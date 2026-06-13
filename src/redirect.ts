/**
 * Redirect flow — open the hosted Peer onramp UI with prefilled params.
 *
 * Peer extension 0.6.0 (rolled out via Chrome Web Store auto-update) removed
 * `peerExtensionSdk.onramp()` and the entire deeplink/side-panel API. The
 * extension is now headless and only handles payment-capture inside the
 * hosted Peer UI. To open an onramp from an external site we navigate to
 * https://www.peer.xyz/swap with the same query params the deeplink used to
 * forward. This works whether or not the extension is installed — peer.xyz
 * surfaces the install prompt inline as needed.
 */

import { resolveAddress } from './adapters/address.js';
import {
  P2PAGO_DEFAULT_RECIPIENT,
  P2PAGO_DEFAULT_REFERRER,
  PEER_ONRAMP_URL,
  MIN_DONATION_WARNING_USD,
} from './constants.js';
import type { Provider } from './types.js';

/** Base USDC on Base (chainId:tokenAddress) */
const BASE_USDC = '8453:0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

export interface OpenRedirectOnrampOptions {
  /** Recipient address or ENS (e.g. FluidKey p2pago.fkey.id). Default: p2pago.fkey.id. Resolved to 0x before redirecting so the gating service receives a checksummed address. */
  recipientAddress?: string;
  /** Provider for ENS resolution. Omit to use a default mainnet provider (requires ethers in env). */
  provider?: Provider | null;
  /** Amount in USD (e.g. 10 or "10.50"). Used when inputAmount is not set. */
  amountUsd?: number | string;
  /** Input fiat amount (overrides amountUsd). String for exact decimals. */
  inputAmount?: string | number;
  /** Output token. Default: Base USDC */
  toToken?: string;
  /** Payment platform (e.g. 'venmo', 'cashapp'). User can change on peer.xyz. */
  paymentPlatform?: string;
  /** Referrer string for attribution (app name). Default: "p2pago". */
  referrer?: string;
  /** Referrer logo URL */
  referrerLogo?: string;
  /** URL to return to after successful onramp */
  callbackUrl?: string;
  /** Input currency. Default: USD */
  inputCurrency?: string;
  /**
   * window.open target. Default: '_blank' (new tab).
   * Pass '_self' to navigate the current tab instead.
   */
  target?: string;
}

export interface OpenDonationOptions extends OpenRedirectOnrampOptions {
  /**
   * Callback when donation amount is below MIN_DONATION_WARNING_USD ($2).
   * Return false to abort opening; return true or undefined to proceed.
   */
  onSmallAmountWarning?: (message: string) => boolean | void;
  /**
   * Retained for backwards compatibility. Previously controlled whether to
   * open the extension install page when the extension was missing. Since the
   * hosted Peer onramp no longer requires the extension to start the flow,
   * this flag has no effect; peer.xyz surfaces the install prompt itself.
   */
  openInstallPageIfMissing?: boolean;
}

const intentHashRegex = /^0x[0-9a-fA-F]{64}$/;

function buildOnrampUrl(params: {
  referrer?: string;
  referrerLogo?: string;
  inputCurrency?: string;
  inputAmount?: string;
  paymentPlatform?: string;
  toToken?: string;
  recipientAddress?: string;
  callbackUrl?: string;
  intentHash?: string;
}): string {
  const search = new URLSearchParams();
  const set = (key: string, value: string | undefined): void => {
    if (value !== undefined && value !== '') search.set(key, value);
  };
  set('referrer', params.referrer);
  set('referrerLogo', params.referrerLogo);
  set('inputCurrency', params.inputCurrency);
  set('inputAmount', params.inputAmount);
  set('paymentPlatform', params.paymentPlatform);
  set('toToken', params.toToken);
  set('recipientAddress', params.recipientAddress);
  set('callbackUrl', params.callbackUrl);
  if (params.intentHash) {
    if (!intentHashRegex.test(params.intentHash)) {
      throw new Error('intentHash must be a 0x-prefixed 32-byte hex string');
    }
    set('intentHash', params.intentHash.toLowerCase());
  }
  const qs = search.toString();
  return qs ? `${PEER_ONRAMP_URL}?${qs}` : PEER_ONRAMP_URL;
}

/**
 * Open the hosted Peer onramp (redirect flow) in a new tab.
 * Resolves recipientAddress (ENS/fkey) to a checksummed 0x address so the
 * gating service receives the EIP-55 format it signs against.
 *
 * @param options — Override defaults. referrer defaults to "p2pago".
 */
export async function openRedirectOnramp(options: OpenRedirectOnrampOptions = {}): Promise<void> {
  const {
    recipientAddress = P2PAGO_DEFAULT_RECIPIENT,
    provider,
    amountUsd,
    inputAmount,
    toToken = BASE_USDC,
    paymentPlatform,
    referrer = P2PAGO_DEFAULT_REFERRER,
    referrerLogo,
    callbackUrl,
    inputCurrency = 'USD',
    target = '_blank',
  } = options;

  const resolvedRecipient = await resolveAddress(recipientAddress, provider);

  const resolvedInputAmount =
    inputAmount != null ? String(inputAmount) : amountUsd != null ? String(amountUsd) : undefined;

  const url = buildOnrampUrl({
    referrer,
    referrerLogo,
    inputCurrency,
    inputAmount: resolvedInputAmount,
    paymentPlatform,
    toToken,
    recipientAddress: resolvedRecipient,
    callbackUrl,
  });

  if (typeof window === 'undefined') {
    throw new Error('openRedirectOnramp requires a browser window');
  }
  window.open(url, target, target === '_blank' ? 'noopener,noreferrer' : undefined);
}

/**
 * Returns true if amount is below the small-donation warning threshold.
 */
export function isSmallDonation(amountUsd: number | string): boolean {
  const n = typeof amountUsd === 'string' ? parseFloat(amountUsd) : amountUsd;
  return !Number.isNaN(n) && n < MIN_DONATION_WARNING_USD;
}

/**
 * Open donation flow (redirect). Optionally warns on small amount.
 * Resolves recipientAddress to a checksummed 0x address before redirecting.
 */
export async function openDonation(options: OpenDonationOptions = {}): Promise<void> {
  // openInstallPageIfMissing is retained but unused; the hosted UI no longer requires the extension to start the flow.
  const { onSmallAmountWarning, openInstallPageIfMissing: _ignored, ...onrampOpts } = options;
  void _ignored;

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

  await openRedirectOnramp(onrampOpts);
}
