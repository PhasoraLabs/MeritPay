'use client';

import { useState, useEffect } from 'react';
import { connectWallet, isWalletConnected } from '@/lib/stellar';

type WalletState = 'idle' | 'connecting' | 'connected' | 'no-extension';

interface WalletConnectProps {
  onConnect?: (address: string) => void;
}

export default function WalletConnect({ onConnect }: WalletConnectProps) {
  const [state, setState] = useState<WalletState>('idle');
  const [address, setAddress] = useState<string | null>(null);

  useEffect(() => {
    isWalletConnected().then(connected => {
      if (connected) {
        connectWallet().then(pk => {
          if (pk) {
            setAddress(pk);
            setState('connected');
            onConnect?.(pk);
          }
        });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleConnect = async () => {
    setState('connecting');
    try {
      const pk = await connectWallet();
      if (pk) {
        setAddress(pk);
        setState('connected');
        onConnect?.(pk);
      } else {
        const hasExt = typeof window !== 'undefined' &&
          ('freighter' in window || 'freighterApi' in window);
        setState(hasExt ? 'idle' : 'no-extension');
      }
    } catch {
      setState('no-extension');
    }
  };

  const truncate = (addr: string) => addr.slice(0, 4) + '…' + addr.slice(-4);

  if (state === 'connected' && address) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#2E2924] bg-[#1A1614]">
        <span className="w-2 h-2 rounded-full bg-[#4A8C6A] animate-pulse-dot" />
        <span className="font-mono text-xs text-[#E8DFD0]">{truncate(address)}</span>
        <span className="text-xs text-[#7A6F63]">Testnet</span>
      </div>
    );
  }

  if (state === 'no-extension') {
    return (
      <a
        href="https://freighter.app"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#C8A55A]/50 bg-[#C8A55A]/10 text-[#C8A55A] text-xs font-medium hover:bg-[#C8A55A]/20 transition-colors"
      >
        Install Freighter
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
        </svg>
      </a>
    );
  }

  if (state === 'connecting') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#C8A55A]/50 bg-[#C8A55A]/10 text-[#C8A55A] text-xs font-medium">
        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        Connecting…
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-[#C8A55A]/50 bg-[#C8A55A]/10 text-[#C8A55A] text-xs font-medium hover:bg-[#C8A55A]/20 hover:border-[#C8A55A] transition-all cursor-pointer"
    >
      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      Connect Wallet
    </button>
  );
}
