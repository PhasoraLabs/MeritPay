// ── Core employee record ──────────────────────────────────────────────────────
export interface Employee {
  id: number;
  name: string;
  baseSalary: number; // in circuit units (1 unit = 0.001 XLM = 10_000 stroops)
  hoursThreshold: number;
  bonusRate?: number; // 0.0–0.5
  role?: string;
}

// ── KPI proof inputs ──────────────────────────────────────────────────────────
export interface KPIInputs {
  employeeId: number;
  hoursWorked: number;
  salesFlag: 0 | 1;
  salt: string;
}

// ── KPI proof result ──────────────────────────────────────────────────────────
export interface KPIResult {
  commitment: string;       // decimal Poseidon hash (publicSignals[0])
  hoursMet: boolean;        // publicSignals[1] === '1'
  salesMet: boolean;        // publicSignals[2] === '1'
  proof: MockProof;         // real Groth16 proof (decimal field element strings)
  publicSignals: string[];  // raw snarkjs public signals
  inputs: KPIInputs;        // original inputs (needed by payroll circuit)
  proofTime?: number;
}

// ── snarkjs-compatible mock proof ────────────────────────────────────────────
export interface MockProof {
  pi_a: string[];
  pi_b: string[][];
  pi_c: string[];
  protocol: 'groth16';
  curve: 'bn128';
}

// ── Payroll summary ───────────────────────────────────────────────────────────
export interface PayrollSummary {
  employees: Employee[];
  payouts: number[];
  totalPayroll: number;
  epoch: number;
  proof?: MockProof;
  publicSignals?: string[];
  nullifiers?: string[];
}

// ── Post-payroll claim bundle (saved after execute_payroll) ───────────────────
export interface ClaimEntry {
  employeeId: number;
  name: string;
  nullifier: string;
  payrollEpoch: number;
  payoutCircuit: number;
  baseSalary: number;
  hoursThreshold: number;
  kpiInputs: KPIInputs;
}

export interface ClaimBundle {
  payrollEpoch: number;
  executedAt: number;
  txHash: string;
  entries: ClaimEntry[];
}

export const CLAIM_BUNDLE_KEY = 'meritpay:claim-bundle';

// ── UI proof state per employee ───────────────────────────────────────────────
export interface EmployeeProofState {
  status: 'pending' | 'generating' | 'proved' | 'error';
  result?: KPIResult;
  error?: string;
}

// ── Mock data (clearly labeled) ───────────────────────────────────────────────
export const MOCK_EMPLOYEES: Employee[] = [
  { id: 1, name: 'Alice', baseSalary: 5000, hoursThreshold: 160, bonusRate: 0.20, role: 'Lead Engineer'       },
  { id: 2, name: 'Bob',   baseSalary: 4200, hoursThreshold: 160, bonusRate: 0.15, role: 'Product Designer'    },
  { id: 3, name: 'Carol', baseSalary: 4800, hoursThreshold: 160, bonusRate: 0.18, role: 'Protocol Researcher' },
  { id: 4, name: 'Dave',  baseSalary: 3900, hoursThreshold: 140, bonusRate: 0.12, role: 'DevOps Engineer'     },
  { id: 5, name: 'Eve',   baseSalary: 5500, hoursThreshold: 160, bonusRate: 0.25, role: 'Head of Growth'      },
];

export const MOCK_PAYROLL_EPOCH = 202506;
