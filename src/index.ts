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
export { getWalletStatus, getZkp2pStatus, ZKP2P_EXTENSION_INSTALL_URL } from './capabilities.js';
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
} from './constants.js';
export { SDK_VERSION } from './version.js';
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
