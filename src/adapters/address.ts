/**
 * Address resolution — ENS (including FluidKey) or raw 0x address
 */

import type { Provider } from '../types.js';

const HEX_REGEX = /^0x[a-fA-F0-9]{40}$/;

/** Check if input looks like a raw Ethereum address */
function isAddress(value: string): boolean {
  return HEX_REGEX.test(value);
}

/**
 * Resolve recipient to address. If ENS (e.g. FluidKey *.fkey.eth), resolve via provider.
 * With FluidKey, each resolution returns a unique stealth address for recipient privacy.
 */
export async function resolveAddress(
  recipient: string,
  provider: Provider | null | undefined
): Promise<string> {
  if (isAddress(recipient)) {
    return recipient;
  }
  if (!provider) {
    throw new Error(
      'ENS resolution requires a provider. Pass provider in options when recipient is an ENS name (e.g. myapp.fkey.eth).'
    );
  }
  let resolved: string | null = null;
  if (provider.resolveName) {
    resolved = await provider.resolveName(recipient);
  } else if (provider.getResolver) {
    const resolver = await provider.getResolver(recipient);
    if (resolver?.resolve) {
      resolved = await resolver.resolve(recipient);
    }
  }
  if (!resolved) {
    throw new Error(`Failed to resolve ENS name: ${recipient}`);
  }
  return resolved;
}
