/**
 * ZKP2P REST API adapter
 */

import type { Quote, QuoteIntent, QuoteItem, VerifiedIntent } from '../types.js';
import { ZKP2P_API_BASE_URL } from '../constants.js';

export interface Zkp2pApiAdapterConfig {
  baseUrl?: string;
}

/** Convert USD amount to 6-decimal string (e.g. 5 -> "5000000") */
function toExactFiatAmount(amountUsd: number): string {
  return Math.round(amountUsd * 1_000_000).toString();
}

/**
 * Fetch quote from ZKP2P /quote/exact-fiat
 */
export async function fetchQuote(
  config: Zkp2pApiAdapterConfig,
  params: {
    recipient: string;
    amountUsd: number;
    platform?: string;
    chainId?: number;
    destinationToken?: string;
    userAddress: string;
  }
): Promise<Quote> {
  const baseUrl = config.baseUrl ?? ZKP2P_API_BASE_URL;
  const chainId = params.chainId ?? 8453;
  const destinationToken =
    params.destinationToken ?? '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

  const paymentPlatforms = params.platform
    ? [params.platform.toLowerCase()]
    : ['venmo', 'cashapp'];

  const body = {
    paymentPlatforms,
    fiatCurrency: 'USD',
    user: params.userAddress,
    recipient: params.recipient,
    destinationChainId: chainId,
    destinationToken,
    exactFiatAmount: toExactFiatAmount(params.amountUsd),
  };

  const res = await fetch(`${baseUrl}/quote/exact-fiat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ZKP2P quote failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    success?: boolean;
    responseObject?: {
      quotes?: Array<{
        fiatAmount: string;
        fiatAmountFormatted: string;
        tokenAmount: string;
        tokenAmountFormatted: string;
        paymentMethod: string;
        payeeAddress: string;
        conversionRate: string;
        intent: QuoteIntent;
      }>;
    };
  };

  if (!json.success || !json.responseObject?.quotes?.length) {
    throw new Error('ZKP2P quote returned no quotes');
  }

  const first = json.responseObject.quotes[0];
  const quoteItem: QuoteItem = {
    fiatAmount: first.fiatAmount,
    fiatAmountFormatted: first.fiatAmountFormatted,
    tokenAmount: first.tokenAmount,
    tokenAmountFormatted: first.tokenAmountFormatted,
    paymentMethod: first.paymentMethod,
    payeeAddress: first.payeeAddress,
    conversionRate: first.conversionRate,
    intent: first.intent,
  };

  return {
    quotes: [quoteItem],
    intent: first.intent,
    payeeAddress: first.payeeAddress,
    platform: first.paymentMethod,
    fiatAmountFormatted: first.fiatAmountFormatted,
    tokenAmountFormatted: first.tokenAmountFormatted,
  };
}

/**
 * Verify intent via ZKP2P /verify/intent (call from backend; apiKey stays on server)
 */
export async function verifyIntent(
  config: Zkp2pApiAdapterConfig,
  intent: QuoteIntent,
  apiKey: string
): Promise<VerifiedIntent> {
  const baseUrl = config.baseUrl ?? ZKP2P_API_BASE_URL;

  const body = {
    processorName: intent.processorName,
    depositId: intent.depositId,
    tokenAmount: intent.amount,
    payeeDetails: intent.payeeDetails,
    toAddress: intent.toAddress,
    fiatCurrencyCode: intent.fiatCurrencyCode,
    chainId: intent.chainId,
  };

  const res = await fetch(`${baseUrl}/verify/intent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ZKP2P verify intent failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    success?: boolean;
    responseObject?: {
      signedIntent: string;
      intentData: VerifiedIntent['intentData'];
    };
  };

  if (!json.success || !json.responseObject) {
    throw new Error('ZKP2P verify intent failed');
  }

  return {
    signedIntent: json.responseObject.signedIntent,
    intentData: json.responseObject.intentData,
  };
}
