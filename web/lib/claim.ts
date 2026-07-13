import type { ClaimBundle, ClaimEntry, KPIInputs } from './types';
import { CLAIM_BUNDLE_KEY } from './types';

const CIRCUIT_UNIT_XLM = 0.001;

export function computePayoutCircuit(
  baseSalary: number,
  hoursMet: boolean,
  salesMet: boolean,
): number {
  const bonusRate = (hoursMet ? 20 : 0) + (salesMet ? 10 : 0);
  const bonus = Math.floor(baseSalary * bonusRate / 100);
  return baseSalary + bonus;
}

export function payoutCircuitToXlm(payoutCircuit: number): number {
  return payoutCircuit * CIRCUIT_UNIT_XLM;
}

export function payoutCircuitToStroops(payoutCircuit: number): bigint {
  return BigInt(Math.round(payoutCircuit)) * 10000n;
}

export function saveClaimBundle(bundle: ClaimBundle): void {
  localStorage.setItem(CLAIM_BUNDLE_KEY, JSON.stringify(bundle));
}

export function loadClaimBundle(): ClaimBundle | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem(CLAIM_BUNDLE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ClaimBundle;
  } catch {
    return null;
  }
}

export function buildClaimEntry(params: {
  employeeId: number;
  name: string;
  nullifier: string;
  payrollEpoch: number;
  baseSalary: number;
  hoursThreshold: number;
  kpiInputs: KPIInputs;
  hoursMet: boolean;
  salesMet: boolean;
}): ClaimEntry {
  return {
    employeeId: params.employeeId,
    name: params.name,
    nullifier: params.nullifier,
    payrollEpoch: params.payrollEpoch,
    payoutCircuit: computePayoutCircuit(
      params.baseSalary,
      params.hoursMet,
      params.salesMet,
    ),
    baseSalary: params.baseSalary,
    hoursThreshold: params.hoursThreshold,
    kpiInputs: params.kpiInputs,
  };
}

export function isEntryClaimed(nullifier: string): boolean {
  const raw = localStorage.getItem('meritpay:claimed-nullifiers');
  if (!raw) return false;
  try {
    const list = JSON.parse(raw) as string[];
    return list.includes(nullifier);
  } catch {
    return false;
  }
}

export function markEntryClaimed(nullifier: string): void {
  const raw = localStorage.getItem('meritpay:claimed-nullifiers');
  const list: string[] = raw ? JSON.parse(raw) : [];
  if (!list.includes(nullifier)) {
    list.push(nullifier);
    localStorage.setItem('meritpay:claimed-nullifiers', JSON.stringify(list));
  }
}
