'use client';

import type { MockProof } from './types';
import { serializeProof, signalToBytes32 } from './proof';

export const PAYROLL_CONTRACT_ID =
  process.env.NEXT_PUBLIC_PAYROLL_CONTRACT_ID ?? 'NOT_DEPLOYED';
export const CLAIM_CONTRACT_ID =
  process.env.NEXT_PUBLIC_CLAIM_CONTRACT_ID ?? 'NOT_DEPLOYED';
export const VERIFIER_CONTRACT_ID =
  process.env.NEXT_PUBLIC_VERIFIER_CONTRACT_ID ?? 'NOT_DEPLOYED';
export const NETWORK_PASSPHRASE = 'Test SDF Network ; September 2015';
export const RPC_URL = 'https://soroban-testnet.stellar.org';
export const EXPLORER_URL = 'https://stellar.expert/explorer/testnet';

// ── Freighter helpers (v4 API) ────────────────────────────────────────────────

async function getFreighter() {
  try {
    return await import('@stellar/freighter-api');
  } catch {
    return null;
  }
}

export async function isFreighterInstalled(): Promise<boolean> {
  const f = await getFreighter();
  if (!f) return false;
  try {
    const r = await f.isConnected();
    return !r.error;
  } catch {
    return false;
  }
}

export async function isWalletConnected(): Promise<boolean> {
  const f = await getFreighter();
  if (!f) return false;
  try {
    const r = await f.isConnected();
    return r.isConnected && !r.error;
  } catch {
    return false;
  }
}

/** Open Freighter popup (if needed) and return the connected address. */
export async function connectWallet(): Promise<string | null> {
  const f = await getFreighter();
  if (!f) return null;
  try {
    const r = await f.requestAccess();
    if (r.error || !r.address) return null;
    return r.address;
  } catch {
    return null;
  }
}

async function getConnectedKey(): Promise<string> {
  const key = await connectWallet();
  if (!key) throw new Error('Wallet not connected — please connect Freighter first');
  return key;
}

// ── Soroban SDK (lazy load to avoid SSR) ────────────────────────────────────
// Import everything from the same module to avoid class identity mismatch.
// @stellar/stellar-sdk re-exports its rpc submodule as `sdk.rpc`, so using
// a separate `import('@stellar/stellar-sdk/rpc')` produces a different class
// instance in the webpack bundle — instanceof checks inside assembleTransaction
// then fail with "expected a 'Transaction', got: [object Object]".
async function sdkImports() {
  const stellar = await import('@stellar/stellar-sdk');
  const rpc = stellar.rpc;
  return { stellar, rpc };
}

// ── Build + sign + submit pattern ─────────────────────────────────────────────

async function sendContractTx(
  publicKey: string,
  contractId: string,
  method: string,
  args: unknown[],
  formatError: (raw: string) => string = formatSimulationError,
): Promise<string> {
  const { stellar, rpc } = await sdkImports();
  const { Contract, Transaction, TransactionBuilder, Networks, BASE_FEE, Address, nativeToScVal } = stellar;
  const { Server, assembleTransaction, Api } = rpc;

  const server = new Server(RPC_URL);
  console.log('[stellar] getAccount', publicKey);
  const account = await server.getAccount(publicKey);
  console.log('[stellar] account loaded, sequence:', account.sequenceNumber());
  const contract = new Contract(contractId);

  // Build ScVal args
  const scArgs = args.map((a, i) => {
    let val;
    if (typeof a === 'bigint') { val = nativeToScVal(a, { type: 'i128' }); }
    else if (a instanceof Uint8Array) { val = nativeToScVal(Buffer.from(a), { type: 'bytes' }); }
    else if (Array.isArray(a) && a.every(el => el instanceof Uint8Array)) {
      val = nativeToScVal(a.map(el => Buffer.from(el as Uint8Array)));
    }
    else if (typeof a === 'string' && a.startsWith('G')) { val = new Address(a).toScVal(); }
    else { val = nativeToScVal(a); }
    console.log(`[stellar] arg[${i}] type=${typeof a} isArray=${Array.isArray(a)} isUint8=${a instanceof Uint8Array} scVal=`, val);
    return val;
  });

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(300)
    .build();
  console.log('[stellar] tx built, XDR length:', tx.toXDR().length);

  console.log('[stellar] simulating...');
  const sim = await server.simulateTransaction(tx);
  console.log('[stellar] sim result:', JSON.stringify(sim).slice(0, 400));
  if (Api.isSimulationError(sim)) {
    throw new Error(formatError((sim as { error: string }).error));
  }

  console.log('[stellar] assembling transaction...');
  const prepared = assembleTransaction(tx, sim).build();
  console.log('[stellar] prepared XDR length:', prepared.toXDR().length);

  const freighter = await getFreighter();
  if (!freighter) throw new Error('Freighter not found');

  console.log('[stellar] signing with Freighter...');
  const signResult = await freighter.signTransaction(prepared.toXDR(), {
    networkPassphrase: Networks.TESTNET,
    address: publicKey, // tell Freighter which account must sign (employee vs employer)
  });
  console.log('[stellar] sign result error:', signResult.error, 'xdr length:', signResult.signedTxXdr?.length);
  if (signResult.error) throw new Error(`Signing failed: ${signResult.error.message}`);
  const signedXdr = signResult.signedTxXdr;

  console.log('[stellar] parsing signed XDR with new Transaction()...');
  let signedTx;
  try {
    signedTx = new Transaction(signedXdr, Networks.TESTNET);
    console.log('[stellar] parsed OK');
  } catch (e) {
    console.error('[stellar] new Transaction() failed:', e);
    console.log('[stellar] falling back to TransactionBuilder.fromXDR...');
    try {
      signedTx = TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET);
      console.log('[stellar] TransactionBuilder.fromXDR OK');
    } catch (e2) {
      console.error('[stellar] TransactionBuilder.fromXDR also failed:', e2);
      throw e2;
    }
  }

  console.log('[stellar] submitting to network...');
  const submitResult = await server.sendTransaction(signedTx);
  console.log('[stellar] submit result:', submitResult.status, submitResult.hash);

  if (submitResult.status === 'ERROR') {
    throw new Error(`Submission failed: ${JSON.stringify(submitResult.errorResult)}`);
  }

  // Poll until confirmed
  for (let i = 0; i < 30; i++) {
    await new Promise(r => setTimeout(r, 2000));
    const res = await server.getTransaction(submitResult.hash);
    if (res.status === 'SUCCESS') return submitResult.hash;
    if (res.status === 'FAILED') throw new Error(`Transaction failed on-chain: ${JSON.stringify(res)}`);
  }
  throw new Error('Transaction timed out (60s)');
}

async function simulateReadOnly(
  contractId: string,
  method: string,
  args: unknown[] = [],
  sourceKey?: string,
): Promise<unknown> {
  const { stellar, rpc } = await sdkImports();
  const { Contract, TransactionBuilder, Networks, BASE_FEE, nativeToScVal, scValToNative } = stellar;
  const { Server, Api } = rpc;

  // Use deployer address for simulation source if no wallet connected
  const DEPLOYER = process.env.NEXT_PUBLIC_DEPLOYER_ADDRESS ??
    'GAO5NNZVKTORYRUR6E4XH43DFNGIVNDL7UCLDCOYUZITFXZSCC4RW2YX';
  const source = sourceKey ?? DEPLOYER;

  const server = new Server(RPC_URL);
  const account = await server.getAccount(source);
  const contract = new Contract(contractId);

  const scArgs = args.map(a => {
    if (a instanceof Uint8Array) return nativeToScVal(Buffer.from(a), { type: 'bytes' });
    if (Array.isArray(a) && a.every(el => el instanceof Uint8Array)) {
      return nativeToScVal(a.map(el => Buffer.from(el as Uint8Array)));
    }
    return nativeToScVal(a);
  });

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(contract.call(method, ...scArgs))
    .setTimeout(30)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (Api.isSimulationError(sim)) {
    throw new Error(`Simulation failed: ${(sim as { error: string }).error}`);
  }

  const successSim = sim as { result?: { retval: unknown } };
  if (!successSim.result?.retval) return null;
  return scValToNative(successSim.result.retval as Parameters<typeof scValToNative>[0]);
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Returns pool balance in XLM (bigint stroops / 1e7) */
export async function getPoolBalance(): Promise<number> {
  try {
    const raw = await simulateReadOnly(PAYROLL_CONTRACT_ID, 'get_pool_balance');
    if (raw == null) return 0;
    const stroops = typeof raw === 'bigint' ? raw : BigInt(String(raw));
    return Number(stroops) / 1e7;
  } catch {
    return 0;
  }
}

/** Returns current payroll epoch */
export async function getEpoch(): Promise<number> {
  try {
    const raw = await simulateReadOnly(PAYROLL_CONTRACT_ID, 'get_epoch');
    return Number(raw ?? 0);
  } catch {
    return 0;
  }
}

/** Fund the payroll pool with `xlmAmount` XLM from the connected wallet */
export async function fundPool(xlmAmount: number): Promise<string> {
  const publicKey = await getConnectedKey();
  const stroops = BigInt(Math.round(xlmAmount * 1e7));
  return sendContractTx(publicKey, PAYROLL_CONTRACT_ID, 'fund_pool', [
    publicKey, // funder: Address
    stroops,   // amount: i128
  ]);
}

/** Map Soroban contract error codes from the payroll contract to readable messages. */
function formatSimulationError(raw: string): string {
  const payrollErrors: Record<number, string> = {
    1: 'Contract is already initialized.',
    2: 'Contract is not initialized.',
    3: 'Unauthorized — connect the contract admin wallet.',
    4: 'Nullifier already spent — regenerate proofs for the next payroll epoch (do not reuse an old aggregated proof).',
    5: 'Invalid ZK proof — verification failed on-chain.',
    6: 'Insufficient pool balance — fund the pool before executing payroll.',
    7: 'Invalid payroll amount — total must be positive.',
    8: 'Claim contract not configured — redeploy or call set_claim_contract.',
  };

  const match = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (match) {
    const code = Number(match[1]);
    const hint = payrollErrors[code];
    if (hint) return `Simulation failed: ${hint} (Contract error #${code})`;
  }
  return `Simulation failed: ${raw}`;
}

function formatClaimSimulationError(raw: string): string {
  const claimErrors: Record<number, string> = {
    1: 'Claim contract is already initialized.',
    2: 'Claim contract is not initialized.',
    3: 'Payroll batch not authorized — wait for employer to execute payroll first.',
    4: 'This payout has already been claimed.',
    5: 'Invalid claim proof — verification failed on-chain.',
    6: 'Invalid claim amount.',
    7: 'Insufficient escrow in the claim contract.',
    8: 'Payroll epoch has not been executed yet.',
    9: 'Proof public signals do not match claim arguments.',
  };

  const match = raw.match(/Error\(Contract,\s*#(\d+)\)/);
  if (match) {
    const code = Number(match[1]);
    const hint = claimErrors[code];
    if (hint) return `Simulation failed: ${hint} (Contract error #${code})`;
  }
  return formatSimulationError(raw);
}

// Payroll nullifiers
// Public signals: employeeIds[5], hoursThresholds[5], totalPayroll, payrollEpoch, nullifiers[5]
function extractNullifiers(publicSignals: string[]): Uint8Array[] {
  return publicSignals.slice(12, 17).map(s => signalToBytes32(s));
}

/**
 * Execute payroll on-chain.
 * `totalPayroll` is in circuit units; 1 unit = 1000 stroops.
 */
export async function executePayroll(
  proof: MockProof,
  publicSignals: string[],
  totalPayroll: number,
): Promise<string> {
  const publicKey = await getConnectedKey();
  const proofBytes = serializeProof(proof);
  const signalBytes = publicSignals.map(s => signalToBytes32(s));
  const nullifierBytes = extractNullifiers(publicSignals);
  // 1 circuit unit = 10_000 stroops = 0.001 XLM
  const totalPayrollStroops = BigInt(Math.round(totalPayroll)) * 10000n;

  return sendContractTx(publicKey, PAYROLL_CONTRACT_ID, 'execute_payroll', [
    publicKey,          // caller: Address
    proofBytes,         // proof: Bytes (256)
    signalBytes,        // public_signals: Vec<BytesN<32>>
    nullifierBytes,     // nullifiers: Vec<BytesN<32>>
    totalPayrollStroops, // total_payroll: i128
  ]);
}

/**
 * Claim an individual payroll payout on-chain.
 * Public signals: [nullifier, payrollEpoch, amount] (circuit units for amount).
 *
 * `recipientAddress` is the employee's Stellar wallet (G...). The contract calls
 * require_auth() on this address, so Freighter must be connected to this account.
 */
export async function claimPayout(
  proof: MockProof,
  publicSignals: string[],
  nullifier: Uint8Array,
  payoutCircuit: number,
  recipientAddress: string,
): Promise<string> {
  const proofBytes = serializeProof(proof);
  const signalBytes = publicSignals.map(s => signalToBytes32(s));
  const amountStroops = BigInt(Math.round(payoutCircuit)) * 10000n;

  return sendContractTx(
    recipientAddress,   // source account — must be connected in Freighter (satisfies require_auth)
    CLAIM_CONTRACT_ID,
    'claim_payout',
    [
      recipientAddress, // recipient: where XLM is sent, must match signer
      proofBytes,
      signalBytes,
      nullifier,
      amountStroops,
    ],
    formatClaimSimulationError,
  );
}

/** Verify an auditor disclosure proof (read-only simulation). */
export async function verifyAuditor(
  proof: MockProof,
  publicSignals: string[],
): Promise<boolean> {
  const proofBytes = serializeProof(proof);
  const signalBytes = publicSignals.map(s => signalToBytes32(s));
  try {
    const result = await simulateReadOnly(PAYROLL_CONTRACT_ID, 'verify_auditor', [
      proofBytes,
      signalBytes,
    ]);
    return Boolean(result);
  } catch {
    return false;
  }
}

export function explorerTxUrl(txHash: string): string {
  return `${EXPLORER_URL}/tx/${txHash}`;
}
