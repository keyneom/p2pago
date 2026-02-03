/**
 * ZKP2P Donate SDK constants
 * Base mainnet values; override via config when needed.
 */

/** ZKP2P Escrow contract address on Base */
export const ESCROW_ADDRESS = '0xCA38607D85E8F6294Dc10728669605E6664C2D70' as const;

/** Base chain ID */
export const BASE_CHAIN_ID = 8453 as const;

/** USDC token address on Base */
export const USDC_ADDRESS = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' as const;

/** ZKP2P API base URL (v1) */
export const ZKP2P_API_BASE_URL = 'https://api.zkp2p.xyz/v1' as const;

/** Default Ethereum mainnet RPC URL used for ENS resolution when no provider is passed */
export const DEFAULT_MAINNET_RPC_URL = 'https://ethereum.publicnode.com' as const;

/** PeerAuth extension Chrome Web Store install URL */
export const ZKP2P_EXTENSION_INSTALL_URL =
  'https://chromewebstore.google.com/detail/zkp2p-extension/ijpgccednehjpeclfcllnjjcmiohdjih' as const;

/** Default recipient when no app recipient specified (FluidKey ENS) */
export const P2PAGO_DEFAULT_RECIPIENT = 'p2pago.fkey.id' as const;

/** Default referrer string for Peer extension onramp (attribution/display) */
export const P2PAGO_DEFAULT_REFERRER = 'p2pago' as const;

/** Fee parameters. Reserved for future use. */
export const P2PAGO_FEE_PERCENT = 0.01;
export const P2PAGO_FEE_MIN_USD = 0.1;

/** Maximum allowed gas cost as fraction of donation amount. */
export const GAS_COST_MAX_FRACTION = 0.5;

/** Amount threshold below which a small-donation warning may be shown. */
export const MIN_DONATION_WARNING_USD = 2;

/** Verifier contract addresses by platform (Base) */
export const VERIFIERS: Record<string, string> = {
  venmo: '0x9a733B55a875D0DB4915c6B36350b24F8AB99dF5',
  revolut: '0xAA5A1B62B01781E789C900d616300717CD9A41aB',
  cashapp: '0x76D33A33068D86016B806dF02376dDBb23Dd3703',
  wise: '0xFF0149799631D7A5bdE2e7eA9b306c42b3d9a9ca',
  mercadopago: '0xf2AC5be14F32Cbe6A613CFF8931d95460D6c33A3',
  zelle: '0x431a078A5029146aAB239c768A615CD484519aF7',
} as const;
