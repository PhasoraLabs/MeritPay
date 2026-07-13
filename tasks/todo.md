# MeritPay Build Plan

## Shared Interface Spec (all components must conform)

### Data Model
- Employees: 5 (hardcoded for MVP)
- Epoch: u64 (payroll cycle identifier)
- Base salary: u64 (in XLM stroops, 1 XLM = 10_000_000 stroops)
- Hours threshold: 160 (per epoch)
- Bonus rate: 20% of base if hours_met, +10% if sales_flag

### KPI Circuit (circuits/kpi.circom)
Template: KPIProof
- private: hoursWorked, salesFlag (0|1), salt
- public: employeeId, hoursThreshold, kpiCommitment
- kpiCommitment = Poseidon(employeeId, hoursWorked, salesFlag, salt)
- Constraint: hoursWorked >= hoursThreshold → hours_met
- Proof: employee met KPI criteria without revealing raw data

### Payroll Aggregator Circuit (circuits/payroll_aggregator.circom)
Template: PayrollAggregator(n=5)
- private: baseSalaries[5], hoursWorked[5], salesFlags[5], salts[5]
- public: employeeIds[5], kpiCommitments[5], hoursThresholds[5], totalPayroll, payrollEpoch, nullifiers[5]
- bonus[i] = baseSalaries[i] * (hours_met[i] ? 20 : 0 + salesFlags[i] ? 10 : 0) / 100
- totalPayroll = sum(baseSalaries[i] + bonus[i])
- nullifier[i] = Poseidon(employeeIds[i], payrollEpoch, salts[i])

### Auditor Disclosure Circuit (circuits/auditor_disclosure.circom)
Template: AuditorDisclosure(n=5)
- private: individualPayouts[5]
- public: totalPayroll, budget
- sum(individualPayouts) == totalPayroll
- totalPayroll <= budget

### Soroban Payroll Contract Functions
- fund_pool(env, amount: i128) → ()
- execute_payroll(env, proof: Bytes, vk_hash: BytesN<32>, public_signals: Vec<BytesN<32>>, total_payroll: i128) → bool
- verify_auditor(env, proof: Bytes, vk_hash: BytesN<32>, public_signals: Vec<BytesN<32>>) → bool  
- get_pool_balance(env) → i128
- is_nullifier_spent(env, nullifier: BytesN<32>) → bool
- get_payroll_records(env) → Vec<(u32, i128)>

### Frontend Pages
- / → Landing page (hero, problem, solution, architecture diagram, CTA)
- /employer → Payroll setup (employee table, base salaries, rules)
- /employee → KPI submit (private inputs, proof generation, show commitment)
- /verify → Verify & Release (submit aggregated proof, execute on-chain)
- /auditor → Auditor view (budget check, selective disclosure proof)

### snarkjs Proof Format (for frontend)
```js
const { proof, publicSignals } = await snarkjs.groth16.fullProve(input, wasmPath, zkeyPath)
// proof.pi_a, proof.pi_b, proof.pi_c (BN254 G1/G2 points)
// Serialize for Stellar: each field element as 32-byte big-endian
```

## Build Checklist

### Phase 1: ZK Circuits
- [ ] circuits/kpi.circom
- [ ] circuits/payroll_aggregator.circom
- [ ] circuits/auditor_disclosure.circom
- [ ] circuits/package.json (circomlibjs dep)

### Phase 2: Smart Contracts
- [ ] contracts/groth16_verifier/Cargo.toml
- [ ] contracts/groth16_verifier/src/lib.rs
- [ ] contracts/payroll/Cargo.toml
- [ ] contracts/payroll/src/lib.rs
- [ ] Cargo.toml (workspace root)

### Phase 3: Frontend
- [ ] frontend/package.json
- [ ] frontend/next.config.js
- [ ] frontend/tailwind.config.js
- [ ] frontend/styles/globals.css
- [ ] frontend/lib/proof.ts
- [ ] frontend/lib/stellar.ts
- [ ] frontend/lib/types.ts
- [ ] frontend/components/WalletConnect.tsx
- [ ] frontend/components/ProofBadge.tsx
- [ ] frontend/components/EmployeeCard.tsx
- [ ] frontend/pages/_app.tsx
- [ ] frontend/pages/index.tsx (landing)
- [ ] frontend/pages/employer.tsx
- [ ] frontend/pages/employee.tsx
- [ ] frontend/pages/verify.tsx
- [ ] frontend/pages/auditor.tsx

### Phase 4: Scripts + README
- [ ] scripts/setup.sh
- [ ] scripts/gen_proof.js
- [ ] scripts/deploy.sh
- [ ] README.md

## Results
(filled in after build)
