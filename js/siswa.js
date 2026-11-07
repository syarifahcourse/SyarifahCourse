/* ==================================================================
   AREA SISWA — mobile-first (maks 480px), mengikuti referensi desain
   ================================================================== */
(function () {
  'use strict';
  const { ic, esc, fmt, toast } = UI;
  let boot = null;                 // data siswa.boot terakhir
  let main = null;

  // ---------- status baca notifikasi (per perangkat) ----------
  const kBaca = () => 'sc_baca_' + ((API.Sesi.me() || {}).id || '');
  const sudahBaca = () => { try { return JSON.parse(localStorage.getItem(kBaca()) || '{}'); } catch (e) { return {}; } };
  const tandaiBaca = (ids) => { const s = sudahBaca(); ids.forEach((i) => { s[i] = 1; }); try { localStorage.setItem(kBaca(), JSON.stringify(s)); } catch (e) { /* */ } };
  const belumDibaca = (notif) => { const s = sudahBaca(); return (notif || []).filter((n) => !s[n.id]).length; };

  // ---------- kerangka ----------
  const NAV = [['beranda', 'home', 'Beranda'], ['jadwal', 'calendar', 'Jadwal'], ['tugas', 'clipboard', 'Tugas'], ['profil', 'user', 'Profil']];
  function kerangka(aktif, tanpaNav) {
    const root = document.getElementById('app');
    if (!root.querySelector('.s-app')) {
      root.innerHTML = '<div class="s-app"><main id="sMain"></main></div><nav class="bnav" aria-label="Navigasi utama"></nav>';
    }
    main = root.querySelector('#sMain');
    const nav = root.querySelector('.bnav');
    nav.classList.toggle('hidden', !!tanpaNav);
    const nBaru = boot ? boot.badge.latihanBaru : 0;
    nav.innerHTML = NAV.map((n) => '<a href="#/siswa/' + n[0] + '" class="' + (n[0] === aktif ? 'on' : '') + '"' + (n[0] === aktif ? ' aria-current="page"' : '') + '>' + ic(n[1], 24) +
      (n[0] === 'tugas' && nBaru ? '<span class="badge">' + nBaru + '</span>' : '') + '<span>' + n[2] + '</span></a>').join('');
    window.scrollTo(0, 0);
    return main;
  }
  function appbar(judul, sub, opt) {
    opt = opt || {};
    return '<header class="appbar">' +
      '<button class="icon-btn" data-back="' + (opt.back || 'beranda') + '" aria-label="Kembali">' + ic(opt.ikonKembali || 'left', 24) + '</button>' +
      '<div class="ttl"><h1>' + esc(judul) + '</h1>' + (sub ? '<p>' + esc(sub) + '</p>' : '') + '</div>' + (opt.kanan || '') + '</header>';
  }
  function pasangBack(root) {
    root.querySelectorAll('[data-back]').forEach((b) => b.addEventListener('click', () => { location.hash = '#/siswa/' + b.dataset.back; }));
  }
  function lonceng() {
    const n = boot ? belumDibaca(boot.notif) : 0;
    return '<a class="icon-btn" href="#/siswa/notif" aria-label="Notifikasi' + (n ? ', ' + n + ' belum dibaca' : '') + '" style="color:#fff">' + ic('bell', 24) + (n ? '<span class="dot"></span>' : '') + '</a>';
  }
  function muatBoot(cb) {
    return API.muat('siswa.boot', {}, (d, cache, err) => { if (d) { boot = d; App.setApp(d.app); } cb(d, cache, err); }, { umur: 20000 });
  }

  const Siswa = {
    route(p) {
      const hal = p[0], arg = p[1];
      const peta = { beranda, materi, tugas, kuis, hasil, nilai, jadwal, profil, notif };
      (peta[hal] || beranda)(arg);
    }
  };
  window.Siswa = Siswa;

  // ================================================================
  // BERANDA
  // ================================================================
  function beranda() {
    kerangka('beranda');
    if (!boot) main.innerHTML = '<div class="s-hero" style="padding-bottom:110px"><div class="sk" style="height:48px;width:60%;background:rgba(255,255,255,.08)"></div></div><div class="s-pad" style="margin-top:-80px">' + UI.skeleton([150, 240, 130]) + '</div>';
    muatBoot((d, cache, err) => {
      if (err) { main.innerHTML = '<div class="s-pad" style="padding-top:40px">' + UI.gagalMuat(err.message) + '</div>'; main.querySelector('#btnUlang').onclick = beranda; return; }
      renderBeranda(d);
    });
  }
  function renderBeranda(d) {
    kerangka('beranda');
    const app = d.app || App.pengaturan(), nBaca = belumDibaca(d.notif);
    const p = d.progres;
    main.innerHTML =
      '<section class="s-hero">' +
        '<div class="brand"><div class="logo">' + UI.logoHtml(app) + '</div><div class="grow"><h1>' + esc(app.nama_app) + '</h1><p>' + esc(app.tagline || '') + '</p></div>' +
          '<a class="icon-btn" href="#/siswa/notif" style="color:#fff;background:rgba(255,255,255,.08)" aria-label="Notifikasi' + (nBaca ? ', ' + nBaca + ' belum dibaca' : '') + '">' + ic('bell', 24) + (nBaca ? '<span class="dot-badge">' + nBaca + '</span>' : '') + '</a></div>' +
        '<div class="greet"><div class="avatar-ring">' + esc(fmt.inisial(d.me.nama)) + '</div><div class="grow"><h2>Halo, ' + esc(fmt.namaDepan(d.me.nama)) + '</h2><p>' + esc(d.me.kelas) + '</p></div></div>' +
      '</section>' +
      '<section class="card-dark hero-card">' +
        '<div class="top">' + UI.cincin(p.persen, { size: 84, stroke: 8, aria: 'Progres belajar ' + p.persen + ' persen' }) +
          '<div class="grow"><p class="t1">Progres Belajar Kamu</p><p class="t2">' + (p.total ? '<b>' + p.selesai + '</b> dari <b>' + p.total + '</b> Materi Selesai' : 'Belum ada materi untuk kelasmu') + '</p>' + UI.bar(p.persen, 'on-dark') + '</div></div>' +
        '<div class="act"><a class="btn btn-primary" href="#/siswa/materi">Lanjut Belajar ' + ic('right', 20) + '</a></div>' +
      '</section>' +
      '<div class="s-pad">' +
        '<div class="section-head"><h2>Menu Utama</h2><span class="small muted bold">6 Layanan Aktif</span></div>' +
        '<div class="menu-grid enter">' +
          tile('materi', 'book', 'Materi', d.badge.materiBaru ? '<span class="new">BARU</span>' : '', 0) +
          tile('tugas', 'quiz', 'Latihan Soal', d.badge.latihanBaru ? '<span class="cnt">' + d.badge.latihanBaru + '</span>' : '', 1) +
          tile('nilai/hadir', 'clipcheck', 'Daftar Hadir', '', 2) +
          tile('nilai', 'chart', 'Nilai Rapor', '', 3) +
          tile('jadwal', 'calendar', 'Jadwal Les', '', 4) +
          tile('notif', 'megaphone', 'Pengumuman', nBaca ? '<span class="cnt">' + nBaca + '</span>' : '', 5) +
        '</div>' +
        '<div class="section-head"><h2>Kategori Kelas</h2><a class="link" href="#/siswa/materi">Lihat Semua ' + ic('chevR', 18) + '</a></div>' +
        (d.mapel.length ? '<div class="rail">' + d.mapel.map((m, i) => kartuMapel(m, i)).join('') + '</div>'
          : '<div class="card">' + UI.kosong('layers', 'Belum ada kelas', 'Mata pelajaran akan muncul setelah pengajar mengunggah materi.') + '</div>') +
        '<div class="section-head"><h2>Aktivitas Harian</h2><span class="small muted bold">Terbaru</span></div>' +
        (d.aktivitas.length ? '<div class="enter">' + d.aktivitas.map((a, i) => itemAktivitas(a, i)).join('') + '</div>'
          : '<div class="card">' + UI.kosong('sparkle', 'Belum ada aktivitas', 'Mulai dengan membuka materi atau mengerjakan latihan soal.', '<a class="btn btn-primary" href="#/siswa/materi">' + ic('book', 18) + ' Buka Materi</a>') + '</div>') +
      '</div>';
    main.querySelectorAll('[data-mapel]').forEach((b) => b.addEventListener('click', () => { location.hash = '#/siswa/materi/' + encodeURIComponent(b.dataset.mapel); }));
    UI.animasi(main);
  }
  function tile(href, ikon, label, extra, i) {
    return '<a class="tile" href="#/siswa/' + href + '" style="--i:' + i + ';text-decoration:none;color:inherit">' + extra + '<span class="sq">' + ic(ikon, 26) + '</span><span>' + esc(label) + '</span></a>';
  }
  function kartuMapel(m, i) {
    const kunci = !m.total;
    return '<button class="kc' + (i % 2 ? ' blue' : '') + '" data-mapel="' + esc(m.id) + '" aria-label="' + esc(m.nama + ', ' + m.total + ' materi') + '">' +
      '<span class="lb">' + esc(m.label || 'Mata Pelajaran') + '</span><h3>' + esc(m.nama) + '</h3><span class="sub">*' + m.total + ' Materi</span>' +
      '<div class="foot">' + (kunci ? '<div class="row between"><span>Belum ada materi</span><span class="lock">' + ic('lock', 16) + '</span></div>'
        : '<div class="row between"><span>Progress</span><b>' + m.persen + '%</b></div><div style="margin-top:6px">' + UI.bar(m.persen, 'on-dark') + '</div>') + '</div></button>';
  }
  function itemAktivitas(a, i) {
    if (a.tipe === 'hasil') {
      return '<a class="li" href="#/siswa/hasil/' + esc(a.id) + '" style="--i:' + i + ';text-decoration:none;color:inherit"><span class="sq">' + ic('clipcheck', 24) + '</span>' +
        '<div class="grow"><h4 class="ellipsis">' + esc(a.judul) + '</h4><p class="sub">Selesai • ' + esc(fmt.relatif(a.waktu)) + '</p></div>' +
        '<div class="end"><span class="pill ' + (a.lulus ? 'pill-green' : 'pill-amber') + '">' + (a.lulus ? 'Lulus' : 'Remedial') + '</span><div class="score">' + a.skor + '<span class="small muted">/100</span></div></div></a>';
    }
    return '<a class="li" href="#/siswa/materi" style="--i:' + i + ';text-decoration:none;color:inherit"><span class="sq">' + ic('file', 24) + '</span>' +
      '<div class="grow"><h4 class="ellipsis">' + esc(a.judul) + '</h4><p class="sub">' + (a.diunduh ? 'Diunduh' : 'Dibuka') + ' • ' + esc(fmt.ukuran(a.ukuran)) + '</p></div>' +
      '<span class="muted">' + ic(a.diunduh ? 'download' : 'eye', 22) + '</span></a>';
  }

  // ================================================================
  // MATERI
  // ================================================================
  let filterMapel = '', cariMateri = '', urut = 'baru';
  function materi(mapelArg) {
    kerangka('');
    if (mapelArg !== undefined) filterMapel = mapelArg;
    main.innerHTML = appbar('Materi Pembelajaran', boot ? boot.me.kelas : '', { kanan: '<span class="icon-btn" title="Tersinkron dengan Google Drive" style="color:#fff">' + ic('cloudCheck', 24) + '<span class="dot green"></span></span>' + lonceng() }) +
      '<div class="s-pad" id="mBody" style="padding-top:16px">' + UI.skeleton([52, 40, 76, 220, 220]) + '</div>';
    pasangBack(main);
    API.muat('materi.saya', {}, (d, cache, err) => {
      const body = main.querySelector('#mBody');
      if (!body) return;
      if (err) { body.innerHTML = UI.gagalMuat(err.message); body.querySelector('#btnUlang').onclick = () => materi(); return; }
      renderMateri(d.materi);
    }, { umur: 30000 });
  }
  function renderMateri(list) {
    const body = main.querySelector('#mBody');
    const mapel = []; list.forEach((m) => { if (!mapel.find((x) => x.id === m.mapelId)) mapel.push({ id: m.mapelId, nama: m.mapel }); });
    const diunduh = list.filter((m) => m.status === 'diunduh').length;
    body.innerHTML =
      '<label class="search">' + ic('search', 22, 'muted') + '<span class="sr-only">Cari materi</span><input type="search" id="mCari" placeholder="Cari judul modul, bab, atau materi…" value="' + esc(cariMateri) + '"><button class="icon-btn light" id="mUrut" aria-label="Urutkan">' + ic('sliders', 22) + '</button></label>' +
      '<div class="chips" style="margin-top:14px" role="tablist" aria-label="Filter mata pelajaran"><button class="chip" data-f="">Semua</button>' + mapel.map((m) => '<button class="chip" data-f="' + esc(m.id) + '">' + esc(m.nama) + '</button>').join('') + '</div>' +
      '<div class="card-dark drive-card" style="margin-top:16px"><span class="sq">' + ic('folderUser', 24) + '</span><div class="grow"><h3>Penyimpanan Drive Siswa</h3><p>' + list.length + ' Modul Tersedia • ' + diunduh + ' Sudah Diunduh</p></div><span class="sync"><i></i>Sinkron</span></div>' +
      '<div class="section-head"><h2>Modul Terbitan Terbaru</h2><span class="small bold">Urutkan: <span id="mUrutLbl"></span></span></div>' +
      '<div id="mList"></div>' +
      '<div class="info-box" style="margin-top:16px">' + ic('info', 20) + '<span><b>Tips Belajar:</b> tekan <b>Cetak / PDF</b> untuk mengunduh modul. Setelah tersimpan di perangkat, modul bisa dibuka tanpa internet.</span></div>';
    const gambar = () => {
      body.querySelectorAll('[data-f]').forEach((c) => { const on = c.dataset.f === filterMapel; c.classList.toggle('on', on); c.setAttribute('aria-selected', on); });
      body.querySelector('#mUrutLbl').textContent = { baru: 'Terbaru', lama: 'Terlama', judul: 'Judul A–Z' }[urut];
      const q = cariMateri.toLowerCase();
      let isi = list.filter((m) => (!filterMapel || m.mapelId === filterMapel) && (!q || (m.judul + ' ' + m.bab + ' ' + m.deskripsi + ' ' + m.mapel).toLowerCase().indexOf(q) > -1));
      isi = isi.slice().sort((a, b) => urut === 'judul' ? a.judul.localeCompare(b.judul) : urut === 'lama' ? (a.tanggal < b.tanggal ? -1 : 1) : (a.tanggal < b.tanggal ? 1 : -1));
      body.querySelector('#mList').innerHTML = isi.length ? '<div class="enter">' + isi.map((m, i) => kartuMateri(m, i)).join('') + '</div>'
        : '<div class="card">' + UI.kosong('book', list.length ? 'Tidak ada yang cocok' : 'Belum ada materi', list.length ? 'Coba kata kunci atau filter lain.' : 'Materi dari pengajar akan muncul di sini.') + '</div>';
      body.querySelectorAll('[data-buka]').forEach((b) => b.addEventListener('click', () => bukaModul(list.find((m) => m.id === b.dataset.buka), false, gambar)));
      body.querySelectorAll('[data-unduh]').forEach((b) => b.addEventListener('click', () => bukaModul(list.find((m) => m.id === b.dataset.unduh), true, gambar)));
    };
    body.querySelectorAll('[data-f]').forEach((c) => c.addEventListener('click', () => { filterMapel = c.dataset.f; gambar(); }));
    body.querySelector('#mCari').addEventListener('input', (e) => { cariMateri = e.target.value; gambar(); });
    body.querySelector('#mUrut').addEventListener('click', (e) => {
      e.preventDefault();
      const s = UI.buka('<h3 style="font-size:18px;margin-bottom:12px">Urutkan materi</h3>' + [['baru', 'Terbaru'], ['lama', 'Terlama'], ['judul', 'Judul A–Z']].map((o) =>
        '<button class="opt' + (o[0] === urut ? ' on' : '') + '" data-u="' + o[0] + '" style="min-height:56px"><span>' + o[1] + '</span><span class="r"></span></button>').join(''), { kind: 'sheet', label: 'Urutkan' });
      s.el.querySelectorAll('[data-u]').forEach((b) => b.addEventListener('click', () => { urut = b.dataset.u; s.tutup(); gambar(); }));
    });
    gambar();
  }
  function kartuMateri(m, i) {
    const st = { diunduh: ['pill-green', 'checkCircle', 'Diunduh'], dibuka: ['pill-blue', 'eye', 'Sudah Dibuka'], baru: ['pill-amber', 'clock', 'Belum Dibaca'] }[m.status];
    const tags = [];
    if (m.tag) tags.push('<span class="tag" style="background:var(--primary);color:#fff">' + esc(m.tag) + '</span>');
    if (m.status === 'baru' && (Date.now() - new Date(m.tanggal).getTime()) < 7 * 864e5) tags.push('<span class="tag" style="background:#14532D;color:#BBF7D0">Baru</span>');
    if (!tags.length && m.label) tags.push('<span class="tag pill-blue">' + esc(m.label) + '</span>');
    return '<article class="card mcard" style="--i:' + i + '">' +
      '<div class="row between"><div class="row">' + tags.join('') + '</div><span class="pill ' + st[0] + '">' + ic(st[1], 14) + ' ' + st[2] + '</span></div>' +
      '<p class="bab">' + esc([m.bab, m.mapel].filter(Boolean).join(' • ')) + '</p>' +
      '<h3>' + esc(m.judul) + '</h3>' + (m.deskripsi ? '<p class="desc clamp2">' + esc(m.deskripsi) + '</p>' : '') +
      '<hr class="divider">' +
      '<div class="meta">' + (m.guru ? '<span>' + ic('user', 16) + esc(m.guru) + '</span>' : '') + '<span>' + ic('file', 16) + esc(fmt.ukuran(m.ukuran)) + (m.halaman ? ' (' + m.halaman + ' Hlm)' : '') + '</span><span>' + ic('calendar', 16) + esc(fmt.tgl(m.tanggal, { tahun: false })) + '</span></div>' +
      '<div class="acts"><button class="btn btn-outline" data-buka="' + esc(m.id) + '">' + ic('book', 18) + ' Buka Modul</button><button class="btn btn-primary" data-unduh="' + esc(m.id) + '">' + ic('printer', 18) + ' Cetak / PDF</button></div>' +
      '</article>';
  }
  function bukaModul(m, unduh, gambarUlang) {
    if (!m || !m.fileId) { toast('Berkas modul tidak ditemukan.', 'error'); return; }
    const statusBaru = unduh ? 'diunduh' : (m.status === 'diunduh' ? 'diunduh' : 'dibuka');
    if (m.status !== statusBaru) { m.status = statusBaru; if (gambarUlang) gambarUlang(); }        // UI optimistis
    API.tulis('materi.buka', { id: m.id, unduh }).then((r) => { if (!r.success && r.code !== 'AUTH') toast('Status materi belum tersimpan: ' + r.message, 'warning'); });
    if (unduh) { window.open('https://drive.google.com/uc?export=download&id=' + encodeURIComponent(m.fileId), '_blank', 'noopener'); toast('Mengunduh ' + (m.namaFile || 'modul') + '…', 'info'); return; }
    const v = document.createElement('div');
    v.className = 'viewer'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-label', m.judul);
    v.innerHTML = '<header class="appbar"><button class="icon-btn" data-x aria-label="Tutup">' + ic('x', 24) + '</button><div class="ttl"><h1>' + esc(m.judul) + '</h1><p>' + esc(m.mapel + (m.bab ? ' • ' + m.bab : '')) + '</p></div>' +
      '<a class="pbtn" href="https://drive.google.com/uc?export=download&id=' + encodeURIComponent(m.fileId) + '" target="_blank" rel="noopener">' + ic('download', 18) + ' Unduh</a></header>' +
      '<div class="load"><span class="spinner" style="width:32px;height:32px"></span></div>' +
      '<iframe src="https://drive.google.com/file/d/' + encodeURIComponent(m.fileId) + '/preview" title="' + esc(m.judul) + '" allow="autoplay"></iframe>';
    document.body.appendChild(v); document.body.style.overflow = 'hidden';
    const tutup = () => { v.remove(); document.body.style.overflow = ''; document.removeEventListener('keydown', esc_); };
    const esc_ = (e) => { if (e.key === 'Escape') tutup(); };
    document.addEventListener('keydown', esc_);
    v.querySelector('[data-x]').addEventListener('click', tutup);
    v.querySelector('iframe').addEventListener('load', () => { const l = v.querySelector('.load'); if (l) l.remove(); });
  }

  // ================================================================
  // TUGAS (daftar latihan)
  // ================================================================
  let tabTugas = 'belum';
  function tugas() {
    kerangka('tugas');
    main.innerHTML = appbar('Latihan Soal', boot ? boot.me.kelas : '', { kanan: lonceng() }) + '<div class="s-pad" id="tBody" style="padding-top:16px">' + UI.skeleton([52, 160, 160]) + '</div>';
    pasangBack(main);
    API.muat('latihan.saya', {}, (d, c, err) => {
      const body = main.querySelector('#tBody'); if (!body) return;
      if (err) { body.innerHTML = UI.gagalMuat(err.message); body.querySelector('#btnUlang').onclick = tugas; return; }
      const belum = d.latihan.filter((l) => !l.hasil), sudah = d.latihan.filter((l) => l.hasil);
      const gambar = () => {
        const isi = tabTugas === 'belum' ? belum : sudah;
        body.innerHTML = '<div class="segmented" role="tablist"><button data-t="belum" class="' + (tabTugas === 'belum' ? 'on' : '') + '">Belum Dikerjakan (' + belum.length + ')</button><button data-t="sudah" class="' + (tabTugas === 'sudah' ? 'on' : '') + '">Selesai (' + sudah.length + ')</button></div>' +
          '<div style="margin-top:16px" class="enter">' + (isi.length ? isi.map((l, i) => kartuLatihan(l, i)).join('')
            : '<div class="card">' + UI.kosong(tabTugas === 'belum' ? 'checkCircle' : 'quiz', tabTugas === 'belum' ? 'Semua latihan sudah dikerjakan' : 'Belum ada latihan selesai', tabTugas === 'belum' ? 'Hebat! Latihan baru dari pengajar akan muncul di sini.' : 'Kerjakan latihan pertamamu sekarang.') + '</div>') + '</div>';
        body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { tabTugas = b.dataset.t; gambar(); }));
      };
      gambar();
    }, { umur: 20000 });
  }
  function kartuLatihan(l, i) {
    const h = l.hasil;
    return '<article class="card hcard' + (h && !h.lulus ? ' remed' : '') + '" style="--i:' + i + '">' +
      '<div class="row between"><span class="tag pill-blue">' + esc(l.mapel) + '</span>' + (h ? '<span class="pill ' + (h.lulus ? 'pill-green' : 'pill-amber') + '">' + ic(h.lulus ? 'checkCircle' : 'alert', 14) + (h.lulus ? ' Lulus' : ' Perlu Remedial') + '</span>' : '<span class="pill pill-outline">' + ic('clock', 14) + ' Belum dikerjakan</span>') + '</div>' +
      '<div class="row between" style="align-items:flex-start;margin-top:6px"><div class="grow"><h3>' + esc(l.judul) + '</h3><p class="small muted">' + esc([l.bab, l.jumlahSoal + ' Soal', l.durasi ? l.durasi + ' Menit' : 'Tanpa batas waktu', 'KKM ' + l.kkm].filter(Boolean).join(' • ')) + '</p></div>' +
        (h ? '<div class="sc" style="color:' + (h.lulus ? 'var(--accent-text)' : 'var(--warning)') + '">' + h.skor + '<small>/100</small></div>' : '') + '</div>' +
      '<div class="row" style="margin-top:14px">' +
        (h ? '<a class="btn btn-outline grow" href="#/siswa/hasil/' + esc(h.id) + '">' + ic('eye', 18) + ' Pembahasan</a><a class="btn ' + (h.lulus ? 'btn-outline' : 'btn-primary') + ' grow" href="#/siswa/kuis/' + esc(l.id) + '">' + ic('rotate', 18) + ' Ulangi</a>'
          : '<a class="btn btn-primary btn-block" href="#/siswa/kuis/' + esc(l.id) + '">Mulai Latihan ' + ic('right', 18) + '</a>') +
      '</div></article>';
  }

  // ================================================================
  // KUIS
  // ================================================================
  let timerId = null;
  function kuis(id) {
    clearInterval(timerId);
    kerangka('', true);
    main.innerHTML = appbar('Latihan Soal', 'Memuat soal…', { back: 'tugas', ikonKembali: 'x' }) + '<div class="s-pad" style="padding-top:16px">' + UI.skeleton([90, 220, 72, 72, 72, 72]) + '</div>';
    pasangBack(main);
    API.api('latihan.ambil', { id }).then((r) => {
      if (!r.success) { main.innerHTML = appbar('Latihan Soal', '', { back: 'tugas' }) + '<div class="s-pad" style="padding-top:24px">' + UI.gagalMuat(r.message) + '</div>'; pasangBack(main); main.querySelector('#btnUlang').onclick = () => kuis(id); return; }
      jalankanKuis(r.data);
    });
  }
  function jalankanKuis(L) {
    const kunciLokal = 'sc_kuis_' + (API.Sesi.me() || {}).id + '_' + L.id;
    let st; try { st = JSON.parse(localStorage.getItem(kunciLokal) || 'null'); } catch (e) { st = null; }
    if (!st) st = { jaw: {}, ragu: {}, idx: 0, mulai: Date.now() };
    const simpan = () => { try { localStorage.setItem(kunciLokal, JSON.stringify(st)); } catch (e) { /* */ } };
    simpan();
    const n = L.soal.length;
    if (!n) { main.innerHTML = appbar(L.judul, '', { back: 'tugas' }) + '<div class="s-pad">' + UI.kosong('quiz', 'Belum ada soal', 'Pengajar belum menambahkan soal untuk latihan ini.') + '</div>'; pasangBack(main); return; }
    const batas = L.durasi ? L.durasi * 60 : 0;
    const sisa = () => batas ? Math.max(0, Math.round(batas - (Date.now() - st.mulai) / 1000)) : null;
    const jam = (s) => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
    let terkirim = false;

    main.innerHTML = '<header class="appbar"><button class="icon-btn" id="qX" aria-label="Keluar dari latihan">' + ic('x', 26) + '</button>' +
      '<div class="ttl"><h1>' + esc(L.judul) + '</h1><p>' + esc([L.mapel, L.bab].filter(Boolean).join(' • ')) + '</p></div>' +
      (batas ? '<span class="timer" id="qTimer" role="timer" aria-live="off">' + ic('clock', 18) + '<span>' + jam(sisa()) + '</span></span>' : '') + '<span style="width:8px"></span></header>' +
      '<div class="quiz-top"><div class="row between small"><span class="row bold">' + ic('trend', 18, '') + ' Progres: <span id="qPct">0%</span></span><span class="muted"><span id="qJml"></span> dari ' + n + ' Soal Terjawab</span></div>' +
      '<div class="bar blue" style="margin-top:8px;height:8px"><i id="qBar" style="width:0"></i></div><div class="qnums" id="qNums" role="tablist" aria-label="Nomor soal"></div></div>' +
      '<div class="s-pad" id="qBody" style="padding-bottom:110px"></div>' +
      '<div class="quiz-bar"><button class="btn btn-outline" id="qPrev" aria-label="Soal sebelumnya">' + ic('chevL', 18) + '<span class="lbl-prev"> Sebelum</span></button><button class="btn btn-warning-outline" id="qRagu">' + ic('flag', 18) + ' Ragu-ragu</button><button class="btn btn-primary" id="qNext"></button></div>';

    const gambar = () => {
      const s = L.soal[st.idx], dij = Object.keys(st.jaw).length, pct = Math.round(dij / n * 100);
      main.querySelector('#qPct').textContent = pct + '%';
      main.querySelector('#qJml').textContent = dij;
      main.querySelector('#qBar').style.width = pct + '%';
      main.querySelector('#qNums').innerHTML = L.soal.map((x, i) => '<button class="qn' + (st.jaw[x.id] ? ' done' : '') + (st.ragu[x.id] ? ' ragu' : '') + (i === st.idx ? ' cur' : '') + '" data-n="' + i + '" aria-label="Soal ' + (i + 1) + (st.jaw[x.id] ? ', terjawab' : '') + (st.ragu[x.id] ? ', ragu-ragu' : '') + '"' + (i === st.idx ? ' aria-current="step"' : '') + '>' + (i + 1) + '</button>').join('');
      const cur = main.querySelector('.qn.cur'); if (cur) cur.scrollIntoView({ block: 'nearest', inline: 'center', behavior: UI.reduce() ? 'auto' : 'smooth' });
      main.querySelector('#qBody').innerHTML = '<article class="card qcard" style="animation:naik 220ms var(--ease)">' +
        '<div class="row between wrap"><div class="row"><span class="pill pill-dark">Soal No. ' + (st.idx + 1) + '</span><span class="pill pill-blue">Pilihan Ganda</span></div><span class="pill pill-green">' + ic('starCircle', 14) + ' Bobot ' + s.bobot + ' Poin</span></div>' +
        '<p class="q">' + esc(s.pertanyaan) + '</p></article>' +
        '<div style="margin-top:16px" role="radiogroup" aria-label="Pilihan jawaban">' + ['A', 'B', 'C', 'D'].map((k) =>
          '<button class="opt' + (st.jaw[s.id] === k ? ' on' : '') + '" role="radio" aria-checked="' + (st.jaw[s.id] === k) + '" data-k="' + k + '"><span class="k">' + k + '</span><span class="grow">' + esc(s.opsi[k]) + '</span><span class="r"></span></button>').join('') + '</div>' +
        '<div class="info-box" style="margin-top:18px">' + ic('info', 20) + '<span>Jawaban tersimpan otomatis di perangkat ini. Tekan <b>Ragu-ragu</b> untuk menandai soal yang ingin ditinjau lagi sebelum dikirim.</span></div>';
      main.querySelector('#qPrev').disabled = st.idx === 0;
      main.querySelector('#qRagu').classList.toggle('on', !!st.ragu[s.id]);
      main.querySelector('#qRagu').setAttribute('aria-pressed', !!st.ragu[s.id]);
      main.querySelector('#qNext').innerHTML = st.idx === n - 1 ? 'Selesai ' + ic('check', 18) : 'Berikutnya ' + ic('chevR', 18);
      main.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { st.jaw[s.id] = b.dataset.k; simpan(); gambar(); }));
      main.querySelectorAll('[data-n]').forEach((b) => b.addEventListener('click', () => { st.idx = +b.dataset.n; simpan(); gambar(); }));
    };
    const pindah = (d) => { st.idx = Math.max(0, Math.min(n - 1, st.idx + d)); simpan(); gambar(); window.scrollTo({ top: 0, behavior: UI.reduce() ? 'auto' : 'smooth' }); };
    main.querySelector('#qPrev').addEventListener('click', () => pindah(-1));
    main.querySelector('#qRagu').addEventListener('click', () => { const id = L.soal[st.idx].id; if (st.ragu[id]) delete st.ragu[id]; else st.ragu[id] = 1; simpan(); gambar(); });
    main.querySelector('#qNext').addEventListener('click', () => { if (st.idx < n - 1) pindah(1); else konfirmasiKirim(); });
    main.querySelector('#qX').addEventListener('click', async () => {
      if (await UI.konfirmasi('Keluar dari latihan?', 'Jawabanmu tetap tersimpan di perangkat ini dan bisa dilanjutkan nanti.' + (batas ? ' Waktu tetap berjalan.' : ''), { ok: 'Keluar' })) { clearInterval(timerId); location.hash = '#/siswa/tugas'; }
    });

    const konfirmasiKirim = () => {
      const dij = Object.keys(st.jaw).length, ragu = Object.keys(st.ragu).length, s = sisa();
      const sh = UI.buka('<div class="row" style="gap:10px;margin-bottom:14px">' + ic('send', 22) + '<h3 style="font-size:20px">Kirim semua jawaban?</h3></div>' +
        '<div class="card" style="display:grid;grid-template-columns:repeat(' + (batas ? 3 : 2) + ',1fr);text-align:center;padding:14px 6px">' +
          '<div><p class="xs muted bold">TERJAWAB</p><p class="num bold" style="font-size:24px">' + dij + ' / ' + n + '</p></div>' +
          '<div style="border-left:1px solid var(--border-soft)"><p class="xs muted bold">RAGU-RAGU</p><p class="num bold" style="font-size:24px">' + ragu + '</p></div>' +
          (batas ? '<div style="border-left:1px solid var(--border-soft)"><p class="xs muted bold">SISA WAKTU</p><p class="num bold" style="font-size:24px">' + Math.ceil(s / 60) + ' Mnt</p></div>' : '') +
        '</div>' +
        (dij < n ? '<div class="warn-box" style="margin-top:12px">' + ic('alert', 18) + '<span>' + (n - dij) + ' soal belum dijawab dan akan dihitung salah.</span></div>' : '') +
        '<p class="small muted" style="margin:12px 0 16px">Pastikan semua soal sudah diperiksa. Setelah dikirim, jawaban tidak dapat diubah.</p>' +
        '<div class="grid-2"><button class="btn btn-outline" data-close>Periksa Lagi</button><button class="btn btn-primary" id="kirimOk">Kirim Jawaban ' + ic('check', 18) + '</button></div>', { kind: 'sheet', label: 'Konfirmasi kirim' });
      sh.el.querySelector('#kirimOk').addEventListener('click', () => { sh.tutup(); kirim(); });
    };
    const kirim = async () => {
      if (terkirim) return; terkirim = true;
      clearInterval(timerId);
      main.querySelector('#qBody').innerHTML = '<div class="empty" style="padding-top:60px"><span class="spinner" style="width:36px;height:36px;color:var(--primary);margin:0 auto 16px;display:block"></span><h3>Mengirim jawaban…</h3><p>Jangan tutup halaman ini.</p></div>';
      main.querySelector('.quiz-bar').classList.add('hidden');
      const r = await API.tulis('latihan.kirim', { id: L.id, jawaban: st.jaw, durasi: Math.round((Date.now() - st.mulai) / 1000) });
      if (!r.success) {
        terkirim = false; toast(r.message, 'error');
        main.querySelector('.quiz-bar').classList.remove('hidden'); gambar(); return;
      }
      try { localStorage.removeItem(kunciLokal); } catch (e) { /* */ }
      tampilHasil(L, r.data);
    };
    if (batas) {
      const tEl = main.querySelector('#qTimer');
      timerId = setInterval(() => {
        if (!document.body.contains(tEl)) { clearInterval(timerId); return; }
        const s = sisa();
        tEl.querySelector('span').textContent = jam(s);
        tEl.classList.toggle('low', s <= 120);
        if (s === 120) toast('Sisa waktu 2 menit.', 'warning');
        if (s <= 0) { clearInterval(timerId); toast('Waktu habis. Jawaban dikirim otomatis.', 'warning'); kirim(); }
      }, 1000);
      if (sisa() <= 0) { kirim(); return; }
    }
    gambar();
  }
  function tampilHasil(L, h) {
    boot = null;
    main.innerHTML = appbar('Hasil Latihan', L.judul, { back: 'tugas' }) +
      '<div class="s-pad"><div class="result-hero enter">' +
        '<div style="--i:0">' + UI.cincin(h.skor, { size: 156, stroke: 12, color: h.lulus ? 'var(--accent)' : '#D97706', track: 'var(--border-soft)', textColor: 'var(--text)', font: 40, label: '<span data-count="' + h.skor + '">0</span>' }) + '</div>' +
        '<h2 style="--i:1">' + (h.lulus ? 'Selamat, kamu lulus!' : 'Belum mencapai KKM') + '</h2>' +
        '<p class="muted" style="--i:2">' + (h.lulus ? 'Nilaimu di atas KKM ' + h.kkm + '. Pertahankan!' : 'KKM latihan ini ' + h.kkm + '. Pelajari pembahasan lalu coba lagi.') + '</p>' +
      '</div>' +
      '<div class="att"><div class="h"><span class="lbl">' + ic('checkCircle', 16) + ' Benar</span><b>' + h.benar + '</b></div><div class="a"><span class="lbl">' + ic('xCircle', 16) + ' Salah</span><b>' + h.salah + '</b></div><div class="i"><span class="lbl">' + ic('clock', 16) + ' Kosong</span><b>' + h.kosong + '</b></div></div>' +
      '<div class="stack" style="margin-top:20px"><a class="btn btn-primary btn-block btn-lg" href="#/siswa/hasil/' + esc(h.hasilId) + '">' + ic('eye', 20) + ' Lihat Pembahasan</a>' +
      (h.lulus ? '' : '<a class="btn btn-outline btn-block" href="#/siswa/kuis/' + esc(L.id) + '">' + ic('rotate', 18) + ' Ulangi Latihan</a>') +
      '<a class="btn btn-ghost btn-block" href="#/siswa/tugas">Kembali ke Daftar Tugas</a></div></div>';
    pasangBack(main); UI.animasi(main);
  }

  // ================================================================
  // HASIL / PEMBAHASAN
  // ================================================================
  function hasil(id) {
    kerangka('tugas');
    main.innerHTML = appbar('Pembahasan', '', { back: 'nilai' }) + '<div class="s-pad" id="hBody" style="padding-top:16px">' + UI.skeleton([110, 200, 200]) + '</div>';
    pasangBack(main);
    API.muat('hasil.detail', { id }, (d, c, err) => {
      const body = main.querySelector('#hBody'); if (!body) return;
      if (err) { body.innerHTML = UI.gagalMuat(err.message); body.querySelector('#btnUlang').onclick = () => hasil(id); return; }
      main.querySelector('.appbar p') ? main.querySelector('.appbar p').textContent = d.judul : main.querySelector('.appbar .ttl').insertAdjacentHTML('beforeend', '<p>' + esc(d.judul) + '</p>');
      const lulus = d.skor >= d.kkm;
      body.innerHTML = '<div class="card-dark stat row" style="gap:16px">' + UI.cincin(d.skor, { size: 76, label: d.skor, color: lulus ? 'var(--accent)' : '#F59E0B' }) +
        '<div class="grow"><p style="color:var(--on-dark-muted)" class="small">Nilai kamu • KKM ' + d.kkm + '</p><p class="num" style="font-size:22px;font-weight:700;color:#fff">' + d.benar + ' benar, ' + d.salah + ' salah' + (d.kosong ? ', ' + d.kosong + ' kosong' : '') + '</p><p class="small" style="color:var(--on-dark-muted)">' + esc(fmt.tgl(d.waktu)) + ' • ' + esc(fmt.durasi(d.durasi)) + '</p></div></div>' +
        d.soal.map((s, i) => {
          const benar = s.jawaban === s.kunci;
          return '<article class="card qcard"><div class="row between"><span class="pill pill-dark">Soal No. ' + (i + 1) + '</span><span class="pill ' + (benar ? 'pill-green' : s.jawaban ? 'pill-red' : 'pill-amber') + '">' + ic(benar ? 'checkCircle' : s.jawaban ? 'xCircle' : 'clock', 14) + (benar ? ' Benar' : s.jawaban ? ' Salah' : ' Tidak dijawab') + '</span></div>' +
            '<p class="q" style="font-size:16px">' + esc(s.pertanyaan) + '</p><div style="margin-top:12px">' +
            ['A', 'B', 'C', 'D'].map((k) => '<div class="opt' + (k === s.kunci ? ' benar' : k === s.jawaban ? ' salah' : '') + '" style="min-height:56px;font-size:15px;cursor:default"><span class="k">' + k + '</span><span class="grow">' + esc(s.opsi[k]) + '</span>' +
              (k === s.kunci ? '<span class="pill pill-green">Kunci</span>' : k === s.jawaban ? '<span class="pill pill-red">Jawabanmu</span>' : '') + '</div>').join('') + '</div>' +
            (s.pembahasan ? '<div class="info-box" style="margin-top:12px">' + ic('book', 18) + '<span><b>Pembahasan:</b> ' + esc(s.pembahasan) + '</span></div>' : '') + '</article>';
        }).join('') +
        '<a class="btn btn-outline btn-block" style="margin-top:16px" href="#/siswa/nilai">' + ic('chart', 18) + ' Lihat Semua Nilai</a>';
      UI.animasi(body);
    }, { umur: 3600000 });
  }

  // ================================================================
  // NILAI & KEHADIRAN
  // ================================================================
  let filterNilai = '';
  function nilai(arg) {
    kerangka('');
    const app = App.pengaturan();
    main.innerHTML = appbar('Nilai & Kehadiran', (app.tahun_ajaran ? 'T.A. ' + app.tahun_ajaran + ' • ' : '') + (boot ? boot.me.nama : ((API.Sesi.me() || {}).nama || '')), { kanan: '<button class="pbtn" id="nRapor">' + ic('download', 18) + ' Rapor</button><span style="width:8px"></span>' }) +
      '<div class="s-pad" id="nBody" style="padding-top:16px">' + UI.skeleton([56, 150, 110, 180, 180]) + '</div>';
    pasangBack(main);
    main.querySelector('#nRapor').addEventListener('click', () => { toast('Pilih "Simpan sebagai PDF" untuk menyimpan rapor.', 'info'); setTimeout(() => window.print(), 300); });
    API.muat('nilai.saya', {}, (d, c, err) => {
      const body = main.querySelector('#nBody'); if (!body) return;
      if (err) { body.innerHTML = UI.gagalMuat(err.message); body.querySelector('#btnUlang').onclick = () => nilai(arg); return; }
      renderNilai(body, d, arg);
    }, { umur: 30000 });
  }
  function renderNilai(body, d, arg) {
    const r = d.ringkasan, hb = d.hadir.bulanIni.total ? d.hadir.bulanIni : d.hadir.semua, labelHadir = d.hadir.bulanIni.total ? 'Bulan Ini' : 'Keseluruhan';
    const mapel = []; d.daftar.forEach((x) => { if (!mapel.find((m) => m.id === x.mapelId)) mapel.push({ id: x.mapelId, nama: x.mapel }); });
    const pctTuntas = r.selesai ? Math.round(r.tuntas / r.selesai * 100) : 0;
    body.innerHTML =
      '<div class="segmented no-print" role="tablist"><button data-sec="secNilai" class="on">' + ic('chart', 18) + ' Ringkasan Nilai</button><button data-sec="secHadir">' + ic('clipcheck', 18) + ' Kehadiran</button></div>' +
      '<section id="secNilai" style="scroll-margin-top:84px">' +
        '<div class="card-dark stat row" style="margin-top:16px;gap:12px;padding:18px"><div class="grow"><p style="color:var(--on-dark-muted);font-weight:500">Rata-rata Nilai</p>' +
          '<p class="num" style="font-size:40px;font-weight:700;color:#fff;line-height:1.1;margin:4px 0 10px">' + (r.rata === null ? '–' : '<span data-count="' + r.rata + '" data-dec="1">0</span>') + '<span style="font-size:18px;color:var(--on-dark-muted)"> /100</span></p>' +
          '<div class="row wrap">' + (r.tren !== null ? '<span class="pill" style="background:' + (r.tren >= 0 ? 'rgba(74,222,128,.14);color:var(--accent-dark-bg)' : 'rgba(248,113,113,.16);color:#FCA5A5') + '">' + ic(r.tren >= 0 ? 'trend' : 'trendDown', 14) + ' ' + (r.tren >= 0 ? '+' : '') + fmt.angka(r.tren) + ' poin</span>' : '') +
          '<span class="pill" style="background:rgba(255,255,255,.1);color:#fff">Grade ' + esc(r.grade.huruf) + ' (' + esc(r.grade.label) + ')</span></div></div>' +
          UI.cincin(r.rata || 0, { size: 88, stroke: 9, label: r.rata === null ? '–' : Math.round(r.rata) + '%' }) + '</div>' +
        '<div class="grid-2" style="margin-top:12px">' +
          '<div class="card stat"><p class="k">Latihan Selesai <span style="color:var(--primary)">' + ic('clipcheck', 20) + '</span></p><p class="v">' + r.selesai + '<small> / ' + r.tersedia + '</small></p>' + UI.bar(r.tersedia ? r.selesai / r.tersedia * 100 : 0) + '<p class="xs bold" style="color:var(--accent-text);margin-top:8px">' + pctTuntas + '% Tuntas</p></div>' +
          '<div class="card stat"><p class="k">Peringkat Kelas <span style="color:#D97706">' + ic('trophy', 20) + '</span></p><p class="v">' + (r.peringkat ? '#' + r.peringkat : '–') + '<small> / ' + r.jumlahKelas + '</small></p><p class="xs bold" style="color:var(--primary);margin-top:8px">' +
            (r.peringkat ? (r.peringkat <= 3 ? 'Konsisten di papan atas' : 'Top ' + Math.max(1, Math.ceil(r.peringkat / r.jumlahKelas * 100)) + '% di kelas') : 'Kerjakan latihan untuk masuk peringkat') + '</p></div>' +
        '</div>' +
        (mapel.length > 1 ? '<div class="chips no-print" style="margin-top:16px"><button class="chip" data-fm="">Semua Mapel</button>' + mapel.map((m) => '<button class="chip" data-fm="' + esc(m.id) + '">' + esc(m.nama) + '</button>').join('') + '</div>' : '') +
        '<div class="section-head"><h2>Daftar Hasil Latihan</h2><span class="small muted bold">Terbaru</span></div><div id="nList"></div>' +
      '</section>' +
      '<section id="secHadir" style="scroll-margin-top:84px">' +
        '<div class="section-head"><h2>Presensi & Kehadiran</h2></div>' +
        '<div class="card card-pad"><div class="row between"><div><p class="small muted bold">Tingkat Kehadiran ' + labelHadir + '</p><p class="num" style="font-size:30px;font-weight:700;color:var(--accent-text)">' + (hb.persen === null ? '–' : fmt.angka(hb.persen) + '%') + ' <span class="small muted" style="font-family:var(--font-b);font-weight:500">(' + hb.hadir + ' dari ' + hb.total + ' sesi)</span></p></div>' +
          '<span class="pill ' + (hb.persen === null ? '' : hb.persen >= 90 ? 'pill-green' : hb.persen >= 75 ? 'pill-blue' : 'pill-amber') + '">' + ic('checkCircle', 14) + ' ' + esc(hb.label) + '</span></div>' +
          '<div class="att" style="margin-top:14px"><div class="h"><span class="lbl">' + ic('checkCircle', 16) + ' Hadir</span><b>' + hb.hadir + '</b><span>Pertemuan</span></div><div class="i"><span class="lbl">' + ic('clock', 16) + ' Izin</span><b>' + hb.izin + '</b><span>Sakit/Surat</span></div><div class="a"><span class="lbl">' + ic('xCircle', 16) + ' Alfa</span><b>' + hb.alfa + '</b><span>Tanpa Ket.</span></div></div>' +
          (d.hadir.log.length ? '<p class="small bold" style="margin:16px 0 10px">Log Sesi Terakhir:</p>' + d.hadir.log.map((l) => {
            const k = { Hadir: ['', 'checkCircle', 'var(--accent-text)'], Izin: ['izin', 'clock', 'var(--warning)'], Alfa: ['alfa', 'xCircle', 'var(--danger)'] }[l.status] || ['', 'info', 'var(--muted)'];
            return '<div class="logi ' + k[0] + '"><span style="color:' + k[2] + '">' + ic(k[1], 22) + '</span><div class="grow"><p class="bold small">' + esc(l.judul) + '</p><p class="xs muted">' + esc(fmt.tgl(l.tanggal)) + (l.jam ? ' • ' + esc(l.jam) + ' WIB' : '') + (l.keterangan ? ' • ' + esc(l.keterangan) : '') + '</p></div><span class="small bold" style="color:' + k[2] + '">' + esc(l.status) + '</span></div>';
          }).join('') : '<p class="small muted" style="margin-top:14px">Belum ada catatan kehadiran.</p>') +
        '</div>' +
        (d.catatan ? '<div class="card-dark card-pad" style="margin-top:16px"><div class="row"><span style="width:44px;height:44px;border-radius:50%;background:var(--primary);display:grid;place-items:center;flex:none">' + ic('cap', 22) + '</span>' +
          '<div class="grow"><div class="row wrap"><span class="pill" style="background:rgba(255,255,255,.12);color:#fff">Tutor Pembina</span><span class="xs" style="color:var(--on-dark-muted)">' + esc(fmt.tgl(d.catatan.tanggal)) + '</span></div><h3 style="font-size:18px;margin-top:4px">Catatan ' + esc(d.catatan.oleh || 'Pengajar') + '</h3></div></div>' +
          '<p style="margin-top:12px;font-style:italic;color:#E2E8F0;line-height:1.6">“' + esc(d.catatan.teks) + '”</p></div>' : '') +
      '</section>';
    const gambarList = () => {
      body.querySelectorAll('[data-fm]').forEach((c) => c.classList.toggle('on', c.dataset.fm === filterNilai));
      const isi = d.daftar.filter((x) => !filterNilai || x.mapelId === filterNilai);
      body.querySelector('#nList').innerHTML = isi.length ? isi.map((x) =>
        '<article class="card hcard' + (x.lulus ? '' : ' remed') + '"><div class="row between" style="align-items:flex-start"><div class="grow"><span class="tag pill-blue">' + esc(x.mapel) + '</span><h3>' + esc(x.judul) + '</h3><p class="small muted">Diselesaikan: ' + esc(fmt.tgl(x.waktu)) + ' • ' + esc(fmt.durasi(x.durasi)) + '</p></div>' +
          '<div style="text-align:right"><div class="sc" style="color:' + (x.lulus ? 'var(--accent-text)' : 'var(--warning)') + '">' + x.skor + '<small>/100</small></div><span class="pill ' + (x.lulus ? 'pill-green' : 'pill-amber') + '" style="margin-top:6px">' + ic(x.lulus ? 'checkCircle' : 'alert', 14) + (x.lulus ? ' Lulus / Tuntas' : ' Perlu Remedial') + '</span></div></div>' +
          (x.lulus ? '<a class="btn btn-outline btn-block btn-sm no-print" style="margin-top:12px" href="#/siswa/hasil/' + esc(x.hasilId) + '">' + ic('eye', 16) + ' Lihat Pembahasan</a>'
            : '<div class="warn-box" style="margin-top:12px">' + ic('info', 18) + '<span>Nilai di bawah batas KKM (' + x.kkm + '). Ulangi latihan untuk remedi!</span></div><div class="grid-2 no-print" style="margin-top:10px">' +
              (x.bisaUlang ? '<a class="btn btn-primary btn-sm" href="#/siswa/kuis/' + esc(x.latihanId) + '">' + ic('rotate', 16) + ' Ulangi Latihan</a>' : '<span></span>') + '<a class="btn btn-outline btn-sm" href="#/siswa/hasil/' + esc(x.hasilId) + '">' + ic('book', 16) + ' Pembahasan</a></div>') +
        '</article>').join('') : '<div class="card">' + UI.kosong('chart', 'Belum ada nilai', 'Nilai akan muncul setelah kamu mengerjakan latihan soal.', '<a class="btn btn-primary" href="#/siswa/tugas">Kerjakan Latihan</a>') + '</div>';
    };
    body.querySelectorAll('[data-fm]').forEach((c) => c.addEventListener('click', () => { filterNilai = c.dataset.fm; gambarList(); }));
    gambarList();
    const seg = body.querySelectorAll('[data-sec]');
    seg.forEach((b) => b.addEventListener('click', () => {
      seg.forEach((x) => x.classList.toggle('on', x === b));
      document.getElementById(b.dataset.sec).scrollIntoView({ behavior: UI.reduce() ? 'auto' : 'smooth' });
    }));
    UI.animasi(body);
    if (arg === 'hadir') setTimeout(() => body.querySelector('[data-sec=secHadir]').click(), 120);
  }

  // ================================================================
  // JADWAL & TAGIHAN
  // ================================================================
  let tabJadwal = 'jadwal';
  function jadwal(arg) {
    kerangka('jadwal');
    if (arg === 'tagihan') tabJadwal = 'tagihan';
    main.innerHTML = appbar('Jadwal Les', boot ? boot.me.kelas : '', { kanan: lonceng() }) + '<div class="s-pad" id="jBody" style="padding-top:16px">' + UI.skeleton([56, 90, 90, 90]) + '</div>';
    pasangBack(main);
    API.muat('jadwal.saya', {}, (d, c, err) => {
      const body = main.querySelector('#jBody'); if (!body) return;
      if (err) { body.innerHTML = UI.gagalMuat(err.message); body.querySelector('#btnUlang').onclick = () => jadwal(); return; }
      const belum = d.tagihan.filter((t) => t.status !== 'Lunas').length;
      const gambar = () => {
        body.innerHTML = '<div class="segmented" role="tablist"><button data-t="jadwal" class="' + (tabJadwal === 'jadwal' ? 'on' : '') + '">' + ic('calendar', 18) + ' Jadwal</button><button data-t="tagihan" class="' + (tabJadwal === 'tagihan' ? 'on' : '') + '">' + ic('wallet', 18) + ' Tagihan' + (belum ? ' (' + belum + ')' : '') + '</button></div>' +
          '<div id="jIsi" class="enter"></div>';
        body.querySelectorAll('[data-t]').forEach((b) => b.addEventListener('click', () => { tabJadwal = b.dataset.t; gambar(); }));
        const isi = body.querySelector('#jIsi');
        if (tabJadwal === 'jadwal') {
          const depan = d.jadwal.filter((j) => j.tanggal >= d.hariIni), lalu = d.jadwal.filter((j) => j.tanggal < d.hariIni).reverse();
          const besok = fmt.geser(d.hariIni, 1);
          let html = '', tgl = '';
          depan.forEach((j, i) => {
            if (j.tanggal !== tgl) { tgl = j.tanggal; html += '<p class="day-h">' + ic('calendar', 16) + (j.tanggal === d.hariIni ? 'Hari Ini — ' : j.tanggal === besok ? 'Besok — ' : '') + esc(fmt.tglPanjang(j.tanggal)) + '</p>'; }
            html += kartuJadwal(j, j.tanggal === d.hariIni, i);
          });
          if (!depan.length) html = '<div class="card" style="margin-top:16px">' + UI.kosong('calendar', 'Belum ada jadwal', 'Jadwal les berikutnya akan muncul di sini.') + '</div>';
          if (lalu.length) html += '<p class="day-h" style="margin-top:28px">' + ic('history', 16) + ' Riwayat 2 minggu terakhir</p>' + lalu.map((j, i) => kartuJadwal(j, false, i)).join('');
          isi.innerHTML = html;
        } else {
          isi.innerHTML = d.tagihan.length ? '<div style="margin-top:16px">' + d.tagihan.map((t, i) => {
            const lewat = t.status !== 'Lunas' && t.jatuhTempo && t.jatuhTempo < d.hariIni;
            return '<article class="card ncard" style="--i:' + i + '"><div class="row between"><span class="tag pill-blue">' + esc(t.periode) + '</span><span class="pill ' + (t.status === 'Lunas' ? 'pill-green' : lewat ? 'pill-red' : 'pill-amber') + '">' + ic(t.status === 'Lunas' ? 'checkCircle' : 'clock', 14) + ' ' + (t.status === 'Lunas' ? 'Lunas' : lewat ? 'Lewat Jatuh Tempo' : 'Belum Bayar') + '</span></div>' +
              '<p class="num" style="font-size:26px;font-weight:700;margin-top:10px">' + fmt.rp(t.jumlah) + '</p>' +
              '<div class="meta">' + (t.jatuhTempo ? '<span>' + ic('calendar', 14) + ' Jatuh tempo ' + esc(fmt.tgl(t.jatuhTempo)) + '</span>' : '') + (t.tglBayar ? '<span>' + ic('checkCircle', 14) + ' Dibayar ' + esc(fmt.tgl(t.tglBayar)) + '</span>' : '') + '</div>' +
              (t.catatan ? '<p class="small muted" style="margin-top:8px">' + esc(t.catatan) + '</p>' : '') + '</article>';
          }).join('') + '<div class="info-box" style="margin-top:16px">' + ic('info', 20) + '<span>Status lunas diperbarui oleh pengelola bimbel setelah pembayaran diterima.</span></div></div>'
            : '<div class="card" style="margin-top:16px">' + UI.kosong('wallet', 'Tidak ada tagihan', 'Tagihan les akan tampil di sini.') + '</div>';
        }
      };
      gambar();
    }, { umur: 30000 });
  }
  function kartuJadwal(j, hariIni, i) {
    const st = { Hadir: 'pill-green', Izin: 'pill-amber', Alfa: 'pill-red' }[j.status];
    return '<article class="card jd' + (hariIni ? ' today' : '') + '" style="--i:' + i + '"><div class="time">' + esc(j.mulai) + (j.selesai ? '<small>s/d ' + esc(j.selesai) + '</small>' : '') + '</div>' +
      '<div class="grow"><div class="row between"><h3 style="font-size:17px">' + esc(j.mapel) + '</h3>' + (st ? '<span class="pill ' + st + '">' + esc(j.status) + '</span>' : hariIni ? '<span class="pill pill-solid-blue">Hari ini</span>' : '') + '</div>' +
      '<div class="ncard" style="padding:0"><div class="meta" style="margin-top:4px">' + (j.label ? '<span>' + ic('layers', 14) + esc(j.label) + '</span>' : '') + (j.ruang ? '<span>' + ic('pin', 14) + esc(j.ruang) + '</span>' : '') + (j.tutor ? '<span>' + ic('user', 14) + esc(j.tutor) + '</span>' : '') + '</div></div>' +
      (j.catatan ? '<p class="small muted" style="margin-top:6px">' + esc(j.catatan) + '</p>' : '') + '</div></article>';
  }

  // ================================================================
  // PROFIL
  // ================================================================
  function profil() {
    kerangka('profil');
    main.innerHTML = appbar('Profil Saya', '', { kanan: lonceng() }) + '<div class="s-pad" id="pBody" style="padding-top:16px">' + UI.skeleton([110, 320, 220]) + '</div>';
    pasangBack(main);
    API.muat('profil.saya', {}, (d, c, err) => {
      const body = main.querySelector('#pBody'); if (!body) return;
      if (err) { body.innerHTML = UI.gagalMuat(err.message); body.querySelector('#btnUlang').onclick = profil; return; }
      renderProfil(body, d);
    }, { umur: 60000 });
  }
  function renderProfil(body, d) {
    const p = d.profil;
    main.querySelector('.appbar .ttl').innerHTML = '<h1>Profil Saya</h1><p>ID ' + esc(p.id) + '</p>';
    const f = (id, label, val, extra) => '<div class="field"><label for="' + id + '">' + label + '</label>' + (extra && extra.area ? '<textarea class="textarea" id="' + id + '" rows="3">' + esc(val) + '</textarea>'
      : '<input class="input" id="' + id + '" value="' + esc(val) + '"' + (extra ? ' ' + (extra.attr || '') : '') + '>') + (extra && extra.hint ? '<span class="hint">' + extra.hint + '</span>' : '') + '</div>';
    body.innerHTML =
      '<div class="card pf-head"><div class="pf-ava">' + esc(fmt.inisial(p.nama)) + '</div><div class="grow"><div class="row wrap"><span class="pill pill-dark">ID ' + esc(p.id) + '</span><span class="pill pill-green">' + ic('checkCircle', 14) + ' ' + esc(p.status) + '</span></div>' +
        '<h2 style="font-size:20px;margin-top:6px">' + esc(p.nama) + '</h2><p class="small muted">' + esc(p.kelas) + (p.tglDaftar ? ' • Bergabung ' + esc(fmt.tgl(p.tglDaftar)) : '') + '</p></div></div>' +
      '<form id="pForm" novalidate>' +
        '<div class="card form-sec" style="margin-top:14px"><h3>' + ic('user', 20) + ' Data Pribadi</h3><div class="stack">' +
          f('pNama', 'Nama Lengkap', p.nama, { attr: 'required autocomplete="name"' }) +
          f('pHp', 'Nomor WhatsApp / HP', p.noHp, { attr: 'type="tel" inputmode="tel" autocomplete="tel" placeholder="08xxxxxxxxxx"' }) +
          f('pEmail', 'Email', p.email, { attr: 'type="email" inputmode="email" autocomplete="email" placeholder="nama@email.com"' }) +
          f('pLahir', 'Tanggal Lahir', p.tglLahir, { attr: 'type="date"' }) +
          f('pAlamat', 'Alamat Tempat Tinggal', p.alamat, { area: true }) +
        '</div></div>' +
        '<div class="card form-sec" style="margin-top:14px"><h3>' + ic('users', 20) + ' Kontak Orang Tua / Wali</h3><div class="stack">' +
          f('pWali', 'Nama Orang Tua / Wali', p.namaWali) +
          f('pHpWali', 'Nomor HP Orang Tua / Wali', p.hpWali, { attr: 'type="tel" inputmode="tel" placeholder="08xxxxxxxxxx"' }) +
          '<div class="field"><span class="label" id="pHubLbl">Hubungan Keluarga</span><div class="segmented" role="radiogroup" aria-labelledby="pHubLbl">' + ['Ayah', 'Ibu', 'Wali Lainnya'].map((h) => '<button type="button" role="radio" data-hub="' + h + '" class="' + (p.hubunganWali === h ? 'on' : '') + '" aria-checked="' + (p.hubunganWali === h) + '">' + h + '</button>').join('') + '</div></div>' +
        '</div></div>' +
        '<button class="btn btn-primary btn-block btn-lg" type="submit" style="margin-top:16px" id="pSimpan">' + ic('checkCircle', 20) + ' Simpan Perubahan</button>' +
      '</form>' +
      '<div class="card form-sec" style="margin-top:16px"><h3>' + ic('shield', 20) + ' Keamanan Akun</h3>' +
        '<button class="li" id="pSandi" style="box-shadow:none"><span class="sq">' + ic('key', 22) + '</span><div class="grow"><h4>Ubah Kata Sandi</h4><p class="sub">' + (d.wajibGanti ? 'Disarankan: masih memakai sandi awal' : 'Ganti secara berkala agar aman') + '</p></div>' + ic('chevR', 20, 'muted') + '</button>' +
        '<button class="li" id="pSemua" style="box-shadow:none"><span class="sq">' + ic('logout', 22) + '</span><div class="grow"><h4>Keluar dari semua perangkat</h4><p class="sub">Akhiri sesi di HP/laptop lain</p></div>' + ic('chevR', 20, 'muted') + '</button>' +
      '</div>' +
      '<button class="btn btn-danger-outline btn-block btn-lg" id="pKeluar" style="margin-top:16px">' + ic('logout', 20) + ' Keluar Akun</button>' +
      '<p class="xs muted" style="text-align:center;margin:16px 0">' + esc(App.pengaturan().nama_app) + ' • Data tersimpan di Google Sheets bimbel</p>';
    let hub = p.hubunganWali;
    body.querySelectorAll('[data-hub]').forEach((b) => b.addEventListener('click', () => { hub = b.dataset.hub; body.querySelectorAll('[data-hub]').forEach((x) => { x.classList.toggle('on', x === b); x.setAttribute('aria-checked', x === b); }); }));
    body.querySelector('#pSandi').addEventListener('click', () => App.modalGantiSandi(false));
    body.querySelector('#pSemua').addEventListener('click', () => App.keluar(true));
    body.querySelector('#pKeluar').addEventListener('click', async () => { if (await UI.konfirmasi('Keluar dari akun?', 'Anda perlu memasukkan ID dan kata sandi lagi untuk masuk.', { ok: 'Keluar' })) App.keluar(false); });
    body.querySelector('#pForm').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = (id) => body.querySelector('#' + id).value.trim();
      const nama = body.querySelector('#pNama');
      if (!v('pNama')) { nama.classList.add('invalid'); nama.focus(); toast('Nama lengkap wajib diisi.', 'error'); return; }
      nama.classList.remove('invalid');
      const btn = body.querySelector('#pSimpan'); btn.disabled = true; btn.innerHTML = '<span class="spinner"></span> Menyimpan…';
      const r = await API.tulis('profil.simpan', { profil: { nama: v('pNama'), noHp: v('pHp'), email: v('pEmail'), tglLahir: v('pLahir'), alamat: v('pAlamat'), namaWali: v('pWali'), hpWali: v('pHpWali'), hubunganWali: hub } });
      btn.disabled = false; btn.innerHTML = ic('checkCircle', 20) + ' Simpan Perubahan';
      if (!r.success) { toast(r.message, 'error'); return; }
      toast(r.message, 'success');
      API.Cache.set('profil.saya', {}, Object.assign({}, d, { profil: r.data.profil }));
      API.Sesi.perbaruiMe({ nama: r.data.profil.nama });
      boot = null;
      renderProfil(body, Object.assign({}, d, { profil: r.data.profil }));
    });
  }

  // ================================================================
  // NOTIFIKASI
  // ================================================================
  let filterNotif = '';
  function notif() {
    kerangka('');
    main.innerHTML = appbar('Notifikasi', 'Update terkini', { kanan: '<button class="pbtn" id="nBaca">' + ic('check', 18) + ' Tandai dibaca</button><span style="width:8px"></span>' }) + '<div class="s-pad" id="ntBody" style="padding-top:16px">' + UI.skeleton([44, 150, 150]) + '</div>';
    pasangBack(main);
    muatBoot((d, c, err) => {
      const body = main.querySelector('#ntBody'); if (!body) return;
      if (err) { body.innerHTML = UI.gagalMuat(err.message); body.querySelector('#btnUlang').onclick = notif; return; }
      const gambar = () => {
        const baca = sudahBaca(), list = d.notif, nBelum = belumDibaca(list);
        const kat = [['', 'Semua'], ['jadwal', 'Jadwal Les'], ['pembayaran', 'Pembayaran'], ['materi', 'Materi'], ['latihan', 'Latihan']];
        const isi = list.filter((x) => !filterNotif || x.kategori === filterNotif);
        body.innerHTML = '<div class="chips">' + kat.map((k) => { const n = k[0] ? list.filter((x) => x.kategori === k[0]).length : list.length; return n || !k[0] ? '<button class="chip' + (filterNotif === k[0] ? ' on' : '') + '" data-k="' + k[0] + '">' + k[1] + ' (' + n + ')</button>' : ''; }).join('') + '</div>' +
          (nBelum ? '<div class="card card-pad row between" style="margin-top:14px"><div><p class="bold">' + nBelum + ' Notifikasi Belum Dibaca</p><p class="small muted">Periksa jadwal & tagihan bimbel kamu</p></div></div>' : '') +
          '<div style="margin-top:14px" class="enter">' + (isi.length ? isi.map((x, i) => kartuNotif(x, !baca[x.id], i)).join('') : '<div class="card">' + UI.kosong('bell', 'Belum ada notifikasi', 'Pengingat jadwal les, tagihan, materi, dan latihan baru akan tampil di sini.') + '</div>') + '</div>';
        body.querySelectorAll('[data-k]').forEach((b) => b.addEventListener('click', () => { filterNotif = b.dataset.k; gambar(); }));
        body.querySelectorAll('[data-nid]').forEach((b) => b.addEventListener('click', () => tandaiBaca([b.dataset.nid])));
      };
      main.querySelector('#nBaca').onclick = () => { tandaiBaca(d.notif.map((x) => x.id)); gambar(); toast('Semua notifikasi ditandai dibaca.', 'success'); };
      gambar();
    });
  }
  function kartuNotif(x, belum, i) {
    const T = {
      jadwal: ['Jadwal Les', 'calendar', '#/siswa/jadwal', 'Lihat Jadwal'], pembayaran: ['Pembayaran', 'wallet', '#/siswa/jadwal/tagihan', 'Lihat Rincian Tagihan'],
      materi: ['Materi Baru', 'book', '#/siswa/materi', 'Buka Materi'], latihan: ['Latihan Baru', 'quiz', '#/siswa/kuis/' + (x.latihanId || ''), 'Kerjakan Sekarang']
    }[x.kategori];
    let sub = '', teks = x.teks;
    if (x.kategori === 'jadwal') sub = '<div class="meta">' + '<span>' + ic('calendar', 14) + esc(fmt.tgl(x.tanggal, { hari: true })) + '</span><span>' + ic('clock', 14) + esc(x.jam) + ' WIB</span>' + (x.ruang ? '<span>' + ic('pin', 14) + esc(x.ruang) + '</span>' : '') + (x.tutor ? '<span>' + ic('user', 14) + esc(x.tutor) + '</span>' : '') + '</div>';
    if (x.kategori === 'pembayaran') teks = 'Tagihan sebesar ' + fmt.rp(x.jumlah) + (x.jatuhTempo ? '. Batas pembayaran: ' + fmt.tgl(x.jatuhTempo) + '.' : '.') + (x.teks ? ' ' + x.teks : '');
    const tag2 = x.kategori === 'pembayaran' ? '<span class="pill ' + (x.lewat ? 'pill-red' : 'pill-amber') + '">' + (x.lewat ? 'Lewat Jatuh Tempo' : 'Menunggu Pembayaran') + '</span>' : x.penting ? '<span class="pill pill-outline">Penting</span>' : '';
    return '<article class="card ncard' + (belum ? ' unread' : '') + '" style="--i:' + i + '"><div class="row wrap"><span class="pill pill-dark">' + ic(T[1], 14) + ' ' + T[0] + '</span>' + tag2 + '</div>' +
      '<h3>' + esc(x.judul) + '</h3>' + (teks ? '<p class="small muted">' + esc(teks) + '</p>' : '') + sub +
      '<a class="btn ' + (x.penting ? 'btn-dark' : 'btn-outline') + ' btn-block btn-sm" style="margin-top:12px" href="' + T[2] + '" data-nid="' + esc(x.id) + '">' + esc(T[3]) + ' ' + ic('right', 16) + '</a></article>';
  }
})();
