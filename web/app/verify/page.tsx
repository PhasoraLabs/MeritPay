'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { KPIResult, MockProof, Employee } from '@/lib/types';
import {
  generateKPIProof,
  generatePayrollProof,
  generateSalt,
  formatProofForDisplay,
} from '@/lib/proof';
import { executePayroll, explorerTxUrl, getEpoch } from '@/lib/stellar';
import { buildClaimEntry, saveClaimBundle } from '@/lib/claim';
import ProofBadge from '@/components/ProofBadge';
import EmployeeCard from '@/components/EmployeeCard';
import WalletConnect from '@/components/WalletConnect';

type EmpStatus = 'pending' | 'proved';
type AggState = 'idle' | 'generating' | 'ready';
type TxState = 'idle' | 'sending' | 'success' | 'error';

interface EmpProofEntry {
  status: EmpStatus;
  result?: KPIResult;
}

// Shape saved by the employer dashboard
interface EmployeeConfig {
  id: number;
  name: string;
  baseSalary: number;
  hoursThreshold: number;
  hoursBonus: number;
  salesBonus: number;
}

const CIRCUIT_UNIT_XLM = 0.001;
const ADMIN_ADDRESS = process.env.NEXT_PUBLIC_ADMIN_ADDRESS ?? '';

// The payroll circuit works in "circuit units" where 1 unit = 0.001 XLM.
// The employer dashboard inputs are in whole XLM, so we convert here.
function toEmployee(c: EmployeeConfig): Employee {
  return {
    id: c.id,
    name: c.name,
    baseSalary: Math.round(c.baseSalary * 1000), // XLM → circuit units
    hoursThreshold: c.hoursThreshold,
  };
}

function configPayout(emp: EmployeeConfig, result?: KPIResult): number {
  if (!result) return emp.baseSalary + emp.hoursBonus + emp.salesBonus;
  return emp.baseSalary + (result.hoursMet ? emp.hoursBonus : 0) + (result.salesMet ? emp.salesBonus : 0);
}

export default function VerifyPage() {
  const [employees, setEmployees] = useState<EmployeeConfig[]>([]);
  const [configLoaded, setConfigLoaded] = useState(false);

  const [empProofs, setEmpProofs] = useState<EmpProofEntry[]>([]);
  const [generating, setGenerating] = useState(false);

  const [aggState, setAggState] = useState<AggState>('idle');
  const [aggProof, setAggProof] = useState<MockProof | null>(null);
  const [publicSignals, setPublicSignals] = useState<string[]>([]);
  const [totalPayroll, setTotalPayroll] = useState<number>(0);

  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [txState, setTxState] = useState<TxState>('idle');
  const [txHash, setTxHash] = useState('');
  const [txError, setTxError] = useState('');
  const [chainEpoch, setChainEpoch] = useState<number>(0);

  const isAdminWallet = !!walletAddress && walletAddress === ADMIN_ADDRESS;
  const nextPayrollEpoch = chainEpoch + 1;

  // Load employer config from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('meritpay:payroll-config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as EmployeeConfig[];
        if (parsed.length) {
          setEmployees(parsed);
          setEmpProofs(parsed.map(() => ({ status: 'pending' })));
        }
      } catch { /* ignore */ }
    }
    setConfigLoaded(true);
  }, []);

  useEffect(() => {
    getEpoch().then(setChainEpoch).catch(() => {});
  }, []);

  const allProved = empProofs.length > 0 && empProofs.every(e => e.status === 'proved');
  const readyProofs = empProofs.filter(e => e.result).map(e => e.result!);

  const handleGenerateAllProofs = async () => {
    setGenerating(true);
    const updated = empProofs.map(e => ({ ...e }));
    const promises = employees.map(async (emp, idx) => {
      const result = await generateKPIProof({
        employeeId: emp.id,
        hoursWorked: emp.hoursThreshold + Math.floor(Math.random() * 40),
        salesFlag: Math.random() > 0.4 ? 1 : 0,
        salt: generateSalt(),
      });
      updated[idx] = { status: 'proved', result };
      setEmpProofs([...updated]);
    });
    await Promise.all(promises);
    setGenerating(false);
  };

  const handleGenerateAggProof = async () => {
    setAggState('generating');
    try {
      const epoch = await getEpoch();
      setChainEpoch(epoch);
      const payrollEpoch = epoch + 1;
      const { proof, publicSignals: sigs, totalPayroll: total } = await generatePayrollProof(
        employees.map(toEmployee),
        empProofs.map(e => e.result!),
        payrollEpoch,
      );
      setAggProof(proof);
      setPublicSignals(sigs);
      setTotalPayroll(total);
      setAggState('ready');
      setEmpProofs(prev => prev.map(e => ({ ...e, status: 'proved' as EmpStatus })));
    } catch (e) {
      console.error(e);
      setAggState('idle');
    }
  };

  const handleExecutePayroll = async () => {
    if (!aggProof) return;
    setTxState('sending');
    setTxError('');
    try {
      const hash = await executePayroll(aggProof, publicSignals, totalPayroll);
      const payrollEpoch = Number(publicSignals[11]);
      const entries = employees.map((emp, idx) => {
        const result = empProofs[idx]?.result;
        if (!result) throw new Error('Missing KPI proof for claim bundle');
        return buildClaimEntry({
          employeeId: emp.id,
          name: emp.name,
          nullifier: publicSignals[12 + idx],
          payrollEpoch,
          baseSalary: Math.round(emp.baseSalary * 1000), // XLM → circuit units (must match circuit)
          hoursThreshold: emp.hoursThreshold,
          kpiInputs: result.inputs,
          hoursMet: result.hoursMet,
          salesMet: result.salesMet,
        });
      });
      saveClaimBundle({
        payrollEpoch,
        executedAt: Date.now(),
        txHash: hash,
        entries,
      });
      setTxHash(hash);
      setTxState('success');
      setChainEpoch(prev => prev + 1);
      setAggState('idle');
      setAggProof(null);
    } catch (e) {
      setTxError(e instanceof Error ? e.message : 'Transaction failed');
      setTxState('error');
    }
  };

  const displayProof = aggProof ? formatProofForDisplay(aggProof) : null;

  // ── Empty / loading states ────────────────────────────────────────────────────

  if (!configLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#7A6F63]">
          <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading config…
        </div>
      </div>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-full bg-[#2E2924] flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-[#7A6F63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h2 className="font-mono font-bold text-xl text-[#E8DFD0] mb-2">No payroll config found</h2>
          <p className="text-[#7A6F63] text-sm mb-6 leading-relaxed">
            Configure your employees on the Employer Dashboard first, then save the config before proceeding here.
          </p>
          <Link
            href="/employer"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C8A55A] text-[#0C0A09] font-semibold text-sm hover:bg-[#D8B86A] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 17l-5-5m0 0l5-5m-5 5h12" />
            </svg>
            Go to Employer Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // ── Main page ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen px-4 py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#C8A55A]/20 border border-[#C8A55A]/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#C8A55A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
          <h1 className="font-mono font-bold text-2xl text-[#E8DFD0]">Verify & Release Payroll</h1>
        </div>
        <div className="ml-11 flex items-center gap-3">
          <p className="text-[#7A6F63] text-sm">
            {employees.length} employee{employees.length !== 1 ? 's' : ''} · loaded from employer config
            · next payroll epoch <span className="font-mono text-[#C8A55A]">#{nextPayrollEpoch}</span>
          </p>
          <Link href="/employer" className="text-[#C8A55A] text-xs hover:underline">Edit config →</Link>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left: Employee proofs + aggregated proof */}
        <div className="lg:col-span-2 space-y-5">

          {/* Step 1: Employee KPI Proofs */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2E2924] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#C8A55A]/20 border border-[#C8A55A]/40 text-[#C8A55A] font-mono text-xs flex items-center justify-center font-bold">1</span>
                <h2 className="font-mono font-semibold text-[#E8DFD0]">Employee KPI Proofs</h2>
              </div>
              {!allProved && (
                <button
                  onClick={handleGenerateAllProofs}
                  disabled={generating}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C8A55A]/20 border border-[#C8A55A]/40 text-[#D8B86A] text-xs font-medium hover:bg-[#C8A55A]/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generating ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Generating…
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Generate All KPI Proofs
                    </>
                  )}
                </button>
              )}
            </div>
            <div className="p-4 space-y-3">
              {employees.map((emp, i) => (
                <EmployeeCard
                  key={emp.id}
                  employee={toEmployee(emp)}
                  status={empProofs[i]?.status ?? 'pending'}
                  kpiResult={empProofs[i]?.result}
                />
              ))}
            </div>
            {!allProved && (
              <div className="px-4 pb-4">
                <p className="text-[#7A6F63] text-xs text-center">
                  Or go to the{' '}
                  <Link href="/employee" className="text-[#C8A55A] hover:underline">Employee Portal</Link>
                  {' '}to generate proofs individually
                </p>
              </div>
            )}
          </div>

          {/* Step 2: Aggregated Payroll Proof */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2E2924] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-[#5A9B78]/20 border border-[#5A9B78]/40 text-[#5A9B78] font-mono text-xs flex items-center justify-center font-bold">2</span>
                <h2 className="font-mono font-semibold text-[#E8DFD0]">Aggregated Payroll Proof</h2>
              </div>
              {allProved && aggState === 'idle' && (
                <button
                  onClick={handleGenerateAggProof}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#5A9B78]/20 border border-[#5A9B78]/40 text-[#5A9B78] text-xs font-medium hover:bg-[#5A9B78]/30 transition-all cursor-pointer"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Aggregated Proof
                </button>
              )}
            </div>

            <div className="p-6">
              {aggState === 'idle' && !allProved && (
                <p className="text-[#7A6F63] text-sm text-center py-4">
                  All employee KPI proofs must be generated first
                </p>
              )}
              {aggState === 'idle' && allProved && (
                <p className="text-[#7A6F63] text-sm text-center py-4">
                  All proofs ready — click Generate Aggregated Proof above
                </p>
              )}
              {aggState === 'generating' && (
                <div className="flex flex-col items-center py-6 text-center">
                  <svg className="w-10 h-10 text-[#5A9B78] animate-spin-slow mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" strokeDasharray="6 4" />
                    <circle className="opacity-75" cx="12" cy="12" r="10" stroke="#C8A55A" strokeWidth="2" strokeDasharray="2 8" />
                  </svg>
                  <p className="font-mono text-[#5A9B78] font-semibold">Running Payroll Aggregator Circuit…</p>
                  <p className="text-[#7A6F63] text-xs mt-2">Groth16 proof over {readyProofs.length} employee commitments</p>
                </div>
              )}
              {aggState === 'ready' && displayProof && (
                <div className="space-y-4 animate-fade-in">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: 'Protocol', value: 'Groth16' },
                      { label: 'Curve', value: 'BN254' },
                      { label: 'Inputs', value: `${employees.length} employees` },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924] text-center">
                        <p className="text-[#7A6F63] text-xs font-mono mb-1">{label}</p>
                        <p className="text-[#5A9B78] font-mono font-semibold text-sm">{value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: 'π_a', value: displayProof.piA },
                      { label: 'π_b', value: displayProof.piB },
                      { label: 'π_c', value: displayProof.piC },
                    ].map(({ label, value }) => (
                      <div key={label} className="p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924]">
                        <span className="text-[#C8A55A] font-mono text-xs mr-2">{label}:</span>
                        <span className="font-mono text-xs text-[#7A6F63] break-all">{value}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924]">
                    <p className="text-[#7A6F63] text-xs font-mono mb-2">Public Signals:</p>
                    <div className="flex flex-wrap gap-2">
                      {publicSignals.map((s, i) => (
                        <span key={i} className="font-mono text-xs text-[#5A9B78] bg-[#5A9B78]/10 px-2 py-0.5 rounded border border-[#5A9B78]/20">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Summary + execution */}
        <div className="space-y-4">
          {/* Payroll summary */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-5">
            <h3 className="font-mono font-semibold text-[#E8DFD0] mb-4">Payroll Summary</h3>
            <div className="space-y-2 mb-4">
              {employees.map((emp, i) => {
                const payout = configPayout(emp, empProofs[i]?.result);
                const proved = empProofs[i]?.status === 'proved';
                return (
                  <div key={emp.id} className="flex items-center justify-between py-1.5 border-b border-[#2E2924]/60 last:border-0">
                    <div>
                      <span className="text-[#7A6F63] text-sm">{emp.name}</span>
                      {proved && empProofs[i]?.result && (
                        <div className="flex gap-1 mt-0.5">
                          {empProofs[i].result!.hoursMet && (
                            <span className="text-[#5A9B78] text-[10px] font-mono">+hrs</span>
                          )}
                          {empProofs[i].result!.salesMet && (
                            <span className="text-[#C8A55A] text-[10px] font-mono">+sales</span>
                          )}
                        </div>
                      )}
                    </div>
                    <span className={`font-mono text-sm ${proved ? 'text-[#E8DFD0]' : 'text-[#4A433C]'}`}>
                      {payout.toFixed(2)} XLM
                    </span>
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-[#2E2924]">
              <span className="font-mono font-semibold text-[#E8DFD0]">Total</span>
              <span className="font-mono font-bold text-lg text-[#C8A55A]">
                {aggState === 'ready'
                  ? (totalPayroll * CIRCUIT_UNIT_XLM).toFixed(2)
                  : employees.reduce((acc, emp, i) => acc + configPayout(emp, empProofs[i]?.result), 0).toFixed(2)
                } XLM
              </span>
            </div>
          </div>

          {/* Proof badge */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-5 flex flex-col items-center">
            <ProofBadge
              verified={aggState === 'ready'}
              label={aggState === 'ready' ? 'PROOF READY' : 'AWAITING PROOF'}
              size="sm"
            />
          </div>

          {/* Wallet + execution */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-5">
            <h3 className="font-mono font-semibold text-[#E8DFD0] mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#C8A55A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              Wallet & Execution
            </h3>
            <div className="mb-4">
              <WalletConnect onConnect={setWalletAddress} />
            </div>

            {walletAddress && !isAdminWallet && (
              <div className="mb-3 p-3 rounded-lg border border-[#D07070]/40 bg-[#D07070]/8">
                <p className="text-[#D07070] text-xs font-mono font-semibold mb-1">Wrong wallet</p>
                <p className="text-[#7A6F63] text-xs leading-relaxed">
                  Connected: <span className="text-[#D07070]">{walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}</span>
                </p>
                <p className="text-[#7A6F63] text-xs leading-relaxed mt-0.5">
                  Required: <span className="text-[#E8DFD0] font-mono">{ADMIN_ADDRESS.slice(0, 6)}…{ADMIN_ADDRESS.slice(-4)}</span>
                  <span className="text-[#7A6F63]"> (contract admin)</span>
                </p>
              </div>
            )}

            <button
              onClick={handleExecutePayroll}
              disabled={aggState !== 'ready' || txState === 'sending' || txState === 'success' || !isAdminWallet}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: aggState === 'ready' && txState === 'idle' && isAdminWallet
                  ? 'linear-gradient(135deg, #C8A55A, #9C7E3E)'
                  : 'rgba(200,165,90,0.15)',
                color: 'white',
                border: '1px solid rgba(200,165,90,0.4)',
              }}
            >
              {txState === 'sending' ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Submitting to Stellar…
                </span>
              ) : txState === 'success' ? (
                <span className="flex items-center justify-center gap-2 text-[#4A8C6A]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Tx Submitted!
                </span>
              ) : (
                'Execute Payroll on Stellar'
              )}
            </button>

            {txState === 'idle' && aggState !== 'ready' && (
              <p className="text-[#7A6F63] text-xs text-center mt-2">
                Generate aggregated proof first
              </p>
            )}
            {txState === 'idle' && aggState === 'ready' && !walletAddress && (
              <p className="text-[#7A6F63] text-xs text-center mt-2">
                Connect the contract admin wallet to execute
              </p>
            )}
          </div>

          {/* Tx result */}
          {txState === 'success' && txHash && (
            <div className="rounded-xl border border-[#4A8C6A]/30 bg-[#4A8C6A]/5 p-5 animate-slide-up">
              <div className="flex items-center gap-2 mb-3">
                <svg className="w-5 h-5 text-[#4A8C6A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="font-mono font-semibold text-[#4A8C6A]">Transaction Submitted</span>
              </div>
              <p className="text-[#7A6F63] text-xs font-mono break-all mb-3">{txHash}</p>
              <a
                href={explorerTxUrl(txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[#5A9B78] text-xs hover:underline"
              >
                View on Stellar Expert
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
              <p className="text-[#7A6F63] text-xs mt-3 leading-relaxed">
                Payroll escrow is ready. Employees can now claim their salary on the{' '}
                <Link href="/employee" className="text-[#5A9B78] hover:underline">Employee Portal</Link>.
              </p>
            </div>
          )}

          {txState === 'error' && txError && (
            <div className="rounded-xl border border-[#D07070]/30 bg-[#D07070]/5 p-4">
              <p className="text-[#D07070] text-sm font-mono">{txError}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
