/**
 * Default RPC provider for ENS resolution (mainnet).
 * Used when callers do not pass a provider. Lazy singleton; ethers v5/v6 compatible.
 * In browser (UMD), uses global ethers; in Node/ESM uses dynamic import.
 */

import type { Provider } from '../types.js';
import { DEFAULT_MAINNET_RPC_URL } from '../constants.js';

let cached: Provider | null = null;

function getEthers(): unknown {
  const g = typeof globalThis !== 'undefined' ? (globalThis as unknown as Record<string, unknown>) : null;
  if (g?.ethers) return g.ethers;
  const w = typeof window !== 'undefined' ? (window as unknown as Record<string, unknown>) : null;
  if (w?.ethers) return w.ethers;
  return null;
}

function createProviderFromEthers(ethers: unknown, rpcUrl: string): Provider | null {
  const RpcProvider =
    (ethers as { JsonRpcProvider?: new (url: string) => Provider }).JsonRpcProvider ??
    (ethers as { providers?: { JsonRpcProvider?: new (url: string) => Provider } }).providers?.JsonRpcProvider;
  if (!RpcProvider) return null;
  return new RpcProvider(rpcUrl) as Provider;
}

/**
 * Return a mainnet provider suitable for ENS resolution when no provider is passed.
 * Uses global ethers in browser (UMD); otherwise dynamic import. Cached after first success.
 */
export async function getDefaultProvider(): Promise<Provider | null> {
  if (cached) return cached;

  const globalEthers = getEthers();
  if (globalEthers) {
    const p = createProviderFromEthers(globalEthers, DEFAULT_MAINNET_RPC_URL);
    if (p) {
      cached = p;
      return cached;
    }
  }

  try {
    const m = await import('ethers');
    const ethers = (m as { default?: unknown }).default ?? m;
    const p = createProviderFromEthers(ethers, DEFAULT_MAINNET_RPC_URL);
    if (p) {
      cached = p;
      return cached;
    }
  } catch {
    // ignore
  }
  return null;
}
