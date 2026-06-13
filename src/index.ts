/**
 * p2pago — public surface.
 *
 * Two layers:
 *
 * 1. **Donation / redirect helpers** — opinionated, donation-shaped wrappers
 *    we own (URL building, ENS+FluidKey resolution, small-amount warning,
 *    donor support status, 402 crypto payments). Stable from our side.
 *
 * 2. **Full @zkp2p/sdk re-export** — for any flow richer than "redirect
 *    button" (custom quote UI, on-chain signal/fulfill, payment-capture
 *    bridge), import `Zkp2pClient`, `createPeerExtensionSdk`, etc. directly
 *    from this package. We deliberately do *not* wrap these — peer's surface
 *    is evolving fast, and an abstraction here would just be a tax.
 */

// Donation / redirect button — our abstraction
export {
  openRedirectOnramp,
  openDonation,
  isSmallDonation,
  type OpenRedirectOnrampOptions,
  type OpenDonationOptions,
} from './redirect.js';

// Donor support status (local-storage record of last donation)
export { recordDonation, getDonationStatus } from './donation.js';
export type { DonationStatus } from './donation.js';

// HTTP 402 crypto-payment helper
export { handle402 } from './handle402.js';
export type { PaymentRequiredBody, PaymentProof } from './contracts/402-v1.js';

// Capability detection — wallet + Peer extension
export {
  getWalletStatus,
  getZkp2pStatus,
  whenExtensionAvailable,
  ZKP2P_EXTENSION_INSTALL_URL,
} from './capabilities.js';
export type { WalletStatus, Zkp2pStatus, WhenExtensionAvailableOptions } from './capabilities.js';

// ENS + FluidKey resolver
export { resolveRecipient } from './adapters/address.js';
export type { ResolveRecipientOptions } from './adapters/address.js';

// Chain config + on-chain payment receipt verification
export {
  getSupportedChains,
  SUPPORTED_CHAINS,
  NATIVE_TOKEN_ADDRESS,
  ERC20_TRANSFER_TOPIC,
} from './chains.js';
export type { ChainConfig, TokenConfig } from './chains.js';
export { verifyPaymentTx } from './verify-payment-tx.js';
export type { VerifyPaymentTxParams } from './verify-payment-tx.js';

// Constants
export {
  P2PAGO_DEFAULT_RECIPIENT,
  P2PAGO_DEFAULT_REFERRER,
  P2PAGO_FEE_PERCENT,
  P2PAGO_FEE_MIN_USD,
  GAS_COST_MAX_FRACTION,
  MIN_DONATION_WARNING_USD,
  DEFAULT_MAINNET_RPC_URL,
  PEER_ONRAMP_URL,
  BASE_CHAIN_ID,
  USDC_ADDRESS,
} from './constants.js';

// Shared types
export type { Signer, Provider, DonationRecord, StorageAdapter } from './types.js';

// Package version
export { SDK_VERSION } from './version.js';

// ---- @zkp2p/sdk re-export ----------------------------------------------------
// Direct pass-through. New peer features show up here automatically; we do not
// own a compatibility shim. Consumers depend on @zkp2p/sdk via this package.
export * from '@zkp2p/sdk';
