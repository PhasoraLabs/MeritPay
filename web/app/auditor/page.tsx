'use client';

import { useState } from 'react';
import ProofBadge from '@/components/ProofBadge';
import { MOCK_EMPLOYEES, type PayrollSummary } from '@/lib/types';
import { generateAuditorProof } from '@/lib/proof';

// Mock payouts matching the circuit bonus logic:
// +20% if hours met, +10% if sales met
const MOCK_PAYOUTS = [6.5, 4.2, 7.8, 4.4, 7.15]; // XLM per employee
const MOCK_TOTAL = MOCK_PAYOUTS.reduce((a, b) => a + b, 0);

type ProofState = 'idle' | 'generating' | 'verified' | 'error';

interface AuditResult {
  totalPayroll: number;
  budget: number;
  withinBudget: boolean;
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] };
  generatedAt: string;
}

function RedactedBar({
  name,
  payout,
  totalPayout,
  revealed,
}: {
  name: string;
  payout: number;
  totalPayout: number;
  revealed: boolean;
}) {
  const pct = (payout / totalPayout) * 100;
  const colors = ['#C8A55A', '#5A9B78', '#7A6B44', '#A87A3A', '#3B6B52'];
  const idx = MOCK_EMPLOYEES.findIndex(e => e.name === name);
  const color = colors[idx] ?? '#C8A55A';

  return (
    <div className="flex items-center gap-4">
      <div className="w-20 text-right font-mono text-sm text-[#7A6F63] flex-shrink-0">
        {name}
      </div>
      <div className="flex-1 redacted-bar">
        <div
          className="redacted-bar-fill"
          style={{
            width: `${pct}%`,
            backgroundColor: color + '60',
            border: `1px solid ${color}80`,
          }}
        />
        <div className="redacted-bar-stripes" />
        <div className="absolute inset-0 flex items-center px-3">
          <span className="font-mono text-xs" style={{ color }}>
            {revealed ? `${payout.toFixed(2)} XLM` : '██████'}
          </span>
        </div>
      </div>
      <div className="w-20 font-mono text-xs text-[#7A6F63] flex-shrink-0">
        {revealed ? `${pct.toFixed(1)}%` : '??.?%'}
      </div>
    </div>
  );
}

export default function AuditorPage() {
  const [budget, setBudget] = useState(40);
  const [proofState, setProofState] = useState<ProofState>('idle');
  const [result, setResult] = useState<AuditResult | null>(null);
  const [payoutsRevealed, setPayoutsRevealed] = useState(false);

  const handleGenerate = async () => {
    setProofState('generating');
    setResult(null);
    try {
      const res = await generateAuditorProof(MOCK_TOTAL, budget);
      setResult({
        totalPayroll: MOCK_TOTAL,
        budget,
        withinBudget: res.withinBudget,
        proof: res.proof,
        generatedAt: new Date().toISOString(),
      });
      setProofState('verified');
    } catch {
      setProofState('error');
    }
  };

  const withinBudget = MOCK_TOTAL <= budget;

  return (
    <div className="min-h-screen py-12 px-4">
      <div className="max-w-4xl mx-auto">

        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <span className="badge badge-accent">Auditor Mode</span>
            <span className="badge badge-muted">Selective Disclosure</span>
          </div>
          <h1 className="font-mono font-bold text-3xl text-[#E8DFD0] mb-2">
            Budget Compliance Proof
          </h1>
          <p className="text-[#7A6F63] max-w-xl">
            Generate a ZK proof that total payroll is within budget — without revealing any
            individual salary or bonus. The auditor receives a cryptographic guarantee, not raw data.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">

          {/* Left column — config + generate */}
          <div className="lg:col-span-2 space-y-5">

            {/* Budget config */}
            <div className="merit-card p-6">
              <h2 className="font-mono font-semibold text-[#E8DFD0] mb-4 flex items-center gap-2">
                <svg className="w-4 h-4 text-[#C8A55A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Budget Parameter
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs text-[#7A6F63] font-mono mb-2 uppercase tracking-wider">
                    Max Budget (XLM)
                  </label>
                  <input
                    type="number"
                    value={budget}
                    onChange={e => setBudget(Number(e.target.value))}
                    min={1}
                    step={1}
                    className="merit-input font-mono"
                  />
                </div>

                {/* Budget preview */}
                <div className={`rounded-lg p-3 border text-sm font-mono ${
                  withinBudget
                    ? 'border-[#4A8C6A]/30 bg-[#4A8C6A]/10 text-[#4A8C6A]'
                    : 'border-[#D07070]/30 bg-[#D07070]/10 text-[#D07070]'
                }`}>
                  <div className="flex items-center gap-2">
                    {withinBudget ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    )}
                    <span>
                      {MOCK_TOTAL.toFixed(2)} XLM {withinBudget ? '≤' : '>'} {budget} XLM
                    </span>
                  </div>
                </div>

                <button
                  onClick={handleGenerate}
                  disabled={proofState === 'generating'}
                  className="btn-primary w-full"
                >
                  {proofState === 'generating' ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                      Generating Disclosure Proof…
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                      Generate Disclosure Proof
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Proof result */}
            {proofState === 'verified' && result && (
              <div className="merit-card p-6 animate-slide-up space-y-4">
                {/* Seal */}
                <div className="flex flex-col items-center py-4">
                  <ProofBadge verified size="lg" label={result.withinBudget ? 'Budget Compliant' : 'Over Budget'} />
                </div>

                <div className={`rounded-lg p-4 border text-center ${
                  result.withinBudget
                    ? 'border-[#4A8C6A]/40 bg-[#4A8C6A]/10'
                    : 'border-[#D07070]/40 bg-[#D07070]/10'
                }`}>
                  <p className={`font-mono font-bold text-lg ${result.withinBudget ? 'text-[#4A8C6A]' : 'text-[#D07070]'}`}>
                    {result.totalPayroll.toFixed(2)} XLM
                  </p>
                  <p className="text-xs text-[#7A6F63] mt-1">
                    Total Payroll {result.withinBudget ? '≤' : '>'} {result.budget} XLM budget
                  </p>
                </div>

                {/* Proof snippet */}
                <div>
                  <p className="text-xs text-[#7A6F63] font-mono uppercase tracking-wider mb-2">Proof Snippet (π_a)</p>
                  <div className="hash-text bg-[#0C0A09] rounded p-2 text-[10px]">
                    {result.proof.pi_a[0].slice(0, 32)}…
                  </div>
                </div>

                <p className="text-[10px] text-[#7A6F63] font-mono text-center">
                  Generated {new Date(result.generatedAt).toLocaleTimeString()}
                </p>
              </div>
            )}

            {proofState === 'error' && (
              <div className="merit-card p-4 border border-[#D07070]/30 bg-[#D07070]/5">
                <p className="text-[#D07070] text-sm font-mono">Proof generation failed. Try again.</p>
              </div>
            )}
          </div>

          {/* Right column — payroll breakdown */}
          <div className="lg:col-span-3 space-y-5">

            {/* Privacy info */}
            <div className="merit-card p-5 border-[#5A9B78]/30 bg-[#5A9B78]/5">
              <div className="flex items-start gap-3">
                <svg className="w-5 h-5 text-[#5A9B78] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-[#5A9B78] font-mono font-semibold text-sm mb-1">Auditor Privacy Guarantee</p>
                  <p className="text-[#7A6F63] text-xs leading-relaxed">
                    This proof guarantees <span className="text-[#E8DFD0]">total payroll ≤ budget</span> without
                    revealing individual salaries or bonus amounts. The <span className="text-[#E8DFD0]">AuditorDisclosure</span> circuit
                    enforces this using a range proof and sum constraint — the auditor gets a cryptographic guarantee, not a signed attestation.
                  </p>
                </div>
              </div>
            </div>

            {/* Individual payout breakdown */}
            <div className="merit-card p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="font-mono font-semibold text-[#E8DFD0]">Individual Payouts</h2>
                <button
                  onClick={() => setPayoutsRevealed(r => !r)}
                  className="text-xs font-mono text-[#7A6F63] hover:text-[#C8A55A] transition-colors flex items-center gap-1"
                >
                  {payoutsRevealed ? (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                      Hide
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      Reveal (Demo Only)
                    </>
                  )}
                </button>
              </div>

              <div className="space-y-3">
                {MOCK_EMPLOYEES.map((emp, i) => (
                  <RedactedBar
                    key={emp.id}
                    name={emp.name}
                    payout={MOCK_PAYOUTS[i]}
                    totalPayout={MOCK_TOTAL}
                    revealed={payoutsRevealed}
                  />
                ))}
              </div>

              {/* Total */}
              <div className="mt-5 pt-4 border-t border-[#2E2924] flex items-center justify-between">
                <span className="font-mono text-sm text-[#7A6F63]">Total Payroll</span>
                <span className="font-mono font-bold text-[#E8DFD0]">{MOCK_TOTAL.toFixed(2)} XLM</span>
              </div>
            </div>

            {/* How this works */}
            <div className="merit-card p-6">
              <h2 className="font-mono font-semibold text-[#E8DFD0] mb-4">How Selective Disclosure Works</h2>
              <div className="space-y-3">
                {[
                  { step: '1', text: 'Private inputs: each employee\'s individual payout (kept local)', color: '#C8A55A' },
                  { step: '2', text: 'Public outputs: totalPayroll and budget (visible to auditor)', color: '#5A9B78' },
                  { step: '3', text: 'Circuit enforces: sum(payouts) == totalPayroll AND totalPayroll ≤ budget', color: '#C8A55A' },
                  { step: '4', text: 'Groth16 proof verifies on Stellar — no individual data revealed', color: '#4A8C6A' },
                ].map(({ step, text, color }) => (
                  <div key={step} className="flex gap-3 items-start">
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center font-mono font-bold text-xs flex-shrink-0"
                      style={{ backgroundColor: color + '22', color, border: `1px solid ${color}60` }}
                    >
                      {step}
                    </div>
                    <p className="text-[#7A6F63] text-sm leading-relaxed">{text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
