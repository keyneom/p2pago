/**
 * p2pago constants.
 *
 * Contract addresses, payment-method hashes, fiat-currency hashes, and verifier
 * addresses are NOT defined here — those live in @zkp2p/sdk (re-exported via
 * this package's top-level entry) and stay in sync with the contracts.
 */

/** Base chain ID */
export const BASE_CHAIN_ID = 8453 as const;

/** USDC token address on Base */
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

/** Default Ethereum mainnet RPC URL used for ENS resolution when no provider is passed. */
export const DEFAULT_MAINNET_RPC_URL = 'https://ethereum.publicnode.com' as const;

/** PeerAuth extension Chrome Web Store install URL. */
export const ZKP2P_EXTENSION_INSTALL_URL =
  'https://chromewebstore.google.com/detail/peerauth-authenticate-and/ijpgccednehjpeclfcllnjjcmiohdjih' as const;

/** Hosted Peer onramp URL — receives query params and drives the full flow. */
export const PEER_ONRAMP_URL = 'https://www.peer.xyz/swap' as const;

/** Default recipient when no app recipient specified (FluidKey ENS). */
export const P2PAGO_DEFAULT_RECIPIENT = 'p2pago.fkey.id' as const;

/** Default referrer string for attribution on peer.xyz. */
export const P2PAGO_DEFAULT_REFERRER = 'p2pago' as const;

/** Fee parameters. Reserved for future use. */
export const P2PAGO_FEE_PERCENT = 0.01;
export const P2PAGO_FEE_MIN_USD = 0.1;

/** Maximum allowed gas cost as fraction of donation amount. */
export const GAS_COST_MAX_FRACTION = 0.5;

/** Amount threshold below which a small-donation warning may be shown. */
export const MIN_DONATION_WARNING_USD = 2;
