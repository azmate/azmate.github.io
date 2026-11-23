// AZMATE — hesab / login (Supabase). Növbəti mərhələlər (reytinq, dostlar, çempionat) window.__azmate.auth üzərindən istifadə edəcək.
const $ = id => document.getElementById(id);
const cfg = window.AZ_SUPABASE;
const btn = $('b-acc');

if (!cfg || !window.supabase || !btn) {
  /* Supabase yüklənməyib: login düyməsi gizli qalır, sayt əvvəlki kimi işləyir */
} else {
  const client = window.supabase.createClient(cfg.url, cfg.key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });
  const back = location.origin + location.pathname;
  let user = null, profile = null;

  const msg = (text, kind) => {
    const el = $('au-msg');
    if (!text) { el.hidden = true; return; }
    el.textContent = text; el.className = 'au-msg' + (kind ? ' ' + kind : ''); el.hidden = false;
  };

  const errText = e => {
    const m = (e && e.message || '').toLowerCase();
    if (m.includes('invalid login')) return 'Email və ya parol səhvdir.';
    if (m.includes('already registered') || m.includes('already been registered')) return 'Bu email artıq qeydiyyatdan keçib. "Daxil ol" düyməsini bas.';
    if (m.includes('email not confirmed')) return 'Email hələ təsdiqlənməyib. Gələnlər qutusuna (və spam-ə) bax.';
    if (m.includes('password')) return 'Parol ən azı 8 simvol olmalıdır.';
    if (m.includes('rate limit') || m.includes('too many')) return 'Çox sorğu göndərildi. Bir az gözləyib yenidən cəhd et.';
    if (m.includes('provider is not enabled') || m.includes('unsupported provider')) return 'Google ilə giriş hələ aktiv edilməyib.';
    if (m.includes('failed to fetch') || m.includes('network')) return 'İnternet bağlantısı yoxdur.';
    return 'Xəta baş verdi. Bir az sonra yenidən cəhd et.';
  };

  async function loadProfile() {
    profile = null;
    if (!user) return;
    for (let i = 0; i < 4 && !profile; i++) {
      const { data } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
      if (data) profile = data; else await new Promise(r => setTimeout(r, 400));
    }
  }

  function render() {
    btn.hidden = false;
    btn.textContent = user ? (profile?.username || 'Hesab') : 'Daxil ol';
    $('au-out').hidden = !!user;
    $('au-in').hidden = !user;
    if (user) { window.dispatchEvent(new CustomEvent('azmate:statsrender')); $('au-mail').textContent = user.email || ''; $('au-uname').value = profile?.username || ''; }
  }

  async function setUser(u) {
    user = u || null;
    await loadProfile();
    render();
    window.dispatchEvent(new CustomEvent('azmate:auth', { detail: { user, profile } }));
  }

  const validName = n => /^[A-Za-z0-9_]{3,20}$/.test(n);
  const dlg = $('dlg-auth');
  btn.addEventListener('click', () => { msg(''); dlg.showModal(); });
  $('au-close').addEventListener('click', () => dlg.close());

  $('au-google').addEventListener('click', async () => {
    msg('');
    const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: back } });
    if (error) msg(errText(error), 'err');
  });

  $('au-form').addEventListener('submit', async e => {
    e.preventDefault(); msg('');
    const email = $('au-email').value.trim(), password = $('au-pass').value;
    if (!email || password.length < 8) return msg('Email və ən azı 8 simvollu parol yaz.', 'err');
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) return msg(errText(error), 'err');
    dlg.close();
  });

  $('au-signup').addEventListener('click', async () => {
    msg('');
    const row = $('au-name-row');
    const email = $('au-email').value.trim(), password = $('au-pass').value, username = $('au-name').value.trim();
    if (row.hidden) { row.hidden = false; $('au-name').focus(); return msg('Qeydiyyat üçün istifadəçi adı seç və yenidən "Qeydiyyat" bas.'); }
    if (!email || password.length < 8) return msg('Email və ən azı 8 simvollu parol yaz.', 'err');
    if (username && !validName(username)) return msg('İstifadəçi adı 3–20 simvol olmalı: hərf (a–z), rəqəm və _.', 'err');
    const { data, error } = await client.auth.signUp({ email, password, options: { emailRedirectTo: back, data: username ? { username } : {} } });
    if (error) return msg(errText(error), 'err');
    if (!data.session) return msg('Təsdiq məktubu göndərildi. Emaildəki linkə bas, sonra daxil ol.', 'ok');
    dlg.close();
  });

  $('au-forgot').addEventListener('click', async () => {
    msg('');
    const email = $('au-email').value.trim();
    if (!email) return msg('Əvvəlcə email ünvanını yaz.', 'err');
    const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo: back });
    msg(error ? errText(error) : 'Parol bərpa linki emailə göndərildi.', error ? 'err' : 'ok');
  });

  $('au-save').addEventListener('click', async () => {
    msg('');
    const name = $('au-uname').value.trim();
    if (!validName(name)) return msg('İstifadəçi adı 3–20 simvol olmalı: hərf (a–z), rəqəm və _.', 'err');
    const { error } = await client.from('profiles').update({ username: name }).eq('id', user.id);
    if (error) return msg(error.code === '23505' ? 'Bu ad artıq götürülüb.' : 'Ad dəyişdirilmədi.', 'err');
    profile = { ...profile, username: name }; render(); msg('Yadda saxlanıldı.', 'ok');
  });

  $('au-logout').addEventListener('click', async () => { await client.auth.signOut(); dlg.close(); });

  client.auth.onAuthStateChange((_ev, session) => {
    // callback içində await etmirik (Supabase tövsiyəsi): ayrı tasklda işləyirik
    setTimeout(() => setUser(session?.user), 0);
  });
  client.auth.getSession().then(({ data }) => setUser(data.session?.user));

  window.__azmate = window.__azmate || {};
  window.__azmate.auth = { client, user: () => user, profile: () => profile };
}
