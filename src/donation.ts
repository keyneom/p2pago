/**
 * recordDonation, getDonationStatus — donation recording and support status
 */

import { defaultStorage, storageKey } from './adapters/storage.js';
import type { DonationRecord, StorageAdapter } from './types.js';

export interface RecordDonationOptions {
  storage?: StorageAdapter;
}

export interface GetDonationStatusOptions {
  maxAgeMs: number;
  storage?: StorageAdapter;
}

export interface DonationStatus {
  valid: boolean;
  lastDonationAt?: string;
  expiredAt?: string;
}

/**
 * Record a donation for an account. Call after successful crypto or ZKP2P donation.
 */
export async function recordDonation(
  accountId: string,
  data: { txHash?: string; amount?: string; chainId?: number },
  options?: RecordDonationOptions
): Promise<void> {
  const storage = options?.storage ?? defaultStorage;
  const key = storageKey(accountId);
  const record: DonationRecord = {
    lastDonationAt: new Date().toISOString(),
    ...(data.txHash && { txHash: data.txHash }),
    ...(data.amount && { amount: data.amount }),
    ...(data.chainId != null && { chainId: data.chainId }),
  };
  await storage.set(key, record);
}

/**
 * Get donation status for an account. Returns valid if last donation is within maxAgeMs.
 */
export async function getDonationStatus(
  accountId: string,
  options: GetDonationStatusOptions
): Promise<DonationStatus> {
  const { maxAgeMs, storage = defaultStorage } = options;
  const key = storageKey(accountId);
  const record = await storage.get(key);
  if (!record) {
    return { valid: false };
  }
  const lastAt = new Date(record.lastDonationAt).getTime();
  const now = Date.now();
  const valid = lastAt + maxAgeMs > now;
  const expiredAt = valid ? undefined : new Date(lastAt + maxAgeMs).toISOString();
  return {
    valid,
    lastDonationAt: record.lastDonationAt,
    expiredAt,
  };
}
