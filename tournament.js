// AZMATE — çempionatlar (kubok sistemi: uduzan çıxır)
import { $, h, client, meId, toast, online, errMsg, rpc, profiles, prof, pname, openDlg, likeEsc, rtShort } from './ui.js';

const TCS = ['1+0', '3+0', '3+2', '5+0', '5+3', '10+0', '10+5', '15+10'];
const STATUS = { open: 'Qeydiyyat açıqdır', running: 'Davam edir', done: 'Bitib' };
let curId = null, timer = null, draft = null;
const hosted = new Set();

const mini = (label, fn, cls = '') => h('button', { class: 'mini ' + cls, type: 'button', onclick: fn }, label);
const row = (title, sub, ...btns) => h('li', { class: 'sr' },
  h('div', { class: 'nm' }, title, sub ? h('small', {}, sub) : null), ...btns);
async function act(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; } catch (e) { toast(errMsg(e)); return false; }
}

/* ---------- Açılış / yenilənmə ---------- */
$('b-tour')?.addEventListener('click', () => { curId = null; openDlg('dlg-tour'); render(); startTimer(); });
$('dlg-tour')?.addEventListener('close', () => { clearInterval(timer); timer = null; });
function startTimer() {
  clearInterval(timer);
  timer = setInterval(() => {
    const a = document.activeElement;
    if (document.hidden || !$('dlg-tour').open) return;
    if (a && $('dlg-tour').contains(a) && ['INPUT', 'SELECT'].includes(a.tagName)) return; // yazarkən yeniləmə
    render();
  }, 6000);
}
async function render() {
  const body = $('tr-body');
  if (!meId()) { body.replaceChildren(h('p', { class: 'empty' }, 'Əvvəlcə daxil ol.')); return; }
  try { await (curId ? renderDetail(body) : renderList(body)); }
  catch { body.replaceChildren(h('p', { class: 'empty' }, 'Yüklənmədi. İnternet bağlantısını yoxla.')); }
}

/* ---------- Siyahı ---------- */
async function renderList(body) {
  const uid = meId(), c = client();
  const [{ data: ts }, { data: mine }] = await Promise.all([
    c.from('tournaments').select('*').order('created_at', { ascending: false }),
    c.from('tournament_players').select('*').eq('user_id', uid)
  ]);
  const tournaments = ts || [];
  const myStatus = id => (mine || []).find(m => m.tournament_id === id)?.status;
  await profiles(tournaments.map(t => t.admin_id));
  const invited = tournaments.filter(t => myStatus(t.id) === 'invited' && t.status === 'open');
  const rest = tournaments.filter(t => !invited.includes(t) && myStatus(t.id) !== 'declined');

  const name = h('input', { id: 'tr-name', placeholder: 'Çempionatın adı', maxlength: 40, autocomplete: 'off' });
  const max = h('input', { id: 'tr-max', type: 'number', min: 2, max: 32, value: 8, inputmode: 'numeric' });
  const tc = h('select', { id: 'tr-tc' }, TCS.map(v => h('option', { value: v, selected: v === '5+0' }, v)));
  const create = async () => {
    const nm = name.value.trim(), mx = parseInt(max.value, 10);
    if (nm.length < 3) return toast('Ad ən azı 3 hərf olmalıdır.');
    if (!(mx >= 2 && mx <= 32)) return toast('Oyunçu sayı 2 ilə 32 arasında olmalıdır.');
    const [mi, inc] = tc.value.split('+').map(Number);
    try {
      curId = await rpc('create_tournament', { p_name: nm, p_max: mx, p_min: mi, p_inc: inc });
      draft = null; render();
    } catch (e) { toast(errMsg(e)); }
  };

  const parts = [h('h2', {}, 'Çempionat')];
  if (invited.length) {
    parts.push(h('h3', {}, 'Dəvətlər'), h('ul', { class: 'sl' }, invited.map(t =>
      row(t.name, `Admin: ${pname(t.admin_id)} · ${t.min}+${t.inc} · max ${t.max_players} nəfər`,
        mini('Qəbul et', async () => { await act(() => rpc('respond_tournament', { p_tid: t.id, p_accept: true })); curId = t.id; render(); }, 'pri'),
        mini('Rədd et', async () => { await act(() => rpc('respond_tournament', { p_tid: t.id, p_accept: false })); render(); })))));
  }
  parts.push(h('h3', {}, 'Çempionatlarım'));
  parts.push(rest.length
    ? h('ul', { class: 'sl' }, rest.map(t => row(t.name, `${STATUS[t.status]} · ${t.min}+${t.inc} · Admin: ${pname(t.admin_id)}`,
      mini('Aç', () => { curId = t.id; draft = null; render(); }, 'pri'))))
    : h('p', { class: 'empty' }, 'Hələ çempionatın yoxdur.'));
  parts.push(h('h3', {}, 'Yeni çempionat yarat'),
    h('div', { class: 'soc-in' }, name),
    h('div', { class: 'soc-in' }, h('label', { class: 'empty' }, 'Maks. oyunçu'), max, tc),
    h('div', { class: 'soc-in' }, mini('Yarat (sən admin olacaqsan)', create, 'pri')),
    h('p', { class: 'empty' }, 'Uduzan çıxır. Dostlarını dəvət edib başlamazdan əvvəl cütləri özün seçə və ya təsadüfi paylaya bilərsən.'));
  body.replaceChildren(...parts);
}

/* ---------- Detallar ---------- */
function syncDraft(joined) {
  if (!draft || draft.tid !== curId) draft = { tid: curId, ids: [] };
  draft.ids = draft.ids.filter(i => joined.includes(i));
  for (const i of joined) if (!draft.ids.includes(i)) draft.ids.push(i);
}
function move(i, d) {
  const j = i + d, a = draft.ids;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]];
  render();
}

async function createRoom(m, t) {
  const o = online();
  if (!o) return;
  const code = await o.create({ min: t.min, inc: t.inc });
  if (!code) return;
  o.matchId = m.id;
  hosted.add(code);
  if (!(await act(() => rpc('host_match_room', { p_match: m.id, p_code: code })))) return;
  $('dlg-tour').close();
  openDlg('dlg-online');
  toast('Otaq yaradıldı. Rəqib "Qoşul" basana qədər gözlə.');
}
function joinRoom(m) {
  const o = online();
  if (!o || !m.room_code) return;
  o.join(m.room_code);
  o.matchId = m.id;
  $('dlg-tour').close();
  openDlg('dlg-online');
}

async function renderDetail(body) {
  const uid = meId(), c = client();
  const [{ data: t }, { data: pl }, { data: ms }] = await Promise.all([
    c.from('tournaments').select('*').eq('id', curId).maybeSingle(),
    c.from('tournament_players').select('*').eq('tournament_id', curId),
    c.from('tournament_matches').select('*').eq('tournament_id', curId).order('round').order('slot')
  ]);
  if (!t) { curId = null; return renderList(body); }
  const players = pl || [], matches = ms || [];
  await profiles([t.admin_id, t.champion_id, ...players.map(p => p.user_id), ...matches.flatMap(m => [m.p1, m.p2, m.winner])], true);
  const isAdmin = t.admin_id === uid;
  const joined = players.filter(p => p.status === 'joined');
  const myRow = players.find(p => p.user_id === uid);

  const parts = [
    mini('← Çempionatlar', () => { curId = null; render(); }),
    h('h2', {}, t.name),
    h('p', { class: 'empty' }, `${t.min}+${t.inc} · ${STATUS[t.status]} · Admin: ${pname(t.admin_id)} · ${joined.length}/${t.max_players} nəfər`)
  ];

  if (t.status === 'done' && t.champion_id) parts.push(h('div', { class: 'champ' }, `🏆 Çempion: ${pname(t.champion_id)}`));

  if (t.status === 'open') {
    if (myRow?.status === 'invited') {
      parts.push(h('div', { class: 'soc-in' },
        mini('Dəvəti qəbul et', async () => { await act(() => rpc('respond_tournament', { p_tid: t.id, p_accept: true })); render(); }, 'pri'),
        mini('Rədd et', async () => { await act(() => rpc('respond_tournament', { p_tid: t.id, p_accept: false })); curId = null; render(); })));
    }
    syncDraft(joined.map(p => p.user_id));
    parts.push(h('h3', {}, 'İştirakçılar'));
    const list = h('ul', { class: 'sl' });
    draft.ids.forEach((id, i) => list.append(row(`${i + 1}. ${pname(id)}`, id === t.admin_id ? 'Admin' : 'Qəbul edib',
      isAdmin ? mini('↑', () => move(i, -1)) : null, isAdmin ? mini('↓', () => move(i, 1)) : null,
      isAdmin && id !== uid ? mini('×', async () => { await act(() => rpc('remove_tournament_player', { p_tid: t.id, p_user: id })); render(); }, 'dg') : null)));
    for (const p of players.filter(p => p.status === 'invited')) {
      list.append(row(pname(p.user_id), 'Cavab gözlənilir',
        isAdmin ? mini('×', async () => { await act(() => rpc('remove_tournament_player', { p_tid: t.id, p_user: p.user_id })); render(); }, 'dg') : null));
    }
    parts.push(list);

    if (isAdmin) {
      // Dəvət: dostlar + istənilən istifadəçi
      const { data: fr } = await c.from('friendships').select('*').eq('status', 'accepted');
      const friendIds = (fr || []).map(f => (f.requester === uid ? f.addressee : f.requester))
        .filter(id => !players.some(p => p.user_id === id && p.status !== 'declined'));
      await profiles(friendIds);
      const invite = async id => { if (await act(() => rpc('invite_to_tournament', { p_tid: t.id, p_user: id }), 'Dəvət göndərildi')) render(); };
      parts.push(h('h3', {}, 'Dəvət et'));
      if (friendIds.length) parts.push(h('ul', { class: 'sl' }, friendIds.map(id => row(pname(id), rtShort(prof(id)), mini('Dəvət et', () => invite(id), 'pri')))));
      const q = h('input', { id: 'tr-q', placeholder: 'İstənilən istifadəçi adı', maxlength: 20, autocomplete: 'off' });
      const res = h('ul', { class: 'sl' });
      const search = async () => {
        const term = q.value.trim();
        if (term.length < 2) return;
        const { data } = await c.from('profiles').select('*').ilike('username', likeEsc(term) + '%').limit(6);
        const rows = (data || []).filter(p => !players.some(x => x.user_id === p.id && x.status !== 'declined'));
        await profiles(rows.map(p => p.id));
        res.replaceChildren(...(rows.length ? rows.map(p => row(p.username, rtShort(p), mini('Dəvət et', () => invite(p.id), 'pri'))) : [h('li', { class: 'empty' }, 'Tapılmadı.')]));
      };
      q.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); search(); } });
      parts.push(h('div', { class: 'soc-in' }, q, mini('Axtar', search)), res);

      parts.push(h('h3', {}, 'Başlat'),
        h('p', { class: 'empty' }, 'Cütlər yuxarıdakı sıra ilə qurulur: 1–2, 3–4 və s. Sayı 2-nin qüvvəsi deyilsə, siyahının əvvəlindəki oyunçular birinci mərhələni oynamadan keçir.'),
        h('div', { class: 'soc-in' },
          mini('Bu sıra ilə başla', async () => { if (await act(() => rpc('start_tournament', { p_tid: t.id, p_order: draft.ids, p_random: false }), 'Çempionat başladı!')) render(); }, 'pri'),
          mini('🎲 Təsadüfi paylaş və başla', async () => { if (await act(() => rpc('start_tournament', { p_tid: t.id, p_order: null, p_random: true }), 'Çempionat başladı!')) render(); })));
    } else if (myRow?.status === 'joined') {
      parts.push(h('p', { class: 'empty' }, 'Admin başladanda matçın burada görünəcək.'));
    }
  } else {
    // Matçlar raundlar üzrə
    const rounds = [...new Set(matches.map(m => m.round))];
    for (const r of rounds) {
      const rm = matches.filter(m => m.round === r);
      parts.push(h('div', { class: 'rd' }, rm.length === 1 && rm[0].p2 ? 'FİNAL' : `${r}-ci raund`));
      const ul = h('ul', { class: 'sl' });
      for (const m of rm) {
        const mine = m.p1 === uid || m.p2 === uid;
        const title = m.p2 ? `${pname(m.p1)}  vs  ${pname(m.p2)}` : `${pname(m.p1)}`;
        let sub, btns = [];
        if (!m.p2) sub = 'Bye: birbaşa növbəti raunda keçdi';
        else if (m.status === 'done') sub = `Qalib: ${pname(m.winner)}`;
        else {
          sub = m.room_code ? 'Otaq hazırdır' : 'Oyun gözlənilir';
          if (mine) {
            if (m.room_code && !hosted.has(m.room_code)) btns.push(mini('Qoşul', () => joinRoom(m), 'pri'));
            btns.push(mini(m.room_code ? 'Yeni otaq' : 'Otaq yarat', () => createRoom(m, t), m.room_code ? '' : 'pri'));
          }
          if (isAdmin) for (const id of [m.p1, m.p2]) {
            btns.push(mini(`${pname(id)} qalib`, async () => {
              if (confirm(`${pname(id)} bu matçın qalibi elan edilsin?`)) { await act(() => rpc('admin_set_match_winner', { p_match: m.id, p_winner: id })); render(); }
            }, 'dg'));
          }
        }
        const li = row(title, sub, ...btns);
        if (mine) li.classList.add('me');
        ul.append(li);
      }
      parts.push(ul);
    }
    if (t.status === 'running') parts.push(h('p', { class: 'empty' }, 'Matç heç-heçə bitərsə, yenidən oynayın (revanş). Qalib avtomatik növbəti raunda keçir. Problem olsa, admin qalibi əl ilə seçə bilər.'));
  }

  if (isAdmin) parts.push(h('div', { class: 'soc-in' }, mini('Çempionatı sil', async () => {
    if (confirm('Çempionat tamamilə silinsin?')) { await act(() => rpc('delete_tournament', { p_tid: t.id })); curId = null; render(); }
  }, 'dg')));
  body.replaceChildren(...parts);
}
