'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import WalletConnect from './WalletConnect';

const NAV_LINKS = [
  { href: '/employer', label: 'Employer' },
  { href: '/employee', label: 'Employee' },
  { href: '/verify',   label: 'Verify & Pay' },
  { href: '/auditor',  label: 'Auditor' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-[#2E2924] bg-[#0C0A09]/90 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-5 sm:px-8">
        <div className="flex items-center justify-between h-13 py-3">
          {/* Wordmark — serif, no icon */}
          <Link href="/" className="group flex items-center gap-2.5">
            {/* Gilt seal mark */}
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <circle cx="9" cy="9" r="8" stroke="#C8A55A" strokeWidth="1" opacity="0.7"/>
              <circle cx="9" cy="9" r="5" stroke="#C8A55A" strokeWidth="0.5" opacity="0.4"/>
              <circle cx="9" cy="9" r="2" fill="#C8A55A" opacity="0.8"/>
            </svg>
            <span
              className="text-[#E8DFD0] text-base tracking-tight group-hover:text-[#C8A55A] transition-colors duration-200"
              style={{ fontFamily: 'var(--font-serif)', fontWeight: 400 }}
            >
              MeritPay
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map(link => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3.5 py-1.5 rounded text-sm transition-all font-medium tracking-tight ${
                    isActive
                      ? 'text-[#C8A55A] bg-[#C8A55A]/08'
                      : 'text-[#7A6F63] hover:text-[#E8DFD0] hover:bg-[#2E2924]/50'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="ml-1.5 inline-block w-1 h-1 rounded-full bg-[#C8A55A] align-middle" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right side */}
          <div className="hidden md:flex items-center gap-3">
            <WalletConnect />
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden p-2 rounded text-[#7A6F63] hover:text-[#E8DFD0] hover:bg-[#2E2924] transition-colors cursor-pointer"
            onClick={() => setMenuOpen(o => !o)}
            aria-label="Toggle menu"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {menuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-[#2E2924] bg-[#0C0A09] px-5 py-3 space-y-0.5">
          {NAV_LINKS.map(link => {
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMenuOpen(false)}
                className={`block px-3 py-2.5 rounded text-sm font-medium transition-all ${
                  isActive
                    ? 'text-[#C8A55A] bg-[#C8A55A]/08'
                    : 'text-[#7A6F63] hover:text-[#E8DFD0] hover:bg-[#2E2924]'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          <div className="pt-2 pb-1">
            <WalletConnect />
          </div>
        </div>
      )}
    </nav>
  );
}
