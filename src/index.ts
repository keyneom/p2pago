/**
 * ZKP2P Donate SDK — public exports
 */

export { getQuote } from './quote.js';
export { verifyIntent } from './verify.js';
export { signalIntent, fulfillIntent } from './intent.js';
export { generateAndEncodeProof } from './proof.js';
export { recordDonation, getDonationStatus } from './donation.js';
export { handle402 } from './handle402.js';
export { runZkp2pDonation, completeZkp2pDonation } from './orchestration.js';
export {
  getWalletStatus,
  getZkp2pStatus,
  whenExtensionAvailable,
  ZKP2P_EXTENSION_INSTALL_URL,
} from './capabilities.js';
export type { WhenExtensionAvailableOptions } from './capabilities.js';
export {
  openRedirectOnramp,
  openDonation,
  isSmallDonation,
  type OpenRedirectOnrampOptions,
  type OpenDonationOptions,
} from './redirect.js';
export {
  P2PAGO_DEFAULT_RECIPIENT,
  P2PAGO_DEFAULT_REFERRER,
  P2PAGO_FEE_PERCENT,
  P2PAGO_FEE_MIN_USD,
  GAS_COST_MAX_FRACTION,
  MIN_DONATION_WARNING_USD,
  DEFAULT_MAINNET_RPC_URL,
} from './constants.js';
export { SDK_VERSION } from './version.js';
export { resolveRecipient } from './adapters/address.js';
export type { ResolveRecipientOptions } from './adapters/address.js';
export {
  getSupportedChains,
  SUPPORTED_CHAINS,
  NATIVE_TOKEN_ADDRESS,
  ERC20_TRANSFER_TOPIC,
} from './chains.js';
export type { ChainConfig, TokenConfig } from './chains.js';
export { verifyPaymentTx } from './verify-payment-tx.js';
export type { VerifyPaymentTxParams } from './verify-payment-tx.js';
export type { PaymentRequiredBody, PaymentProof } from './contracts/402-v1.js';
export type {
  Signer,
  Provider,
  Quote,
  QuoteIntent,
  VerifiedIntent,
  DonationRecord,
  StorageAdapter,
} from './types.js';
export type { WalletStatus, Zkp2pStatus } from './capabilities.js';
export type { DonationStatus } from './donation.js';
