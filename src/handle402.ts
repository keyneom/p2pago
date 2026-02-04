/**
 * handle402 — client-side 402 Payment Required flow
 */

import { resolveAddress } from './adapters/address.js';
import {
  isPaymentRequiredBody,
  type PaymentProof,
  type PaymentRequiredBody,
} from './contracts/402-v1.js';
import type { Signer } from './types.js';
import type { VerifiedIntent } from './types.js';
import { getQuote } from './quote.js';
import { signalIntent } from './intent.js';
import { generateAndEncodeProof } from './proof.js';
import { fulfillIntent } from './intent.js';
import type { Provider } from './types.js';
import { BASE_CHAIN_ID } from './constants.js';

export interface Handle402Options {
  signer: Signer;
  /** Resolved recipient or ENS (e.g. FluidKey) — resolved before sending */
  recipient: string;
  /** Use ZKP2P (Venmo/Cash App) path. If false, use direct crypto. */
  useZkp2p: boolean;
  /** Backend URL for ZKP2P verify. Required when useZkp2p. */
  verifyUrl?: string;
  /** Provider for ENS resolution */
  provider?: Provider;
}

/**
 * Handle 402 Payment Required. Pays via crypto or ZKP2P, returns PaymentProof for retry.
 */
export async function handle402(
  body: unknown,
  options: Handle402Options
): Promise<PaymentProof> {
  if (!isPaymentRequiredBody(body)) {
    throw new Error('Invalid 402 body: missing paymentRequired, recipient, or chainId');
  }

  const { recipient, chainId, amountWei, zkp2p } = body as PaymentRequiredBody;
  const resolvedRecipient = await resolveAddress(recipient, options.provider);
  const chain = chainId ?? BASE_CHAIN_ID;

  if (options.useZkp2p && zkp2p?.enabled && zkp2p.verifyUrl) {
    return runZkp2pPath(options.signer, resolvedRecipient, body, options);
  }

  return runCryptoPath(options.signer, resolvedRecipient, chain, amountWei);
}

async function runCryptoPath(
  signer: Signer,
  recipient: string,
  chainId: number,
  amountWei?: string
): Promise<PaymentProof> {
  const value = amountWei ? BigInt(amountWei) : 0n;
  const tx = await signer.sendTransaction({
    to: recipient,
    value,
  });
  return {
    type: 'crypto',
    chainId,
    txHash: tx.hash,
    recipient,
    ...(amountWei && { amount: amountWei }),
  };
}

async function runZkp2pPath(
  signer: Signer,
  recipient: string,
  body: PaymentRequiredBody,
  options: Handle402Options
): Promise<PaymentProof> {
  const verifyUrl = body.zkp2p?.verifyUrl ?? options.verifyUrl;
  if (!verifyUrl) {
    throw new Error('ZKP2P path requires verifyUrl in 402 body or options');
  }

  const userAddress = await signer.getAddress();
  const amountUsd = body.amountFormatted
    ? parseFloat(body.amountFormatted.replace(/[^0-9.]/g, ''))
    : 5;

  const quote = await getQuote({
    recipient,
    amountUsd,
    userAddress,
    provider: options.provider,
    chainId: body.chainId,
  });

  // Resolve toAddress so verify/intent receives a 0x address (ZKP2P arrayify fails on ENS/fkey ids)
  const resolvedToAddress = await resolveAddress(
    quote.intent.toAddress,
    options.provider
  );
  const intentForVerify: typeof quote.intent = {
    ...quote.intent,
    toAddress: resolvedToAddress,
  };

  const verifyRes = await fetch(verifyUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(intentForVerify),
  });
  if (!verifyRes.ok) {
    throw new Error(`Verify intent failed: ${verifyRes.status}`);
  }
  const json = (await verifyRes.json()) as
    | VerifiedIntent
    | { responseObject: VerifiedIntent };
  const verified: VerifiedIntent =
    json && typeof json === 'object' && 'responseObject' in json && json.responseObject
      ? json.responseObject
      : (json as VerifiedIntent);

  const intentHash = await signalIntent(signer, verified);
  const proofBytes = await generateAndEncodeProof(intentHash, quote.platform);
  const { hash } = await fulfillIntent(signer, proofBytes, intentHash);

  return {
    type: 'zkp2p',
    chainId: body.chainId,
    txHash: hash,
    recipient,
  };
}
