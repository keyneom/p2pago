/**
 * Capability detection — wallet and ZKP2P extension availability
 */

import { ZKP2P_EXTENSION_INSTALL_URL } from './constants.js';

export { ZKP2P_EXTENSION_INSTALL_URL };

/** Wallet status (e.g. MetaMask, injected wallet) */
export interface WalletStatus {
  available: boolean;
}

/** ZKP2P PeerAuth extension status */
export interface Zkp2pStatus {
  available: boolean;
  needsInstall?: boolean;
}

declare global {
  interface Window {
    ethereum?: unknown;
    zktls?: unknown;
  }
}

/** Check if a wallet (e.g. MetaMask) is available via window.ethereum */
export function getWalletStatus(): WalletStatus {
  if (typeof window === 'undefined') {
    return { available: false };
  }
  return { available: typeof window.ethereum !== 'undefined' };
}

/** Check if ZKP2P PeerAuth extension is available via window.zktls */
export function getZkp2pStatus(): Zkp2pStatus {
  if (typeof window === 'undefined') {
    return { available: false, needsInstall: true };
  }
  const available = typeof window.zktls !== 'undefined';
  return { available, needsInstall: !available };
}
