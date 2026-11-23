// AZMATE — reytinq, profil, dostlar, oyuna dəvət
import { $, h, client, meId, toast, online, sleep, errMsg, rpc, profiles, prof, pname, tcName, tcOf,
  rtShort, ratingGrid, openDlg, copyText, likeEsc } from './ui.js';

const RES = { w: 'Qələbə', b: 'Məğlubiyyət', d: 'Heç-heçə' };
const minutesAgo = m => new Date(Date.now() - m * 60000).toISOString();
const sign = n => (n > 0 ? '+' : '') + n;

/* ---------- Oyun nəticəsinin göndərilməsi (reytinq) ---------- */
function note(text) {
  const s = $('r-sub');
  if (s && $('dlg-result')?.open) {
    let sp = $('r-rate');
    if (!sp || !s.contains(sp)) { sp = h('span', { id: 'r-rate' }); s.append(' · ', sp); }
    sp.textContent = text;
  } else toast(text);
}

async function reportGame({ winner }) {
  const info = online()?.info?.();
  const uid = meId();
  if (!info || !uid || !info.oppUid || info.oppUid === uid) return; // reytinqli oyun üçün iki tərəf də daxil olmalıdır
  const args = {
    p_gid: info.gid, p_opponent: info.oppUid, p_color: info.color,
    p_result: winner === 'w' ? 'w' : winner === 'b' ? 'b' : 'd',
    p_min: info.min, p_inc: info.inc, p_match: info.matchId || null
  };
  const waits = [0, 2500, 5000, 9000, 15000, 30000];
  for (let i = 0; i < waits.length; i++) {
    if (waits[i]) await sleep(waits[i]);
    try {
      const r = await rpc('report_game', args);
      if (r.status === 'done') {
        const [p] = await profiles([uid], true);
        const cur = p ? p['rating_' + r.tc] : '';
        note(`${tcName(r.tc)} reytinqi: ${cur} (${sign(r.delta)})`);
        return;
      }
      if (r.status === 'disputed') { note('Nəticələr uyğun gəlmədi, reytinq dəyişmədi.'); return; }
      if (i === 0) note('Rəqibin təsdiqi gözlənilir…');
    } catch (e) {
      if (i === waits.length - 1) note('Nəticə göndərilmədi.');
    }
  }
  note('Rəqib nəticəni təsdiqləmədi, reytinq dəyişmədi.');
}
window.addEventListener('azmate:gameover', e => { reportGame(e.detail || {}); });

/* ---------- Məlumat yükləmə ---------- */
async function loadSocial() {
  const uid = meId(), c = client();
  const [fr, inv] = await Promise.all([
    c.from('friendships').select('*'),
    c.from('game_invites').select('*').eq('to_id', uid).gte('created_at', minutesAgo(10)).order('created_at', { ascending: false })
  ]);
  const friendships = fr.data || [], invites = inv.data || [];
  const ids = [...friendships.flatMap(f => [f.requester, f.addressee]), ...invites.map(i => i.from_id)].filter(i => i && i !== uid);
  await profiles(ids, true);
  return { friendships, invites };
}
const relation = (friendships, uid, other) => {
  const f = friendships.find(x => (x.requester === uid && x.addressee === other) || (x.requester === other && x.addressee === uid));
  if (!f) return null;
  if (f.status === 'accepted') return 'friends';
  return f.requester === uid ? 'sent' : 'incoming';
};

/* ---------- Əməliyyatlar ---------- */
async function act(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); } catch (e) { toast(errMsg(e)); }
}
async function addFriend(id) {
  await act(async () => {
    const r = await rpc('send_friend_request', { p_user: id });
    toast(r === 'friends' ? 'Artıq dostsunuz 🎉' : 'Dostluq sorğusu göndərildi');
  });
}
async function challenge(friend) {
  const o = online();
  if (!o) return;
  const s = window.__azmate.S.get();
  const code = await o.create({ min: s.min, inc: s.inc });
  if (!code) return;
  o.matchId = null;
  await act(async () => {
    await rpc('send_game_invite', { p_to: friend.id, p_code: code, p_min: s.min, p_inc: s.inc });
    $('dlg-friends').close(); $('dlg-profile').close();
    openDlg('dlg-online');
    toast(`${friend.username} dəvət olundu. Qoşulana qədər gözlə.`);
  });
}
async function acceptInvite(inv) {
  const o = online();
  if (!o) return;
  await client().from('game_invites').delete().eq('id', inv.id);
  o.matchId = null;
  o.join(inv.room_code);
  $('dlg-friends').close();
  openDlg('dlg-online');
}

/* ---------- Dostlar pəncərəsi ---------- */
const userRow = (p, sub, ...btns) => h('li', { class: 'sr' },
  h('div', { class: 'nm' }, p?.username || '?', sub ? h('small', {}, sub) : null), ...btns);
const mini = (label, fn, cls = '') => h('button', { class: 'mini ' + cls, type: 'button', onclick: fn }, label);

async function renderFriends() {
  const uid = meId(), body = $('fr-body');
  if (!uid) { body.replaceChildren(h('p', { class: 'empty' }, 'Əvvəlcə daxil ol.')); return; }
  const { friendships, invites } = await loadSocial();
  const again = () => renderFriends();

  const q = h('input', { id: 'fr-q', placeholder: 'İstifadəçi adı ilə axtar', maxlength: 20, autocomplete: 'off' });
  const res = h('ul', { class: 'sl' });
  const doSearch = async () => {
    const term = q.value.trim();
    if (term.length < 2) { res.replaceChildren(h('li', { class: 'empty' }, 'Ən azı 2 hərf yaz.')); return; }
    const { data } = await client().from('profiles').select('*').ilike('username', likeEsc(term) + '%').neq('id', uid).limit(8);
    await profiles((data || []).map(p => p.id), true);
    if (!data?.length) { res.replaceChildren(h('li', { class: 'empty' }, 'Tapılmadı.')); return; }
    res.replaceChildren(...data.map(p => {
      const rel = relation(friendships, uid, p.id);
      const action = rel === 'friends' ? h('span', { class: 'empty' }, 'Dost')
        : rel === 'sent' ? h('span', { class: 'empty' }, 'Göndərilib')
        : mini(rel === 'incoming' ? 'Qəbul et' : 'Dost əlavə et', async () => { await addFriend(p.id); again(); }, 'pri');
      return userRow(p, rtShort(p), mini('Profil', () => openProfile(p.id)), action);
    }));
  };
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

  const incoming = friendships.filter(f => f.status === 'pending' && f.addressee === uid);
  const sent = friendships.filter(f => f.status === 'pending' && f.requester === uid);
  const friends = friendships.filter(f => f.status === 'accepted');
  const other = f => (f.requester === uid ? f.addressee : f.requester);

  const parts = [h('h2', {}, 'Dostlar'),
    h('div', { class: 'soc-in' }, q, mini('Axtar', doSearch, 'pri')), res];

  if (invites.length) {
    parts.push(h('h3', {}, 'Oyun dəvətləri'), h('ul', { class: 'sl' }, invites.map(i =>
      userRow(prof(i.from_id), `Səni oyuna dəvət edir · ${i.min}+${i.inc}`,
        mini('Qoşul', () => acceptInvite(i), 'pri'),
        mini('Rədd et', async () => { await client().from('game_invites').delete().eq('id', i.id); again(); })))));
  }
  if (incoming.length) {
    parts.push(h('h3', {}, 'Dostluq sorğuları'), h('ul', { class: 'sl' }, incoming.map(f =>
      userRow(prof(f.requester), rtShort(prof(f.requester)),
        mini('Qəbul et', async () => { await act(() => rpc('respond_friend_request', { p_user: f.requester, p_accept: true })); again(); }, 'pri'),
        mini('Rədd et', async () => { await act(() => rpc('respond_friend_request', { p_user: f.requester, p_accept: false })); again(); })))));
  }
  parts.push(h('h3', {}, `Dostlarım (${friends.length})`));
  parts.push(friends.length
    ? h('ul', { class: 'sl' }, friends.map(f => {
      const p = prof(other(f));
      return userRow(p, rtShort(p), mini('Oyna', () => challenge(p), 'pri'), mini('Profil', () => openProfile(p.id)),
        mini('×', async () => { if (confirm(`${p?.username} dostlardan çıxarılsın?`)) { await act(() => rpc('remove_friend', { p_user: p.id })); again(); } }, 'dg'));
    }))
    : h('p', { class: 'empty' }, 'Hələ dostun yoxdur. Yuxarıdan axtar və ya profil linkini göndər.'));
  if (sent.length) {
    parts.push(h('h3', {}, 'Göndərilən sorğular'), h('ul', { class: 'sl' }, sent.map(f =>
      userRow(prof(f.addressee), 'Cavab gözlənilir', mini('Ləğv et', async () => { await act(() => rpc('remove_friend', { p_user: f.addressee })); again(); })))));
  }
  body.replaceChildren(...parts);
}
$('b-friends')?.addEventListener('click', () => { openDlg('dlg-friends'); renderFriends().catch(() => toast('Yüklənmədi.')); });

/* ---------- Profil ---------- */
const profileLink = name => `${location.origin}${location.pathname}?u=${encodeURIComponent(name)}`;

async function renderHistory(uid) {
  const { data } = await client().from('games').select('*').eq('status', 'done')
    .order('finished_at', { ascending: false }).limit(15);
  const games = data || [];
  await profiles(games.map(g => (g.white_id === uid ? g.black_id : g.white_id)));
  if (!games.length) return h('p', { class: 'empty' }, 'Hələ təsdiqlənmiş oyun yoxdur.');
  return h('ul', { class: 'sl' }, games.map(g => {
    const mine = g.white_id === uid ? 'w' : 'b';
    const outcome = g.result === 'd' ? 'd' : g.result === mine ? 'w' : 'b';
    const delta = mine === 'w' ? g.white_delta : g.black_delta;
    return h('li', { class: 'sr' },
      h('div', { class: 'nm' }, `${pname(mine === 'w' ? g.black_id : g.white_id)}`,
        h('small', {}, `${tcName(g.time_control)} ${g.min}+${g.inc} · ${mine === 'w' ? 'Ağ' : 'Qara'}`)),
      h('span', { class: outcome === 'w' ? 'win' : outcome === 'b' ? 'lose' : '' }, `${RES[outcome]} ${sign(delta ?? 0)}`));
  }));
}

export async function openProfile(id) {
  openDlg('dlg-profile');
  const body = $('pr-body');
  body.replaceChildren(h('p', { class: 'empty' }, 'Yüklənir…'));
  const [p] = await profiles([id], true);
  if (!p) { body.replaceChildren(h('p', { class: 'empty' }, 'Profil tapılmadı.')); return; }
  const uid = meId();
  const parts = [h('h2', {}, p.username), ratingGrid(p),
    h('p', { class: 'empty' }, `Qələbə ${p.wins} · Heç-heçə ${p.draws} · Məğlubiyyət ${p.losses}`)];
  const acts = [mini('Linki kopyala', () => copyText(profileLink(p.username), 'Profil linki kopyalandı'))];
  if (uid && uid !== p.id) {
    const { friendships } = await loadSocial();
    const rel = relation(friendships, uid, p.id);
    if (rel === 'friends') acts.unshift(mini('Oyuna dəvət et', () => challenge(p), 'pri'));
    else if (rel === 'sent') acts.unshift(h('span', { class: 'empty' }, 'Sorğu göndərilib'));
    else acts.unshift(mini(rel === 'incoming' ? 'Sorğunu qəbul et' : 'Dost əlavə et', async () => { await addFriend(p.id); openProfile(p.id); }, 'pri'));
  } else if (!uid) parts.push(h('p', { class: 'empty' }, 'Dost əlavə etmək üçün daxil ol.'));
  parts.push(h('div', { class: 'soc-in' }, acts));
  if (uid === p.id) parts.push(h('h3', {}, 'Son oyunlar'), await renderHistory(uid));
  body.replaceChildren(...parts);
}

/* ---------- Hesab pəncərəsində reytinqlər ---------- */
async function renderStats() {
  const uid = meId(), box = $('au-stats');
  if (!box || !uid) return;
  const [p] = await profiles([uid], true);
  if (p) box.replaceChildren(ratingGrid(p));
}
window.addEventListener('azmate:statsrender', () => { renderStats(); });
$('au-prof')?.addEventListener('click', () => { $('dlg-auth').close(); openProfile(meId()); });

/* ---------- Bildiriş nişanları (hər 15 saniyədən bir yoxlanır) ---------- */
let timer = null, lastInv = 0, lastTour = 0;
const setBadge = (id, n) => {
  const b = $(id)?.querySelector('.bdg');
  if (!b) return;
  b.textContent = n > 9 ? '9+' : String(n); b.hidden = !n;
};
async function poll() {
  const uid = meId();
  if (!uid || document.hidden) return;
  const c = client();
  try {
    const [a, b, t] = await Promise.all([
      c.from('friendships').select('id', { count: 'exact', head: true }).eq('addressee', uid).eq('status', 'pending'),
      c.from('game_invites').select('id', { count: 'exact', head: true }).eq('to_id', uid).gte('created_at', minutesAgo(10)),
      c.from('tournament_players').select('tournament_id', { count: 'exact', head: true }).eq('user_id', uid).eq('status', 'invited')
    ]);
    const inv = b.count || 0, tour = t.count || 0;
    setBadge('b-friends', (a.count || 0) + inv);
    setBadge('b-tour', tour);
    if (inv > lastInv) toast('Səni oyuna dəvət ediblər 👥');
    if (tour > lastTour) toast('Çempionat dəvətin var 🏆');
    lastInv = inv; lastTour = tour;
  } catch { /* şəbəkə xətası: növbəti dəfə yoxlanılır */ }
}
function onAuth() {
  const uid = meId();
  $('b-friends').hidden = !uid;
  $('b-tour').hidden = !uid;
  clearInterval(timer); timer = null;
  lastInv = lastTour = 0;
  if (uid) { poll(); timer = setInterval(poll, 15000); } else { setBadge('b-friends', 0); setBadge('b-tour', 0); }
}
window.addEventListener('azmate:auth', onAuth);
document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
onAuth();

/* ---------- ?u=ad linki ilə profil açılışı ---------- */
(async () => {
  const u = new URLSearchParams(location.search).get('u');
  if (!u || !/^[A-Za-z0-9_]{3,20}$/.test(u) || !client()) return;
  const { data } = await client().from('profiles').select('id').ilike('username', likeEsc(u)).limit(1);
  if (data?.[0]) openProfile(data[0].id);
})();
