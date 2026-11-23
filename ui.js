// AZMATE — social/çempionat modulları üçün ümumi köməkçilər
export const $ = id => document.getElementById(id);

export function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false && v != null) el.setAttribute(k, v);
  }
  for (const k of kids.flat()) if (k != null && k !== false) el.append(k.nodeType ? k : document.createTextNode(String(k)));
  return el;
}

export const client = () => window.__azmate?.auth?.client || null;
export const meId = () => window.__azmate?.auth?.user?.()?.id || null;
export const toast = msg => window.__azmate?.toast?.(msg);
export const online = () => window.__azmate?.online || null;
export const sleep = ms => new Promise(r => setTimeout(r, ms));

const ERR = {
  not_authenticated: 'Əvvəlcə daxil ol.',
  bad_input: 'Yanlış məlumat.',
  not_friends: 'Yalnız dostları oyuna dəvət etmək olar.',
  not_allowed: 'Bu əməliyyata icazən yoxdur.',
  already_started: 'Çempionat artıq başlayıb.',
  full: 'Çempionat doludur.',
  need_two_players: 'Başlamaq üçün ən azı 2 nəfər qəbul etməlidir.',
  bad_order: 'Sıra düzgün deyil, səhifəni yeniləyib yenidən cəhd et.',
  too_many_tournaments: 'Eyni anda ən çox 5 aktiv çempionatın ola bilər.'
};
export const errMsg = e => ERR[(e?.message || '').trim()] || 'Xəta baş verdi. Yenidən cəhd et.';

export async function rpc(name, args) {
  const { data, error } = await client().rpc(name, args);
  if (error) throw error;
  return data;
}

// Profil keşi (ad və reytinqlər)
const cache = new Map();
export async function profiles(ids, fresh = false) {
  const want = [...new Set(ids.filter(Boolean))];
  const need = fresh ? want : want.filter(i => !cache.has(i));
  if (need.length) {
    const { data } = await client().from('profiles').select('*').in('id', need);
    for (const p of data || []) cache.set(p.id, p);
  }
  return ids.map(i => cache.get(i) || null);
}
export const prof = id => cache.get(id) || null;
export const pname = id => cache.get(id)?.username || '?';

export const tcName = tc => ({ bullet: 'Bullet', blitz: 'Blitz', rapid: 'Rapid' }[tc] || tc);
export const tcOf = (min, inc) => (min * 60 + inc * 40 < 180 ? 'bullet' : min * 60 + inc * 40 < 600 ? 'blitz' : 'rapid');
export const rtShort = p => (p ? `Blitz ${p.rating_blitz} · Rapid ${p.rating_rapid} · Bullet ${p.rating_bullet}` : '');

export function ratingGrid(p) {
  return h('div', { class: 'rt' },
    ['bullet', 'blitz', 'rapid'].map(k => h('div', {}, tcName(k), h('b', {}, p['rating_' + k]))));
}

export function openDlg(id) { const d = $(id); if (d && !d.open) d.showModal(); }
export function copyText(text, okMsg) {
  if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(() => toast(okMsg), () => window.prompt('Kopyala:', text));
  else window.prompt('Kopyala:', text);
}

document.addEventListener('click', e => {
  const id = e.target?.dataset?.close;
  if (id) $(id)?.close();
});

export const likeEsc = s => s.replace(/[\\%_]/g, m => '\\' + m);
