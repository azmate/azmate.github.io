const KEY = 'azmate:settings:v1';
const defaults = { theme: 'classic', pieces: 'az', legal: true, coords: true, anim: true, sound: true, min: 5, inc: 0 };
const subs = new Set();
let state = { ...defaults };

try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { /* storage unavailable */ }

export const get = () => state;

export function set(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* storage unavailable */ }
  subs.forEach(fn => fn(state));
}

export function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
