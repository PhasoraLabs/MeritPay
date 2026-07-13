'use client';

import { useEffect, useRef, useState } from 'react';

interface ProofBadgeProps {
  verified: boolean;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  hash?: string; // optional short hash shown in center of seal
}

const SIZE = { sm: 72, md: 108, lg: 160 };

export default function ProofBadge({ verified, label, size = 'md', hash }: ProofBadgeProps) {
  const d = SIZE[size];
  const [stamped, setStamped] = useState(false);
  const prev = useRef(false);

  useEffect(() => {
    if (verified && !prev.current) {
      setStamped(false);
      const t = setTimeout(() => setStamped(true), 40);
      return () => clearTimeout(t);
    }
    if (!verified) setStamped(false);
    prev.current = verified;
  }, [verified]);

  const r = d / 2;
  const outerR = r - 2;
  const innerR = r - 10;
  const textR   = r - 6;

  // Arc path helpers for circular text (top arc)
  const arcPath = `M ${r - outerR + 2},${r} A ${outerR - 2},${outerR - 2} 0 0 1 ${r + outerR - 2},${r}`;
  const arcBottom = `M ${r - outerR + 2},${r} A ${outerR - 2},${outerR - 2} 0 0 0 ${r + outerR - 2},${r}`;

  const giltColor   = '#C8A55A';
  const giltDim     = 'rgba(200,165,90,0.35)';
  const pendingColor = '#3D3630';

  const centerText = hash ? hash.slice(0, 8) : (verified ? 'VERIFIED' : 'PENDING');
  const subText    = verified ? 'GROTH16 · BN254' : 'AWAITING PROOF';

  return (
    <div className="flex flex-col items-center gap-2.5">
      <div
        key={`${verified}-${d}`}
        className={stamped ? 'animate-proof-stamp' : ''}
        style={{ width: d, height: d }}
      >
        <svg
          width={d}
          height={d}
          viewBox={`0 0 ${d} ${d}`}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={verified ? 'animate-seal-glow' : ''}
        >
          <defs>
            <path id={`arc-top-${d}`}    d={arcPath} />
            <path id={`arc-bottom-${d}`} d={arcBottom} />
          </defs>

          {/* Outer ring */}
          <circle
            cx={r} cy={r} r={outerR}
            stroke={verified ? giltColor : pendingColor}
            strokeWidth={verified ? 1.2 : 0.8}
            fill="none"
            opacity={verified ? 0.8 : 0.4}
          />

          {/* Inner ring */}
          <circle
            cx={r} cy={r} r={innerR}
            stroke={verified ? giltColor : pendingColor}
            strokeWidth={0.5}
            fill={verified ? 'rgba(200,165,90,0.04)' : 'transparent'}
            strokeDasharray={verified ? 'none' : '3 4'}
            opacity={verified ? 0.5 : 0.25}
          />

          {/* Circular text — top arc */}
          <text
            fontSize={size === 'sm' ? 7 : size === 'md' ? 8.5 : 11}
            fill={verified ? giltColor : pendingColor}
            fontFamily="var(--font-geist-mono), monospace"
            fontWeight="500"
            letterSpacing={size === 'sm' ? '0.14em' : '0.12em'}
            opacity={verified ? 0.9 : 0.3}
          >
            <textPath href={`#arc-top-${d}`} startOffset="50%" textAnchor="middle">
              {verified ? '· MERIT PAY · PROOF VERIFIED ·' : '· MERIT PAY · PROOF PENDING ·'}
            </textPath>
          </text>

          {/* Circular text — bottom arc */}
          <text
            fontSize={size === 'sm' ? 6 : size === 'md' ? 7.5 : 10}
            fill={verified ? giltColor : pendingColor}
            fontFamily="var(--font-geist-mono), monospace"
            fontWeight="400"
            letterSpacing="0.1em"
            opacity={verified ? 0.6 : 0.2}
          >
            <textPath href={`#arc-bottom-${d}`} startOffset="50%" textAnchor="middle">
              STELLAR SOROBAN · ZERO KNOWLEDGE
            </textPath>
          </text>

          {/* Center: hash or status */}
          {size !== 'sm' && (
            <text
              x={r}
              y={r - (size === 'lg' ? 8 : 5)}
              textAnchor="middle"
              fontSize={size === 'lg' ? 13 : 10}
              fontFamily="var(--font-geist-mono), monospace"
              fontWeight="600"
              letterSpacing="0.05em"
              fill={verified ? giltColor : pendingColor}
              opacity={verified ? 1 : 0.35}
            >
              {centerText}
            </text>
          )}

          {size !== 'sm' && (
            <text
              x={r}
              y={r + (size === 'lg' ? 10 : 7)}
              textAnchor="middle"
              fontSize={size === 'lg' ? 9 : 7.5}
              fontFamily="var(--font-geist-mono), monospace"
              fill={verified ? giltDim : pendingColor}
              letterSpacing="0.08em"
              opacity={verified ? 1 : 0.25}
            >
              {subText}
            </text>
          )}

          {/* Tick mark for verified */}
          {verified && (
            <polyline
              points={`${r * 0.62},${r * 1.04} ${r * 0.85},${r * 1.22} ${r * 1.38},${r * 0.78}`}
              stroke={giltColor}
              strokeWidth={size === 'sm' ? 1.5 : size === 'md' ? 1.8 : 2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="0"
            />
          )}
        </svg>
      </div>

      {label && (
        <span
          className="text-xs font-mono uppercase tracking-widest"
          style={{ color: verified ? giltColor : '#4A433C' }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
