import { PENDING_TIMEOUT_MS } from "../constants.js";

export interface PendingEntry {
  abilityId: string;
  userId: string;
  actorId: string | null;
  ts: number;
}

const TIMEOUT_MS: number = PENDING_TIMEOUT_MS;
const MAX_ENTRIES: number = 20;
const _pending: Map<string, PendingEntry> = new Map();

function currentUserId(): string { return game.user?.id ?? "_"; }

function pruneExpired(): void {
  const now = Date.now();
  for (const [key, entry] of _pending) {
    if (now - entry.ts > TIMEOUT_MS) _pending.delete(key);
  }
}

function enforceLimit(): void {
  while (_pending.size > MAX_ENTRIES) {
    const oldest = _pending.keys().next().value;
    if (oldest !== undefined) _pending.delete(oldest);
  }
}

function compositeKey(uid: string, actorId: string | null, abilityId: string): string {
  return `${uid}|${actorId || "*"}|${abilityId}`;
}

export const setPendingSave = (abilityId: string, userId: string | null = null, actorId: string | null = null): void => {
  if (!abilityId) return;
  const uid = userId || currentUserId();
  const key = compositeKey(uid, actorId, abilityId);
  pruneExpired();
  _pending.set(key, { abilityId, userId: uid, actorId: actorId || null, ts: Date.now() });
  enforceLimit();
  setTimeout(() => {
    const entry = _pending.get(key);
    if (entry && Date.now() - entry.ts >= TIMEOUT_MS) _pending.delete(key);
  }, TIMEOUT_MS + 50);
};

export const peekPendingSave = (userId: string | null = null, actorId: string | null = null): string | null => {
  pruneExpired();
  if (_pending.size === 0) return null;
  const uid = userId || currentUserId();
  let latest: string | null = null;
  let latestTs = 0;
  for (const [, entry] of _pending) {
    if (uid && entry.userId !== uid) continue;
    if (actorId && entry.actorId && entry.actorId !== actorId) continue;
    if (entry.ts >= latestTs) { latest = entry.abilityId; latestTs = entry.ts; }
  }
  return latest;
};

export const clearPendingSave = (abilityId: string | null | undefined, userId: string | null = null, actorId: string | null = null): void => {
  const uid = userId || currentUserId();
  if (abilityId) {
    const exact = compositeKey(uid, actorId, abilityId);
    if (_pending.has(exact)) { _pending.delete(exact); return; }
    if (actorId) { const wild = compositeKey(uid, null, abilityId); if (_pending.has(wild)) { _pending.delete(wild); return; } }
    for (const [key, entry] of _pending) {
      if (entry.userId === uid && entry.abilityId === abilityId) { _pending.delete(key); return; }
    }
    return;
  }
  let latestKey: string | null = null;
  let latestTs = 0;
  for (const [key, entry] of _pending) {
    if (uid && entry.userId !== uid) continue;
    if (actorId && entry.actorId && entry.actorId !== actorId) continue;
    if (entry.ts >= latestTs) { latestKey = key; latestTs = entry.ts; }
  }
  if (latestKey) _pending.delete(latestKey);
};

export const clearPendingSavesForActor = (userId: string | null = null, actorId: string | null = null): void => {
  const uid = userId || currentUserId();
  for (const [key, entry] of _pending) {
    if (entry.userId !== uid) continue;
    if (actorId && entry.actorId && entry.actorId !== actorId) continue;
    _pending.delete(key);
  }
};
