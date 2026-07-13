'use client';

import type { Employee, KPIResult } from '@/lib/types';

export interface EmployeeCardProps {
  employee: Employee;
  status?: 'pending' | 'generating' | 'proved' | 'error';
  kpiResult?: KPIResult;
  selected?: boolean;
  onSelect?: () => void;
}

// Warm, earthy initials palette — no indigo/purple
const AVATAR_COLORS: [string, string][] = [
  ['#C8A55A', '#9C7E3E'],
  ['#3B6B52', '#2D5240'],
  ['#7A6B44', '#5C5030'],
  ['#5A7A6B', '#3E5A50'],
  ['#8A6A42', '#6A4E28'],
];

const STATUS_CONFIG = {
  pending:    { label: 'Pending',  bg: 'rgba(74,67,60,0.15)',    border: 'rgba(74,67,60,0.3)',    color: '#7A6F63' },
  generating: { label: 'Proving…', bg: 'rgba(200,165,90,0.1)',  border: 'rgba(200,165,90,0.3)',  color: '#C8A55A' },
  proved:     { label: 'Proved',   bg: 'rgba(59,107,82,0.1)',    border: 'rgba(59,107,82,0.3)',   color: '#5A9B78' },
  error:      { label: 'Error',    bg: 'rgba(168,74,74,0.1)',    border: 'rgba(168,74,74,0.3)',   color: '#D07070' },
};

export default function EmployeeCard({
  employee,
  status = 'pending',
  kpiResult,
  selected = false,
  onSelect,
}: EmployeeCardProps) {
  const [c1, c2] = AVATAR_COLORS[(employee.id - 1) % AVATAR_COLORS.length];
  const cfg = STATUS_CONFIG[status];
  const proved = status === 'proved' && kpiResult;

  return (
    <div
      onClick={onSelect}
      className="merit-card p-4 transition-all duration-200 relative"
      style={{
        cursor: onSelect ? 'pointer' : 'default',
        borderColor: selected
          ? '#C8A55A'
          : proved
          ? 'rgba(59,107,82,0.4)'
          : '#2E2924',
        boxShadow: selected
          ? '0 0 0 1.5px rgba(200,165,90,0.2), 0 4px 20px rgba(0,0,0,0.4)'
          : proved
          ? '0 0 12px rgba(59,107,82,0.08)'
          : 'none',
      }}
    >
      {/* Selected top accent — gilt rule */}
      {selected && (
        <div
          className="absolute top-0 left-0 right-0 h-px rounded-t-[10px]"
          style={{ background: 'linear-gradient(90deg, transparent, #C8A55A, transparent)' }}
        />
      )}

      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[#0C0A09] font-bold text-sm flex-shrink-0"
          style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
        >
          {employee.name[0]}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-0.5">
            <span className="font-medium text-sm text-[#E8DFD0]">
              {employee.name}
            </span>
            {/* Status badge */}
            <span
              className="badge text-[10px] flex items-center gap-1"
              style={{ background: cfg.bg, border: `1px solid ${cfg.border}`, color: cfg.color }}
            >
              {status === 'generating' && (
                <svg className="w-2.5 h-2.5 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.3" />
                  <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                </svg>
              )}
              {status === 'proved' && <span>✓</span>}
              {cfg.label}
            </span>
          </div>

          <p className="text-xs text-[#7A6F63] mb-2.5">
            {employee.role || `Employee #${employee.id}`}
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <div>
              <p className="text-[10px] text-[#4A433C] uppercase tracking-wide mb-0.5">Salary</p>
              <p className="text-xs font-semibold text-[#E8DFD0] font-mono">
                {employee.baseSalary.toLocaleString()}
                <span className="font-normal text-[#7A6F63] ml-0.5">u</span>
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#4A433C] uppercase tracking-wide mb-0.5">Threshold</p>
              <p className="text-xs font-semibold text-[#E8DFD0] font-mono">
                {employee.hoursThreshold}h
              </p>
            </div>
            <div>
              <p className="text-[10px] text-[#4A433C] uppercase tracking-wide mb-0.5">Bonus</p>
              <p className="text-xs font-semibold font-mono" style={{ color: '#C8A55A' }}>
                +{((employee.bonusRate ?? 0.15) * 100).toFixed(0)}%
              </p>
            </div>
          </div>

          {/* KPI results */}
          {proved && (
            <div className="mt-3 pt-2.5 border-t border-[#2E2924]">
              <div className="flex gap-2 mb-1.5">
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-mono"
                  style={{
                    background: kpiResult.hoursMet ? 'rgba(59,107,82,0.12)' : 'rgba(74,67,60,0.15)',
                    color: kpiResult.hoursMet ? '#5A9B78' : '#7A6F63',
                  }}
                >
                  {kpiResult.hoursMet ? '✓' : '✗'} Hours
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded font-mono"
                  style={{
                    background: kpiResult.salesMet ? 'rgba(59,107,82,0.12)' : 'rgba(74,67,60,0.15)',
                    color: kpiResult.salesMet ? '#5A9B78' : '#7A6F63',
                  }}
                >
                  {kpiResult.salesMet ? '✓' : '✗'} Sales
                </span>
              </div>
              <p className="text-[10px] font-mono truncate" style={{ color: '#5A9B78' }}>
                {kpiResult.commitment.slice(0, 22)}…
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
