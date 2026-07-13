'use client';

import type { KPIInputs, KPIResult, MockProof, Employee } from './types';
import { MOCK_EMPLOYEES } from './types';

// ── Byte helpers (browser-safe) ───────────────────────────────────────────────

function bigIntToBytes32(n: bigint): Uint8Array {
  const hex = n.toString(16).padStart(64, '0');
  const out = new Uint8Array(32);
  for (let i = 0; i < 32; i++) {
    out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

// Serialize a Groth16 proof to 256 bytes for Soroban.
// Wire format: pi_a.x(32) | pi_a.y(32) | pi_b.x_im(32) | pi_b.x_re(32) | pi_b.y_im(32) | pi_b.y_re(32) | pi_c.x(32) | pi_c.y(32)
export function serializeProof(proof: MockProof): Uint8Array {
  const out = new Uint8Array(256);
  let off = 0;
  const write = (s: string) => { out.set(bigIntToBytes32(BigInt(s)), off); off += 32; };

  write(proof.pi_a[0]);
  write(proof.pi_a[1]);
  // G2: snarkjs stores [c0, c1] where element = c0 + c1*i, but wire format is im(c1) first
  write(proof.pi_b[0][1]); // x_im
  write(proof.pi_b[0][0]); // x_re
  write(proof.pi_b[1][1]); // y_im
  write(proof.pi_b[1][0]); // y_re
  write(proof.pi_c[0]);
  write(proof.pi_c[1]);
  return out;
}

// Serialize a VK JSON (from snarkjs) to the wire format expected by the contract.
// VK wire format: alpha(64) | beta(128) | gamma(128) | delta(128) | n_ic(4) | ic[](64 each)
export function serializeVK(vkey: Record<string, unknown>): Uint8Array {
  const vk = vkey as {
    vk_alpha_1: string[];
    vk_beta_2: string[][];
    vk_gamma_2: string[][];
    vk_delta_2: string[][];
    IC: string[][];
  };
  const n_ic = vk.IC.length;
  const buf = new Uint8Array(452 + n_ic * 64);
  let off = 0;

  const writeG1 = (p: string[]) => {
    buf.set(bigIntToBytes32(BigInt(p[0])), off); off += 32;
    buf.set(bigIntToBytes32(BigInt(p[1])), off); off += 32;
  };
  const writeG2 = (p: string[][]) => {
    // wire: x_im(32) | x_re(32) | y_im(32) | y_re(32)
    buf.set(bigIntToBytes32(BigInt(p[0][1])), off); off += 32; // x_im
    buf.set(bigIntToBytes32(BigInt(p[0][0])), off); off += 32; // x_re
    buf.set(bigIntToBytes32(BigInt(p[1][1])), off); off += 32; // y_im
    buf.set(bigIntToBytes32(BigInt(p[1][0])), off); off += 32; // y_re
  };

  writeG1(vk.vk_alpha_1);    // [0..64)
  writeG2(vk.vk_beta_2);     // [64..192)
  writeG2(vk.vk_gamma_2);    // [192..320)
  writeG2(vk.vk_delta_2);    // [320..448)
  // n_ic as big-endian u32
  buf[off++] = (n_ic >> 24) & 0xff;
  buf[off++] = (n_ic >> 16) & 0xff;
  buf[off++] = (n_ic >> 8) & 0xff;
  buf[off++] = n_ic & 0xff;
  for (const ic of vk.IC) writeG1(ic);

  return buf;
}

// Convert a public signal (decimal BigInt string) to a 32-byte big-endian buffer.
export function signalToBytes32(signal: string): Uint8Array {
  return bigIntToBytes32(BigInt(signal));
}

// ── snarkjs loader (lazy, browser-only) ───────────────────────────────────────

async function snarkjs() {
  // Dynamic import avoids SSR issues; snarkjs is browser-safe
  const mod = await import('snarkjs');
  return mod.default ?? mod;
}

async function poseidonFn() {
  const mod = await import('circomlibjs');
  return mod.buildPoseidon();
}

// Salt string (hex 0x-prefixed) → BigInt decimal string for circuit
function saltToField(salt: string): string {
  return BigInt(salt).toString();
}

// ── Commitment ────────────────────────────────────────────────────────────────

export async function generateCommitment(
  employeeId: number,
  hoursWorked: number,
  salesFlag: 0 | 1,
  salt: string,
): Promise<string> {
  const poseidon = await poseidonFn();
  const hash = poseidon([
    BigInt(employeeId),
    BigInt(hoursWorked),
    BigInt(salesFlag),
    BigInt(salt),
  ]);
  return poseidon.F.toString(hash);
}

// ── KPI Proof ─────────────────────────────────────────────────────────────────

export async function generateKPIProof(inputs: KPIInputs): Promise<KPIResult> {
  const start = Date.now();
  const { employeeId, hoursWorked, salesFlag, salt } = inputs;

  const emp = MOCK_EMPLOYEES.find(e => e.id === employeeId);
  const hoursThreshold = emp?.hoursThreshold ?? 160;

  const sjs = await snarkjs() as { groth16: { fullProve: (input: unknown, wasm: string, zkey: string) => Promise<{ proof: MockProof; publicSignals: string[] }> } };

  const circuitInput = {
    hoursWorked: hoursWorked.toString(),
    salesFlag: salesFlag.toString(),
    salt: saltToField(salt),
    employeeId: employeeId.toString(),
    hoursThreshold: hoursThreshold.toString(),
  };

  const { proof, publicSignals } = await sjs.groth16.fullProve(
    circuitInput,
    '/circuits/kpi/kpi.wasm',
    '/circuits/kpi/kpi_final.zkey',
  );

  // Public signals: [kpiCommitment, hoursMet, salesMet, employeeId, hoursThreshold]
  const commitment = publicSignals[0];
  const hoursMet = publicSignals[1] === '1';
  const salesMet = publicSignals[2] === '1';

  return {
    commitment,
    hoursMet,
    salesMet,
    proof,
    publicSignals,
    inputs,
    proofTime: Date.now() - start,
  };
}

// ── Payroll Aggregator Proof ──────────────────────────────────────────────────

// Circuit baseSalary scale: MOCK_EMPLOYEES.baseSalary values (5000, 4200…) used directly.
// All are divisible by 100, so the bonus/100 constraint holds as integers.
// 1 circuit unit = 10_000 stroops = 0.001 XLM on chain.

const CIRCUIT_SLOTS = 5;

export async function generatePayrollProof(
  employees: Employee[],
  kpiResults: KPIResult[],
  epoch: number,
): Promise<{ proof: MockProof; publicSignals: string[]; totalPayroll: number }> {
  const poseidon = await poseidonFn();
  const sjs = await snarkjs() as { groth16: { fullProve: (input: unknown, wasm: string, zkey: string) => Promise<{ proof: MockProof; publicSignals: string[] }> } };

  const n = employees.length;
  const baseSalaries: string[] = [];
  const hoursWorkedArr: string[] = [];
  const salesFlagsArr: string[] = [];
  const saltsArr: string[] = [];
  const employeeIds: string[] = [];
  const hoursThresholds: string[] = [];
  const nullifiers: string[] = [];

  for (let i = 0; i < n; i++) {
    const emp = employees[i];
    const kr = kpiResults[i];
    const saltField = saltToField(kr.inputs.salt);

    baseSalaries.push(emp.baseSalary.toString());
    hoursWorkedArr.push(kr.inputs.hoursWorked.toString());
    salesFlagsArr.push(kr.inputs.salesFlag.toString());
    saltsArr.push(saltField);
    employeeIds.push(emp.id.toString());
    hoursThresholds.push(emp.hoursThreshold.toString());

    // nullifier = Poseidon(employeeId, payrollEpoch, salt)
    const nul = poseidon([BigInt(emp.id), BigInt(epoch), BigInt(saltField)]);
    nullifiers.push(poseidon.F.toString(nul));
  }

  // Guard: the circuit computes 1/baseSalary for each slot; 0 causes "Bad union switch" in WASM.
  for (let i = 0; i < n; i++) {
    if (!employees[i].baseSalary || employees[i].baseSalary <= 0) {
      throw new Error(`Employee "${employees[i].name}" has baseSalary = 0. All employees must have a positive salary.`);
    }
  }

  // Pad to CIRCUIT_SLOTS. The circuit enforces baseSalary != 0 via an
  // inverse check (line 180), so dummy slots use baseSalary=1 with
  // hoursWorked=0 and salesFlag=0 → bonus=0 → payout=1 each.
  for (let i = n; i < CIRCUIT_SLOTS; i++) {
    const dummyId = 1000 + i; // distinct IDs to avoid nullifier collisions
    const dummySalt = '1';
    baseSalaries.push('1');   // non-zero: satisfies invSalary constraint
    hoursWorkedArr.push('0'); // 0 < threshold(1) → hoursMet=0 → bonus=0
    salesFlagsArr.push('0');
    saltsArr.push(dummySalt);
    employeeIds.push(dummyId.toString());
    hoursThresholds.push('1');
    const nul = poseidon([BigInt(dummyId), BigInt(epoch), BigInt(dummySalt)]);
    nullifiers.push(poseidon.F.toString(nul));
  }

  // Compute totalPayroll matching circuit logic (real employees + dummy slots).
  // Dummy payout = baseSalary(1) + bonus(0) = 1 each.
  let totalCircuit = CIRCUIT_SLOTS - n; // dummy contributions
  for (let i = 0; i < n; i++) {
    const base = employees[i].baseSalary;
    const hm = kpiResults[i].hoursMet ? 1 : 0;
    const sm = kpiResults[i].inputs.salesFlag;
    const bonusRate = hm * 20 + sm * 10;
    const bonus = Math.floor(base * bonusRate / 100);
    totalCircuit += base + bonus;
  }

  const circuitInput = {
    baseSalaries,
    hoursWorked: hoursWorkedArr,
    salesFlags: salesFlagsArr,
    salts: saltsArr,
    employeeIds,
    hoursThresholds,
    totalPayroll: totalCircuit.toString(),
    payrollEpoch: epoch.toString(),
    nullifiers,
  };

  console.log('[proof] payroll circuit input:', JSON.stringify({
    baseSalaries,
    hoursWorked: hoursWorkedArr,
    salesFlags: salesFlagsArr,
    employeeIds,
    hoursThresholds,
    totalPayroll: totalCircuit.toString(),
    payrollEpoch: epoch.toString(),
    // salts and nullifiers are large; just show lengths
    saltsLen: saltsArr.length,
    nullifiersLen: nullifiers.length,
  }));

  console.log('[proof] calling groth16.fullProve for payroll aggregator...');
  const { proof, publicSignals } = await sjs.groth16.fullProve(
    circuitInput,
    '/circuits/payroll/payroll_aggregator.wasm',
    '/circuits/payroll/payroll_aggregator_final.zkey',
  );

  return { proof, publicSignals, totalPayroll: totalCircuit };
}

// ── Employee Claim Proof ──────────────────────────────────────────────────────
// Public signals: [nullifier, payrollEpoch, amount]

export async function generateClaimProof(params: {
  employeeId: number;
  payrollEpoch: number;
  baseSalary: number;
  hoursThreshold: number;
  hoursWorked: number;
  salesFlag: 0 | 1;
  salt: string;
  payoutCircuit: number;
}): Promise<{ proof: MockProof; publicSignals: string[] }> {
  const poseidon = await poseidonFn();
  const sjs = await snarkjs() as { groth16: { fullProve: (input: unknown, wasm: string, zkey: string) => Promise<{ proof: MockProof; publicSignals: string[] }> } };

  const saltField = saltToField(params.salt);
  const nullifier = poseidon([
    BigInt(params.employeeId),
    BigInt(params.payrollEpoch),
    BigInt(saltField),
  ]);
  const nullifierStr = poseidon.F.toString(nullifier);

  // The claim circuit uses the same formula as the payroll circuit:
  //   amount = baseSalary + floor(baseSalary * bonusRate / 100)
  // The contract then calls token.transfer(…, amount) directly (in stroops).
  // So baseSalary and amount must both be in stroops here.
  // Our ClaimEntry stores values in circuit units (1 unit = 10_000 stroops = 0.001 XLM),
  // so we scale by 10_000 before entering the circuit.
  const STROOPS_PER_UNIT = 10_000;
  const circuitInput = {
    employeeId: params.employeeId.toString(),
    salt: saltField,
    baseSalary: (params.baseSalary * STROOPS_PER_UNIT).toString(),
    hoursWorked: params.hoursWorked.toString(),
    salesFlag: params.salesFlag.toString(),
    hoursThreshold: params.hoursThreshold.toString(),
    nullifier: nullifierStr,
    payrollEpoch: params.payrollEpoch.toString(),
    amount: (params.payoutCircuit * STROOPS_PER_UNIT).toString(),
  };

  const { proof, publicSignals } = await sjs.groth16.fullProve(
    circuitInput,
    '/circuits/claim/claim.wasm',
    '/circuits/claim/claim_final.zkey',
  );

  return { proof, publicSignals };
}

// ── Auditor Budget-Compliance Proof ──────────────────────────────────────────

// Scale: XLM → centi-XLM (×100) for integer arithmetic in circuit.
export async function generateAuditorProof(
  totalPayroll: number, // XLM
  budget: number,       // XLM
): Promise<{ proof: MockProof; withinBudget: boolean; publicSignals: string[] }> {
  const withinBudget = totalPayroll <= budget;
  if (!withinBudget) {
    // Cannot generate a valid proof when constraint would fail
    throw new Error(`Total payroll (${totalPayroll.toFixed(2)} XLM) exceeds budget (${budget.toFixed(2)} XLM) — proof is impossible`);
  }

  const sjs = await snarkjs() as { groth16: { fullProve: (input: unknown, wasm: string, zkey: string) => Promise<{ proof: MockProof; publicSignals: string[] }> } };

  const SCALE = 100;
  const totalCircuit = Math.round(totalPayroll * SCALE);
  const budgetCircuit = Math.round(budget * SCALE);

  // Split totalPayroll evenly across 5 employees (private inputs)
  const n = 5;
  const evenPayout = Math.floor(totalCircuit / n);
  const remainder = totalCircuit - evenPayout * n;
  const payouts = Array.from({ length: n }, (_, i) =>
    (evenPayout + (i < remainder ? 1 : 0)).toString()
  );

  const { proof, publicSignals } = await sjs.groth16.fullProve(
    {
      individualPayouts: payouts,
      totalPayroll: totalCircuit.toString(),
      budget: budgetCircuit.toString(),
    },
    '/circuits/auditor/auditor_disclosure.wasm',
    '/circuits/auditor/auditor_disclosure_final.zkey',
  );

  return { proof, withinBudget: true, publicSignals };
}

// ── Display helpers ───────────────────────────────────────────────────────────

export function formatProofForDisplay(proof: MockProof): {
  piA: string;
  piB: string;
  piC: string;
} {
  const trunc = (s: string) => s.slice(0, 14) + '…' + s.slice(-6);
  const fmtG1 = (p: string[]) => `[${trunc(p[0])}, ${trunc(p[1])}]`;
  const fmtG2 = (p: string[][]) =>
    `[[${trunc(p[0][0])}, ${trunc(p[0][1])}], [${trunc(p[1][0])}, ${trunc(p[1][1])}]]`;

  return { piA: fmtG1(proof.pi_a), piB: fmtG2(proof.pi_b), piC: fmtG1(proof.pi_c) };
}

export function generateSalt(): string {
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  const hex = Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  return '0x' + hex;
}

export function truncateHash(hash: string, prefixLen = 10, suffixLen = 8): string {
  if (!hash || hash.length <= prefixLen + suffixLen + 1) return hash;
  return `${hash.slice(0, prefixLen)}…${hash.slice(-suffixLen)}`;
}

export function computePayout(baseSalary: number, hoursMet: boolean, salesMet: boolean): number {
  return Math.round(baseSalary * (1 + (hoursMet ? 0.20 : 0) + (salesMet ? 0.10 : 0)));
}
