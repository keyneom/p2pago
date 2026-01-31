/**
 * Default storage adapter — localStorage
 */

import type { DonationRecord, StorageAdapter } from '../types.js';

const KEY_PREFIX = 'zkp2p-donate:v1:';

function storageKey(accountId: string): string {
  return `${KEY_PREFIX}${accountId}`;
}

export const defaultStorage: StorageAdapter = {
  async get(key: string): Promise<DonationRecord | null> {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as DonationRecord;
      if (typeof parsed.lastDonationAt !== 'string') return null;
      return parsed;
    } catch {
      return null;
    }
  },
  async set(key: string, value: DonationRecord): Promise<void> {
    if (typeof localStorage === 'undefined') {
      throw new Error('localStorage is not available');
    }
    localStorage.setItem(key, JSON.stringify(value));
  },
};

export { storageKey };
