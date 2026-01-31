/**
 * PeerAuth extension adapter — proof generation for ZKP2P
 */

import { ZKP2P_EXTENSION_INSTALL_URL } from '../constants.js';

interface ZktlsApi {
  requestConnection(): Promise<boolean>;
  generateProof(params: {
    intentHash: string;
    originalIndex: number;
    platform: string;
    proofIndex?: number;
  }): Promise<{ proofId: string; platform: string }>;
  fetchProofById(proofId: string): Promise<{ notaryRequest: { [key: string]: unknown } }>;
}

/**
 * Encode proof as bytes for fulfillIntent (JSON -> TextEncoder -> 0x hex)
 */
function encodeProofAsBytes(proof: unknown): string {
  const proofString = JSON.stringify(proof);
  const encoder = new TextEncoder();
  const proofBytes = encoder.encode(proofString);
  return (
    '0x' +
    Array.from(proofBytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  );
}

/**
 * Generate and encode proof via PeerAuth extension.
 * Requires window.zktls (PeerAuth extension installed).
 */
export async function generateAndEncodeProof(
  intentHash: string,
  platform: string,
  originalIndex: number = 0
): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error(
      `ZKP2P proof generation requires the PeerAuth browser extension. Install from: ${ZKP2P_EXTENSION_INSTALL_URL}`
    );
  }
  const zktls = window.zktls as ZktlsApi | undefined;
  if (!zktls || typeof zktls.requestConnection !== 'function') {
    throw new Error(
      `ZKP2P path requires PeerAuth browser extension. Install from Chrome Web Store: ${ZKP2P_EXTENSION_INSTALL_URL}`
    );
  }

  const connected = await zktls.requestConnection();
  if (!connected) {
    throw new Error('PeerAuth connection was not approved');
  }

  const { proofId } = await zktls.generateProof({
    intentHash,
    originalIndex,
    platform: platform.toLowerCase(),
  });

  const { notaryRequest } = await (zktls as ZktlsApi).fetchProofById(proofId);
  const proofBytes = encodeProofAsBytes(notaryRequest);
  return proofBytes;
}
