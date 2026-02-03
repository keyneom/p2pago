/**
 * Supported chains and token metadata for payments and verification.
 * Apps can subset or extend; SDK uses this as the canonical source for RPC and token addresses.
 */

/** Token metadata for a chain (USDC, USDT, native ETH, etc.) */
export interface TokenConfig {
  address: string;
  symbol: string;
  decimals: number;
}

/** Chain metadata. Apps can override rpcUrl or add custom tokens. */
export interface ChainConfig {
  name: string;
  chainId: number;
  rpcUrl?: string;
  tokens?: TokenConfig[];
}

/** Native ETH sentinel (zero address). Use for native transfer verification. */
export const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000' as const;

/** ERC20 Transfer event topic (Transfer(address,address,uint256)) */
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef' as const;

const BASE_RPC = 'https://mainnet.base.org';
const ETHEREUM_RPC = 'https://ethereum.publicnode.com';
const POLYGON_RPC = 'https://polygon-rpc.com';
const ARBITRUM_RPC = 'https://arb1.arbitrum.io/rpc';
const OPTIMISM_RPC = 'https://mainnet.optimism.io';

/** USDC addresses (Circle canonical mainnet). */
const USDC = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
} as const;

/** USDT addresses (Tether, common mainnet). */
const USDT = {
  1: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
  8453: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
  137: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
  42161: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
  10: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
} as const;

function buildChains(): Record<number, ChainConfig> {
  const chains: Record<number, ChainConfig> = {};

  const entries: Array<{
    chainId: number;
    name: string;
    rpcUrl: string;
    usdc: string;
    usdt: string;
  }> = [
    { chainId: 1, name: 'Ethereum', rpcUrl: ETHEREUM_RPC, usdc: USDC[1], usdt: USDT[1] },
    { chainId: 8453, name: 'Base', rpcUrl: BASE_RPC, usdc: USDC[8453], usdt: USDT[8453] },
    { chainId: 137, name: 'Polygon', rpcUrl: POLYGON_RPC, usdc: USDC[137], usdt: USDT[137] },
    { chainId: 42161, name: 'Arbitrum One', rpcUrl: ARBITRUM_RPC, usdc: USDC[42161], usdt: USDT[42161] },
    { chainId: 10, name: 'OP Mainnet', rpcUrl: OPTIMISM_RPC, usdc: USDC[10], usdt: USDT[10] },
  ];

  for (const { chainId, name, rpcUrl, usdc, usdt } of entries) {
    chains[chainId] = {
      name,
      chainId,
      rpcUrl,
      tokens: [
        { address: NATIVE_TOKEN_ADDRESS, symbol: 'ETH', decimals: 18 },
        { address: usdc, symbol: 'USDC', decimals: 6 },
        { address: usdt, symbol: 'USDT', decimals: 6 },
      ],
    };
  }

  return chains;
}

/** Supported chains with name, rpcUrl, and default tokens (ETH, USDC, USDT). Apps can subset or extend. */
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = buildChains();

/**
 * Return the supported chain config. Use for "pay with wallet" UI (display names, USDC address, decimals)
 * and for verification (RPC URL). Apps can pass a custom chain map to verifyPaymentTx if needed.
 */
export function getSupportedChains(): Record<number, ChainConfig> {
  return SUPPORTED_CHAINS;
}
