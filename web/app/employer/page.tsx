'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { fundPool, getPoolBalance, getEpoch, explorerTxUrl } from '@/lib/stellar';
import WalletConnect from '@/components/WalletConnect';

interface EmployeeRow {
  id: number;
  name: string;
  baseSalary: number;
  hoursThreshold: number;
  hoursBonus: number;
  salesBonus: number;
}

const INITIALS_COLORS = ['#C8A55A', '#5A9B78', '#7A6B44', '#A87A3A', '#3B6B52'];
const MAX_EMPLOYEES = 5;

let _nextId = 1;
function makeRow(): EmployeeRow {
  return { id: _nextId++, name: '', baseSalary: 0, hoursThreshold: 160, hoursBonus: 0, salesBonus: 0 };
}

function parseCSV(text: string): EmployeeRow[] | string {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return 'CSV must have a header row and at least one data row.';

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const required = ['name', 'base_salary', 'hours_threshold', 'hours_bonus', 'sales_bonus'];
  const missing = required.filter(r => !headers.includes(r));
  if (missing.length) return `Missing columns: ${missing.join(', ')}`;

  const rows: EmployeeRow[] = [];
  for (let i = 1; i < lines.length && rows.length < MAX_EMPLOYEES; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const col = (key: string) => values[headers.indexOf(key)] ?? '';
    rows.push({
      id: _nextId++,
      name: col('name'),
      baseSalary: parseFloat(col('base_salary')) || 0,
      hoursThreshold: parseInt(col('hours_threshold')) || 160,
      hoursBonus: parseFloat(col('hours_bonus')) || 0,
      salesBonus: parseFloat(col('sales_bonus')) || 0,
    });
  }
  return rows;
}

function downloadTemplate() {
  const csv = [
    'name,base_salary,hours_threshold,hours_bonus,sales_bonus',
    'Alice,100,160,20,15',
    'Bob,120,160,25,18',
    'Carol,110,160,22,12',
  ].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'meritpay-employees.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function EmployerPage() {
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [saved, setSaved] = useState(false);
  const [csvError, setCsvError] = useState('');
  const [poolBalance, setPoolBalance] = useState<number | null>(null);
  const [epoch, setEpoch] = useState<number>(1);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [fundAmount, setFundAmount] = useState('');
  const [fundState, setFundState] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [fundError, setFundError] = useState('');
  const [fundTxHash, setFundTxHash] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const refreshPoolStats = () => {
    getPoolBalance().then(setPoolBalance).catch(() => {});
    getEpoch().then(setEpoch).catch(() => {});
  };

  useEffect(() => {
    const stored = localStorage.getItem('meritpay:payroll-config');
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as EmployeeRow[];
        if (parsed.length) {
          _nextId = Math.max(...parsed.map(r => r.id)) + 1;
          setRows(parsed);
        }
      } catch { /* ignore */ }
    }
  }, []);

  useEffect(() => {
    refreshPoolStats();
  }, []);

  const totalPool = rows.reduce((acc, r) => acc + r.baseSalary + r.hoursBonus + r.salesBonus, 0);
  const topUpNeeded = poolBalance !== null ? Math.max(0, totalPool - poolBalance) : 0;
  const parsedFundAmount = parseFloat(fundAmount);
  const canFund = !!walletAddress && parsedFundAmount > 0 && fundState !== 'sending';

  const handleFundPool = async () => {
    if (!canFund) return;
    setFundState('sending');
    setFundError('');
    setFundTxHash('');
    try {
      const hash = await fundPool(parsedFundAmount);
      setFundTxHash(hash);
      setFundState('success');
      setFundAmount('');
      refreshPoolStats();
    } catch (e) {
      setFundError(e instanceof Error ? e.message : 'Funding failed');
      setFundState('error');
    }
  };

  const addRow = () => {
    if (rows.length >= MAX_EMPLOYEES) return;
    setRows(prev => [...prev, makeRow()]);
    setSaved(false);
  };

  const deleteRow = (id: number) => {
    setRows(prev => prev.filter(r => r.id !== id));
    setSaved(false);
  };

  const updateRow = (id: number, field: keyof EmployeeRow, value: string | number) => {
    setRows(prev => prev.map(r => (r.id === id ? { ...r, [field]: value } : r)));
    setSaved(false);
  };

  const handleSave = () => {
    localStorage.setItem('meritpay:payroll-config', JSON.stringify(rows));
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleCSV = (file: File) => {
    setCsvError('');
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) ?? '';
      const result = parseCSV(text);
      if (typeof result === 'string') {
        setCsvError(result);
      } else {
        setRows(result);
        setSaved(false);
      }
    };
    reader.readAsText(file);
  };

  const canProceed = rows.length > 0 && rows.every(r => r.name.trim() && r.baseSalary > 0);

  return (
    <div className="min-h-screen px-4 py-10 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-lg bg-[#C8A55A]/20 border border-[#C8A55A]/40 flex items-center justify-center">
              <svg className="w-4 h-4 text-[#C8A55A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h1 className="font-mono font-bold text-2xl text-[#E8DFD0]">Employer Dashboard</h1>
          </div>
          <p className="text-[#7A6F63] text-sm ml-11">
            Payroll Epoch{' '}
            <span className="font-mono text-[#C8A55A]">#{epoch}</span>
            {' '}— add employees manually or upload a CSV
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={rows.length === 0}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#C8A55A] text-[#0C0A09] font-semibold text-sm hover:bg-[#D8B86A] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saved ? (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Saved!
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                </svg>
                Save Config
              </>
            )}
          </button>
          {canProceed ? (
            <Link
              href="/verify"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#5A9B78]/50 text-[#5A9B78] font-semibold text-sm hover:bg-[#5A9B78]/10 transition-all"
            >
              Proceed to Proof Generation
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
          ) : (
            <span className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg border border-[#2E2924] text-[#4A433C] font-semibold text-sm cursor-not-allowed select-none">
              Proceed to Proof Generation
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </span>
          )}
        </div>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Employee table */}
        <div className="lg:col-span-3 space-y-4">

          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={addRow}
              disabled={rows.length >= MAX_EMPLOYEES}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1614] border border-[#2E2924] text-[#E8DFD0] text-sm font-medium hover:border-[#C8A55A]/50 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4 text-[#C8A55A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Employee
              {rows.length > 0 && (
                <span className="text-[#7A6F63] text-xs">({rows.length}/{MAX_EMPLOYEES})</span>
              )}
            </button>

            <button
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1614] border border-[#2E2924] text-[#E8DFD0] text-sm font-medium hover:border-[#5A9B78]/50 transition-all"
            >
              <svg className="w-4 h-4 text-[#5A9B78]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload CSV
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleCSV(f); e.target.value = ''; }}
            />

            <button
              onClick={downloadTemplate}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-[#7A6F63] text-sm hover:text-[#C8A55A] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download template
            </button>
          </div>

          {csvError && (
            <div className="rounded-lg border border-[#A84A4A]/40 bg-[#A84A4A]/10 px-4 py-3 text-sm text-[#D07070]">
              {csvError}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] overflow-hidden">
            <div className="px-6 py-4 border-b border-[#2E2924] flex items-center justify-between">
              <h2 className="font-mono font-semibold text-[#E8DFD0]">Employee Payroll Configuration</h2>
              <span className="text-xs text-[#7A6F63] font-mono">{rows.length} / {MAX_EMPLOYEES} employees</span>
            </div>

            {rows.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
                <div className="w-14 h-14 rounded-full bg-[#2E2924] flex items-center justify-center">
                  <svg className="w-6 h-6 text-[#7A6F63]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <p className="text-[#E8DFD0] font-medium mb-1">No employees added yet</p>
                  <p className="text-[#7A6F63] text-sm">Add employees manually or upload a CSV file above</p>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={addRow}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#C8A55A] text-[#0C0A09] text-sm font-semibold hover:bg-[#D8B86A] transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Add first employee
                  </button>
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#2E2924] text-[#E8DFD0] text-sm hover:border-[#5A9B78]/50 transition-all"
                  >
                    Upload CSV
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#2E2924]">
                      {['#', 'Employee Name', 'Base Salary (XLM)', 'Hours Threshold', 'Hours Bonus', 'Sales Bonus', 'Max Payout', ''].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-mono text-[#7A6F63] uppercase tracking-wide whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row, idx) => {
                      const color = INITIALS_COLORS[idx % INITIALS_COLORS.length];
                      const initials = row.name.trim() ? row.name.trim().slice(0, 2).toUpperCase() : '??';
                      const maxPayout = row.baseSalary + row.hoursBonus + row.salesBonus;
                      return (
                        <tr
                          key={row.id}
                          className="border-b border-[#2E2924]/60 hover:bg-[#2E2924]/20 transition-colors"
                        >
                          {/* # */}
                          <td className="px-4 py-3">
                            <span className="font-mono text-[#7A6F63] text-sm">{idx + 1}</span>
                          </td>

                          {/* Name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div
                                className="w-8 h-8 rounded-full flex items-center justify-center font-mono font-bold text-xs flex-shrink-0"
                                style={{ backgroundColor: color + '22', border: `1.5px solid ${color}`, color }}
                              >
                                {initials}
                              </div>
                              <input
                                type="text"
                                placeholder="Employee name"
                                value={row.name}
                                onChange={e => updateRow(row.id, 'name', e.target.value)}
                                className="w-32 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-3 py-1.5 text-sm text-[#E8DFD0] placeholder-[#4A433C] focus:outline-none focus:border-[#C8A55A] focus:ring-1 focus:ring-[#C8A55A]/30 transition-colors"
                              />
                            </div>
                          </td>

                          {/* Base salary */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                value={row.baseSalary || ''}
                                placeholder="0"
                                onChange={e => updateRow(row.id, 'baseSalary', parseFloat(e.target.value) || 0)}
                                className="w-20 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-3 py-1.5 text-sm font-mono text-[#E8DFD0] placeholder-[#4A433C] focus:outline-none focus:border-[#C8A55A] focus:ring-1 focus:ring-[#C8A55A]/30 transition-colors"
                              />
                              <span className="text-[#7A6F63] text-xs font-mono">XLM</span>
                            </div>
                          </td>

                          {/* Hours threshold */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                step={1}
                                value={row.hoursThreshold || ''}
                                placeholder="160"
                                onChange={e => updateRow(row.id, 'hoursThreshold', parseInt(e.target.value) || 160)}
                                className="w-16 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-2 py-1.5 text-sm font-mono text-[#E8DFD0] placeholder-[#4A433C] focus:outline-none focus:border-[#C8A55A] focus:ring-1 focus:ring-[#C8A55A]/30 transition-colors"
                              />
                              <span className="text-[#7A6F63] text-xs font-mono">hrs</span>
                            </div>
                          </td>

                          {/* Hours bonus */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                step={0.25}
                                value={row.hoursBonus || ''}
                                placeholder="0"
                                onChange={e => updateRow(row.id, 'hoursBonus', parseFloat(e.target.value) || 0)}
                                className="w-16 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-2 py-1.5 text-sm font-mono text-[#5A9B78] placeholder-[#4A433C] focus:outline-none focus:border-[#5A9B78] focus:ring-1 focus:ring-[#5A9B78]/30 transition-colors"
                              />
                              <span className="text-[#7A6F63] text-xs font-mono">XLM</span>
                            </div>
                          </td>

                          {/* Sales bonus */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min={0}
                                step={0.25}
                                value={row.salesBonus || ''}
                                placeholder="0"
                                onChange={e => updateRow(row.id, 'salesBonus', parseFloat(e.target.value) || 0)}
                                className="w-16 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-2 py-1.5 text-sm font-mono text-[#C8A55A] placeholder-[#4A433C] focus:outline-none focus:border-[#C8A55A] focus:ring-1 focus:ring-[#C8A55A]/30 transition-colors"
                              />
                              <span className="text-[#7A6F63] text-xs font-mono">XLM</span>
                            </div>
                          </td>

                          {/* Max payout */}
                          <td className="px-4 py-3">
                            <span className="font-mono font-semibold text-sm text-[#C8A55A]">
                              {maxPayout.toFixed(2)} XLM
                            </span>
                          </td>

                          {/* Delete */}
                          <td className="px-4 py-3">
                            <button
                              onClick={() => deleteRow(row.id)}
                              className="w-7 h-7 rounded-lg border border-transparent text-[#7A6F63] hover:border-[#A84A4A]/50 hover:text-[#D07070] hover:bg-[#A84A4A]/10 transition-all flex items-center justify-center"
                              title="Remove row"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                {rows.length < MAX_EMPLOYEES && (
                  <div className="px-4 py-3 border-t border-[#2E2924]/60">
                    <button
                      onClick={addRow}
                      className="inline-flex items-center gap-2 text-sm text-[#7A6F63] hover:text-[#C8A55A] transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      Add another employee
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* CSV format hint */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-4">
            <p className="text-xs font-mono text-[#7A6F63] mb-2 uppercase tracking-wide">CSV format</p>
            <code className="text-xs font-mono text-[#5A9B78] block">
              name,base_salary,hours_threshold,hours_bonus,sales_bonus
            </code>
            <code className="text-xs font-mono text-[#4A433C] block mt-1">
              Alice,100,160,20,15
            </code>
            <p className="text-xs text-[#4A433C] mt-2">Max {MAX_EMPLOYEES} employees (circuit constraint). Uploading replaces the current list.</p>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Pool status */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-6">
            <h3 className="font-mono font-semibold text-[#E8DFD0] mb-4 flex items-center gap-2">
              <svg className="w-4 h-4 text-[#5A9B78]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Pool Status
            </h3>

            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924]">
                <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-wide mb-1">Pool Balance</p>
                <p className="font-mono font-bold text-2xl text-[#5A9B78]">
                  {poolBalance !== null ? `${poolBalance.toFixed(2)} XLM` : '— XLM'}
                </p>
                <p className="text-[#7A6F63] text-xs mt-1">
                  {poolBalance !== null ? 'Live · testnet' : 'Fetching…'}
                </p>
              </div>

              <div className="p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924]">
                <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-wide mb-1">Current Epoch</p>
                <p className="font-mono font-bold text-2xl text-[#C8A55A]">#{epoch}</p>
              </div>

              <div className="p-3 rounded-lg bg-[#0C0A09] border border-[#2E2924]">
                <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-wide mb-1">Max Payroll</p>
                <p className="font-mono font-bold text-xl text-[#C8A55A]">{totalPool.toFixed(2)} XLM</p>
                <p className="text-[#7A6F63] text-xs mt-1">if all KPIs met</p>
              </div>

              <div className="pt-2 border-t border-[#2E2924] space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-wide">Fund Pool</p>
                  <WalletConnect onConnect={setWalletAddress} />
                </div>

                <div className="flex gap-2">
                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    value={fundAmount}
                    onChange={e => {
                      setFundAmount(e.target.value);
                      if (fundState !== 'idle') setFundState('idle');
                    }}
                    placeholder="Amount in XLM"
                    className="flex-1 bg-[#0C0A09] border border-[#2E2924] rounded-lg px-3 py-2 text-sm font-mono text-[#E8DFD0] placeholder-[#4A433C] focus:outline-none focus:border-[#5A9B78] focus:ring-1 focus:ring-[#5A9B78]/30"
                  />
                  {topUpNeeded > 0 && (
                    <button
                      type="button"
                      onClick={() => setFundAmount(topUpNeeded.toFixed(2))}
                      className="px-2.5 py-2 rounded-lg border border-[#2E2924] text-[#7A6F63] text-[10px] font-mono hover:border-[#5A9B78]/50 hover:text-[#5A9B78] transition-colors cursor-pointer whitespace-nowrap"
                    >
                      +{topUpNeeded.toFixed(2)}
                    </button>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleFundPool}
                  disabled={!canFund}
                  className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: canFund
                      ? 'linear-gradient(135deg, #5A9B78, #3B6B52)'
                      : 'rgba(90,155,120,0.15)',
                    color: 'white',
                    border: '1px solid rgba(90,155,120,0.4)',
                  }}
                >
                  {fundState === 'sending' ? 'Funding…' : 'Fund Pool from Wallet'}
                </button>

                {!walletAddress && (
                  <p className="text-[#7A6F63] text-xs">Connect Freighter to deposit XLM into the payroll pool.</p>
                )}

                {fundState === 'success' && fundTxHash && (
                  <div className="p-2.5 rounded-lg border border-[#4A8C6A]/30 bg-[#4A8C6A]/5">
                    <p className="text-[#4A8C6A] text-xs font-mono mb-1">Pool funded successfully</p>
                    <a
                      href={explorerTxUrl(fundTxHash)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#5A9B78] text-xs hover:underline break-all"
                    >
                      View transaction →
                    </a>
                  </div>
                )}

                {fundState === 'error' && fundError && (
                  <p className="text-[#D07070] text-xs font-mono">{fundError}</p>
                )}

                <p className="text-[#4A433C] text-[11px] leading-relaxed">
                  Deposits transfer XLM from your wallet into the on-chain pool via <span className="font-mono">fund_pool</span>.
                </p>
              </div>
            </div>
          </div>

          {/* ZK Privacy note */}
          <div className="rounded-xl border border-[#C8A55A]/30 bg-[#C8A55A]/5 p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-[#C8A55A] flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <p className="text-[#D8B86A] text-xs font-semibold mb-1">ZK Privacy</p>
                <p className="text-[#7A6F63] text-xs leading-relaxed">
                  Individual KPIs and salaries remain private. Only cryptographic proofs are submitted on-chain.
                </p>
              </div>
            </div>
          </div>

          {/* Epoch window */}
          <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-4">
            <p className="text-[#7A6F63] text-xs font-mono uppercase tracking-wide mb-3">Epoch Window</p>
            <div className="space-y-2 text-sm">
              {[
                { label: 'Start', value: 'Jun 1, 2026' },
                { label: 'End', value: 'Jun 30, 2026' },
                { label: 'Settlement', value: 'Jul 1, 2026' },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between">
                  <span className="text-[#7A6F63]">{label}</span>
                  <span className="font-mono text-[#E8DFD0] text-xs">{value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Proceed hint */}
          {!canProceed && rows.length > 0 && (
            <div className="rounded-xl border border-[#2E2924] bg-[#1A1614] p-4">
              <p className="text-[#7A6F63] text-xs">
                All employees must have a <span className="text-[#C8A55A]">name</span> and a <span className="text-[#C8A55A]">base salary &gt; 0</span> to unlock Proceed to Proof Generation.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
