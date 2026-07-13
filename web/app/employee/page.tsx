'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { MOCK_EMPLOYEES } from '@/lib/types';
import type { ClaimBundle, ClaimEntry, KPIResult } from '@/lib/types';
import { generateKPIProof, generateClaimProof, generateSalt, formatProofForDisplay, signalToBytes32 } from '@/lib/proof';
import {
  isEntryClaimed,
  loadClaimBundle,
  markEntryClaimed,
} from '@/lib/claim';
import { claimPayout, explorerTxUrl, connectWallet } from '@/lib/stellar';
import ProofBadge from '@/components/ProofBadge';

type ProofState = 'idle' | 'generating' | 'complete' | 'error';
type ClaimState = 'idle' | 'claiming' | 'success' | 'error';

const AVATAR_COLORS = ['#C8A55A', '#5A9B78', '#7A6B44', '#A87A3A', '#3B6B52'];

export default function EmployeePage() {
  const [selectedId, setSelectedId] = useState<number>(1);
  const [hours, setHours] = useState<number>(165);
  const [salesMet, setSalesMet] = useState<boolean>(false);
  const [salt, setSalt] = useState<string>('');
  const [proofState, setProofState] = useState<ProofState>('idle');
  const [result, setResult] = useState<KPIResult | null>(null);
  const [error, setError] = useState<string>('');

  const [claimBundle, setClaimBundle] = useState<ClaimBundle | null>(null);
  const [selectedClaimIdx, setSelectedClaimIdx] = useState(0);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [claimState, setClaimState] = useState<ClaimState>('idle');
  const [claimError, setClaimError] = useState('');
  const [claimTxHash, setClaimTxHash] = useState('');

  useEffect(() => {
    setClaimBundle(loadClaimBundle());
  }, []);

  const selectedClaim: ClaimEntry | null = claimBundle?.entries[selectedClaimIdx] ?? null;
  const claimAlreadyDone = selectedClaim ? isEntryClaimed(selectedClaim.nullifier) : false;

  // Generate a new salt on mount and employee change
  const refreshSalt = useCallback(() => {
    setSalt(generateSalt());
  }, []);

  useEffect(() => {
    refreshSalt();
    setProofState('idle');
    setResult(null);
  }, [selectedId, refreshSalt]);

  const selectedEmployee = MOCK_EMPLOYEES.find(e => e.id === selectedId)!;

  const handleGenerateProof = async () => {
    setProofState('generating');
    setError('');
    setResult(null);
    try {
      const kpiResult = await generateKPIProof({
        employeeId: selectedId,
        hoursWorked: hours,
        salesFlag: salesMet ? 1 : 0,
        salt,
      });
      setResult(kpiResult);
      setProofState('complete');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Proof generation failed');
      setProofState('error');
    }
  };

  const handleClaimSalary = async () => {
    if (!selectedClaim || claimAlreadyDone || !walletAddress) return;
    setClaimState('claiming');
    setClaimError('');
    setClaimTxHash('');
    try {
      const { proof, publicSignals } = await generateClaimProof({
        employeeId: selectedClaim.employeeId,
        payrollEpoch: selectedClaim.payrollEpoch,
        baseSalary: selectedClaim.baseSalary,
        hoursThreshold: selectedClaim.hoursThreshold,
        hoursWorked: selectedClaim.kpiInputs.hoursWorked,
        salesFlag: selectedClaim.kpiInputs.salesFlag,
        salt: selectedClaim.kpiInputs.salt,
        payoutCircuit: selectedClaim.payoutCircuit,
      });
      const nullifierBytes = signalToBytes32(selectedClaim.nullifier);
      const hash = await claimPayout(
        proof,
        publicSignals,
        nullifierBytes,
        selectedClaim.payoutCircuit,
        walletAddress, // employee's wallet — must be connected in Freighter
      );
      markEntryClaimed(selectedClaim.nullifier);
      setClaimTxHash(hash);
      setClaimState('success');
    } catch (e) {
      setClaimError(e instanceof Error ? e.message : 'Claim failed');
      setClaimState('error');
    }
  };

  const displayProof = result ? formatProofForDisplay(result.proof) : null;
  const color = AVATAR_COLORS[(selectedId - 1) % AVATAR_COLORS.length];

  return (
    <div className="min-h-screen px-4 py-10 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-lg bg-[#5A9B78]/20 border border-[#5A9B78]/40 flex items-center justify-center">
            <svg className="w-4 h-4 text-[#5A9B78]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <h1 className="font-mono font-bold text-2xl text-[#E8DFD0]">Employee KPI Portal</h1>
        </div>
        <p className="text-[#7A6F63] text-sm ml-11">
          Claim verified payroll or submit private KPI proofs locally
        </p>
      </div>

      {/* Claim salary */}
      <div className="mb-6 rounded-xl border border-[#5A9B78]/30 bg-[#5A9B78]/5 p-6">
        <div className="mb-4">
          <h2 className="font-mono font-semibold text-[#E8DFD0]">Claim Salary</h2>
          <p className="text-[#7A6F63] text-xs mt-1">
            Private withdrawal — on-chain tx shows a transfer, not your full payroll row
          </p>
        </div>

        {!claimBundle ? (
          <div className="rounded-lg border border-[#2E2924] bg-[#1A1614] p-4">
            <p className="text-[#7A6F63] text-sm">
              No payroll ready to claim yet. Ask your employer to execute payroll on the{' '}
              <Link href="/verify" className="text-[#5A9B78] hover:underline">Verify Dashboard</Link>.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {claimBundle.entries.map((entry, idx) => {
                const claimed = isEntryClaimed(entry.nullifier);
                const active = idx === selectedClaimIdx;
                return (
                  <button
                    key={entry.nullifier}
                    type="button"
                    onClick={() => {
                      setSelectedClaimIdx(idx);
                      setClaimState('idle');
                      setClaimError('');
                    }}
                    className={`px-3 py-2 rounded-lg border text-xs font-mono transition-all cursor-pointer ${
                      active
                        ? 'border-[#5A9B78] bg-[#5A9B78]/15 text-[#E8DFD0]'
                        : 'border-[#2E2924] text-[#7A6F63] hover:border-[#5A9B78]/40'
                    }`}
                  >
                    {entry.name}
                    {claimed ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>

            {selectedClaim && (
              <div className="rounded-lg border border-[#2E2924] bg-[#1A1614] p-4 space-y-3">
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-[#7A6F63]">Payroll epoch</span>
                  <span className="font-mono text-[#C8A55A]">#{selectedClaim.payrollEpoch}</span>
                </div>
                <div className="flex flex-wrap justify-between gap-2 text-sm">
                  <span className="text-[#7A6F63]">Payout amount</span>
                  <span className="font-mono text-[#7A6F63] text-xs italic">Private — revealed on receipt</span>
                </div>

                {/* Recipient wallet — employee's own wallet, not the employer's */}
                <div className="pt-1 space-y-2">
                  <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-wide">
                    Your receive address
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Paste your Stellar address (G…)"
                      value={walletAddress ?? ''}
                      onChange={e => setWalletAddress(e.target.value || null)}
                      className="flex-1 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-3 py-2 text-xs font-mono text-[#E8DFD0] placeholder-[#4A433C] focus:outline-none focus:border-[#5A9B78] focus:ring-1 focus:ring-[#5A9B78]/30 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        const addr = await connectWallet();
                        if (addr) setWalletAddress(addr);
                      }}
                      className="px-3 py-2 rounded-lg border border-[#5A9B78]/40 bg-[#5A9B78]/10 text-[#5A9B78] text-xs font-medium hover:bg-[#5A9B78]/20 transition-all cursor-pointer whitespace-nowrap"
                    >
                      Use Freighter
                    </button>
                  </div>
                  {walletAddress && walletAddress.startsWith('G') && walletAddress.length === 56 && (
                    <p className="text-[#5A9B78] text-xs font-mono">
                      → {walletAddress.slice(0, 6)}…{walletAddress.slice(-4)}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleClaimSalary}
                  disabled={!walletAddress || claimState === 'claiming' || claimAlreadyDone}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: walletAddress && !claimAlreadyDone
                      ? 'linear-gradient(135deg, #5A9B78, #3B6B52)'
                      : 'rgba(90,155,120,0.15)',
                    color: 'white',
                    border: '1px solid rgba(90,155,120,0.4)',
                  }}
                >
                  {claimState === 'claiming'
                    ? 'Generating proof & claiming…'
                    : claimAlreadyDone
                      ? 'Already claimed'
                      : 'Claim Salary'}
                </button>

                {!walletAddress && (
                  <p className="text-[#7A6F63] text-xs text-center">
                    Enter your Stellar address or connect Freighter to receive your salary
                  </p>
                )}

                {claimState === 'success' && claimTxHash && (
                  <div className="p-3 rounded-lg border border-[#4A8C6A]/30 bg-[#4A8C6A]/5">
                    <p className="text-[#4A8C6A] text-xs font-mono mb-2">XLM sent to your wallet</p>
                    <a
                      href={explorerTxUrl(claimTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5A9B78] text-xs hover:underline break-all"
                    >
                      View claim transaction →
                    </a>
                  </div>
                )}

                {claimState === 'error' && claimError && (
                  <p className="text-[#D07070] text-xs font-mono">{claimError}</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Privacy banner */}
      <div className="mb-6 flex items-start gap-3 p-4 rounded-xl border border-[#C8A55A]/30 bg-[#C8A55A]/5">
        <svg className="w-5 h-5 text-[#C8A55A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div>
          <p className="text-[#D8B86A] font-semibold text-sm">Your hours and sales data never leave your browser</p>
          <p className="text-[#7A6F63] text-xs mt-0.5">
            Only a cryptographic commitment and boolean outputs (hoursMet, salesMet) are submitted on-chain.
            The proof is computed locally using the Groth16 protocol over BN254.
          </p>
        </div>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Left: Employee selector + form */}
        <div className="lg:col-span-3 space-y-5">
          {/* Employee selector */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-6">
            <h2 className="font-mono font-semibold text-[#E8DFD0] mb-4">Select Employee</h2>
            <div className="grid grid-cols-5 gap-2">
              {MOCK_EMPLOYEES.map((emp, idx) => {
                const c = AVATAR_COLORS[idx % AVATAR_COLORS.length];
                const active = emp.id === selectedId;
                return (
                  <button
                    key={emp.id}
                    onClick={() => setSelectedId(emp.id)}
                    className={`flex flex-col items-center gap-2 py-3 px-2 rounded-lg border transition-all cursor-pointer ${
                      active
                        ? 'border-[#C8A55A] bg-[#C8A55A]/15'
                        : 'border-[#2E2924] hover:border-[#2E2924]/80 hover:bg-[#2E2924]/30'
                    }`}
                  >
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center font-mono font-bold text-xs"
                      style={{ backgroundColor: c + '22', border: `1.5px solid ${c}`, color: c }}
                    >
                      {emp.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-[#D8B86A]' : 'text-[#7A6F63]'}`}>
                      {emp.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* KPI form */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-6">
            <div className="flex items-center gap-3 mb-5">
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center font-mono font-bold text-sm"
                style={{ backgroundColor: color + '22', border: `2px solid ${color}`, color }}
              >
                {selectedEmployee.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <h2 className="font-mono font-semibold text-[#E8DFD0]">{selectedEmployee.name}</h2>
                <p className="text-[#7A6F63] text-xs">
                  Base: <span className="font-mono text-[#5A9B78]">{(selectedEmployee.baseSalary / 1000).toFixed(1)} XLM</span>
                  {selectedEmployee.role && (
                    <> &middot; <span className="text-[#7A6F63]">{selectedEmployee.role}</span></>
                  )}
                </p>
              </div>
            </div>

            <div className="space-y-5">
              {/* Hours */}
              <div>
                <label className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#E8DFD0]">Hours Worked This Epoch</span>
                  <span className="text-xs text-[#5A9B78] font-mono bg-[#5A9B78]/10 px-2 py-0.5 rounded border border-[#5A9B78]/30">
                    Private — never shared
                  </span>
                </label>
                <div className="flex items-center gap-3">
                  <input
                    type="number"
                    min={0}
                    max={744}
                    step={1}
                    value={hours}
                    onChange={e => {
                      setHours(parseInt(e.target.value) || 0);
                      setProofState('idle');
                      setResult(null);
                    }}
                    className="flex-1 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-4 py-2.5 text-sm font-mono text-[#E8DFD0] focus:outline-none focus:border-[#C8A55A] focus:ring-1 focus:ring-[#C8A55A]/30 transition-colors"
                  />
                  <span className="text-[#7A6F63] text-sm font-mono">/ {selectedEmployee.hoursThreshold}h threshold</span>
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-[#2E2924] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, (hours / selectedEmployee.hoursThreshold) * 100)}%`,
                      backgroundColor: hours >= selectedEmployee.hoursThreshold ? '#4A8C6A' : '#C8A55A',
                    }}
                  />
                </div>
                <p className="text-xs text-[#7A6F63] mt-1">
                  {hours >= selectedEmployee.hoursThreshold ? (
                    <span className="text-[#4A8C6A]">Hours threshold met (+1.0 XLM bonus)</span>
                  ) : (
                    <span>{selectedEmployee.hoursThreshold - hours}h below threshold</span>
                  )}
                </p>
              </div>

              {/* Sales flag */}
              <div>
                <label className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-[#E8DFD0]">Sales Target Met?</span>
                  <span className="text-xs text-[#5A9B78] font-mono bg-[#5A9B78]/10 px-2 py-0.5 rounded border border-[#5A9B78]/30">
                    Private — never shared
                  </span>
                </label>
                <button
                  onClick={() => {
                    setSalesMet(s => !s);
                    setProofState('idle');
                    setResult(null);
                  }}
                  className={`w-full py-2.5 rounded-lg border font-medium text-sm transition-all cursor-pointer ${
                    salesMet
                      ? 'border-[#4A8C6A] bg-[#4A8C6A]/15 text-[#4A8C6A]'
                      : 'border-[#2E2924] bg-[#0C0A09] text-[#7A6F63] hover:border-[#7A6F63]'
                  }`}
                >
                  {salesMet ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Sales Target Met (+0.5 XLM bonus)
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      Sales Target Not Met
                    </span>
                  )}
                </button>
              </div>

              {/* Salt */}
              <div>
                <label className="text-sm font-medium text-[#E8DFD0] block mb-2">
                  Cryptographic Salt
                </label>
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={salt}
                    className="flex-1 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-3 py-2 text-xs font-mono text-[#7A6F63] focus:outline-none"
                  />
                  <button
                    onClick={refreshSalt}
                    className="px-3 py-2 rounded-lg border border-[#2E2924] text-[#7A6F63] hover:text-[#E8DFD0] hover:border-[#7A6F63] transition-colors cursor-pointer"
                    title="Generate new salt"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </div>
                <p className="text-[#7A6F63] text-xs mt-1">Auto-generated (cryptographic randomness)</p>
              </div>

              {/* Generate button */}
              <button
                onClick={handleGenerateProof}
                disabled={proofState === 'generating'}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  background: proofState === 'generating'
                    ? 'rgba(200,165,90,0.3)'
                    : 'linear-gradient(135deg, #C8A55A, #9C7E3E)',
                  color: 'white',
                  border: '1px solid rgba(200,165,90,0.4)',
                }}
              >
                {proofState === 'generating' ? (
                  <span className="flex items-center justify-center gap-3">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Generating ZK Proof...
                  </span>
                ) : proofState === 'complete' ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Proof Generated — Generate Again
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    Generate KPI Proof
                  </span>
                )}
              </button>

              {error && (
                <p className="text-[#D07070] text-sm text-center">{error}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: Proof result */}
        <div className="lg:col-span-2 space-y-4">
          {/* Generating state */}
          {proofState === 'generating' && (
            <div className="rounded-xl border border-[#C8A55A]/40 bg-[#C8A55A]/5 p-8 flex flex-col items-center text-center proof-generating min-h-[340px] justify-center">
              <div className="relative w-16 h-16 mb-6">
                {/* Outer ring */}
                <svg className="absolute inset-0 w-16 h-16 animate-spin-slow" viewBox="0 0 64 64" fill="none">
                  <circle cx="32" cy="32" r="28" stroke="#C8A55A" strokeWidth="2" strokeDasharray="8 4" />
                </svg>
                {/* Inner ring */}
                <svg className="absolute inset-2 w-12 h-12 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1s' }} viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="20" stroke="#5A9B78" strokeWidth="2" strokeDasharray="4 6" />
                </svg>
                {/* Center */}
                <div className="absolute inset-4 rounded-full bg-[#C8A55A]/20 border border-[#C8A55A]/40 flex items-center justify-center">
                  <span className="text-[#C8A55A] text-xs font-mono">ZK</span>
                </div>
              </div>
              <p className="font-mono font-semibold text-[#D8B86A] mb-2">Generating ZK Proof...</p>
              <p className="text-[#7A6F63] text-xs max-w-48">
                Running Groth16 circuit on BN254 curve. Private inputs never leave this device.
              </p>
            </div>
          )}

          {/* Complete state */}
          {proofState === 'complete' && result && (
            <div className="rounded-xl border border-[#C8A55A]/40 bg-[#C8A55A]/5 p-6 animate-fade-in">
              {/* Proof seal */}
              <div className="flex flex-col items-center py-4 mb-5 border-b border-[#2E2924]">
                <ProofBadge verified={true} label="PROOF VERIFIED" size="lg" />
                {result.proofTime && (
                  <p className="text-[#7A6F63] text-xs mt-3 font-mono">
                    Generated in {result.proofTime}ms
                  </p>
                )}
              </div>

              {/* KPI results */}
              <div className="space-y-3 mb-5">
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924]">
                  <span className="text-[#7A6F63] text-sm">Hours Threshold</span>
                  <span className={`font-mono font-semibold text-sm ${result.hoursMet ? 'text-[#4A8C6A]' : 'text-[#D07070]'}`}>
                    {result.hoursMet ? 'MET ✓' : 'NOT MET ✗'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924]">
                  <span className="text-[#7A6F63] text-sm">Sales Target</span>
                  <span className={`font-mono font-semibold text-sm ${result.salesMet ? 'text-[#4A8C6A]' : 'text-[#D07070]'}`}>
                    {result.salesMet ? 'MET ✓' : 'NOT MET ✗'}
                  </span>
                </div>
              </div>

              {/* Commitment hash */}
              <div className="p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924] mb-4">
                <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-wide mb-2">
                  Commitment Hash (public)
                </p>
                <p className="font-mono text-xs text-[#5A9B78] break-all leading-relaxed">
                  {result.commitment}
                </p>
              </div>

              {/* Proof data (truncated) */}
              {displayProof && (
                <div className="space-y-2">
                  <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-wide">
                    Groth16 Proof (truncated)
                  </p>
                  {[
                    { label: 'π_a', value: displayProof.piA },
                    { label: 'π_c', value: displayProof.piC },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex gap-2">
                      <span className="text-[#C8A55A] font-mono text-xs w-6 flex-shrink-0 mt-0.5">{label}</span>
                      <span className="font-mono text-xs text-[#7A6F63] break-all">{value}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Idle state */}
          {proofState === 'idle' && (
            <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-8 flex flex-col items-center text-center min-h-[280px] justify-center">
              <ProofBadge verified={false} label="Awaiting Proof" size="md" />
              <p className="text-[#7A6F63] text-sm mt-4 max-w-48">
                Fill in your KPI data and click Generate to create your private proof.
              </p>
            </div>
          )}

          {/* How this works */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-4">
            <p className="font-mono font-semibold text-[#E8DFD0] text-xs mb-3">How Your Privacy Is Protected</p>
            <ul className="space-y-2">
              {[
                'Hours worked → private circuit input',
                'Sales flag → private circuit input',
                'Salt → prevents commitment linking',
                'Commitment → public (on-chain)',
                'hoursMet, salesMet → public outputs',
              ].map((item, i) => (
                <li key={i} className="flex gap-2 text-xs text-[#7A6F63]">
                  <span className="text-[#C8A55A] font-mono">{(i + 1).toString().padStart(2, '0')}</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
