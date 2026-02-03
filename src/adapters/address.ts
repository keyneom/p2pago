/**
 * Address resolution — ENS (including FluidKey) or raw 0x address
 */

import type { Provider } from '../types.js';
import { getDefaultProvider } from './default-provider.js';

const HEX_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Check if input looks like a raw Ethereum address */
function isAddress(value: string): boolean {
  return HEX_REGEX.test(value);
}

/**
 * Resolve recipient to address. If ENS (e.g. FluidKey *.fkey.eth), resolve via provider.
 * When no provider is passed, uses a default mainnet provider (requires ethers).
 * With FluidKey, each resolution returns a unique stealth address for recipient privacy.
 */
export async function resolveAddress(
  recipient: string,
  provider: Provider | null | undefined
): Promise<string> {
  if (isAddress(recipient)) {
    return recipient;
  }

  const effectiveProvider = provider ?? (await getDefaultProvider());
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
  return resolved;
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
