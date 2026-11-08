/* ==================================================================
   APP — router hash, layar login, sesi, ganti sandi
   ================================================================== */
(function () {
  'use strict';
  const { ic, esc, toast } = UI;
  const KAPP = 'sc_app';

  const App = {
    app: null,
    pengaturan() { if (!this.app) { try { this.app = JSON.parse(localStorage.getItem(KAPP) || 'null'); } catch (e) { this.app = null; } } return this.app || { nama_app: 'Syarifah Course', tagline: 'Bimbingan Belajar Digital' }; },
    setApp(app) { if (!app) return; this.app = app; try { localStorage.setItem(KAPP, JSON.stringify(app)); } catch (e) { /* */ } UI.terapkanTema(app); },

    init() {
      if (!API.konfigValid()) { renderSetup(); return; }
      UI.terapkanTema(this.pengaturan());
      API.setOnAuthHilang((msg) => App.sesiBerakhir(msg));
      window.addEventListener('hashchange', route);
      route();
      API.api('app.publik').then((r) => {
        if (!r.success) return;
        const lama = JSON.stringify(App.app);
        App.setApp(r.data);
        if (!API.Sesi.me() && lama !== JSON.stringify(r.data)) renderLogin();
      });
    },
    sesiBerakhir(msg) {
      if (!API.Sesi.me()) return;
      API.Sesi.hapus();
      toast(msg || 'Sesi Anda berakhir. Silakan masuk lagi.', 'warning');
      location.hash = '#/masuk';
      route();
    },
    async keluar(semua) {
      if (semua) {
        const ok = await UI.konfirmasi('Keluar dari semua perangkat?', 'Semua sesi akun Anda di HP/laptop lain juga akan berakhir.', { ok: 'Keluar semua', bahaya: true });
        if (!ok) return;
        await API.api('auth.keluarSemua', {});
      }
      API.Sesi.hapus();
      location.hash = '#/masuk';
      route();
    },
    /** Modal ganti kata sandi. wajib=true → tidak bisa ditutup sebelum diganti. */
    modalGantiSandi(wajib) {
      const m = UI.buka(UI.headHtml(wajib ? 'Buat kata sandi baru' : 'Ubah kata sandi', wajib ? 'Demi keamanan, ganti kata sandi awal dari pengelola.' : '') +
        '<form class="modal-body stack" id="fGanti" novalidate>' +
        fieldSandi('gLama', wajib ? 'Kata sandi saat ini (dari pengelola)' : 'Kata sandi lama', 'current-password') +
        fieldSandi('gBaru', 'Kata sandi baru', 'new-password', 'Minimal 8 karakter, berisi huruf dan angka.') +
        fieldSandi('gUlang', 'Ulangi kata sandi baru', 'new-password') +
        '<p class="err hidden" id="gErr" role="alert"></p>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit">' + ic('key', 18) + ' Simpan kata sandi</button>' +
        (wajib ? '<button class="btn btn-ghost btn-block" type="button" data-close>Nanti saja</button>' : '') +
        '</form>', { label: 'Ubah kata sandi' });
      pasangMata(m.el);
      m.el.querySelector('#fGanti').addEventListener('submit', async (e) => {
        e.preventDefault();
        const lama = m.el.querySelector('#gLama').value, baru = m.el.querySelector('#gBaru').value, ulang = m.el.querySelector('#gUlang').value;
        const err = m.el.querySelector('#gErr');
        const tampil = (t) => { err.innerHTML = ic('alert', 16) + ' ' + esc(t); err.classList.remove('hidden'); err.className = 'err'; };
        if (baru.length < 8 || !/[A-Za-z]/.test(baru) || !/\d/.test(baru)) return tampil('Kata sandi baru minimal 8 karakter dan berisi huruf serta angka.');
        if (baru !== ulang) return tampil('Ulangan kata sandi tidak sama.');
        const btn = e.submitter || m.el.querySelector('[type=submit]');
        btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan…';
        const s = API.Sesi.baca();
        const r = await API.api('auth.gantiSandi', { lama, baru, ingat: s && s.ingat });
        btn.disabled = false; btn.innerHTML = ic('key', 18) + ' Simpan kata sandi';
        if (!r.success) return tampil(r.message);
        if (r.data && r.data.token) API.Sesi.perbaruiToken(r.data.token);
        API.Sesi.perbaruiMe({ wajibGanti: false });
        toast(r.message || 'Kata sandi diganti.', 'success');
        m.tutup();
      });
    }
  };
  window.App = App;

  function fieldSandi(id, label, ac, hint) {
    return '<div class="field"><label for="' + id + '">' + esc(label) + '</label><div class="input-wrap">' + ic('lock', 20) +
      '<input class="input" type="password" id="' + id + '" autocomplete="' + ac + '" required><button type="button" class="icon-btn light trail" data-mata="' + id + '" aria-label="Tampilkan kata sandi">' + ic('eye', 20) + '</button></div>' +
      (hint ? '<span class="hint">' + esc(hint) + '</span>' : '') + '</div>';
  }
  function pasangMata(root) {
    root.querySelectorAll('[data-mata]').forEach((b) => b.addEventListener('click', () => {
      const i = root.querySelector('#' + b.dataset.mata), lihat = i.type === 'password';
      i.type = lihat ? 'text' : 'password';
      b.innerHTML = ic(lihat ? 'eyeOff' : 'eye', 20);
      b.setAttribute('aria-label', lihat ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi');
    }));
  }
  App.pasangMata = pasangMata;
  App.fieldSandi = fieldSandi;

  // ---------------- Router ----------------
  function route() {
    const me = API.Sesi.me();
    const bagian = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    if (!me) { if (bagian[0] && bagian[0] !== 'masuk') history.replaceState(null, '', '#/masuk'); renderLogin(); return; }
    if (me.peran === 'siswa') {
      if (bagian[0] !== 'siswa') { location.replace('#/siswa/beranda'); return; }
      document.body.className = 'mode-siswa';
      Siswa.route(bagian.slice(1).length ? bagian.slice(1) : ['beranda']);
    } else {
      if (bagian[0] !== 'guru') { location.replace('#/guru/dashboard'); return; }
      document.body.className = 'mode-guru';
      Guru.route(bagian.slice(1).length ? bagian.slice(1) : ['dashboard']);
    }
    if (me.wajibGanti && !App._sudahMinta) { App._sudahMinta = true; setTimeout(() => App.modalGantiSandi(true), 700); }
  }
  App.route = route;

  // ---------------- Layar setup (config.js belum diisi) ----------------
  function renderSetup() {
    document.body.className = '';
    document.getElementById('app').innerHTML = '<div class="setup"><div class="card stack">' +
      '<div class="empty" style="padding:0"><div class="art">' + ic('settings', 32) + '</div></div>' +
      '<h2>Konfigurasi belum lengkap</h2>' +
      '<p class="muted">Aplikasi belum tersambung ke server Google Apps Script. Buka berkas <b>js/config.js</b> lalu isi <b>GAS_URL</b> dengan URL Web App yang berakhiran <code>/exec</code>.</p>' +
      '<div class="info-box">' + ic('info', 18) + '<span>Langkah lengkap ada di <b>PANDUAN-INSTALASI.md</b> bagian “Hubungkan frontend”.</span></div></div></div>';
  }

  // ---------------- Layar masuk ----------------
  let peranLogin = 'siswa';
  function renderLogin() {
    document.body.className = 'mode-login';
    const app = App.pengaturan();
    API.warmUp('pub');
    // simpan isian bila layar dirender ulang (mis. pengaturan aplikasi baru selesai dimuat)
    const lamaUser = document.getElementById('lUser'), lamaPass = document.getElementById('lPass'), lamaIngat = document.getElementById('lIngat');
    const simpanan = lamaUser ? { u: lamaUser.value, p: lamaPass.value, i: lamaIngat.checked, fokus: document.activeElement && document.activeElement.id } : null;
    const sapa = (() => { const j = new Date().getHours(); return j < 11 ? 'Selamat pagi' : j < 15 ? 'Selamat siang' : j < 18 ? 'Selamat sore' : 'Selamat malam'; })();
    const intro = Date.now() - (App._loginRender || 0) > 4000;      // animasi masuk hanya sekali (bukan saat render ulang)
    App._loginRender = Date.now();
    const kata = esc(app.nama_app).split(' ').map((k, i) => '<span class="kata" style="--d:' + (i * 90 + 250) + 'ms">' + k + '</span>').join(' ');
    const node = (cls, isi) => '<span class="node ' + cls + '">' + isi + '</span>';
    document.getElementById('app').innerHTML =
      '<main class="login' + (intro ? ' intro' : '') + '">' +
        '<canvas class="lg-net" aria-hidden="true"></canvas>' +
        '<div class="orb a"></div><div class="orb b"></div><div class="orb c"></div>' +
        '<section class="login-hero">' +
          '<span class="access-pill"><i></i> Akses Tertutup • Khusus Terdaftar</span>' +
          '<div class="stage px" style="--d:10">' +
            '<div class="orbit o2">' + node('n1', ic('book', 16)) + node('n2', ic('trophy', 16)) + node('n3', '<b>π</b>') + node('n4', ic('quiz', 16)) + '</div>' +
            '<div class="orbit o1">' + node('n1', ic('star', 14)) + node('n3', '<b>x²</b>') + '</div>' +
            '<div class="logo-tile">' + (app.logo_url ? UI.logoHtml(app, 'mono') : '<span class="mono">' + esc(UI.fmt.inisial(app.nama_app).slice(0, 1)) + '<b>' + esc(UI.fmt.inisial(app.nama_app).slice(1, 2)) + '</b></span>') +
              '<span class="cap">' + ic('cap', 18) + '</span></div>' +
            '<div class="fc-wrap fa px" style="--d:26" aria-hidden="true"><div class="fc"><span class="fc-ic g">' + ic('trend', 18) + '</span><div><small>Nilai latihan</small><b>92 <em>+8</em></b></div>' +
              '<span class="fc-bars"><i style="--h:40%"></i><i style="--h:62%"></i><i style="--h:50%"></i><i style="--h:78%"></i><i style="--h:92%"></i></span></div></div>' +
            '<div class="fc-wrap fb px" style="--d:-22" aria-hidden="true"><div class="fc"><svg class="fc-ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15"/><circle class="v" cx="18" cy="18" r="15" pathLength="100"/></svg><div><small>Kehadiran</small><b>8/8 sesi</b></div></div></div>' +
          '</div>' +
          '<h1 class="kilap">' + kata + '</h1>' +
          '<p class="typer" aria-hidden="true"><span id="lType"></span><i class="caret"></i></p><p class="sr-only">' + esc(app.tagline || '') + '</p>' +
          '<div class="login-points"><div style="--d:700ms">' + ic('book', 22) + ' Materi & modul PDF dari pengajar</div><div style="--d:820ms">' + ic('quiz', 22) + ' Latihan soal dengan nilai otomatis</div><div style="--d:940ms">' + ic('clipcheck', 22) + ' Pantau kehadiran, jadwal, dan tagihan</div></div>' +
        '</section>' +
        '<div class="login-side">' + LoginFX.owlSvg() +
        '<section class="login-card"><div class="login-inner">' +
          '<div class="segmented blue seg-slide" role="tablist" aria-label="Pilih jenis akun"><span class="seg-ind"></span>' +
            '<button type="button" role="tab" data-peran="siswa">' + ic('user', 18) + ' Siswa</button>' +
            '<button type="button" role="tab" data-peran="guru">' + ic('idcard', 18) + ' Guru / Pengelola</button>' +
          '</div>' +
          '<div class="l-head"><span class="sapa">' + ic('sparkle', 14) + ' ' + sapa + '!</span><h2 id="lJudul"></h2><p class="lead">Gunakan akun yang sudah diverifikasi oleh pengelola bimbel.</p></div>' +
          '<form id="fLogin" class="stack" novalidate>' +
            '<div class="field"><label for="lUser" id="lUserLbl"></label><div class="input-wrap" id="lUserWrap"></div></div>' +
            '<div class="field"><label for="lPass">Kata Sandi</label><div class="input-wrap">' + ic('lock', 20) +
              '<input class="input" type="password" id="lPass" autocomplete="current-password" placeholder="Masukkan kata sandi" required>' +
              '<button type="button" class="icon-btn light trail" data-mata="lPass" aria-label="Tampilkan kata sandi">' + ic('eye', 20) + '</button></div>' +
              '<span class="caps hidden" id="lCaps" role="status">' + ic('alert', 14) + ' Caps Lock sedang aktif</span></div>' +
            '<div class="row between"><label class="check"><input type="checkbox" id="lIngat"> Ingat Sesi Saya</label>' +
              '<button type="button" class="btn btn-ghost btn-sm" id="lLupa">Lupa kata sandi?</button></div>' +
            '<p class="err hidden" id="lErr" role="alert"></p>' +
            '<button class="btn btn-primary btn-block btn-lg btn-login" type="submit" id="lBtn"><span class="lbl">Masuk Sekarang ' + ic('right', 20) + '</span></button>' +
          '</form>' +
          '<div class="login-help"><span>Belum memiliki akun bimbingan?</span><button class="btn btn-ghost btn-sm" id="lAktivasi">' + ic('headset', 16) + ' Hubungi Admin</button></div>' +
          '<p class="login-foot">' + ic('shield', 16) + ' Data tersimpan di Google Workspace milik ' + esc(app.nama_app) + '</p>' +
        '</div></section></div>' +
      '</main>';
    const root = document.getElementById('app');
    pasangMata(root);
    const fx = LoginFX.pasang(root, { kalimat: [app.tagline || 'Bimbingan Belajar Digital', 'Materi & modul bisa dibuka kapan saja.', 'Latihan soal dengan nilai otomatis.', 'Pantau jadwal, kehadiran, dan tagihan.'] });
    const polaUser = (p, v) => p === 'siswa' ? /^[A-Za-z0-9._-]{4,}$/.test(v) : /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
    const cekUser = () => { const u = root.querySelector('#lUser'); root.querySelector('#lUserWrap').classList.toggle('valid', polaUser(peranLogin, u.value.trim())); };
    const setPeran = (p, awal) => {
      peranLogin = p;
      root.querySelectorAll('[data-peran]').forEach((b) => { const on = b.dataset.peran === p; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
      root.querySelector('.seg-slide').style.setProperty('--i', p === 'siswa' ? 0 : 1);
      root.querySelector('#lJudul').textContent = p === 'siswa' ? 'Masuk ke Akun Siswa' : 'Masuk sebagai Guru';
      root.querySelector('#lUserLbl').textContent = p === 'siswa' ? 'ID Siswa Bimbel' : 'Email Guru';
      const lama = root.querySelector('#lUser'), nilai = lama ? lama.value : '';
      root.querySelector('#lUserWrap').innerHTML = ic(p === 'siswa' ? 'idcard' : 'mail', 20) +
        '<input class="input" id="lUser" ' + (p === 'siswa' ? 'autocapitalize="characters" autocomplete="username" placeholder="Contoh: SC26001"' : 'type="email" autocomplete="username" inputmode="email" placeholder="nama@email.com"') + ' required>' +
        '<span class="ok-mark" aria-hidden="true">' + ic('check', 14) + '</span>';
      root.querySelector('#lUser').value = nilai; cekUser();
      root.querySelector('#lUser').addEventListener('input', cekUser);
      root.querySelector('#lErr').classList.add('hidden');
      if (!awal) { const h = root.querySelector('.l-head'); h.classList.remove('ganti'); void h.offsetWidth; h.classList.add('ganti'); }
      fx.peran(p);
      if (p === 'guru') API.warmUp('guru');
    };
    root.querySelectorAll('[data-peran]').forEach((b) => b.addEventListener('click', () => setPeran(b.dataset.peran)));
    setPeran(peranLogin, true);
    const caps = (e) => { if (e.getModifierState) root.querySelector('#lCaps').classList.toggle('hidden', !e.getModifierState('CapsLock')); };
    root.querySelector('#lPass').addEventListener('keydown', caps);
    root.querySelector('#lPass').addEventListener('keyup', caps);
    root.querySelector('#lPass').addEventListener('blur', () => root.querySelector('#lCaps').classList.add('hidden'));
    if (simpanan) {
      root.querySelector('#lUser').value = simpanan.u; root.querySelector('#lPass').value = simpanan.p; root.querySelector('#lIngat').checked = simpanan.i; cekUser();
      if (simpanan.fokus && root.querySelector('#' + simpanan.fokus)) root.querySelector('#' + simpanan.fokus).focus();
    }
    const bantuan = () => UI.buka(UI.headHtml('Butuh bantuan akun?') + '<div class="modal-body stack"><p class="muted">Akun dan kata sandi dibuat oleh pengelola bimbel. Untuk aktivasi akun baru atau reset kata sandi, hubungi pengelola:</p>' +
      (app.kontak_admin ? '<div class="cred"><span>' + esc(app.kontak_admin) + '</span></div>' : '<div class="info-box">' + ic('info', 18) + '<span>Hubungi pengelola bimbel secara langsung di tempat les.</span></div>') +
      '</div><div class="modal-foot"><button class="btn btn-primary" data-close>Mengerti</button></div>');
    root.querySelector('#lLupa').addEventListener('click', bantuan);
    root.querySelector('#lAktivasi').addEventListener('click', bantuan);
    root.querySelector('#fLogin').addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = root.querySelector('#lUser').value.trim(), pass = root.querySelector('#lPass').value;
      const err = root.querySelector('#lErr'), btn = root.querySelector('#lBtn');
      const tampil = (t) => { err.innerHTML = ic('alert', 16) + ' ' + esc(t); err.className = 'err'; };
      if (!user || !pass) { tampil(peranLogin === 'siswa' ? 'Isi ID Siswa dan kata sandi.' : 'Isi email dan kata sandi.'); fx.gagal(); (user ? root.querySelector('#lPass') : root.querySelector('#lUser')).focus(); return; }
      btn.disabled = true; btn.innerHTML = '<span class="lbl"><span class="spinner"></span> Memeriksa…</span>';
      const ingat = root.querySelector('#lIngat').checked;
      const r = await API.api('auth.login', { peran: peranLogin, username: user, password: pass, ingat });
      if (!r.success) {
        btn.disabled = false; btn.innerHTML = '<span class="lbl">Masuk Sekarang ' + ic('right', 20) + '</span>';
        tampil(r.message); fx.gagal(); root.querySelector('#lPass').select(); return;
      }
      btn.classList.add('ok'); btn.innerHTML = '<span class="lbl">' + ic('checkCircle', 20) + ' Berhasil! Mengalihkan…</span>';
      err.className = 'err hidden'; fx.sukses();
      await new Promise((ok) => setTimeout(ok, fx.jeda()));
      API.Sesi.simpan(r.data.token, r.data.me, ingat);
      App._sudahMinta = false;
      location.hash = r.data.me.peran === 'siswa' ? '#/siswa/beranda' : '#/guru/dashboard';
    });
  }

  document.addEventListener('DOMContentLoaded', () => App.init());
})();
