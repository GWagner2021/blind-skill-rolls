
let _pendingMode: 'blind' | 'private' | null = null;

let _clearTimer: ReturnType<typeof setTimeout> | null = null;

const AUTO_CLEAR_MS = 5_000;

export function setDsnPendingMode(mode: 'blind' | 'private'): void {
  _pendingMode = mode;
  if (_clearTimer !== null) clearTimeout(_clearTimer);
  _clearTimer = setTimeout(() => { _pendingMode = null; _clearTimer = null; }, AUTO_CLEAR_MS);
}

export function peekDsnPendingMode(): 'blind' | 'private' | null {
  return _pendingMode;
}

export function consumeDsnPendingMode(): 'blind' | 'private' | null {
  const mode = _pendingMode;
  _pendingMode = null;
  if (_clearTimer !== null) { clearTimeout(_clearTimer); _clearTimer = null; }
  return mode;
}
