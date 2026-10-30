/**
 * @deprecated Superceded by IndexedDB storage in `services/db.ts`
 * Kept for backwards compatibility and legacy migration.
 */
import type { OfflineBoardingItem } from '../types';

const STORAGE_KEY_PREFIX = 'railbus_offline_boardings_';

export const getOfflineQueue = (tripId: string): OfflineBoardingItem[] => {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY_PREFIX}${tripId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

export const addToOfflineQueue = (tripId: string, item: OfflineBoardingItem): void => {
  try {
    const current = getOfflineQueue(tripId);
    if (!current.some((x) => x.ticket_id === item.ticket_id)) {
      current.push(item);
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${tripId}`, JSON.stringify(current));
    }
  } catch (err) {
    console.error('Failed to save offline scan to localStorage', err);
  }
};

export const clearOfflineQueue = (tripId: string): void => {
  try {
    localStorage.removeItem(`${STORAGE_KEY_PREFIX}${tripId}`);
  } catch (err) {
    console.error('Failed to clear offline queue', err);
  }
};
