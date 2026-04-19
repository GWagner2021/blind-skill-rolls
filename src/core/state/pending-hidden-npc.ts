import { PENDING_TIMEOUT_MS } from "../constants.js";

let _pending = false;
let _timer: ReturnType<typeof setTimeout> | null = null;

export function setPendingHiddenNpc(): void {
  _pending = true;
  if (_timer) clearTimeout(_timer);
  _timer = setTimeout(() => { _pending = false; _timer = null; }, PENDING_TIMEOUT_MS);
}

export function isPendingHiddenNpc(): boolean {
  return _pending;
}

export function clearPendingHiddenNpc(): void {
  _pending = false;
  if (_timer) { clearTimeout(_timer); _timer = null; }
}
