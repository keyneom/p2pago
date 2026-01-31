/**
 * getQuote — fetch ZKP2P quote for exact fiat amount
 */

import { resolveAddress } from './adapters/address.js';
import { fetchQuote } from './adapters/zkp2p-api.js';
import type { GetQuoteOptions, Quote } from './types.js';
import { ZKP2P_API_BASE_URL } from './constants.js';

export interface GetQuoteParams extends GetQuoteOptions {
  /** ZKP2P API base URL (optional) */
  apiBaseUrl?: string;
}

/**
 * Get a quote for donating exact fiat amount via ZKP2P.
 * Resolves recipient (ENS or 0x) before calling API — supports FluidKey for recipient privacy.
 */
export async function getQuote(options: GetQuoteParams): Promise<Quote> {
  const {
    recipient,
    amountUsd,
    userAddress,
    platform,
    chainId,
    destinationToken,
    provider,
    apiBaseUrl,
  } = options;

  const resolvedRecipient = await resolveAddress(recipient, provider);

  const config = { baseUrl: apiBaseUrl ?? ZKP2P_API_BASE_URL };
  return fetchQuote(config, {
    recipient: resolvedRecipient,
    amountUsd,
    platform,
    chainId,
    destinationToken,
    userAddress,
  });
}
