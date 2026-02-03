/**
 * Default RPC provider for ENS resolution (mainnet).
 * Used when callers do not pass a provider. Lazy singleton; ethers v5/v6 compatible.
 */

import type { Provider } from '../types.js';
import { DEFAULT_MAINNET_RPC_URL } from '../constants.js';

let cached: Provider | null = null;

/**
 * Return a mainnet provider suitable for ENS resolution when no provider is passed.
 * Uses ethers (v5 or v6) if available; returns null otherwise so callers can throw
 * a clear error. Cached after first successful creation.
 */
export async function getDefaultProvider(): Promise<Provider | null> {
  if (cached) return cached;

  try {
    const m = await import('ethers');
    const ethers = (m as { default?: unknown }).default ?? m;
    const RpcProvider =
      (ethers as { JsonRpcProvider?: new (url: string) => Provider }).JsonRpcProvider ??
      (ethers as { providers?: { JsonRpcProvider?: new (url: string) => Provider } }).providers?.JsonRpcProvider;
    if (!RpcProvider) return null;
    cached = new RpcProvider(DEFAULT_MAINNET_RPC_URL) as Provider;
    return cached;
  } catch {
    return null;
  }
}
