/**
 * generateAndEncodeProof — PeerAuth proof generation
 */

import { generateAndEncodeProof as adapterGenerateProof } from './adapters/peerauth.js';

/**
 * Generate and encode payment proof via PeerAuth extension.
 * Requires PeerAuth extension (window.zktls). Use getZkp2pStatus() to check availability.
 */
export async function generateAndEncodeProof(
  intentHash: string,
  platform: string,
  originalIndex: number = 0
): Promise<string> {
  return adapterGenerateProof(intentHash, platform, originalIndex);
}
