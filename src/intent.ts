/**
 * signalIntent, fulfillIntent — Escrow contract calls
 */

import { callSignalIntent, callFulfillIntent } from './adapters/escrow.js';
import type { Signer } from './types.js';
import type { VerifiedIntent } from './types.js';

/**
 * Signal intent on ZKP2P Escrow. Returns intentHash.
 * Signer must have provider (e.g. ethers provider.getSigner()).
 */
export async function signalIntent(
  signer: Signer,
  verifiedIntent: VerifiedIntent
): Promise<string> {
  return callSignalIntent(signer, verifiedIntent);
}

/**
 * Fulfill intent on ZKP2P Escrow. Returns tx receipt with hash.
 */
export async function fulfillIntent(
  signer: Signer,
  proofBytes: string,
  intentHash: string
): Promise<{ hash: string }> {
  return callFulfillIntent(signer, proofBytes, intentHash);
}
