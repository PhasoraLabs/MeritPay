# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Workflow Orchestration

### 1. Plan Node Default
- Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
- If something goes sideways, STOP and re-plan immediately - don't keep pushing
- Use plan mode for verification steps, not just building
- Write detailed specs upfront to reduce ambiguity

### 2. Subagent Strategy
- Use subagents liberally to keep main context window clean
- Offload research, exploration, and parallel analysis to subagents
- For complex problems, throw more compute at it via subagents
- One tack per subagent for focused execution

### 3. Self-Improvement Loop
- After ANY correction from the user: update `tasks/lessons.md` with the pattern
- Write rules for yourself that prevent the same mistake
- Ruthlessly iterate on these lessons until mistake rate drops
- Review lessons at session start for relevant project

### 4. Verification Before Done
- Never mark a task complete without proving it works
- Diff behavior between main and your changes when relevant
- Ask yourself: "Would a staff engineer approve this?"
- Run tests, check logs, demonstrate correctness

### 5. Demand Elegance (Balanced)
- For non-trivial changes: pause and ask "is there a more elegant way?"
- If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
- Skip this for simple, obvious fixes - don't over-engineer
- Challenge your own work before presenting it

### 6. Autonomous Bug Fixing
- When given a bug report: just fix it. Don't ask for hand-holding
- Point at logs, errors, failing tests - then resolve them
- Zero context switching required from the user
- Go fix failing CI tests without being told how

## Task Management

1. **Plan First**: Write plan to `tasks/todo.md` with checkable items
2. **Verify Plan**: Check in before starting implementation
3. **Track Progress**: Mark items complete as you go
4. **Explain Changes**: High-level summary at each step
5. **Document Results**: Add review section to `tasks/todo.md`
6. **Capture Lessons**: Update `tasks/lessons.md` after corrections

## Core Principles

- **Simplicity First**: Make every change as simple as possible. Impact minimal code.
- **No Laziness**: Find root causes. No temporary fixes. Senior developer standards.
- **Minimal Impact**: Changes should only touch what's necessary. Avoid introducing bugs.

---

## Commands

### ZK Circuits

```bash
# First-time: install snarkjs + circomlib
cd circuits && npm install && cd ..

# Compile all circuits + run Groth16 trusted setup + sync WASMs to web/public/
./scripts/setup.sh

# Skip re-downloading the ptau files if already present
SKIP_PTAU=1 ./scripts/setup.sh
```

### Soroban Contracts

```bash
# Add wasm target (one-time)
rustup target add wasm32v1-none

# Build all contracts
cargo build --target wasm32v1-none --release

# Test a specific contract
cargo test -p meritpay-payroll
cargo test -p claim

# Deploy to testnet (creates 'deployer' key, funds it, deploys 4 contracts, writes .env.contracts)
./scripts/deploy.sh

# Upload verification keys manually if deploy skipped them
node scripts/upload_vk.js build/payroll/payroll_aggregator_vkey.json <PAYROLL_VERIFIER_ID>
node scripts/upload_vk.js build/claim/claim_vkey.json <CLAIM_VERIFIER_ID>
```

### Frontend

```bash
cd web
npm install
cp ../.env.contracts .env.local   # populated by deploy.sh
npm run dev     # http://localhost:3000  (uses Turbopack)
npm run build
npm run lint
```

### Stellar Key Management

```bash
stellar keys generate deployer --network testnet   # one-time
stellar keys ls
stellar keys address deployer
stellar keys fund deployer --network testnet        # faucet
```

---

## Architecture

MeritPay is a ZK payroll system: employees prove KPI metrics in zero-knowledge; a batch Groth16 proof releases XLM from a Soroban pool; each employee claims individually with a second proof.

### Repository Layout

```
circuits/           Circom 2.0 circuit sources + package.json (circomlib, snarkjs)
contracts/
  groth16_verifier/ Soroban BN254 Groth16 verifier (used as two separate instances)
  payroll/          Payroll pool contract (batch execute, nullifier management, escrow)
  claim/            Employee claim contract (individual payout, anti-double-claim)
web/                Next.js 16 frontend
  app/
    employer/       Employer dashboard — configure employees, fund pool, KPI inputs
    verify/         Proof generation + Execute Payroll on Stellar (Step 1)
    employee/       Employee portal — claim salary (Step 2)
    auditor/        Auditor disclosure proof
  lib/
    proof.ts        snarkjs wrappers: generateKPIProof, generatePayrollProof,
                    generateClaimProof, generateAuditorProof, serializeProof
    stellar.ts      Soroban SDK wrappers: executePayroll, claimPayout, fundPool, etc.
    claim.ts        Claim bundle helpers: buildClaimEntry, computePayoutCircuit,
                    saveClaimBundle / loadClaimBundle (localStorage)
    types.ts        Shared interfaces: Employee, ClaimEntry, ClaimBundle, MockProof
  public/circuits/  WASM + zkey files served to the browser (synced by setup.sh)
scripts/
  setup.sh          Circuit compilation + Groth16 Phase 2 + ptau download + web sync
  deploy.sh         Contract build + testnet deploy + VK upload + init + fund
  upload_vk.js      Upload a vkey.json to a deployed groth16_verifier contract
build/              Generated artefacts (r1cs, zkey, wasm, vkey.json, solidity_ref/)
.env.contracts      Contract IDs written by deploy.sh; copied to web/.env.local
Cargo.toml          Rust workspace (groth16_verifier, payroll, claim)
```

### Two-Step Payroll Flow

```
Step 1 — Employer (verify page):
  generatePayrollProof()  →  executePayroll()  →  payroll contract
    • verifies PayrollAggregator Groth16 proof
    • marks 5 batch nullifiers spent
    • moves total_payroll XLM from pool → claim contract escrow
    • saves ClaimBundle to localStorage (passed to employees)

Step 2 — Employee (employee page):
  generateClaimProof()  →  claimPayout()  →  claim contract
    • verifies ClaimPayout Groth16 proof
    • checks nullifier against payroll contract (is_nullifier_spent)
    • compares public_signals[2] (amount in stroops) == amount arg
    • token.transfer → employee wallet
    • marks nullifier claimed locally (meritpay:claimed-nullifiers)
```

### Unit System — Critical

Getting units wrong causes `ClaimError::SignalMismatch (#9)`. The rule:

| Layer | Unit | Value for 30 XLM |
|---|---|---|
| Frontend display | XLM | 30 |
| `Employee.baseSalary` / `ClaimEntry` | circuit units | 30 000 (= XLM × 1 000) |
| Claim circuit inputs | stroops | 300 000 000 (= circuit units × 10 000) |
| Soroban `token.transfer` | stroops | 300 000 000 |
| `executePayroll` total | stroops | circuit_units × 10 000n (BigInt) |
| `claimPayout` amount arg | stroops | circuit_units × 10 000n |

The conversion `XLM → circuit units` happens in `verify/page.tsx::toEmployee()`: `baseSalary * 1000`.

The conversion `circuit units → stroops` for the claim circuit happens in `proof.ts::generateClaimProof()`: inputs are multiplied by `STROOPS_PER_UNIT = 10_000` before being fed to snarkjs. This ensures `publicSignals[2]` (the circuit's `amount` output) is already in stroops, matching the `amountStroops` argument sent to `claim_payout`.

### Circuit Public Signals

**KPI** (`kpi.circom`): public signals `[kpiCommitment, hoursMet, salesMet, employeeId, hoursThreshold]` — outputs first, then the two declared-public inputs

**PayrollAggregator** (`payroll_aggregator.circom`): public inputs `employeeIds[5], hoursThresholds[5], totalPayroll, payrollEpoch, nullifiers[5]` → signals at indices `[0..4]=employeeIds, [5..9]=hoursThresholds, [10]=totalPayroll, [11]=payrollEpoch, [12..16]=nullifiers`

**ClaimPayout** (`claim.circom`): public inputs `nullifier, payrollEpoch, amount` → signals at indices `[0]=nullifier, [1]=payrollEpoch, [2]=amount` (all in stroops)

**AuditorDisclosure** (`auditor_disclosure.circom`): public inputs `totalPayroll, budget`

### Soroban Contracts

**`groth16_verifier`** — deployed twice (one VK per circuit type). Stores VK as raw bytes via `set_vk`; exposes `verify(proof_bytes, public_signals)`. Uses Stellar's native BN254 host functions for pairing.

**`payroll`** — admin-only `execute_payroll(caller, proof, signals, nullifiers, total_payroll)`. Checks proof via verifier contract, rejects spent nullifiers, deducts pool, transfers escrow to claim contract. Requires `set_claim_contract` to be called after deploy.

**`claim`** — employee-signed `claim_payout(recipient, proof, signals, nullifier, amount)`. Calls `recipient.require_auth()` — the employee's Freighter must sign. Compares `public_signals[2]` against `amount` (both must be in stroops). Calls `payroll.is_nullifier_spent` to verify the batch was executed.

### Freighter Signing

Always pass `address: publicKey` to `freighter.signTransaction()`. Without it, Freighter signs with its active account which may differ from the tx source → `txBadAuth (-6)`. The `publicKey` for employer flows is the connected wallet; for employee `claimPayout`, it is `recipientAddress`.

### Powers of Tau

- `pot12` (~54 MB) — used by kpi, auditor_disclosure, claim (all < 4096 constraints)
- `pot14` (~220 MB) — required by payroll_aggregator (7065 constraints, which exceeds pot12's 2^12 = 4096 limit)

### Deploy Script Contract Order

`deploy.sh` deploys in this order and wires them together:
1. `groth16_verifier` → upload payroll VK → `VERIFIER_CONTRACT_ID`
2. `groth16_verifier` (second instance) → upload claim VK → `CLAIM_VERIFIER_CONTRACT_ID`
3. `payroll` → initialize(admin, verifier, XLM token) → `PAYROLL_CONTRACT_ID`
4. `claim` → initialize(payroll, claim_verifier, XLM token) → `CLAIM_CONTRACT_ID`
5. `payroll.set_claim_contract(claim)` — links payroll → claim
6. `payroll.fund_pool(10 XLM)` — seeds the pool

Contract IDs are written to `.env.contracts`; copy to `web/.env.local` to use them in the frontend.
