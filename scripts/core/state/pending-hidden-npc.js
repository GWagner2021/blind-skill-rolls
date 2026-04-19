import { PENDING_TIMEOUT_MS } from "../constants.js";
let _pending = false;
let _timer = null;
export function setPendingHiddenNpc() {
    _pending = true;
    if (_timer)
        clearTimeout(_timer);
    _timer = setTimeout(() => { _pending = false; _timer = null; }, PENDING_TIMEOUT_MS);
}
export function isPendingHiddenNpc() {
    return _pending;
}
export function clearPendingHiddenNpc() {
    _pending = false;
    if (_timer) {
        clearTimeout(_timer);
        _timer = null;
    }
}
