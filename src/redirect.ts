/**
 * Redirect flow — open Peer extension onramp with p2pago defaults
 */

import { peerExtensionSdk } from '@zkp2p/sdk';
import { getZkp2pStatus } from './capabilities.js';
import {
  P2PAGO_DEFAULT_RECIPIENT,
  P2PAGO_DEFAULT_REFERRER,
  ZKP2P_EXTENSION_INSTALL_URL,
  MIN_DONATION_WARNING_USD,
} from './constants.js';

/** Base USDC on Base (chainId:tokenAddress) */
const BASE_USDC = '8453:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export interface OpenRedirectOnrampOptions {
  /** Recipient address or ENS (e.g. FluidKey p2pago.fkey.id). Default: p2pago.fkey.id */
  recipientAddress?: string;
  /** Amount in USD (e.g. 10 or "10.50"). Used when inputAmount is not set. */
  amountUsd?: number | string;
  /** Input fiat amount (overrides amountUsd). String for exact decimals. */
  inputAmount?: string | number;
  /** Output token. Default: Base USDC */
  toToken?: string;
  /** Payment platform (e.g. 'venmo', 'cashapp'). User can change in extension. */
  paymentPlatform?: string;
  /** Referrer string for attribution (app name). Default: "p2pago". */
  referrer?: string;
  /** Referrer logo URL */
  referrerLogo?: string;
  /** URL to return to after successful onramp */
  callbackUrl?: string;
  /** Input currency. Default: USD */
  inputCurrency?: string;
}

export interface OpenDonationOptions extends OpenRedirectOnrampOptions {
  /**
   * Callback when donation amount is below MIN_DONATION_WARNING_USD ($2).
   * Return false to abort opening; return true or undefined to proceed.
   */
  onSmallAmountWarning?: (message: string) => boolean | void;
  /**
   * If true and extension is missing, open install page instead of throwing.
   * Default: false (throw with install URL in error).
   */
  openInstallPageIfMissing?: boolean;
}

/**
 * Open the Peer extension onramp (redirect flow).
 * Gasless; extension handles submission. Requires Peer extension installed.
 *
 * @param options — Override defaults. referrer defaults to "p2pago".
 */
export function openRedirectOnramp(options: OpenRedirectOnrampOptions = {}): void {
  const {
    recipientAddress = P2PAGO_DEFAULT_RECIPIENT,
    amountUsd,
    inputAmount,
    toToken = BASE_USDC,
    paymentPlatform,
    referrer = P2PAGO_DEFAULT_REFERRER,
    referrerLogo,
    callbackUrl,
    inputCurrency = 'USD',
  } = options;

  const resolvedInputAmount =
    inputAmount != null ? String(inputAmount) : amountUsd != null ? String(amountUsd) : undefined;

  peerExtensionSdk.onramp({
    referrer,
    ...(referrerLogo && { referrerLogo }),
    recipientAddress,
    inputCurrency,
    ...(resolvedInputAmount && { inputAmount: resolvedInputAmount }),
    ...(paymentPlatform && { paymentPlatform }),
    toToken,
    ...(callbackUrl && { callbackUrl }),
  });
}

/**
 * Returns true if amount is below the small-donation warning threshold.
 */
export function isSmallDonation(amountUsd: number | string): boolean {
  const n = typeof amountUsd === 'string' ? parseFloat(amountUsd) : amountUsd;
  return !Number.isNaN(n) && n < MIN_DONATION_WARNING_USD;
}

/**
 * Open donation flow (redirect). Checks extension, optionally warns on small amount.
 * Throws if extension not installed (unless openInstallPageIfMissing).
 */
export function openDonation(options: OpenDonationOptions = {}): void {
  const { onSmallAmountWarning, openInstallPageIfMissing = false, ...onrampOpts } = options;

  const { available } = getZkp2pStatus();
  if (!available) {
    if (openInstallPageIfMissing && typeof window !== 'undefined') {
      window.open(ZKP2P_EXTENSION_INSTALL_URL, '_blank', 'noopener,noreferrer');
      return;
    }
    throw new Error(
      `Peer extension required for ZKP2P donations. Install from: ${ZKP2P_EXTENSION_INSTALL_URL}`
    );
  }

  const amount =
    onrampOpts.inputAmount != null
      ? (typeof onrampOpts.inputAmount === 'string'
          ? parseFloat(onrampOpts.inputAmount)
          : onrampOpts.inputAmount)
      : onrampOpts.amountUsd != null
        ? (typeof onrampOpts.amountUsd === 'string' ? parseFloat(onrampOpts.amountUsd) : onrampOpts.amountUsd)
        : undefined;

  if (amount != null && isSmallDonation(amount) && onSmallAmountWarning) {
    const msg = `Donations under $${MIN_DONATION_WARNING_USD} may take longer to process.`;
    const proceed = onSmallAmountWarning(msg);
    if (proceed === false) return;
  }

  openRedirectOnramp(onrampOpts);
}
