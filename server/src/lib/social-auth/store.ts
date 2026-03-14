import { randomBytes } from 'crypto';
import type { AuthSuccessResponse } from '../auth-accounts.js';

interface PendingSocialAuthEntry {
  state: string;
  codeVerifier: string;
  accessCode: string | null;
  mode: 'login' | 'register';
  createdAt: number;
}

interface CompletionTicketEntry {
  ticket: string;
  auth: AuthSuccessResponse;
  createdAt: number;
}

const PENDING_STATE_TTL_MS = 10 * 60 * 1000;
const COMPLETION_TICKET_TTL_MS = 5 * 60 * 1000;

const pendingStates = new Map<string, PendingSocialAuthEntry>();
const completionTickets = new Map<string, CompletionTicketEntry>();

function cleanupExpired(): void {
  const now = Date.now();

  for (const [state, entry] of pendingStates.entries()) {
    if (now - entry.createdAt > PENDING_STATE_TTL_MS) {
      pendingStates.delete(state);
    }
  }

  for (const [ticket, entry] of completionTickets.entries()) {
    if (now - entry.createdAt > COMPLETION_TICKET_TTL_MS) {
      completionTickets.delete(ticket);
    }
  }
}

function createRandomToken(size = 32): string {
  return randomBytes(size).toString('base64url');
}

export function createPendingSocialAuth(params: {
  accessCode?: string;
  mode?: 'login' | 'register';
}) {
  cleanupExpired();

  const state = createRandomToken(24);
  const codeVerifier = createRandomToken(48);
  const entry: PendingSocialAuthEntry = {
    state,
    codeVerifier,
    accessCode: params.accessCode?.trim().toUpperCase() || null,
    mode: params.mode || 'login',
    createdAt: Date.now(),
  };

  pendingStates.set(state, entry);

  return entry;
}

export function consumePendingSocialAuth(state: string) {
  cleanupExpired();

  const entry = pendingStates.get(state) || null;
  if (!entry) {
    return null;
  }

  pendingStates.delete(state);
  return entry;
}

export function createSocialCompletionTicket(auth: AuthSuccessResponse) {
  cleanupExpired();

  const ticket = createRandomToken(32);
  completionTickets.set(ticket, {
    ticket,
    auth,
    createdAt: Date.now(),
  });

  return ticket;
}

export function consumeSocialCompletionTicket(ticket: string) {
  cleanupExpired();

  const entry = completionTickets.get(ticket) || null;
  if (!entry) {
    return null;
  }

  completionTickets.delete(ticket);
  return entry.auth;
}
