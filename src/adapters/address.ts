/**
 * Address resolution — ENS (including FluidKey) or raw 0x address
 */

import { ethers } from 'ethers';
import type { Provider } from '../types.js';
import { getDefaultProvider } from './default-provider.js';

const HEX_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Check if input looks like a raw Ethereum address */
function isAddress(value: string): boolean {
  return HEX_REGEX.test(value);
}

/**
 * Normalize address to checksummed format (EIP-55).
 * ZKP2P's gating service signs checksummed addresses, so we must match.
 */
function toChecksumAddress(address: string): string {
  try {
    return ethers.getAddress(address);
  } catch {
    // ethers v5 fallback
    if ((ethers as unknown as { utils?: { getAddress?: (a: string) => string } }).utils?.getAddress) {
      return (ethers as unknown as { utils: { getAddress: (a: string) => string } }).utils.getAddress(address);
    }
    throw new Error(`Invalid address: ${address}`);
  }
}

/**
 * Resolve recipient to address. If ENS (e.g. FluidKey p2pago.fkey.id), resolve via provider.
 *
 * - ENS resolution only works on Ethereum mainnet (ethers throws on Base/L2). We always use
 *   a mainnet provider for resolution.
 * - The resolved 0x address is valid on all EVM chains. FluidKey uses a derivation (coinType
 *   for chainId 0) so stealth addresses work across Base, Polygon, etc. So resolving on L1
 *   and sending on Base is safe—FluidKey will detect the payment. See FluidKey technical docs.
 */
export async function resolveAddress(
  recipient: string,
  provider: Provider | null | undefined
): Promise<string> {
  if (isAddress(recipient)) {
    // Always return checksummed address (EIP-55) for consistency with ZKP2P gating service
    return toChecksumAddress(recipient);
  }

  // ENS resolution requires mainnet (ethers throws "network does not support ENS" on Base/L2).
  // FluidKey .fkey.id is ENS; use default mainnet provider so resolution works regardless of caller's chain.
  const effectiveProvider = await getDefaultProvider();
  if (!effectiveProvider) {
    throw new Error(
      'ENS resolution requires a provider. Pass provider in options when recipient is an ENS name (e.g. myapp.fkey.eth), or ensure ethers is installed for default mainnet resolution.'
    );
  }

  let resolved: string | null = null;
  if (effectiveProvider.resolveName) {
    resolved = await effectiveProvider.resolveName(recipient);
  } else if (effectiveProvider.getResolver) {
    const resolver = await effectiveProvider.getResolver(recipient);
    if (resolver?.resolve) {
      resolved = await resolver.resolve(recipient);
    }
  }
  if (!resolved) {
    throw new Error(`Failed to resolve ENS name: ${recipient}`);
  }
  // Always return checksummed address (EIP-55) for consistency with ZKP2P gating service
  return toChecksumAddress(resolved);
}

/** Options for resolveRecipient (public API). */
export interface ResolveRecipientOptions {
  /** Provider for ENS resolution. Omit to use SDK default mainnet provider (requires ethers). */
  provider?: Provider | null;
}

/**
 * Resolve recipient to a 0x address. Input may be ENS (e.g. p2pago.fkey.id) or already a 0x address.
 * When no provider is passed, uses SDK default mainnet provider (requires ethers).
 */
export async function resolveRecipient(
  recipient: string,
  options: ResolveRecipientOptions = {}
): Promise<string> {
  return resolveAddress(recipient, options.provider);
}
