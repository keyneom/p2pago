/**
 * Shared types — kept narrow on purpose.
 *
 * Quote / VerifiedIntent / intent shapes live in @zkp2p/sdk; consumers who
 * want them should import directly from there (re-exported via this package's
 * top-level entry). We only define the cross-cutting interfaces our own
 * value-add layer needs.
 */

/** Minimal signer surface compatible with ethers v5/v6 (and the redirect/402 flows). */
export interface Signer {
  getAddress(): Promise<string>;
  sendTransaction(tx: {
    to: string;
    value?: bigint;
    data?: string;
    gasLimit?: bigint;
  }): Promise<{ hash: string }>;
}

/** RPC provider surface used by the ENS / FluidKey resolver. */
export interface Provider {
  resolveName?(name: string): Promise<string | null>;
  getResolver?(name: string): Promise<{ resolve?(name: string): Promise<string | null> } | null>;
}

/** Donation record stored per account (donor support status). */
export interface DonationRecord {
  lastDonationAt: string;
  txHash?: string;
  amount?: string;
  chainId?: number;
}

/** Storage adapter for donation records. */
export interface StorageAdapter {
  get(key: string): Promise<DonationRecord | null>;
  set(key: string, value: DonationRecord): Promise<void>;
}
