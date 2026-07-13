import Link from "next/link";

// ── Notarial seal for hero ────────────────────────────────────────────────────
function HeroSeal() {
  const d = 200;
  const r = d / 2;
  const outerR = r - 2;
  const arcPath    = `M ${r - outerR + 2},${r} A ${outerR - 2},${outerR - 2} 0 0 1 ${r + outerR - 2},${r}`;
  const arcBottom  = `M ${r - outerR + 2},${r} A ${outerR - 2},${outerR - 2} 0 0 0 ${r + outerR - 2},${r}`;

  return (
    <div className="relative flex-shrink-0 animate-spin-slow" style={{ width: d, height: d }}>
      {/* Outer ring */}
      <svg
        width={d}
        height={d}
        viewBox={`0 0 ${d} ${d}`}
        fill="none"
        style={{ position: 'absolute', inset: 0 }}
      >
        <circle cx={r} cy={r} r={outerR} stroke="#C8A55A" strokeWidth="1" fill="none" opacity="0.5" />
      </svg>
      {/* Inner content */}
      <svg
        width={d}
        height={d}
        viewBox={`0 0 ${d} ${d}`}
        fill="none"
        style={{ position: 'absolute', inset: 0 }}
      >
        <defs>
          <path id="arc-hero-top" d={arcPath} />
          <path id="arc-hero-bot" d={arcBottom} />
        </defs>

        <circle cx={r} cy={r} r={r - 14} stroke="#C8A55A" strokeWidth="0.5" fill="rgba(200,165,90,0.03)" opacity="0.4" />

        <text fontSize="10" fill="#C8A55A" fontFamily="var(--font-geist-mono), monospace" fontWeight="500" letterSpacing="0.14em" opacity="0.85">
          <textPath href="#arc-hero-top" startOffset="50%" textAnchor="middle">
            · MERIT PAY · PROOF VERIFIED · STELLAR ·
          </textPath>
        </text>
        <text fontSize="8.5" fill="#C8A55A" fontFamily="var(--font-geist-mono), monospace" letterSpacing="0.1em" opacity="0.55">
          <textPath href="#arc-hero-bot" startOffset="50%" textAnchor="middle">
            GROTH16 · BN254 · ZERO KNOWLEDGE · SOROBAN
          </textPath>
        </text>

        {/* Center content */}
        <text x={r} y={r - 14} textAnchor="middle" fontSize="11" fontFamily="var(--font-geist-mono), monospace" fontWeight="600" letterSpacing="0.05em" fill="#C8A55A" opacity="0.95">
          0x7a3f…9c2b
        </text>
        <text x={r} y={r + 4} textAnchor="middle" fontSize="8" fontFamily="var(--font-geist-mono), monospace" fill="#C8A55A" letterSpacing="0.12em" opacity="0.5">
          COMMITMENT
        </text>
        <text x={r} y={r + 20} textAnchor="middle" fontSize="8" fontFamily="var(--font-geist-mono), monospace" fill="#C8A55A" letterSpacing="0.12em" opacity="0.5">
          HASH
        </text>

        {/* Tick */}
        <polyline
          points={`${r - 28},${r + 34} ${r - 10},${r + 50} ${r + 32},${r + 6}`}
          stroke="#C8A55A"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.7"
        />
      </svg>
    </div>
  );
}

// ── Flow step ─────────────────────────────────────────────────────────────────
function FlowStep({
  role,
  headline,
  body,
  tag,
  last = false,
}: {
  role: string;
  headline: string;
  body: string;
  tag: string;
  last?: boolean;
}) {
  return (
    <div className="relative grid md:grid-cols-[180px_1fr_80px] gap-6 items-start py-10 border-t border-[#2E2924]">
      {/* Role label */}
      <div>
        <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-widest mb-1">{role}</p>
        <p className="text-[#E8DFD0] font-medium text-base leading-snug" style={{ fontFamily: 'var(--font-serif)' }}>
          {headline}
        </p>
      </div>

      {/* Body */}
      <p className="text-[#7A6F63] text-sm leading-relaxed">{body}</p>

      {/* Tag */}
      <div className="hidden md:flex items-start justify-end pt-0.5">
        <span className="inline-block px-2.5 py-1 rounded border border-[#2E2924] text-[#C8A55A] text-xs font-mono tracking-wider">
          {tag}
        </span>
      </div>

      {/* Connector line */}
      {!last && (
        <div
          className="absolute left-0 md:left-[180px] bottom-0 w-px bg-[#2E2924]"
          style={{ top: '100%', height: '1px', width: '100%', left: 0 }}
        />
      )}
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen">

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-8 py-20 md:py-28 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-[1fr_auto] gap-10 md:gap-14 items-center">

          {/* Left: text */}
          <div>
            {/* Live pill — minimal */}
            <div className="inline-flex items-center gap-2 mb-8">
              <span className="w-1.5 h-1.5 rounded-full bg-[#4A8C6A] animate-pulse-dot" />
              <span className="text-[#7A6F63] text-xs font-mono tracking-widest uppercase">
                Live · Stellar Testnet
              </span>
            </div>

            <h1
              className="leading-[1.08] mb-6 text-[#E8DFD0]"
              style={{ fontFamily: 'var(--font-serif)', fontSize: 'clamp(2.8rem, 6vw, 5rem)', fontWeight: 400 }}
            >
              Payroll,
              <em style={{ fontStyle: 'italic', color: '#C8A55A' }}>Proven.</em>
            </h1>

            <p className="text-[#7A6F63] text-base md:text-lg leading-relaxed mb-8 max-w-md">
              Employees prove performance thresholds in zero-knowledge — hours, sales, bonuses — without revealing any raw data.
              Settlement is executed on Stellar Soroban.
            </p>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/employer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded bg-[#C8A55A] text-[#0C0A09] font-semibold text-sm hover:bg-[#D8B86A] transition-colors"
              >
                Run the Demo
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </Link>
              <Link
                href="/employee"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded border border-[#2E2924] text-[#7A6F63] font-medium text-sm hover:border-[#3D3630] hover:text-[#E8DFD0] transition-colors"
              >
                Employee Portal
              </Link>
            </div>
          </div>

          {/* Right: seal */}
          <div className="flex justify-center md:justify-end">
            <HeroSeal />
          </div>
        </div>
      </section>

      {/* ── Evidence strip ────────────────────────────────────────────────── */}
      <section className="border-y border-[#2E2924] bg-[#1A1614]/40 py-4 px-5 sm:px-8 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex items-center gap-8 whitespace-nowrap">
          {[
            { k: 'Proof system', v: 'Groth16 / BN254' },
            { k: 'Circuits', v: '3 · 7,455 constraints' },
            { k: 'Verifier', v: 'CBT4QOM…UAYK' },
            { k: 'Payroll', v: 'CDT63SM…YIFB' },
            { k: 'Pool', v: '50 XLM funded' },
          ].map(({ k, v }) => (
            <div key={k} className="flex items-center gap-2">
              <span className="text-[#4A433C] text-xs font-mono uppercase tracking-widest">{k}</span>
              <span className="text-[#E8DFD0] text-xs font-mono">{v}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── The Flow ──────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-8 py-16 max-w-7xl mx-auto">
        <div className="mb-12">
          <p className="text-[#4A433C] text-xs font-mono uppercase tracking-widest mb-3">How it works</p>
          <h2
            className="text-[#E8DFD0] text-3xl md:text-4xl"
            style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}
          >
            Three steps. No secrets exposed.
          </h2>
        </div>

        <div>
          <FlowStep
            role="Employee"
            headline="Proves performance privately"
            body="Each employee inputs hours worked and sales flag. The browser generates a Groth16 ZK proof using the KPI circuit. Only a Poseidon commitment hash and boolean outputs — hours met, sales met — leave the device."
            tag="KPI circuit"
          />
          <FlowStep
            role="Employer"
            headline="Aggregates without revealing"
            body="The PayrollAggregator circuit batches all five employee commitments into a single proof. Bonuses are computed from the circuit constraints — the aggregator sees only that thresholds were met, not the underlying numbers. Nullifiers prevent double-spend."
            tag="Aggregator circuit"
          />
          <FlowStep
            role="Settlement"
            headline="Soroban verifies and releases"
            body="The Groth16 verifier contract on Stellar checks the aggregated proof against the stored verification key. If valid and nullifiers are unspent, XLM is released from the payroll pool and the epoch counter advances."
            tag="On-chain"
            last
          />
        </div>
      </section>

      {/* ── Comparison ────────────────────────────────────────────────────── */}
      <section className="px-5 sm:px-8 py-16 border-t border-[#2E2924] max-w-7xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <p className="text-[#A84A4A] text-xs font-mono uppercase tracking-widest mb-4">Traditional on-chain payroll</p>
            <ul className="space-y-3">
              {[
                'Every salary and bonus is permanently visible on the block explorer',
                'KPI metrics expose confidential business performance',
                'Competitors, colleagues, and arbitrageurs see everything',
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-[#7A6F63] text-sm">
                  <span className="mt-1 flex-shrink-0 w-4 h-4 rounded-full border border-[#A84A4A]/40 flex items-center justify-center">
                    <span className="w-1.5 h-0.5 bg-[#A84A4A] rounded-full" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <p className="text-[#3B6B52] text-xs font-mono uppercase tracking-widest mb-4">MeritPay ZK payroll</p>
            <ul className="space-y-3">
              {[
                { text: 'Private KPI proofs', sub: 'Only boolean outputs published — hours met, sales met' },
                { text: 'Poseidon commitments', sub: 'Cryptographic binding of performance data, not the data itself' },
                { text: 'Selective auditor disclosure', sub: 'Budget compliance verifiable without revealing individual salaries' },
              ].map((item, i) => (
                <li key={i} className="flex gap-3 text-sm">
                  <span className="mt-1 flex-shrink-0 w-4 h-4 rounded-full border border-[#3B6B52]/40 flex items-center justify-center">
                    <span className="w-1 h-1 bg-[#3B6B52] rounded-full" />
                  </span>
                  <span>
                    <span className="text-[#E8DFD0]">{item.text}</span>
                    <span className="text-[#7A6F63]"> — {item.sub}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Tech strip ────────────────────────────────────────────────────── */}
      <section className="border-t border-[#2E2924] py-8 px-5 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-6">
          <p className="text-[#4A433C] text-xs font-mono uppercase tracking-widest">Built with</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {['Circom 2.0', 'snarkjs', 'Groth16', 'BN254', 'Stellar Soroban', 'Rust', 'Next.js 16', 'Freighter'].map(tech => (
              <span key={tech} className="text-[#7A6F63] text-xs font-mono hover:text-[#E8DFD0] transition-colors cursor-default">
                {tech}
              </span>
            ))}
          </div>
          <p className="text-[#4A433C] text-xs font-mono">
            Stellar Hacks · Real-World ZK · 2026
          </p>
        </div>
      </section>
    </div>
  );
}
