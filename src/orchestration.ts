/**
 * Orchestration helpers — runZkp2pDonation, completeZkp2pDonation
 */

import { getQuote } from './quote.js';
import { signalIntent } from './intent.js';
import { generateAndEncodeProof } from './proof.js';
import { fulfillIntent } from './intent.js';
import type { Signer } from './types.js';
import type { Quote, VerifiedIntent } from './types.js';

export interface RunZkp2pDonationOptions {
  signer: Signer;
  recipient: string;
  amountUsd: number;
  platform?: string;
  /** Callback to get verified intent (your backend calls ZKP2P /verify/intent) */
  getVerifiedIntent: (intent: Quote['intent']) => Promise<VerifiedIntent>;
  provider?: import('./types.js').Provider;
  apiBaseUrl?: string;
}

export interface RunZkp2pDonationResult {
  intentHash: string;
  payeeAddress: string;
  platform: string;
}

/**
 * Run quote -> verify (via callback) -> signalIntent.
 * Returns { intentHash, payeeAddress, platform } so app can show "Pay $X to @user".
 * Then app calls completeZkp2pDonation after user pays.
 */
export async function runZkp2pDonation(
  options: RunZkp2pDonationOptions
): Promise<RunZkp2pDonationResult> {
  const { signer, recipient, amountUsd, platform, getVerifiedIntent, provider, apiBaseUrl } =
    options;

  const userAddress = await signer.getAddress();
  const quote = await getQuote({
    recipient,
    amountUsd,
    userAddress,
    platform,
    provider,
    apiBaseUrl,
  });

  const verified = await getVerifiedIntent(quote.intent);
  const intentHash = await signalIntent(signer, verified);

  return {
    intentHash,
    payeeAddress: quote.payeeAddress,
    platform: quote.platform,
  };
}

/**
 * Complete ZKP2P donation: generate proof -> fulfillIntent.
 * Call after user has made the Venmo/Cash App payment.
 */
export async function completeZkp2pDonation(
  signer: Signer,
  intentHash: string,
  platform: string
): Promise<{ hash: string }> {
  const proofBytes = await generateAndEncodeProof(intentHash, platform);
  return fulfillIntent(signer, proofBytes, intentHash);
}
