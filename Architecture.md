# MeritPay — Architecture

## Overview

MeritPay separates payroll into two on-chain steps: a **batch verification** (employer) and a **private individual claim** (employee). Zero-knowledge proofs enforce correctness at both stages without revealing salary or KPI data.

---

## System Diagram

```
Off-chain (browser)                   On-chain (Stellar Soroban)

┌────────────────────────────┐
│  Employer Dashboard        │
│  /employer                 │
│  • configures 5 employees  │
│  • sets baseSalary (XLM)   │
│  • funds pool via Freighter│
└────────────┬───────────────┘
             │ fund_pool(amount)
             ▼
┌────────────────────────────┐         ┌──────────────────────────┐
│  Verify Dashboard          │         │  payroll contract         │
│  /verify                   │         │  (meritpay_payroll)       │
│                            │         │                           │
│  1. generateKPIProof × 5   │         │  execute_payroll(         │
│     (kpi.circom)           │         │    proof, signals,        │
│  2. generatePayrollProof   │────────►│    nullifiers, total)     │
│     (payroll_aggregator    │         │                           │
│      .circom)              │         │  • calls groth16_verifier │
│  3. Execute Payroll btn     │         │    (payroll VK)           │
│     → saves ClaimBundle    │         │  • marks nullifiers spent │
│       to localStorage      │         │  • transfers total XLM   │
└────────────────────────────┘         │    → claim contract       │
                                       └──────────────────────────┘

┌────────────────────────────┐         ┌──────────────────────────┐
│  Employee Portal           │         │  claim contract           │
│  /employee                 │         │                           │
│                            │         │  claim_payout(            │
│  • reads ClaimBundle from  │         │    recipient, proof,      │
│    localStorage            │         │    signals, nullifier,    │
│  • generateClaimProof      │────────►│    amount)                │
│    (claim.circom)          │         │                           │
│  • employee wallet signs   │         │  • calls groth16_verifier │
│    (require_auth)          │         │    (claim VK)             │
│                            │         │  • checks nullifier via   │
│                            │         │    payroll.is_nullifier_  │
│                            │         │    spent()                │
│                            │         │  • asserts signals[2]     │
│                            │         │    == amount (stroops)    │
│                            │         │  • token.transfer →       │
└────────────────────────────┘         │    employee wallet        │
                                       └──────────────────────────┘

┌────────────────────────────┐
│  Auditor Tab               │
│  /auditor                  │
│  • generateAuditorProof    │──► (read-only verify, not a separate tx)
│    (auditor_disclosure     │
│     .circom)               │
│  • budget compliance check │
└────────────────────────────┘
```

---

## Contracts

### `groth16_verifier` (deployed twice)

One instance per circuit type. Each instance stores one verification key (set via `set_vk` after deploy).

| Method | Description |
|--------|-------------|
| `set_vk(vk_bytes)` | Store VK (admin, one-time). VK is serialised as raw bytes: alpha(64) \| beta(128) \| gamma(128) \| delta(128) \| n_ic(4) \| ic[](64 each) |
| `verify(proof_bytes, public_signals)` | Run BN254 Groth16 pairing check. Returns `true`/`false`. |

Wire format for `proof_bytes` (256 bytes): `pi_a.x(32) | pi_a.y(32) | pi_b.x_im(32) | pi_b.x_re(32) | pi_b.y_im(32) | pi_b.y_re(32) | pi_c.x(32) | pi_c.y(32)`

Public signals are passed as `Vec<BytesN<32>>` (each signal as big-endian 32-byte field element).

### `payroll` (meritpay_payroll)

| Method | Who | Description |
|--------|-----|-------------|
| `initialize(admin, verifier, token)` | deployer | One-time setup |
| `fund_pool(funder, amount)` | anyone | Deposit XLM into pool |
| `execute_payroll(caller, proof, signals, nullifiers, total_payroll)` | admin | Verify batch proof, spend nullifiers, transfer escrow to claim contract |
| `set_claim_contract(claim)` | admin | Link claim contract (required before execute_payroll) |
| `is_nullifier_spent(nullifier)` | claim contract | Cross-contract nullifier check |
| `get_pool_balance()` | anyone | Read current pool |
| `get_epoch()` | anyone | Read current epoch |

Error codes: `1=AlreadyInitialized, 2=NotInitialized, 3=Unauthorized, 4=NullifierSpent, 5=InvalidProof, 6=InsufficientFunds, 7=InvalidAmount, 8=ClaimNotConfigured`

### `claim`

| Method | Who | Description |
|--------|-----|-------------|
| `initialize(payroll, verifier, token)` | deployer | One-time setup |
| `claim_payout(recipient, proof, signals, nullifier, amount)` | employee | Verify claim proof, transfer XLM |

`claim_payout` calls `recipient.require_auth()` — the employee's Freighter account must be the transaction signer. It asserts `public_signals[2] == amount` (both in stroops) before the token transfer.

Error codes: `1=AlreadyInitialized, 2=NotInitialized, 3=NullifierNotAuthorized, 4=AlreadyClaimed, 5=InvalidProof, 6=InvalidAmount, 7=InsufficientEscrow, 8=PayrollEpochNotExecuted, 9=SignalMismatch`

---

## Circuits

### `kpi.circom`

Private: `hoursWorked, salesFlag, salt`  
Public inputs (declared in `{public [...]}`): `employeeId, hoursThreshold`  
Public outputs: `kpiCommitment = Poseidon(employeeId, hoursWorked, salesFlag, salt)`, `hoursMet`, `salesMet`  
snarkjs `publicSignals` order: `[kpiCommitment, hoursMet, salesMet, employeeId, hoursThreshold]` (outputs first, then public inputs)

Proves an employee's KPI metrics without revealing raw values. `hoursMet = hoursWorked >= hoursThreshold` (using LessThan gadget).

### `payroll_aggregator.circom` (n=5)

Private: `baseSalaries[5], hoursWorked[5], salesFlags[5], salts[5]`  
Public: `employeeIds[5], hoursThresholds[5], totalPayroll, payrollEpoch, nullifiers[5]`

For each employee:
- Recomputes KPI commitment and checks `nullifier == Poseidon(employeeId, payrollEpoch, salt)`
- Computes `bonusRate = hoursMet*20 + salesMet*10`
- Computes `bonus` via `bonus * 100 === baseSalary * bonusRate` (integer, no floats)
- Accumulates `totalPayroll`

Requires `pot14` (~7 065 constraints, exceeds pot12's 4 096 limit).

### `claim.circom`

Private: `employeeId, salt, baseSalary, hoursWorked, salesFlag, hoursThreshold`  
Public: `nullifier, payrollEpoch, amount`

Proves `nullifier == Poseidon(employeeId, payrollEpoch, salt)` and `amount == baseSalary + bonus` with identical bonus formula. All values in **stroops** (baseSalary × 10 000 before entering the circuit) so `amount` public output matches `token.transfer` expectations.

### `auditor_disclosure.circom` (n=5)

Private: `individualPayouts[5]`  
Public: `totalPayroll, budget`

Proves `sum(individualPayouts) == totalPayroll` and `totalPayroll <= budget` without revealing individual amounts.

---

## Unit System

| Context | Unit | Conversion |
|---------|------|-----------|
| UI display | XLM | — |
| `Employee.baseSalary`, `ClaimEntry` | circuit units | XLM × 1 000 |
| Payroll circuit `baseSalaries[]` | circuit units | same |
| Claim circuit inputs | stroops | circuit units × 10 000 |
| `executePayroll` / `claimPayout` args | stroops | circuit units × 10 000n (BigInt) |
| `token.transfer` | stroops | — |

1 circuit unit = 10 000 stroops = 0.001 XLM.

The `XLM → circuit unit` conversion happens in `verify/page.tsx::toEmployee()` (`baseSalary * 1000`).

The `circuit unit → stroop` scaling for the claim circuit happens in `proof.ts::generateClaimProof()` (inputs multiplied by `STROOPS_PER_UNIT = 10_000` before snarkjs).

---

## Data Flow: Claim Bundle

After `execute_payroll` succeeds, `verify/page.tsx` writes a `ClaimBundle` to `localStorage`:

```typescript
interface ClaimBundle {
  payrollEpoch: number;
  executedAt: number;
  txHash: string;
  entries: ClaimEntry[];    // one per employee
}

interface ClaimEntry {
  employeeId: number;
  name: string;
  nullifier: string;        // decimal field element string from payroll publicSignals[12+i]
  payrollEpoch: number;
  payoutCircuit: number;    // circuit units: baseSalary + bonus
  baseSalary: number;       // circuit units
  hoursThreshold: number;
  kpiInputs: KPIInputs;     // hoursWorked, salesFlag, salt (used to regenerate claim proof)
}
```

The employee page reads this bundle, selects their entry, and regenerates a fresh `ClaimPayout` proof from the stored `kpiInputs`.

---

## Deployment Topology

```
deployer key (stellar keys)
    │
    ├─► groth16_verifier instance A  ← payroll VK uploaded
    │       ↑ called by payroll contract
    │
    ├─► groth16_verifier instance B  ← claim VK uploaded
    │       ↑ called by claim contract
    │
    ├─► payroll contract
    │     • set_claim_contract(claim) ←──────┐
    │     • execute_payroll → escrow ──────────►─┐
    │                                            │
    └─► claim contract ◄──────────────────────────┘
          • claim_payout → employee wallet
```

All four contracts are deployed by `scripts/deploy.sh`. Contract IDs are written to `.env.contracts` and must be copied to `web/.env.local` for the frontend.
