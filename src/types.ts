/**
 * ZKP2P Donate SDK — shared types
 */

/** Minimal signer interface compatible with ethers v5/v6 and viem */
export interface Signer {
  getAddress(): Promise<string>;
  sendTransaction(tx: {
    to: string;
    value?: bigint;
    data?: string;
    gasLimit?: bigint;
  }): Promise<{ hash: string }>;
}

/** RPC provider for ENS resolution (e.g. JsonRpcProvider from ethers) */
export interface Provider {
  resolveName?(name: string): Promise<string | null>;
  getResolver?(name: string): Promise<{ resolve?(name: string): Promise<string | null> } | null>;
}

/** ZKP2P quote request */
export interface GetQuoteOptions {
  recipient: string;
  amountUsd: number;
  /** Sender/donor address (from wallet) — required for ZKP2P quote */
  userAddress: string;
  platform?: string;
  chainId?: number;
  destinationToken?: string;
  /** Provider for ENS resolution when recipient is ENS (e.g. FluidKey) */
  provider?: Provider;
}

/** Intent from ZKP2P quote */
export interface QuoteIntent {
  depositId: string;
  processorName: string;
  amount: string;
  toAddress: string;
  payeeDetails: string;
  processorIntentData?: Record<string, unknown>;
  fiatCurrencyCode: string;
  chainId: string;
}

/** Single quote from ZKP2P response */
export interface QuoteItem {
  fiatAmount: string;
  fiatAmountFormatted: string;
  tokenAmount: string;
  tokenAmountFormatted: string;
  paymentMethod: string;
  payeeAddress: string;
  conversionRate: string;
  intent: QuoteIntent;
}

/** Normalized quote returned by getQuote */
export interface Quote {
  quotes: QuoteItem[];
  intent: QuoteIntent;
  payeeAddress: string;
  platform: string;
  fiatAmountFormatted: string;
  tokenAmountFormatted: string;
}

/** Verified intent from ZKP2P /verify/intent */
export interface VerifiedIntent {
  signedIntent: string;
  intentData: {
    depositId: string;
    tokenAmount: string;
    recipientAddress: string;
    verifierAddress: string;
    currencyCodeHash: string;
    gatingServiceSignature: string;
  };
}

/** Donation record stored per account */
export interface DonationRecord {
  lastDonationAt: string;
  txHash?: string;
  amount?: string;
  chainId?: number;
}

/** Storage adapter interface */
export interface StorageAdapter {
  get(key: string): Promise<DonationRecord | null>;
  set(key: string, value: DonationRecord): Promise<void>;
}
