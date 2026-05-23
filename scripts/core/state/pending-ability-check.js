import { PENDING_TIMEOUT_MS } from "../constants.js";
const TIMEOUT_MS = PENDING_TIMEOUT_MS;
const MAX_ENTRIES = 20;
const _pending = new Map();
function currentUserId() { return game.user?.id ?? "_"; }
function pruneExpired() {
    const now = Date.now();
    for (const [key, entry] of _pending) {
        if (now - entry.ts > TIMEOUT_MS)
            _pending.delete(key);
    }
}
function enforceLimit() {
    while (_pending.size > MAX_ENTRIES) {
        const oldest = _pending.keys().next().value;
        if (oldest !== undefined)
            _pending.delete(oldest);
    }
}
function compositeKey(uid, actorId, abilityId) {
    return `${uid}|${actorId || "*"}|${abilityId}`;
}
export const setPendingAbilityCheck = (abilityId, userId = null, actorId = null) => {
    if (!abilityId)
        return;
    const uid = userId || currentUserId();
    const key = compositeKey(uid, actorId, abilityId);
    pruneExpired();
    _pending.set(key, { abilityId, userId: uid, actorId: actorId || null, ts: Date.now() });
    enforceLimit();
    setTimeout(() => {
        const entry = _pending.get(key);
        if (entry && Date.now() - entry.ts >= TIMEOUT_MS)
            _pending.delete(key);
    }, TIMEOUT_MS + 50);
};
export const peekPendingAbilityCheck = (userId = null, actorId = null) => {
    pruneExpired();
    if (_pending.size === 0)
        return null;
    const uid = userId || currentUserId();
    let latest = null;
    let latestTs = 0;
    for (const [, entry] of _pending) {
        if (uid && entry.userId !== uid)
            continue;
        if (actorId && entry.actorId && entry.actorId !== actorId)
            continue;
        if (entry.ts >= latestTs) {
            latest = entry.abilityId;
            latestTs = entry.ts;
        }
    }
    return latest;
};
export const clearPendingAbilityCheck = (abilityId, userId = null, actorId = null) => {
    const uid = userId || currentUserId();
    if (abilityId) {
        const exact = compositeKey(uid, actorId, abilityId);
        if (_pending.has(exact)) {
            _pending.delete(exact);
            return;
        }
        if (actorId) {
            const wild = compositeKey(uid, null, abilityId);
            if (_pending.has(wild)) {
                _pending.delete(wild);
                return;
            }
        }
        for (const [key, entry] of _pending) {
            if (entry.userId === uid && entry.abilityId === abilityId) {
                _pending.delete(key);
                return;
            }
        }
        return;
    }
    let latestKey = null;
    let latestTs = 0;
    for (const [key, entry] of _pending) {
        if (uid && entry.userId !== uid)
            continue;
        if (actorId && entry.actorId && entry.actorId !== actorId)
            continue;
        if (entry.ts >= latestTs) {
            latestKey = key;
            latestTs = entry.ts;
        }
    }
    if (latestKey)
        _pending.delete(latestKey);
};
export const clearPendingAbilityChecksForActor = (userId = null, actorId = null) => {
    const uid = userId || currentUserId();
    for (const [key, entry] of _pending) {
        if (entry.userId !== uid)
            continue;
        if (actorId && entry.actorId && entry.actorId !== actorId)
            continue;
        _pending.delete(key);
    }
};
