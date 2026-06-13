/**
 * handle402 — client-side HTTP 402 Payment Required flow.
 *
 * Pays the 402 body's recipient with a direct on-chain transfer (native or ERC-20)
 * and returns a PaymentProof the caller can retry the request with.
 *
 * The previous ZKP2P-via-extension path has been removed: Peer extension 0.6.0
 * dropped the in-extension proof generation API this depended on. Apps that
 * want a ZKP2P-backed 402 flow should compose `Zkp2pClient` (re-exported from
 * `@zkp2p/sdk`) directly and feed the resulting tx hash into PaymentProof
 * themselves.
 */

import { resolveAddress } from './adapters/address.js';
import {
  isPaymentRequiredBody,
  type PaymentProof,
  type PaymentRequiredBody,
} from './contracts/402-v1.js';
import type { Signer, Provider } from './types.js';
import { BASE_CHAIN_ID } from './constants.js';

export interface Handle402Options {
  signer: Signer;
  /** Provider for ENS / FluidKey resolution. */
  provider?: Provider;
}

/**
 * Pay a 402 body via direct on-chain transfer. Returns a PaymentProof.
 */
export async function handle402(
  body: unknown,
  options: Handle402Options
): Promise<PaymentProof> {
  if (!isPaymentRequiredBody(body)) {
    throw new Error('Invalid 402 body: missing paymentRequired, recipient, or chainId');
  }

  const { recipient, chainId, amountWei } = body as PaymentRequiredBody;
  const resolvedRecipient = await resolveAddress(recipient, options.provider);
  const chain = chainId ?? BASE_CHAIN_ID;

  const value = amountWei ? BigInt(amountWei) : 0n;
  const tx = await options.signer.sendTransaction({
    to: resolvedRecipient,
    value,
  });

  return {
    type: 'crypto',
    chainId: chain,
    txHash: tx.hash,
    recipient: resolvedRecipient,
    ...(amountWei && { amount: amountWei }),
  };
}
