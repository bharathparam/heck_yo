import { get, set, del } from 'idb-keyval';
import type { Booking } from '../types';

const TICKET_VAULT_PREFIX = 'railbus_ticket_vault_';

export async function saveTicketsToVault(userId: string, bookings: Booking[]): Promise<void> {
  try {
    // Only cache bookings that have a valid issued ticket
    const issuedBookings = bookings.filter((b) => b.ticket && b.ticket.qr_content);
    await set(`${TICKET_VAULT_PREFIX}${userId}`, issuedBookings);
  } catch (err) {
    console.warn('[TicketVault] Failed to cache tickets in IndexedDB:', err);
  }
}

export async function getTicketsFromVault(userId?: string): Promise<Booking[]> {
  try {
    if (!userId) return [];
    const cached = await get<Booking[]>(`${TICKET_VAULT_PREFIX}${userId}`);
    return cached || [];
  } catch (err) {
    console.warn('[TicketVault] Failed to read tickets from IndexedDB:', err);
    return [];
  }
}

export async function clearTicketVault(userId?: string): Promise<void> {
  try {
    if (userId) {
      await del(`${TICKET_VAULT_PREFIX}${userId}`);
    }
  } catch (err) {
    console.warn('[TicketVault] Failed to clear IndexedDB:', err);
  }
}
