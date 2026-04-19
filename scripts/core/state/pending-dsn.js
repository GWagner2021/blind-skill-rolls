let _pendingMode = null;
let _clearTimer = null;
const AUTO_CLEAR_MS = 5_000;
export function setDsnPendingMode(mode) {
    _pendingMode = mode;
    if (_clearTimer !== null)
        clearTimeout(_clearTimer);
    _clearTimer = setTimeout(() => { _pendingMode = null; _clearTimer = null; }, AUTO_CLEAR_MS);
}
export function peekDsnPendingMode() {
    return _pendingMode;
}
export function consumeDsnPendingMode() {
    const mode = _pendingMode;
    _pendingMode = null;
    if (_clearTimer !== null) {
        clearTimeout(_clearTimer);
        _clearTimer = null;
    }
    return mode;
}
