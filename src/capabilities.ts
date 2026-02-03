/**
 * Capability detection — wallet and ZKP2P extension availability
 */

import { ZKP2P_EXTENSION_INSTALL_URL } from './constants.js';

export { ZKP2P_EXTENSION_INSTALL_URL };

/** Wallet status (e.g. MetaMask, injected wallet) */
export interface WalletStatus {
  available: boolean;
}

/** ZKP2P PeerAuth extension status. `available` true when redirect onramp can be opened (peer or zktls). */
export interface Zkp2pStatus {
  available: boolean;
  needsInstall?: boolean;
  /** True when proof generation (generateAndEncodeProof) is possible; requires window.zktls */
  proofAvailable?: boolean;
}

declare global {
  interface Window {
    ethereum?: unknown;
    zktls?: unknown;
    peer?: unknown;
  }
}

/** Check if a wallet (e.g. MetaMask) is available via window.ethereum */
export function getWalletStatus(): WalletStatus {
  if (typeof window === 'undefined') {
    return { available: false };
  }
  return { available: typeof window.ethereum !== 'undefined' };
}

/**
 * Check if the Peer extension is available for the redirect onramp (Venmo/Cash App).
 * Uses the same globals the onramp flow uses: window.peer (Peer SDK) or window.zktls.
 * When only peer is present, openDonation/openRedirectOnramp work; proof generation requires zktls.
 */
export function getZkp2pStatus(): Zkp2pStatus {
  if (typeof window === 'undefined') {
    return { available: false, needsInstall: true, proofAvailable: false };
  }
  const peer = typeof window.peer !== 'undefined';
  const zktls = typeof window.zktls !== 'undefined';
  const available = peer || zktls;
  return { available, needsInstall: !available, proofAvailable: zktls };
}

export interface WhenExtensionAvailableOptions {
  /** Max time to wait (ms). Default 3000. Resolves when available or after timeout. */
  timeoutMs?: number;
  /** Poll interval (ms). Default 100. */
  pollIntervalMs?: number;
}

/**
 * Wait for the Peer extension to become available (e.g. after async injection).
 * Listens for zktls#initialized and polls getZkp2pStatus(). Resolves when available or after timeoutMs.
 * Use before deciding to show "install extension" so UIs don't flash "not installed" when the extension is installed but not yet injected.
 */
export function whenExtensionAvailable(
  options: WhenExtensionAvailableOptions = {}
): Promise<void> {
  const { timeoutMs = 3000, pollIntervalMs = 100 } = options;

  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  const status = getZkp2pStatus();
  if (status.available) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const deadline = Date.now() + timeoutMs;

    const check = (): void => {
      if (getZkp2pStatus().available) {
        cleanup();
        resolve();
        return;
      }
      if (Date.now() >= deadline) {
        cleanup();
        resolve();
        return;
      }
    };

    const onInitialized = (): void => {
      check();
    };

    const cleanup = (): void => {
      window.removeEventListener('zktls#initialized' as keyof WindowEventMap, onInitialized as EventListener);
      clearInterval(intervalId);
    };

    window.addEventListener('zktls#initialized' as keyof WindowEventMap, onInitialized as EventListener);
    const intervalId = setInterval(check, pollIntervalMs);
  });
}
