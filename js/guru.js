/* ==================================================================
   PANEL GURU / PENGELOLA — desktop-first, sidebar navy
   ================================================================== */
(function () {
  'use strict';
  const { ic, esc, fmt, toast } = UI;
  let M = null;               // master.list: kelas, mapel, app, pengaturan, guru, saya
  let main = null;
  let halaman = '';
  const isAdmin = () => { const me = API.Sesi.me() || {}; return me.peran === 'admin' || me.peran === 'superadmin'; };

  const NAV = [
    ['Utama', [['dashboard', 'grid', 'Dashboard'], ['siswa', 'users', 'Siswa & Kelas'], ['presensi', 'clipcheck', 'Presensi Kehadiran'], ['jadwal', 'calendar', 'Jadwal & Tagihan']]],
    ['Pembelajaran', [['materi', 'book', 'Materi Pembelajaran'], ['latihan', 'quiz', 'Latihan Soal'], ['nilai', 'chart', 'Nilai Siswa'], ['laporan', 'report', 'Laporan']]],
    ['Sistem', [['pengaturan', 'settings', 'Pengaturan']]]
  ];
  const JUDUL = { dashboard: ['Ringkasan Operasional', 'Dashboard'], siswa: ['Data Master', 'Siswa & Kelas'], presensi: ['Kegiatan Les', 'Presensi Kehadiran'], jadwal: ['Kegiatan Les', 'Jadwal & Tagihan'],
    materi: ['Pembelajaran', 'Materi Pembelajaran'], latihan: ['Pembelajaran', 'Latihan Soal'], nilai: ['Pembelajaran', 'Nilai Siswa'], laporan: ['Analitik', 'Laporan'], pengaturan: ['Sistem', 'Pengaturan'] };

  // ---------------- kerangka ----------------
  function kerangka(hal) {
    halaman = hal;
    const root = document.getElementById('app');
    const me = API.Sesi.me() || {}, app = (M && M.app) || App.pengaturan();
    if (!root.querySelector('.g-app')) {
      root.innerHTML = '<div class="g-app"><aside class="side" id="side" aria-label="Menu panel guru"></aside><div class="g-main">' +
        '<header class="topbar"><button class="icon-btn light menu-btn" id="gMenu" aria-label="Buka menu">' + ic('menu', 24) + '</button>' +
        '<div class="grow"><p class="crumb" id="gCrumb"></p><h1 id="gJudul"></h1></div>' +
        '<label class="search">' + ic('search', 20, 'muted') + '<span class="sr-only">Cari siswa</span><input id="gCari" type="search" placeholder="Cari nama siswa…"></label>' +
        '<button class="btn btn-outline btn-icon" id="gSegar" title="Segarkan data dari Google Sheets" aria-label="Segarkan data">' + ic('refresh', 20) + '</button></header>' +
        '<main class="g-content" id="gMain"></main></div></div>';
      root.querySelector('#gMenu').addEventListener('click', bukaSide);
      root.querySelector('#gSegar').addEventListener('click', segarkan);
      root.querySelector('#gCari').addEventListener('keydown', (e) => { if (e.key === 'Enter') { cariSiswa = e.target.value.trim(); hal_siswa_tab = 'siswa'; if (halaman === 'siswa') siswa(); else location.hash = '#/guru/siswa'; } });
    }
    const side = root.querySelector('#side');
    side.innerHTML = '<div class="brand"><div class="logo">' + UI.logoHtml(app) + '</div><div class="grow"><h1>' + esc(app.nama_app) + '</h1><p>Portal Bimbel Terpadu</p></div></div>' +
      NAV.map((g) => '<p class="grp">' + g[0] + '</p>' + g[1].map((n) => '<a class="nav-i' + (n[0] === hal ? ' on' : '') + '" href="#/guru/' + n[0] + '"' + (n[0] === hal ? ' aria-current="page"' : '') + '>' + ic(n[1], 20) + '<span>' + n[2] + '</span>' + hitungNav(n[0]) + '</a>').join('')).join('') +
      '<div class="me"><span class="av">' + esc(fmt.inisial(me.nama)) + '</span><div class="grow" style="min-width:0"><b class="ellipsis">' + esc(me.nama) + '</b><span>' + esc({ admin: 'Admin', guru: 'Guru / Tutor', superadmin: 'Akses Darurat' }[me.peran] || '') + '</span></div>' +
      '<button class="icon-btn" id="gKeluar" aria-label="Keluar" title="Keluar">' + ic('logout', 20) + '</button></div>';
    side.querySelector('#gKeluar').addEventListener('click', async () => { if (await UI.konfirmasi('Keluar dari panel?', 'Anda perlu masuk lagi untuk mengelola data.', { ok: 'Keluar' })) App.keluar(false); });
    side.querySelectorAll('.nav-i').forEach((a) => a.addEventListener('click', tutupSide));
    root.querySelector('#gCrumb').textContent = (JUDUL[hal] || ['', ''])[0].toUpperCase();
    root.querySelector('#gJudul').textContent = (JUDUL[hal] || ['', ''])[1];
    main = root.querySelector('#gMain');
    window.scrollTo(0, 0);
    return main;
  }
  function hitungNav(h) {
    if (!M) return '';
    if (h === 'siswa') { const n = M.kelas.reduce((a, k) => a + k.jumlah, 0); return n ? '<span class="cnt">' + n + '</span>' : ''; }
    return '';
  }
  function bukaSide() { document.getElementById('side').classList.add('open'); const s = document.createElement('div'); s.className = 'side-scrim'; s.id = 'scrim'; s.onclick = tutupSide; document.body.appendChild(s); }
  function tutupSide() { const s = document.getElementById('side'); if (s) s.classList.remove('open'); const x = document.getElementById('scrim'); if (x) x.remove(); }
  async function segarkan() {
    const b = document.getElementById('gSegar'); b.disabled = true; b.innerHTML = '<span class="spinner"></span>';
    const r = await API.tulis('sistem.segarkan', {});
    b.disabled = false; b.innerHTML = ic('refresh', 20);
    if (!r.success) return toast(r.message, 'error');
    API.Cache.hapusSemua(); M = null;
    toast('Data disegarkan dari Google Sheets.', 'success');
    App.route();
  }
  /** Pastikan master (kelas/mapel) siap, lalu jalankan fn. */
  function denganMaster(fn) {
    if (M) { fn(); }
    API.muat('master.list', {}, (d, cache, err) => {
      if (err && !M) { main.innerHTML = UI.gagalMuat(err.message); main.querySelector('#btnUlang').onclick = () => App.route(); return; }
      if (!d) return;
      const awal = !M, beda = M && JSON.stringify(M) !== JSON.stringify(d);
      M = d; App.setApp(d.app);
      if (awal || beda) { kerangka(halaman); fn(); }
    }, { umur: 60000 });
  }
  const opsiKelas = (pilih, semua) => (semua ? '<option value="SEMUA"' + (pilih === 'SEMUA' ? ' selected' : '') + '>Semua Kelas</option>' : '') + M.kelas.map((k) => '<option value="' + esc(k.id) + '"' + (k.id === pilih ? ' selected' : '') + '>' + esc(k.nama) + '</option>').join('');
  const opsiMapel = (pilih) => M.mapel.map((m) => '<option value="' + esc(m.id) + '"' + (m.id === pilih ? ' selected' : '') + '>' + esc(m.nama) + '</option>').join('');
  const namaKelas = (id) => id === 'SEMUA' ? 'Semua Kelas' : ((M.kelas.find((k) => k.id === id) || {}).nama || '-');
  const fld = (id, label, inner, hint) => '<div class="field"><label for="' + id + '">' + label + '</label>' + inner + (hint ? '<span class="hint">' + hint + '</span>' : '') + '</div>';
  const inp = (id, val, attr) => '<input class="input" id="' + id + '" value="' + esc(val === undefined || val === null ? '' : val) + '" ' + (attr || '') + '>';
  const sel = (id, opsi, attr) => '<select class="select" id="' + id + '" ' + (attr || '') + '>' + opsi + '</select>';
  const btnOf = (e) => e._btn || (e._btn = e.currentTarget);      // currentTarget jadi null setelah await
  function tombolSibuk(btn, sibuk, label) { btn.disabled = sibuk; if (sibuk) { btn.dataset.html = btn.innerHTML; btn.innerHTML = '<span class="spinner"></span> ' + (label || 'Menyimpan…'); } else if (btn.dataset.html) btn.innerHTML = btn.dataset.html; }
  function butuhMaster(teks) {
    if (M.kelas.length && M.mapel.length) return '';
    return '<div class="warn-box" style="margin-bottom:16px">' + ic('alert', 18) + '<span>' + esc(teks || 'Tambahkan kelas dan mata pelajaran terlebih dahulu di menu Siswa & Kelas → tab Kelas & Mapel.') + ' <a href="#/guru/siswa/kelas">Buka sekarang</a></span></div>';
  }
  function pager(total, hal, per, onGo) {
    const n = Math.max(1, Math.ceil(total / per));
    if (total <= per) return '<div class="pager"><span>Menampilkan ' + total + ' data</span></div>';
    const nomor = []; for (let i = 1; i <= n; i++) if (i === 1 || i === n || Math.abs(i - hal) <= 1) nomor.push(i); else if (nomor[nomor.length - 1] !== '…') nomor.push('…');
    setTimeout(() => document.querySelectorAll('[data-pg]').forEach((b) => b.addEventListener('click', () => onGo(+b.dataset.pg))), 0);
    return '<div class="pager"><span>Menampilkan ' + ((hal - 1) * per + 1) + '–' + Math.min(total, hal * per) + ' dari ' + total + ' data</span><div class="pg">' +
      '<button data-pg="' + Math.max(1, hal - 1) + '" aria-label="Sebelumnya">‹</button>' + nomor.map((x) => x === '…' ? '<button disabled>…</button>' : '<button data-pg="' + x + '" class="' + (x === hal ? 'on' : '') + '">' + x + '</button>').join('') + '<button data-pg="' + Math.min(n, hal + 1) + '" aria-label="Berikutnya">›</button></div></div>';
  }

  const Guru = {
    route(p) {
      const peta = { dashboard, siswa, presensi, jadwal, materi, latihan, nilai, laporan, pengaturan };
      const h = peta[p[0]] ? p[0] : 'dashboard';
      kerangka(h);
      main.innerHTML = UI.skeleton([110, 300, 200]);
      denganMaster(() => peta[h](p[1], p[2]));
    }
  };
  window.Guru = Guru;

  // ================================================================
  // DASHBOARD
  // ================================================================
  function dashboard() {
    API.muat('guru.dashboard', {}, (d, c, err) => {
      if (halaman !== 'dashboard') return;
      if (err) { main.innerHTML = UI.gagalMuat(err.message); main.querySelector('#btnUlang').onclick = dashboard; return; }
      const k = d.kpi, HR = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
      main.innerHTML =
        '<div class="row between wrap" style="margin-bottom:18px"><p class="muted row">' + ic('calendar', 18) + esc(fmt.tglPanjang(d.hariIni)) + (M.app.tahun_ajaran ? ' • T.A. ' + esc(M.app.tahun_ajaran) : '') + '</p>' +
          '<div class="row"><a class="btn btn-outline btn-sm" href="#/guru/jadwal">' + ic('plus', 16) + ' Jadwal</a><a class="btn btn-primary btn-sm" href="#/guru/presensi">' + ic('clipcheck', 16) + ' Catat Presensi</a></div></div>' +
        (k.tagihanLewat ? '<div class="warn-box" style="margin-bottom:16px">' + ic('alert', 18) + '<span>' + k.tagihanLewat + ' tagihan sudah lewat jatuh tempo. <a href="#/guru/jadwal/tagihan">Lihat tagihan</a></span></div>' : '') +
        '<div class="kpis enter">' +
          kpi(0, 'TOTAL SISWA AKTIF', 'users', '<span data-count="' + k.siswaAktif + '">0</span>' + (k.target ? '<small> / ' + k.target + '</small>' : ''), (k.target ? UI.bar(Math.min(100, k.siswaAktif / k.target * 100), 'blue') + '<div style="height:8px"></div>' : '') + '<span class="pill pill-green">+' + k.baruBulanIni + '</span> siswa baru bulan ini') +
          kpi(1, 'KEHADIRAN HARI INI', 'clipcheck', k.hadirPersen === null ? '–' : '<span data-count="' + k.hadirPersen + '" data-dec="1">0</span><small>%</small>', k.tercatat ? k.hadir + ' hadir dari ' + k.tercatat + ' • <span class="pill pill-amber">' + k.izin + ' izin</span><span class="pill pill-red">' + k.alfa + ' alfa</span>' : 'Belum ada presensi tercatat hari ini') +
          kpi(2, 'MATERI DIUNGGAH', 'folder', '<span data-count="' + k.materi + '">0</span><small> modul</small>', k.materiTerbaru ? '<span class="ellipsis" style="max-width:100%">Terbaru: ' + esc(k.materiTerbaru) + '</span>' : 'Belum ada materi') +
          kpi(3, 'LATIHAN SOAL TERBIT', 'quiz', '<span data-count="' + k.latihanTerbit + '">0</span>', k.pengerjaan + ' pengerjaan' + (k.rataNilai !== null ? ' • rata-rata <b class="num">' + fmt.angka(k.rataNilai) + '</b>' : '')) +
        '</div>' +
        '<div class="g-grid">' +
          '<section class="card panel"><div class="panel-h"><div><h2>' + ic('chart', 20) + ' Tingkat Kehadiran 7 Hari</h2><p>Persentase siswa hadir dari yang tercatat per hari</p></div><button class="btn btn-ghost btn-sm" data-tabel="chHadir">' + ic('table', 16) + ' Tabel</button></div>' +
            '<div class="chart" id="chHadir"></div><div id="chHadirT" class="hidden"></div></section>' +
          '<section class="card panel"><div class="panel-h"><h2>' + ic('zap', 20) + ' Aksi Cepat</h2></div><div class="quick">' +
            qa('presensi', 'clipcheck', 'Catat Presensi', 'Checklist siswa per sesi') + qa('materi', 'upload', 'Unggah Modul', 'PDF ke Google Drive') +
            qa('latihan/baru', 'quiz', 'Buat Latihan', 'Soal pilihan ganda') + qa('jadwal/tagihan', 'wallet', 'Buat Tagihan', 'Per siswa atau massal') + '</div></section>' +
        '</div>' +
        '<div class="g-grid">' +
          '<section class="card panel"><div class="panel-h"><h2>' + ic('clock', 20) + ' Sesi Hari Ini</h2><span class="pill pill-outline">' + d.sesi.length + ' sesi terjadwal</span></div>' +
            (d.sesi.length ? d.sesi.map((s) => '<div class="sesi"><div class="tm">' + esc(s.mulai) + (s.selesai ? '<small>– ' + esc(s.selesai) + '</small>' : '') + '</div><div class="grow"><b>' + esc(s.kelas) + '</b> <span class="muted small">• ' + esc(s.mapel) + '</span>' +
              '<p class="small muted">' + esc([s.tutor, s.ruang].filter(Boolean).join(' • ')) + '</p><p class="xs bold" style="margin-top:4px">Tercatat ' + s.tercatat + ' / ' + s.kapasitas + ' siswa</p></div>' +
              '<a class="btn ' + (s.tercatat >= s.kapasitas && s.kapasitas ? 'btn-outline' : 'btn-dark') + ' btn-sm" href="#/guru/presensi/' + encodeURIComponent(s.kelasId) + '/' + encodeURIComponent(s.id) + '">' + (s.tercatat >= s.kapasitas && s.kapasitas ? ic('check', 16) + ' Selesai' : ic('clipcheck', 16) + ' Buka Presensi') + '</a></div>').join('')
              : UI.kosong('calendar', 'Tidak ada sesi hari ini', 'Tambahkan jadwal les agar sesi tampil di sini.', '<a class="btn btn-outline btn-sm" href="#/guru/jadwal">' + ic('plus', 16) + ' Tambah Jadwal</a>')) + '</section>' +
          '<section class="card panel"><div class="panel-h"><h2>' + ic('star', 20) + ' Hasil Latihan Terbaru</h2></div>' +
            (d.terbaru.length ? d.terbaru.map((h) => '<button class="li" data-hasil="' + esc(h.id) + '" style="box-shadow:none"><div class="grow"><h4 class="ellipsis">' + esc(h.nama) + ' <span class="pill pill-outline">' + esc(h.kelas) + '</span></h4><p class="sub ellipsis">' + esc(h.latihan) + '</p></div>' +
              '<div class="end"><div class="score">' + h.skor + '<span class="small muted">/100</span></div><span class="pill ' + (h.lulus ? 'pill-green' : 'pill-amber') + '">' + (h.lulus ? 'Tuntas' : 'Perlu Remedial') + '</span></div></button>').join('') +
              '<a class="btn btn-outline btn-block" style="margin-top:12px" href="#/guru/nilai">Lihat semua nilai ' + ic('right', 16) + '</a>'
              : UI.kosong('quiz', 'Belum ada pengerjaan', 'Hasil latihan siswa akan muncul di sini.')) + '</section>' +
        '</div>';
      const items = d.grafik.map((g) => ({ label: HR[new Date(g.tanggal + 'T00:00:00').getDay()] + ' ' + g.tanggal.slice(8), pendek: HR[new Date(g.tanggal + 'T00:00:00').getDay()], value: g.persen, tip: '<b>' + esc(fmt.tgl(g.tanggal, { hari: true })) + '</b><br>' + (g.total ? g.persen + '% hadir (' + g.hadir + '/' + g.total + ')' : 'Belum ada presensi') }));
      UI.grafikKolom(main.querySelector('#chHadir'), items, { max: 100, satuan: '%', target: 90, aria: 'Grafik kehadiran 7 hari terakhir' });
      pasangTabel('chHadir', ['Tanggal', 'Hadir', 'Tercatat', 'Persen'], d.grafik.map((g) => [fmt.tgl(g.tanggal, { hari: true }), g.hadir, g.total, g.persen === null ? '-' : g.persen + '%']));
      main.querySelectorAll('[data-hasil]').forEach((b) => b.addEventListener('click', () => lihatHasil(b.dataset.hasil)));
      UI.animasi(main);
    }, { umur: 30000 });
  }
  function kpi(i, label, ikon, nilai, foot) {
    return '<div class="card kpi" style="--i:' + i + '"><div class="k">' + label + '<span class="sq">' + ic(ikon, 20) + '</span></div><div class="v">' + nilai + '</div><div class="f">' + foot + '</div></div>';
  }
  function qa(href, ikon, judul, sub) { return '<a class="qa" href="#/guru/' + href + '" style="text-decoration:none;color:inherit">' + ic(ikon, 24) + '<b>' + judul + '</b><span>' + sub + '</span></a>'; }
  function pasangTabel(id, kol, baris) {
    const btn = main.querySelector('[data-tabel="' + id + '"]'); if (!btn) return;
    const t = main.querySelector('#' + id + 'T');
    t.innerHTML = UI.tabelGrafik(kol, baris);
    btn.addEventListener('click', () => { const on = t.classList.toggle('hidden'); main.querySelector('#' + id).classList.toggle('hidden', !on); btn.innerHTML = on ? ic('table', 16) + ' Tabel' : ic('chart', 16) + ' Grafik'; });
  }
  /** Lihat pembahasan hasil (modal) — dipakai di dashboard & nilai. */
  async function lihatHasil(id) {
    const m = UI.buka(UI.headHtml('Hasil Latihan') + '<div class="modal-body">' + UI.skeleton([80, 160, 160]) + '</div>', { wide: true });
    const r = await API.api('hasil.detail', { id });
    if (!r.success) { m.el.querySelector('.modal-body').innerHTML = UI.gagalMuat(r.message); return; }
    const d = r.data;
    m.el.querySelector('.modal-head h3').textContent = d.siswa + ' — ' + d.judul;
    m.el.querySelector('.modal-body').innerHTML = '<div class="row wrap" style="margin-bottom:14px"><span class="pill ' + (d.skor >= d.kkm ? 'pill-green' : 'pill-amber') + '" style="font-size:15px">Nilai ' + d.skor + ' / KKM ' + d.kkm + '</span><span class="pill">' + d.benar + ' benar</span><span class="pill">' + d.salah + ' salah</span><span class="pill">' + d.kosong + ' kosong</span><span class="small muted">' + esc(fmt.tgl(d.waktu)) + ' ' + esc(fmt.jam(d.waktu)) + ' • ' + esc(fmt.durasi(d.durasi)) + '</span></div>' +
      d.soal.map((s, i) => '<div class="qb"><div class="row" style="align-items:flex-start"><span class="no">' + (i + 1) + '</span><div class="grow"><p>' + esc(s.pertanyaan) + '</p><p class="small" style="margin-top:6px">Jawaban siswa: <b>' + (s.jawaban || '–') + '</b> • Kunci: <b>' + s.kunci + '</b> ' +
        (s.jawaban === s.kunci ? '<span class="pill pill-green">Benar</span>' : '<span class="pill pill-red">' + (s.jawaban ? 'Salah' : 'Kosong') + '</span>') + '</p></div></div></div>').join('');
  }

  // ================================================================
  // SISWA & KELAS
  // ================================================================
  let cariSiswa = '', fKelasSiswa = '', fStatusSiswa = 'Aktif', halSiswa = 1, hal_siswa_tab = 'siswa';
  function siswa(tab) {
    if (tab === 'kelas') hal_siswa_tab = 'kelas';
    main.innerHTML = '<div class="tabs" role="tablist"><button data-tab="siswa" class="' + (hal_siswa_tab === 'siswa' ? 'on' : '') + '">' + ic('users', 18) + ' Daftar Siswa</button><button data-tab="kelas" class="' + (hal_siswa_tab === 'kelas' ? 'on' : '') + '">' + ic('layers', 18) + ' Kelas & Mapel</button></div><div id="sIsi"></div>';
    main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { hal_siswa_tab = b.dataset.tab; siswa(); }));
    if (hal_siswa_tab === 'kelas') return kelasMapel(main.querySelector('#sIsi'));
    const box = main.querySelector('#sIsi');
    box.innerHTML = UI.skeleton([52, 400]);
    API.muat('siswa.list', {}, (d, c, err) => {
      if (halaman !== 'siswa' || hal_siswa_tab !== 'siswa') return;
      if (err) { box.innerHTML = UI.gagalMuat(err.message); box.querySelector('#btnUlang').onclick = () => siswa(); return; }
      renderSiswa(box, d.siswa);
    }, { umur: 30000 });
  }
  function renderSiswa(box, list) {
    box.innerHTML = butuhMaster('Buat minimal satu kelas sebelum menambah siswa.') +
      '<div class="filters"><label class="search">' + ic('search', 20, 'muted') + '<span class="sr-only">Cari siswa</span><input type="search" id="fsCari" placeholder="Cari nama, ID, atau nomor HP…" value="' + esc(cariSiswa) + '"></label>' +
      sel('fsKelas', '<option value="">Semua kelas</option>' + opsiKelas(fKelasSiswa), 'aria-label="Filter kelas"') +
      sel('fsStatus', ['Aktif', 'Nonaktif', ''].map((s) => '<option value="' + s + '"' + (s === fStatusSiswa ? ' selected' : '') + '>' + (s || 'Semua status') + '</option>').join(''), 'aria-label="Filter status"') +
      '<button class="btn btn-outline" id="fsCsv">' + ic('download', 18) + ' CSV</button><button class="btn btn-primary" id="fsTambah"' + (M.kelas.length ? '' : ' disabled') + '>' + ic('plus', 18) + ' Tambah Siswa</button></div>' +
      '<div id="fsTabel"></div>';
    const gambar = () => {
      const q = cariSiswa.toLowerCase();
      const isi = list.filter((s) => (!fKelasSiswa || s.kelasId === fKelasSiswa) && (!fStatusSiswa || s.status === fStatusSiswa) && (!q || (s.nama + ' ' + s.id + ' ' + s.noHp).toLowerCase().indexOf(q) > -1));
      const per = 15; halSiswa = Math.min(halSiswa, Math.max(1, Math.ceil(isi.length / per)));
      const potong = isi.slice((halSiswa - 1) * per, halSiswa * per);
      box.querySelector('#fsTabel').innerHTML = isi.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Siswa</th><th>Kelas</th><th>No. HP</th><th class="num">Kehadiran</th><th class="num">Rata Nilai</th><th>Status</th><th><span class="sr-only">Aksi</span></th></tr></thead><tbody>' +
        potong.map((s) => '<tr><td><div class="who"><span class="av">' + esc(fmt.inisial(s.nama)) + '</span><div><b>' + esc(s.nama) + '</b><span>' + esc(s.id) + (s.tagihanBelum ? ' • <span style="color:var(--warning)">' + s.tagihanBelum + ' tagihan</span>' : '') + '</span></div></div></td>' +
          '<td>' + esc(s.kelas) + '</td><td>' + esc(s.noHp || '–') + '</td><td class="num">' + (s.hadirPersen === null ? '–' : fmt.angka(s.hadirPersen) + '%') + '</td><td class="num">' + (s.rataNilai === null ? '–' : '<b class="num">' + fmt.angka(s.rataNilai) + '</b>') + '</td>' +
          '<td><span class="pill ' + (s.status === 'Aktif' ? 'pill-green' : '') + '">' + esc(s.status) + '</span></td>' +
          '<td><div class="acts"><button class="btn btn-ghost btn-icon btn-sm" data-ed="' + esc(s.id) + '" aria-label="Ubah ' + esc(s.nama) + '" title="Ubah">' + ic('pencil', 18) + '</button>' +
          '<button class="btn btn-ghost btn-icon btn-sm" data-rs="' + esc(s.id) + '" aria-label="Reset kata sandi ' + esc(s.nama) + '" title="Reset kata sandi">' + ic('key', 18) + '</button>' +
          '<button class="btn btn-ghost btn-icon btn-sm" data-hp="' + esc(s.id) + '" aria-label="Hapus ' + esc(s.nama) + '" title="Hapus" style="color:var(--danger)">' + ic('trash', 18) + '</button></div></td></tr>').join('') +
        '</tbody></table></div>' + pager(isi.length, halSiswa, per, (p) => { halSiswa = p; gambar(); })
        : '<div class="card">' + UI.kosong('users', list.length ? 'Tidak ada siswa yang cocok' : 'Belum ada siswa', list.length ? 'Ubah kata kunci atau filter.' : 'Tambahkan siswa satu per satu, atau impor dari spreadsheet lama di Pengaturan → Import Data.') + '</div>';
      box.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => formSiswa(list.find((s) => s.id === b.dataset.ed))));
      box.querySelectorAll('[data-rs]').forEach((b) => b.addEventListener('click', async () => {
        const s = list.find((x) => x.id === b.dataset.rs);
        if (!await UI.konfirmasi('Reset kata sandi ' + s.nama + '?', 'Kata sandi lama tidak berlaku lagi dan siswa akan keluar dari semua perangkat.', { ok: 'Buat sandi baru' })) return;
        const r = await API.tulis('siswa.resetSandi', { id: s.id });
        if (!r.success) return toast(r.message, 'error');
        UI.tampilKredensial('Kata sandi baru — ' + s.nama, [{ label: 'ID Siswa', nilai: s.id }, { label: 'Kata sandi baru', nilai: r.data.sandiBaru }], 'Berikan ke siswa. Kata sandi ini hanya ditampilkan sekali; siswa akan diminta menggantinya setelah masuk.');
      }));
      box.querySelectorAll('[data-hp]').forEach((b) => b.addEventListener('click', async () => {
        const s = list.find((x) => x.id === b.dataset.hp);
        if (!await UI.konfirmasi('Hapus ' + s.nama + '?', 'Data siswa dan akun loginnya dihapus. Riwayat nilai & kehadiran tetap tersimpan di Google Sheets. Untuk siswa yang berhenti, lebih aman ubah status menjadi Nonaktif.', { ok: 'Hapus', bahaya: true })) return;
        const r = await API.tulis('siswa.hapus', { id: s.id });
        if (!r.success) return toast(r.message, 'error');
        toast(r.message, 'success'); list.splice(list.indexOf(s), 1); M = null; gambar();
      }));
    };
    box.querySelector('#fsCari').addEventListener('input', (e) => { cariSiswa = e.target.value; halSiswa = 1; gambar(); });
    box.querySelector('#fsKelas').addEventListener('change', (e) => { fKelasSiswa = e.target.value; halSiswa = 1; gambar(); });
    box.querySelector('#fsStatus').addEventListener('change', (e) => { fStatusSiswa = e.target.value; halSiswa = 1; gambar(); });
    box.querySelector('#fsTambah').addEventListener('click', () => formSiswa(null));
    box.querySelector('#fsCsv').addEventListener('click', () => UI.unduhCsv('daftar-siswa.csv', ['ID_Siswa', 'Nama', 'Kelas', 'No_HP', 'Email', 'Tgl_Lahir', 'Alamat', 'Nama_Wali', 'HP_Wali', 'Status', 'Kehadiran_%', 'Rata_Nilai'],
      list.map((s) => [s.id, s.nama, s.kelas, s.noHp, s.email, s.tglLahir, s.alamat, s.namaWali, s.hpWali, s.status, s.hadirPersen, s.rataNilai])));
    gambar();
  }
  function formSiswa(s) {
    const baru = !s; s = s || { status: 'Aktif', kelasId: fKelasSiswa || (M.kelas[0] || {}).id };
    const d = UI.buka(UI.headHtml(baru ? 'Tambah Siswa' : 'Ubah Data Siswa', baru ? 'ID & kata sandi awal dibuat otomatis.' : s.id) +
      '<form class="modal-body stack" id="fSiswa" novalidate>' +
        fld('sNama', 'Nama lengkap *', inp('sNama', s.nama, 'required autocomplete="off"')) +
        '<div class="grid-2 sm-1">' + fld('sKelas', 'Kelas *', sel('sKelas', opsiKelas(s.kelasId))) + fld('sStatus', 'Status', sel('sStatus', ['Aktif', 'Nonaktif'].map((x) => '<option' + (x === s.status ? ' selected' : '') + '>' + x + '</option>').join(''))) + '</div>' +
        '<div class="grid-2 sm-1">' + fld('sHp', 'No. HP / WhatsApp', inp('sHp', s.noHp, 'type="tel" inputmode="tel" placeholder="08xxxxxxxxxx"')) + fld('sEmail', 'Email', inp('sEmail', s.email, 'type="email"')) + '</div>' +
        '<div class="grid-2 sm-1">' + fld('sLahir', 'Tanggal lahir', inp('sLahir', s.tglLahir, 'type="date"')) + fld('sHub', 'Hubungan wali', sel('sHub', ['', 'Ayah', 'Ibu', 'Wali Lainnya'].map((x) => '<option value="' + x + '"' + (x === s.hubunganWali ? ' selected' : '') + '>' + (x || '—') + '</option>').join(''))) + '</div>' +
        fld('sAlamat', 'Alamat', '<textarea class="textarea" id="sAlamat" rows="2">' + esc(s.alamat || '') + '</textarea>') +
        '<div class="grid-2 sm-1">' + fld('sWali', 'Nama orang tua / wali', inp('sWali', s.namaWali)) + fld('sHpWali', 'HP orang tua / wali', inp('sHpWali', s.hpWali, 'type="tel" inputmode="tel"')) + '</div>' +
        fld('sCatatan', 'Catatan untuk siswa', '<textarea class="textarea" id="sCatatan" rows="3" placeholder="Contoh: Pertahankan pemahaman trigonometri, tingkatkan latihan fisika.">' + esc(s.catatan || '') + '</textarea>', 'Tampil sebagai “Catatan Ustadzah” di halaman nilai siswa.') +
      '</form><div class="modal-foot"><button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="sSimpan">' + ic('save', 18) + ' Simpan</button></div>', { kind: 'drawer', label: 'Form siswa' });
    d.el.querySelector('#sSimpan').addEventListener('click', async (e) => {
      const v = (id) => d.el.querySelector('#' + id).value.trim();
      if (!v('sNama')) { d.el.querySelector('#sNama').classList.add('invalid'); d.el.querySelector('#sNama').focus(); return toast('Nama siswa wajib diisi.', 'error'); }
      tombolSibuk(btnOf(e), true);
      const r = await API.tulis('siswa.simpan', { siswa: { id: baru ? '' : s.id, nama: v('sNama'), kelasId: v('sKelas'), status: v('sStatus'), noHp: v('sHp'), email: v('sEmail'), tglLahir: v('sLahir'), hubunganWali: v('sHub'), alamat: v('sAlamat'), namaWali: v('sWali'), hpWali: v('sHpWali'), catatan: v('sCatatan') } });
      tombolSibuk(btnOf(e), false);
      if (!r.success) return toast(r.message, 'error');
      d.tutup(); toast(r.message, 'success'); M = null;
      if (r.data.sandiAwal) UI.tampilKredensial('Akun siswa dibuat', [{ label: 'ID Siswa (untuk masuk)', nilai: r.data.id }, { label: 'Kata sandi awal', nilai: r.data.sandiAwal }], 'Berikan ke siswa. Kata sandi ini hanya ditampilkan sekali; siswa akan diminta menggantinya setelah masuk pertama kali.');
      Guru.route(['siswa']);
    });
  }
  function kelasMapel(box) {
    const daftar = (judul, ikon, list, jenis) => '<section class="card panel"><div class="panel-h"><h2>' + ic(ikon, 20) + ' ' + judul + '</h2><button class="btn btn-primary btn-sm" data-add="' + jenis + '">' + ic('plus', 16) + ' Tambah</button></div>' +
      (list.length ? '<div class="tbl-wrap"><table class="tbl"><tbody>' + list.map((x) => '<tr><td><b>' + esc(x.nama) + '</b><br><span class="small muted">' + esc(jenis === 'kelas' ? [x.jenjang, x.jumlah + ' siswa aktif'].filter(Boolean).join(' • ') : (x.label || 'Tanpa label')) + '</span></td>' +
        '<td><div class="acts"><button class="btn btn-ghost btn-icon btn-sm" data-e="' + jenis + '|' + esc(x.id) + '" aria-label="Ubah ' + esc(x.nama) + '">' + ic('pencil', 18) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-h="' + jenis + '|' + esc(x.id) + '" aria-label="Hapus ' + esc(x.nama) + '" style="color:var(--danger)">' + ic('trash', 18) + '</button></div></td></tr>').join('') + '</tbody></table></div>'
        : UI.kosong(ikon, 'Belum ada ' + judul.toLowerCase(), jenis === 'kelas' ? 'Contoh: 12 SMA Intensif, 9 SMP Reguler.' : 'Contoh: Matematika, Bahasa Inggris, Fisika.')) + '</section>';
    box.innerHTML = '<div class="g-2">' + daftar('Kelas', 'layers', M.kelas, 'kelas') + daftar('Mata Pelajaran', 'book', M.mapel, 'mapel') + '</div>';
    const form = (jenis, x) => {
      x = x || {};
      const d = UI.buka(UI.headHtml((x.id ? 'Ubah ' : 'Tambah ') + (jenis === 'kelas' ? 'Kelas' : 'Mata Pelajaran')) + '<form class="modal-body stack" id="fKM">' +
        fld('kmNama', jenis === 'kelas' ? 'Nama kelas *' : 'Nama mata pelajaran *', inp('kmNama', x.nama, 'required placeholder="' + (jenis === 'kelas' ? '12 SMA Intensif' : 'Matematika') + '"')) +
        (jenis === 'kelas' ? fld('kmJenjang', 'Jenjang', inp('kmJenjang', x.jenjang, 'placeholder="SD / SMP / SMA"')) + fld('kmKet', 'Keterangan', inp('kmKet', x.keterangan))
          : fld('kmLabel', 'Label program', inp('kmLabel', x.label, 'placeholder="SMA - K13 / Intensif UTBK / Saintek"'), 'Tampil kecil di kartu “Kategori Kelas” siswa.')) +
        '<button class="btn btn-primary btn-block" type="submit">' + ic('save', 18) + ' Simpan</button></form>');
      d.el.querySelector('#fKM').addEventListener('submit', async (e) => {
        e.preventDefault();
        const v = (id) => { const el = d.el.querySelector('#' + id); return el ? el.value.trim() : ''; };
        tombolSibuk(e.submitter, true);
        const r = jenis === 'kelas' ? await API.tulis('kelas.simpan', { kelas: { id: x.id, nama: v('kmNama'), jenjang: v('kmJenjang'), keterangan: v('kmKet') } })
          : await API.tulis('mapel.simpan', { mapel: { id: x.id, nama: v('kmNama'), label: v('kmLabel') } });
        tombolSibuk(e.submitter, false);
        if (!r.success) return toast(r.message, 'error');
        d.tutup(); toast(r.message, 'success'); M = null; hal_siswa_tab = 'kelas'; Guru.route(['siswa', 'kelas']);
      });
    };
    box.querySelectorAll('[data-add]').forEach((b) => b.addEventListener('click', () => form(b.dataset.add)));
    box.querySelectorAll('[data-e]').forEach((b) => b.addEventListener('click', () => { const [j, id] = b.dataset.e.split('|'); form(j, (j === 'kelas' ? M.kelas : M.mapel).find((x) => x.id === id)); }));
    box.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', async () => {
      const [j, id] = b.dataset.h.split('|'), x = (j === 'kelas' ? M.kelas : M.mapel).find((y) => y.id === id);
      if (!await UI.konfirmasi('Hapus ' + x.nama + '?', 'Hanya bisa dihapus bila tidak dipakai siswa, materi, atau latihan.', { ok: 'Hapus', bahaya: true })) return;
      const r = await API.tulis(j === 'kelas' ? 'kelas.hapus' : 'mapel.hapus', { id });
      if (!r.success) return toast(r.message, 'error');
      toast(r.message, 'success'); M = null; Guru.route(['siswa', 'kelas']);
    }));
  }

  // ================================================================
  // PRESENSI
  // ================================================================
  let pTgl = '', pKelas = '', pJadwal;
  function presensi(kelasArg, jadwalArg) {
    if (kelasArg) { pKelas = kelasArg; pJadwal = jadwalArg; pTgl = fmt.hariIni(); }
    if (!pTgl) pTgl = fmt.hariIni();
    if (!pKelas || (pKelas !== 'SEMUA' && !M.kelas.find((k) => k.id === pKelas))) pKelas = (M.kelas[0] || {}).id || '';
    if (!M.kelas.length) { main.innerHTML = butuhMaster('Buat kelas terlebih dahulu sebelum mencatat presensi.'); return; }
    main.innerHTML = '<div class="filters">' + fld('pTgl', 'Tanggal', inp('pTgl', pTgl, 'type="date"')) + fld('pKelas', 'Kelas', sel('pKelas', opsiKelas(pKelas))) + '<div class="field" id="pJadwalWrap"></div></div><div id="pIsi">' + UI.skeleton([60, 360]) + '</div>';
    main.querySelector('#pTgl').addEventListener('change', (e) => { pTgl = e.target.value || fmt.hariIni(); pJadwal = undefined; presensi(); });
    main.querySelector('#pKelas').addEventListener('change', (e) => { pKelas = e.target.value; pJadwal = undefined; presensi(); });
    const data = { tanggal: pTgl, kelasId: pKelas }; if (pJadwal !== undefined) data.jadwalId = pJadwal;
    API.api('hadir.ambil', data).then((r) => {
      if (halaman !== 'presensi') return;
      const box = main.querySelector('#pIsi');
      if (!r.success) { box.innerHTML = UI.gagalMuat(r.message); box.querySelector('#btnUlang').onclick = () => presensi(); return; }
      renderPresensi(box, r.data);
    });
  }
  function renderPresensi(box, d) {
    pJadwal = d.jadwalId;
    const wrap = main.querySelector('#pJadwalWrap');
    wrap.innerHTML = d.jadwal.length ? '<label for="pJadwal">Sesi</label>' + sel('pJadwal', d.jadwal.map((j) => '<option value="' + esc(j.id) + '"' + (j.id === d.jadwalId ? ' selected' : '') + '>' + esc(j.mulai + ' ' + j.mapel + (j.ruang ? ' • ' + j.ruang : '')) + '</option>').join('') + '<option value=""' + (!d.jadwalId ? ' selected' : '') + '>Tanpa jadwal</option>') : '';
    if (d.jadwal.length) wrap.querySelector('#pJadwal').addEventListener('change', (e) => { pJadwal = e.target.value; presensi(); });
    const st = {}; d.siswa.forEach((s) => { st[s.id] = { status: s.status, ket: s.keterangan, awal: s.status + '|' + s.keterangan }; });
    if (!d.siswa.length) { box.innerHTML = '<div class="card">' + UI.kosong('users', 'Belum ada siswa aktif di kelas ini', 'Tambahkan siswa di menu Siswa & Kelas.') + '</div>'; return; }
    box.innerHTML = '<section class="card" style="padding:0;overflow:hidden">' +
      '<div class="panel-h" style="padding:16px 16px 0"><div><h2>' + ic('clipcheck', 20) + ' ' + esc(namaKelas(d.kelasId)) + '</h2><p>' + esc(fmt.tglPanjang(d.tanggal)) + (d.jadwal.length && d.jadwalId ? ' • ' + esc((d.jadwal.find((j) => j.id === d.jadwalId) || {}).mapel || '') : '') + '</p></div><div class="row wrap" id="pRingkas"></div></div>' +
      '<div id="pRows" style="margin-top:12px;border-top:1px solid var(--border-soft)"></div>' +
      '<div class="sticky-foot"><span class="small muted grow" id="pInfo"></span><button class="btn btn-outline" id="pSemua">' + ic('checkCircle', 18) + ' Tandai Semua Hadir</button><button class="btn btn-primary" id="pSimpan">' + ic('save', 18) + ' Simpan Daftar Hadir</button></div></section>';
    const rows = box.querySelector('#pRows');
    rows.innerHTML = d.siswa.map((s) => '<div class="att-row" data-sid="' + esc(s.id) + '"><div class="who grow" style="min-width:180px"><span class="av">' + esc(fmt.inisial(s.nama)) + '</span><div><b>' + esc(s.nama) + '</b><span>' + esc(s.id) + (s.tersimpan ? ' • tersimpan' : '') + '</span></div></div>' +
      '<div class="tri" role="radiogroup" aria-label="Status ' + esc(s.nama) + '"><button type="button" class="h" data-s="Hadir" role="radio">' + ic('check', 16) + ' Hadir</button><button type="button" class="i" data-s="Izin" role="radio">' + ic('clock', 16) + ' Izin</button><button type="button" class="a" data-s="Alfa" role="radio">' + ic('x', 16) + ' Alfa</button></div>' +
      '<input class="input" style="max-width:220px;min-height:40px;font-size:14px" placeholder="Keterangan (opsional)" aria-label="Keterangan ' + esc(s.nama) + '" value="' + esc(s.keterangan) + '"></div>').join('');
    const gambar = () => {
      let h = 0, i = 0, a = 0, ubah = 0;
      rows.querySelectorAll('.att-row').forEach((row) => {
        const s = st[row.dataset.sid];
        row.querySelectorAll('[data-s]').forEach((b) => { const on = b.dataset.s === s.status; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
        if (s.status === 'Hadir') h++; else if (s.status === 'Izin') i++; else if (s.status === 'Alfa') a++;
        if (s.status && (s.status + '|' + s.ket) !== s.awal) ubah++;
      });
      box.querySelector('#pRingkas').innerHTML = '<span class="pill pill-green">' + ic('checkCircle', 14) + ' Hadir ' + h + '</span><span class="pill pill-amber">' + ic('clock', 14) + ' Izin ' + i + '</span><span class="pill pill-red">' + ic('xCircle', 14) + ' Alfa ' + a + '</span><span class="pill">' + (d.siswa.length - h - i - a) + ' belum</span>';
      box.querySelector('#pInfo').textContent = ubah ? ubah + ' perubahan belum disimpan' : 'Semua perubahan tersimpan';
      box.querySelector('#pSimpan').disabled = !ubah;
    };
    rows.querySelectorAll('.att-row').forEach((row) => {
      const s = st[row.dataset.sid];
      row.querySelectorAll('[data-s]').forEach((b) => b.addEventListener('click', () => { s.status = b.dataset.s; gambar(); }));
      row.querySelector('input').addEventListener('input', (e) => { s.ket = e.target.value; gambar(); });
    });
    box.querySelector('#pSemua').addEventListener('click', () => { Object.keys(st).forEach((k) => { if (!st[k].status) st[k].status = 'Hadir'; }); gambar(); });
    box.querySelector('#pSimpan').addEventListener('click', async (e) => {
      const entri = Object.keys(st).filter((k) => st[k].status && (st[k].status + '|' + st[k].ket) !== st[k].awal).map((k) => ({ siswaId: k, status: st[k].status, keterangan: st[k].ket }));
      tombolSibuk(btnOf(e), true);
      const r = await API.tulis('hadir.simpan', { tanggal: d.tanggal, kelasId: d.kelasId, jadwalId: d.jadwalId || '', entri });
      tombolSibuk(btnOf(e), false);
      if (!r.success) return toast(r.message, 'error');
      entri.forEach((x) => { st[x.siswaId].awal = x.status + '|' + x.keterangan; });
      toast(r.message, 'success'); gambar();
    });
    gambar();
  }

  // ================================================================
  // JADWAL & TAGIHAN
  // ================================================================
  let tabJT = 'jadwal', jKelas = '', bStatus = '', bKelas = '', bCari = '';
  function jadwal(tab) {
    if (tab === 'tagihan') tabJT = 'tagihan';
    main.innerHTML = '<div class="tabs"><button data-tab="jadwal" class="' + (tabJT === 'jadwal' ? 'on' : '') + '">' + ic('calendar', 18) + ' Jadwal Les</button><button data-tab="tagihan" class="' + (tabJT === 'tagihan' ? 'on' : '') + '">' + ic('wallet', 18) + ' Tagihan & Pembayaran</button></div>' + butuhMaster() + '<div id="jtIsi">' + UI.skeleton([52, 380]) + '</div>';
    main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tabJT = b.dataset.tab; jadwal(); }));
    const box = main.querySelector('#jtIsi');
    if (tabJT === 'jadwal') {
      API.muat('jadwal.list', {}, (d, c, err) => {
        if (halaman !== 'jadwal' || tabJT !== 'jadwal') return;
        if (err) { box.innerHTML = UI.gagalMuat(err.message); box.querySelector('#btnUlang').onclick = () => jadwal(); return; }
        renderJadwal(box, d);
      }, { umur: 30000 });
    } else {
      Promise.all([API.apiQ('bayar.list', {}), API.apiQ('siswa.list', {})]).then(([b, s]) => {
        if (halaman !== 'jadwal' || tabJT !== 'tagihan') return;
        if (!b.success) { box.innerHTML = UI.gagalMuat(b.message); box.querySelector('#btnUlang').onclick = () => jadwal(); return; }
        renderTagihan(box, b.data, s.success ? s.data.siswa : []);
      });
    }
  }
  function renderJadwal(box, d) {
    const kini = fmt.hariIni();
    box.innerHTML = '<div class="filters">' + sel('jfKelas', '<option value="">Semua kelas</option>' + opsiKelas(jKelas), 'aria-label="Filter kelas"') + '<span class="small muted grow">Menampilkan ' + esc(fmt.tgl(d.dari)) + ' – ' + esc(fmt.tgl(d.sampai)) + '</span><button class="btn btn-primary" id="jTambah"' + (M.kelas.length && M.mapel.length ? '' : ' disabled') + '>' + ic('plus', 18) + ' Tambah Jadwal</button></div><div id="jTabel"></div>';
    const gambar = () => {
      const isi = d.jadwal.filter((j) => !jKelas || j.kelasId === jKelas || j.kelasId === 'SEMUA');
      box.querySelector('#jTabel').innerHTML = isi.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Tanggal</th><th>Jam</th><th>Kelas</th><th>Mapel</th><th>Ruang</th><th>Tutor</th><th></th></tr></thead><tbody>' +
        isi.map((j) => '<tr' + (j.tanggal < kini ? ' style="opacity:.6"' : '') + '><td><b>' + esc(fmt.tgl(j.tanggal, { hari: true })) + '</b>' + (j.tanggal === kini ? ' <span class="pill pill-solid-blue">Hari ini</span>' : '') + '</td><td class="num">' + esc(j.mulai) + (j.selesai ? '–' + esc(j.selesai) : '') + '</td><td>' + esc(j.kelas) + '</td><td>' + esc(j.mapel) + '</td><td>' + esc(j.ruang || '–') + '</td><td>' + esc(j.tutor || '–') + '</td>' +
          '<td><div class="acts"><a class="btn btn-ghost btn-icon btn-sm" href="#/guru/presensi/' + encodeURIComponent(j.kelasId) + '/' + encodeURIComponent(j.id) + '" title="Presensi" aria-label="Presensi sesi ini" data-ptgl="' + esc(j.tanggal) + '">' + ic('clipcheck', 18) + '</a><button class="btn btn-ghost btn-icon btn-sm" data-ed="' + esc(j.id) + '" aria-label="Ubah jadwal">' + ic('pencil', 18) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-hp="' + esc(j.id) + '" aria-label="Hapus jadwal" style="color:var(--danger)">' + ic('trash', 18) + '</button></div></td></tr>').join('') + '</tbody></table></div>'
        : '<div class="card">' + UI.kosong('calendar', 'Belum ada jadwal', 'Tambahkan jadwal les; bisa diulang mingguan sekaligus.') + '</div>';
      box.querySelectorAll('[data-ptgl]').forEach((a) => a.addEventListener('click', () => { pTgl = a.dataset.ptgl; }));
      box.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => formJadwal(d.jadwal.find((j) => j.id === b.dataset.ed))));
      box.querySelectorAll('[data-hp]').forEach((b) => b.addEventListener('click', async () => {
        if (!await UI.konfirmasi('Hapus jadwal ini?', 'Catatan kehadiran yang sudah ada tetap tersimpan.', { ok: 'Hapus', bahaya: true })) return;
        const r = await API.tulis('jadwal.hapus', { id: b.dataset.hp }); if (!r.success) return toast(r.message, 'error');
        toast(r.message, 'success'); d.jadwal = d.jadwal.filter((j) => j.id !== b.dataset.hp); gambar();
      }));
    };
    box.querySelector('#jfKelas').addEventListener('change', (e) => { jKelas = e.target.value; gambar(); });
    box.querySelector('#jTambah').addEventListener('click', () => formJadwal(null));
    gambar();
  }
  function formJadwal(j) {
    const baru = !j; j = j || { tanggal: fmt.hariIni(), mulai: '16:00', selesai: '17:30', kelasId: jKelas || (M.kelas[0] || {}).id, mapelId: (M.mapel[0] || {}).id, tutor: (API.Sesi.me() || {}).nama };
    const d = UI.buka(UI.headHtml(baru ? 'Tambah Jadwal Les' : 'Ubah Jadwal') + '<form class="modal-body stack" id="fJ" novalidate>' +
      '<div class="grid-3 sm-1">' + fld('jTgl', 'Tanggal *', inp('jTgl', j.tanggal, 'type="date" required')) + fld('jMulai', 'Jam mulai *', inp('jMulai', j.mulai, 'type="time" required')) + fld('jSelesai', 'Jam selesai', inp('jSelesai', j.selesai, 'type="time"')) + '</div>' +
      '<div class="grid-2 sm-1">' + fld('jKls', 'Kelas *', sel('jKls', opsiKelas(j.kelasId, true))) + fld('jMp', 'Mata pelajaran *', sel('jMp', opsiMapel(j.mapelId))) + '</div>' +
      '<div class="grid-2 sm-1">' + fld('jRuang', 'Ruang', inp('jRuang', j.ruang, 'placeholder="Ruang A"')) + fld('jTutor', 'Tutor', inp('jTutor', j.tutor)) + '</div>' +
      fld('jCat', 'Catatan untuk siswa', inp('jCat', j.catatan, 'placeholder="Contoh: Bawa modul Bab 4"'), 'Tampil di notifikasi siswa.') +
      (baru ? fld('jUlang', 'Ulangi mingguan', sel('jUlang', [1, 2, 4, 8, 12, 16].map((n) => '<option value="' + n + '">' + (n === 1 ? 'Tidak diulang' : n + ' minggu') + '</option>').join('')), 'Membuat jadwal yang sama setiap minggu, mulai tanggal di atas.') : '') +
      '</form><div class="modal-foot"><button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="jSimpan">' + ic('save', 18) + ' Simpan</button></div>', { kind: 'drawer' });
    d.el.querySelector('#jSimpan').addEventListener('click', async (e) => {
      const v = (id) => { const el = d.el.querySelector('#' + id); return el ? el.value.trim() : ''; };
      tombolSibuk(btnOf(e), true);
      const r = await API.tulis('jadwal.simpan', { jadwal: { id: baru ? '' : j.id, tanggal: v('jTgl'), mulai: v('jMulai'), selesai: v('jSelesai'), kelasId: v('jKls'), mapelId: v('jMp'), ruang: v('jRuang'), tutor: v('jTutor'), catatan: v('jCat') }, ulangMingguan: +v('jUlang') || 1 });
      tombolSibuk(btnOf(e), false);
      if (!r.success) return toast(r.message, 'error');
      d.tutup(); toast(r.message, 'success'); tabJT = 'jadwal'; Guru.route(['jadwal']);
    });
  }
  function renderTagihan(box, d, siswaList) {
    const kini = d.hariIni;
    box.innerHTML = '<div class="filters"><label class="search">' + ic('search', 20, 'muted') + '<input type="search" id="bCari" placeholder="Cari nama siswa atau periode…" value="' + esc(bCari) + '" aria-label="Cari tagihan"></label>' +
      sel('bKelas', '<option value="">Semua kelas</option>' + opsiKelas(bKelas), 'aria-label="Filter kelas"') +
      sel('bStatus', [['', 'Semua status'], ['Belum Bayar', 'Belum bayar'], ['Lewat', 'Lewat jatuh tempo'], ['Lunas', 'Lunas']].map((s) => '<option value="' + s[0] + '"' + (s[0] === bStatus ? ' selected' : '') + '>' + s[1] + '</option>').join(''), 'aria-label="Filter status"') +
      '<button class="btn btn-outline" id="bMassal">' + ic('users', 18) + ' Tagihan Massal</button><button class="btn btn-primary" id="bTambah">' + ic('plus', 18) + ' Tambah Tagihan</button></div><div id="bRingkas" class="row wrap" style="margin-bottom:12px"></div><div id="bTabel"></div>';
    const gambar = () => {
      const q = bCari.toLowerCase();
      const isi = d.tagihan.filter((t) => (!bKelas || t.kelasId === bKelas) && (!q || (t.nama + ' ' + t.periode).toLowerCase().indexOf(q) > -1) &&
        (!bStatus || (bStatus === 'Lewat' ? t.lewat : t.status === bStatus)));
      const belum = isi.filter((t) => t.status !== 'Lunas');
      box.querySelector('#bRingkas').innerHTML = '<span class="pill pill-amber">' + belum.length + ' belum bayar • ' + fmt.rp(belum.reduce((a, t) => a + t.jumlah, 0)) + '</span><span class="pill pill-red">' + isi.filter((t) => t.lewat).length + ' lewat jatuh tempo</span><span class="pill pill-green">' + isi.filter((t) => t.status === 'Lunas').length + ' lunas</span>';
      box.querySelector('#bTabel').innerHTML = isi.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Siswa</th><th>Periode</th><th class="num">Jumlah</th><th>Jatuh tempo</th><th>Status</th><th></th></tr></thead><tbody>' +
        isi.map((t) => '<tr><td><div class="who"><span class="av">' + esc(fmt.inisial(t.nama)) + '</span><div><b>' + esc(t.nama) + '</b><span>' + esc(t.kelas) + '</span></div></div></td><td>' + esc(t.periode) + '</td><td class="num"><b class="num">' + fmt.rp(t.jumlah) + '</b></td>' +
          '<td>' + (t.jatuhTempo ? esc(fmt.tgl(t.jatuhTempo)) : '–') + '</td><td><span class="pill ' + (t.status === 'Lunas' ? 'pill-green' : t.lewat ? 'pill-red' : 'pill-amber') + '">' + (t.status === 'Lunas' ? 'Lunas' + (t.tglBayar ? ' • ' + esc(fmt.tgl(t.tglBayar, { tahun: false })) : '') : t.lewat ? 'Lewat tempo' : 'Belum bayar') + '</span></td>' +
          '<td><div class="acts">' + (t.status !== 'Lunas' ? '<button class="btn btn-outline btn-sm" data-lunas="' + esc(t.id) + '">' + ic('check', 16) + ' Lunas</button>' : '') +
          '<button class="btn btn-ghost btn-icon btn-sm" data-ed="' + esc(t.id) + '" aria-label="Ubah tagihan">' + ic('pencil', 18) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-hp="' + esc(t.id) + '" aria-label="Hapus tagihan" style="color:var(--danger)">' + ic('trash', 18) + '</button></div></td></tr>').join('') + '</tbody></table></div>'
        : '<div class="card">' + UI.kosong('wallet', 'Belum ada tagihan', 'Buat tagihan per siswa atau sekaligus untuk satu kelas.') + '</div>';
      box.querySelectorAll('[data-lunas]').forEach((b) => b.addEventListener('click', async () => {
        const t = d.tagihan.find((x) => x.id === b.dataset.lunas), lama = Object.assign({}, t);
        t.status = 'Lunas'; t.tglBayar = kini; t.lewat = false; gambar();                       // UI optimistis
        const r = await API.tulis('bayar.simpan', { tagihan: { id: t.id, siswaId: t.siswaId, periode: t.periode, jumlah: t.jumlah, jatuhTempo: t.jatuhTempo, status: 'Lunas', tglBayar: kini, catatan: t.catatan } });
        if (!r.success) { Object.assign(t, lama); gambar(); return toast(r.message, 'error'); }
        toast('Tagihan ' + t.nama + ' ditandai lunas.', 'success');
      }));
      box.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => formTagihan(d.tagihan.find((x) => x.id === b.dataset.ed), siswaList)));
      box.querySelectorAll('[data-hp]').forEach((b) => b.addEventListener('click', async () => {
        if (!await UI.konfirmasi('Hapus tagihan ini?', 'Tindakan ini tidak bisa dibatalkan.', { ok: 'Hapus', bahaya: true })) return;
        const r = await API.tulis('bayar.hapus', { id: b.dataset.hp }); if (!r.success) return toast(r.message, 'error');
        d.tagihan = d.tagihan.filter((x) => x.id !== b.dataset.hp); toast(r.message, 'success'); gambar();
      }));
    };
    box.querySelector('#bCari').addEventListener('input', (e) => { bCari = e.target.value; gambar(); });
    box.querySelector('#bKelas').addEventListener('change', (e) => { bKelas = e.target.value; gambar(); });
    box.querySelector('#bStatus').addEventListener('change', (e) => { bStatus = e.target.value; gambar(); });
    box.querySelector('#bTambah').addEventListener('click', () => formTagihan(null, siswaList));
    box.querySelector('#bMassal').addEventListener('click', formMassal);
    gambar();
  }
  const periodeIni = () => { const d = new Date(); return ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'][d.getMonth()] + ' ' + d.getFullYear(); };
  function formTagihan(t, siswaList) {
    const baru = !t; t = t || { periode: periodeIni(), status: 'Belum Bayar', jumlah: '' };
    const aktif = siswaList.filter((s) => s.status === 'Aktif' || s.id === t.siswaId);
    const d = UI.buka(UI.headHtml(baru ? 'Tambah Tagihan' : 'Ubah Tagihan') + '<form class="modal-body stack" novalidate>' +
      fld('tSiswa', 'Siswa *', sel('tSiswa', '<option value="">— Pilih siswa —</option>' + aktif.map((s) => '<option value="' + esc(s.id) + '"' + (s.id === t.siswaId ? ' selected' : '') + '>' + esc(s.nama + ' (' + s.kelas + ')') + '</option>').join(''))) +
      '<div class="grid-2 sm-1">' + fld('tPer', 'Periode *', inp('tPer', t.periode, 'placeholder="November 2026"')) + fld('tJml', 'Jumlah (Rp) *', inp('tJml', t.jumlah, 'type="number" min="0" step="1000" inputmode="numeric" placeholder="450000"')) + '</div>' +
      '<div class="grid-2 sm-1">' + fld('tTempo', 'Jatuh tempo', inp('tTempo', t.jatuhTempo, 'type="date"')) + fld('tStatus', 'Status', sel('tStatus', ['Belum Bayar', 'Lunas'].map((x) => '<option' + (x === t.status ? ' selected' : '') + '>' + x + '</option>').join(''))) + '</div>' +
      fld('tBayar', 'Tanggal bayar', inp('tBayar', t.tglBayar, 'type="date"'), 'Diisi otomatis hari ini bila status Lunas dan kolom ini kosong.') +
      fld('tCat', 'Catatan untuk siswa', inp('tCat', t.catatan, 'placeholder="Transfer ke rekening bimbel / bayar tunai di tempat"')) +
      '</form><div class="modal-foot"><button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="tSimpan">' + ic('save', 18) + ' Simpan</button></div>', { kind: 'drawer' });
    d.el.querySelector('#tSimpan').addEventListener('click', async (e) => {
      const v = (id) => d.el.querySelector('#' + id).value.trim();
      tombolSibuk(btnOf(e), true);
      const r = await API.tulis('bayar.simpan', { tagihan: { id: baru ? '' : t.id, siswaId: v('tSiswa'), periode: v('tPer'), jumlah: v('tJml'), jatuhTempo: v('tTempo'), status: v('tStatus'), tglBayar: v('tBayar'), catatan: v('tCat') } });
      tombolSibuk(btnOf(e), false);
      if (!r.success) return toast(r.message, 'error');
      d.tutup(); toast(r.message, 'success'); tabJT = 'tagihan'; Guru.route(['jadwal', 'tagihan']);
    });
  }
  function formMassal() {
    const d = UI.buka(UI.headHtml('Tagihan Massal', 'Membuat tagihan yang sama untuk semua siswa aktif di kelas terpilih.') + '<form class="modal-body stack" novalidate>' +
      fld('mKls', 'Kelas', sel('mKls', opsiKelas('SEMUA', true))) +
      '<div class="grid-2 sm-1">' + fld('mPer', 'Periode *', inp('mPer', periodeIni())) + fld('mJml', 'Jumlah (Rp) *', inp('mJml', '', 'type="number" min="0" step="1000" inputmode="numeric" placeholder="450000"')) + '</div>' +
      fld('mTempo', 'Jatuh tempo', inp('mTempo', fmt.geser(fmt.hariIni(), 10), 'type="date"')) + fld('mCat', 'Catatan', inp('mCat', '')) +
      '<div class="info-box">' + ic('info', 18) + '<span>Siswa yang sudah punya tagihan untuk periode yang sama akan dilewati, jadi aman bila tombol ditekan dua kali.</span></div>' +
      '</form><div class="modal-foot"><button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="mSimpan">' + ic('send', 18) + ' Buat Tagihan</button></div>', { kind: 'drawer' });
    d.el.querySelector('#mSimpan').addEventListener('click', async (e) => {
      const v = (id) => d.el.querySelector('#' + id).value.trim();
      tombolSibuk(btnOf(e), true, 'Membuat…');
      const r = await API.tulis('bayar.massal', { kelasId: v('mKls'), periode: v('mPer'), jumlah: v('mJml'), jatuhTempo: v('mTempo'), catatan: v('mCat') });
      tombolSibuk(btnOf(e), false);
      if (!r.success) return toast(r.message, 'error');
      d.tutup(); toast(r.message, 'success'); tabJT = 'tagihan'; Guru.route(['jadwal', 'tagihan']);
    });
  }

  // ================================================================
  // MATERI
  // ================================================================
  let mCari = '', mMapel = '';
  function materi() {
    main.innerHTML = butuhMaster() + '<div class="split"><section class="card panel" id="mForm"></section><section id="mDaftar">' + UI.skeleton([52, 90, 90, 90]) + '</section></div>';
    formUnggah(main.querySelector('#mForm'));
    API.muat('materi.list', {}, (d, c, err) => {
      if (halaman !== 'materi') return;
      const box = main.querySelector('#mDaftar');
      if (err) { box.innerHTML = UI.gagalMuat(err.message); box.querySelector('#btnUlang').onclick = materi; return; }
      renderDaftarMateri(box, d.materi);
    }, { umur: 30000 });
  }
  function formUnggah(box) {
    let berkas = null;
    box.innerHTML = '<div class="panel-h"><div><h2>' + ic('upload', 20) + ' Unggah Materi</h2><p>Tersimpan di Google Drive bimbel</p></div></div><form class="stack" id="fU" novalidate>' +
      fld('uJudul', 'Judul materi *', inp('uJudul', '', 'placeholder="Rumus Cepat Identitas Trigonometri"')) +
      '<div class="grid-2">' + fld('uMapel', 'Mata pelajaran *', sel('uMapel', opsiMapel(mMapel || ''))) + fld('uKelas', 'Untuk kelas *', sel('uKelas', opsiKelas('', true))) + '</div>' +
      '<div class="grid-2">' + fld('uBab', 'Bab', inp('uBab', '', 'placeholder="Bab 3"')) + fld('uTag', 'Label', sel('uTag', ['', 'Wajib', 'Rangkuman', 'Pengayaan', 'Intensif UTBK'].map((t) => '<option value="' + t + '">' + (t || '—') + '</option>').join(''))) + '</div>' +
      fld('uDesk', 'Deskripsi singkat', '<textarea class="textarea" id="uDesk" rows="2" placeholder="Ringkasan isi modul"></textarea>') +
      '<label class="drop" id="uDrop" tabindex="0">' + ic('upload', 32) + '<b id="uNama">Seret berkas ke sini atau klik untuk memilih</b><span id="uInfo">PDF, Word, PowerPoint, atau gambar • maks. 10 MB</span>' +
      '<input type="file" id="uFile" class="sr-only" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.jpg,.jpeg,.png"></label>' +
      '<div class="prog hidden" id="uProg"><i></i></div>' +
      '<button class="btn btn-primary btn-block" type="submit" id="uBtn"' + (M.kelas.length && M.mapel.length ? '' : ' disabled') + '>' + ic('upload', 18) + ' Unggah Materi</button></form>';
    const drop = box.querySelector('#uDrop'), file = box.querySelector('#uFile');
    const pilih = (f) => {
      if (!f) return;
      if (f.size > 10 * 1024 * 1024) { toast('Ukuran berkas melebihi 10 MB. Kompres atau pecah modul terlebih dahulu.', 'error'); return; }
      berkas = f;
      box.querySelector('#uNama').textContent = f.name; box.querySelector('#uInfo').textContent = fmt.ukuran(f.size) + ' • siap diunggah';
      if (!box.querySelector('#uJudul').value) box.querySelector('#uJudul').value = f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ');
    };
    file.addEventListener('change', () => pilih(file.files[0]));
    drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
    ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
    ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
    drop.addEventListener('drop', (e) => pilih(e.dataTransfer.files[0]));
    box.querySelector('#fU').addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = (id) => box.querySelector('#' + id).value.trim();
      if (!v('uJudul')) return toast('Isi judul materi.', 'error');
      if (!berkas) return toast('Pilih berkas materi terlebih dahulu.', 'error');
      const btn = box.querySelector('#uBtn'); tombolSibuk(btn, true, 'Mengunggah…');
      const prog = box.querySelector('#uProg'); prog.classList.remove('hidden');
      const bar = prog.querySelector('i'); bar.style.width = '15%';
      let p = 15; const t = setInterval(() => { p = Math.min(90, p + 5); bar.style.width = p + '%'; }, 400);
      try {
        const b64 = await UI.bacaFileBase64(berkas);
        const r = await API.tulis('materi.unggah', { materi: { judul: v('uJudul'), mapelId: v('uMapel'), kelasId: v('uKelas'), bab: v('uBab'), tag: v('uTag'), deskripsi: v('uDesk') }, file: { nama: berkas.name, mime: berkas.type || 'application/octet-stream', base64: b64 } }, { timeout: 240000 });
        clearInterval(t); bar.style.width = '100%';
        if (!r.success) { toast(r.message, 'error'); return; }
        toast(r.message, 'success');
        if (r.data.peringatan) toast(r.data.peringatan, 'warning');
        mMapel = v('uMapel'); materi();
      } catch (err) { toast(err.message, 'error'); }
      finally { clearInterval(t); tombolSibuk(btn, false); setTimeout(() => prog.classList.add('hidden'), 600); }
    });
  }
  function renderDaftarMateri(box, list) {
    box.innerHTML = '<div class="filters"><label class="search">' + ic('search', 20, 'muted') + '<input type="search" id="mfCari" placeholder="Cari judul atau bab…" value="' + esc(mCari) + '" aria-label="Cari materi"></label>' +
      sel('mfMapel', '<option value="">Semua mapel</option>' + opsiMapel(mMapel), 'aria-label="Filter mapel"') + '</div><div id="mfList"></div>';
    const gambar = () => {
      const q = mCari.toLowerCase();
      const isi = list.filter((m) => (!mMapel || m.mapelId === mMapel) && (!q || (m.judul + ' ' + m.bab).toLowerCase().indexOf(q) > -1));
      box.querySelector('#mfList').innerHTML = isi.length ? isi.map((m) => '<div class="card li" style="align-items:flex-start"><span class="sq">' + ic('file', 24) + '</span><div class="grow"><h4>' + esc(m.judul) + '</h4>' +
        '<p class="sub">' + esc([m.kelas, m.mapel, m.bab].filter(Boolean).join(' • ')) + '</p><div class="row wrap" style="margin-top:6px">' + (m.tag ? '<span class="pill pill-solid-blue">' + esc(m.tag) + '</span>' : '') +
        '<span class="pill">' + esc(fmt.ukuran(m.ukuran)) + (m.halaman ? ' • ' + m.halaman + ' hlm' : '') + '</span><span class="pill">' + ic('calendar', 12) + ' ' + esc(fmt.tgl(m.tanggal)) + '</span><span class="pill pill-blue">' + ic('eye', 12) + ' ' + m.dibuka + ' siswa membuka</span></div></div>' +
        '<div class="acts row"><a class="btn btn-ghost btn-icon btn-sm" href="https://drive.google.com/file/d/' + encodeURIComponent(m.fileId) + '/view" target="_blank" rel="noopener" aria-label="Buka di Drive" title="Buka di Drive">' + ic('external', 18) + '</a>' +
        '<button class="btn btn-ghost btn-icon btn-sm" data-ed="' + esc(m.id) + '" aria-label="Ubah materi">' + ic('pencil', 18) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-hp="' + esc(m.id) + '" aria-label="Hapus materi" style="color:var(--danger)">' + ic('trash', 18) + '</button></div></div>').join('')
        : '<div class="card">' + UI.kosong('book', list.length ? 'Tidak ada yang cocok' : 'Belum ada materi', list.length ? 'Ubah kata kunci atau filter.' : 'Unggah modul pertama lewat formulir di samping.') + '</div>';
      box.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => {
        const m = list.find((x) => x.id === b.dataset.ed);
        const d = UI.buka(UI.headHtml('Ubah Materi') + '<form class="modal-body stack" id="fME">' + fld('meJudul', 'Judul *', inp('meJudul', m.judul)) +
          '<div class="grid-2 sm-1">' + fld('meMapel', 'Mapel', sel('meMapel', opsiMapel(m.mapelId))) + fld('meKelas', 'Kelas', sel('meKelas', opsiKelas(m.kelasId, true))) + '</div>' +
          '<div class="grid-2 sm-1">' + fld('meBab', 'Bab', inp('meBab', m.bab)) + fld('meTag', 'Label', inp('meTag', m.tag)) + '</div>' + fld('meDesk', 'Deskripsi', '<textarea class="textarea" id="meDesk">' + esc(m.deskripsi) + '</textarea>') +
          '<button class="btn btn-primary btn-block" type="submit">' + ic('save', 18) + ' Simpan</button></form>');
        d.el.querySelector('#fME').addEventListener('submit', async (e) => {
          e.preventDefault(); const v = (id) => d.el.querySelector('#' + id).value.trim();
          tombolSibuk(e.submitter, true);
          const r = await API.tulis('materi.ubah', { materi: { id: m.id, judul: v('meJudul'), mapelId: v('meMapel'), kelasId: v('meKelas'), bab: v('meBab'), tag: v('meTag'), deskripsi: v('meDesk') } });
          tombolSibuk(e.submitter, false);
          if (!r.success) return toast(r.message, 'error');
          d.tutup(); toast(r.message, 'success'); materi();
        });
      }));
      box.querySelectorAll('[data-hp]').forEach((b) => b.addEventListener('click', async () => {
        const m = list.find((x) => x.id === b.dataset.hp);
        if (!await UI.konfirmasi('Hapus “' + m.judul + '”?', 'Berkas dipindah ke Sampah Google Drive dan tidak tampil lagi untuk siswa.', { ok: 'Hapus', bahaya: true })) return;
        const r = await API.tulis('materi.hapus', { id: m.id }); if (!r.success) return toast(r.message, 'error');
        list.splice(list.indexOf(m), 1); toast(r.message, 'success'); gambar();
      }));
    };
    box.querySelector('#mfCari').addEventListener('input', (e) => { mCari = e.target.value; gambar(); });
    box.querySelector('#mfMapel').addEventListener('change', (e) => { mMapel = e.target.value; gambar(); });
    gambar();
  }

  // ================================================================
  // LATIHAN SOAL (pembuat soal)
  // ================================================================
  let latAktif = null, latDraft = null, latKotor = false;
  function latihan(arg) {
    main.innerHTML = butuhMaster() + '<div class="split"><section class="card panel" id="lList">' + UI.skeleton([44, 70, 70, 70]) + '</section><section id="lEdit"></section></div>';
    API.muat('latihan.list', {}, (d, c, err) => {
      if (halaman !== 'latihan') return;
      const box = main.querySelector('#lList');
      if (err) { box.innerHTML = UI.gagalMuat(err.message); box.querySelector('#btnUlang').onclick = () => latihan(); return; }
      daftarLatihan(box, d.latihan);
      if (arg === 'baru') bukaEditor(null);
      else if (latAktif && d.latihan.find((l) => l.id === latAktif)) { if (!latDraft) bukaEditor(latAktif); }
      else if (!latDraft) main.querySelector('#lEdit').innerHTML = '<div class="card">' + UI.kosong('quiz', 'Pilih atau buat latihan', 'Pilih latihan di daftar untuk mengubah soal, atau buat latihan baru.', '<button class="btn btn-primary" id="lBaru2">' + ic('plus', 18) + ' Latihan Baru</button>') + '</div>';
      const b2 = main.querySelector('#lBaru2'); if (b2) b2.onclick = () => bukaEditor(null);
    }, { umur: 20000 });
  }
  function daftarLatihan(box, list) {
    box.innerHTML = '<div class="panel-h"><h2>' + ic('quiz', 20) + ' Daftar Latihan</h2><button class="btn btn-primary btn-sm" id="lBaru"' + (M.kelas.length && M.mapel.length ? '' : ' disabled') + '>' + ic('plus', 16) + ' Baru</button></div>' +
      (list.length ? list.map((l) => '<button class="lat-item' + (l.id === latAktif ? ' on' : '') + '" data-l="' + esc(l.id) + '"><div class="row between"><b class="ellipsis">' + esc(l.judul) + '</b><span class="pill ' + ({ Terbit: 'pill-green', Draf: 'pill-amber' }[l.status] || '') + '">' + esc(l.status) + '</span></div>' +
        '<p class="small muted ellipsis">' + esc([l.mapel, l.kelas, l.bab].filter(Boolean).join(' • ')) + '</p><p class="xs muted" style="margin-top:4px">' + l.jumlahSoal + ' soal • ' + l.pengerjaan + ' pengerjaan' + (l.rata !== null ? ' • rata ' + fmt.angka(l.rata) : '') + '</p></button>').join('')
        : UI.kosong('quiz', 'Belum ada latihan', 'Buat latihan pilihan ganda pertama.'));
    box.querySelector('#lBaru').addEventListener('click', () => bukaEditor(null));
    box.querySelectorAll('[data-l]').forEach((b) => b.addEventListener('click', () => bukaEditor(b.dataset.l)));
  }
  async function bukaEditor(id) {
    if (latKotor && !await UI.konfirmasi('Buang perubahan?', 'Ada perubahan soal yang belum disimpan.', { ok: 'Buang', bahaya: true })) return;
    latKotor = false; latAktif = id;
    main.querySelectorAll('.lat-item').forEach((b) => b.classList.toggle('on', b.dataset.l === id));
    const box = main.querySelector('#lEdit');
    if (!id) {
      latDraft = { latihan: { judul: '', mapelId: (M.mapel[0] || {}).id, kelasId: (M.kelas[0] || {}).id, bab: '', durasi: 30, kkm: '', status: 'Draf' }, soal: [soalKosong()] };
      return gambarEditor(box);
    }
    box.innerHTML = '<div class="card panel">' + UI.skeleton([200, 200]) + '</div>';
    const r = await API.api('latihan.detail', { id });
    if (!r.success) { box.innerHTML = UI.gagalMuat(r.message); return; }
    latDraft = r.data;
    if (!latDraft.soal.length) latDraft.soal.push(soalKosong());
    gambarEditor(box);
  }
  const soalKosong = () => ({ pertanyaan: '', opsi: { A: '', B: '', C: '', D: '' }, kunci: '', bobot: 10, pembahasan: '' });
  function gambarEditor(box) {
    const L = latDraft.latihan, S = latDraft.soal;
    box.innerHTML = '<div class="card panel"><div class="panel-h"><h2>' + ic('pencil', 20) + ' ' + (L.id ? 'Ubah Latihan' : 'Latihan Baru') + '</h2>' + (L.id ? '<span class="pill ' + (L.status === 'Terbit' ? 'pill-green' : 'pill-amber') + '">' + esc(L.status) + '</span>' : '') + '</div>' +
      '<div class="stack">' + fld('eJudul', 'Judul latihan *', inp('eJudul', L.judul, 'placeholder="Latihan Soal: Trigonometri Dasar"')) +
      '<div class="grid-3 sm-1">' + fld('eMapel', 'Mapel *', sel('eMapel', opsiMapel(L.mapelId))) + fld('eKelas', 'Kelas *', sel('eKelas', opsiKelas(L.kelasId, true))) + fld('eBab', 'Bab', inp('eBab', L.bab, 'placeholder="Bab 3"')) + '</div>' +
      '<div class="grid-2">' + fld('eDur', 'Durasi (menit)', inp('eDur', L.durasi, 'type="number" min="0" max="300"'), '0 = tanpa batas waktu') + fld('eKkm', 'KKM', inp('eKkm', L.kkm || '', 'type="number" min="1" max="100" placeholder="' + esc((M.app && M.app.kkm) || 75) + '"'), 'Kosong = KKM umum di Pengaturan') + '</div></div></div>' +
      '<div class="row between" style="margin:20px 0 12px"><h2 style="font-size:18px">Soal (' + S.length + ')</h2><button class="btn btn-outline btn-sm" id="eTempel">' + ic('copy', 16) + ' Tempel dari teks</button></div>' +
      '<div id="eSoal">' + S.map((s, i) => blokSoal(s, i)).join('') + '</div>' +
      '<button class="btn btn-outline btn-block" id="eTambah" style="margin-top:12px">' + ic('plus', 18) + ' Tambah Soal</button>' +
      '<div class="card sticky-foot" style="margin-top:16px;border-radius:14px">' + (L.id ? '<button class="btn btn-danger-outline" id="eHapus">' + ic('trash', 18) + ' Hapus</button>' : '') + '<span class="grow small muted" id="eInfo"></span>' +
        '<button class="btn btn-outline" id="eDraf">' + ic('save', 18) + ' Simpan Draf</button><button class="btn btn-primary" id="eTerbit">' + ic('send', 18) + ' ' + (L.status === 'Terbit' ? 'Simpan & Terbitkan' : 'Terbitkan') + '</button></div>';
    const tandai = () => { latKotor = true; box.querySelector('#eInfo').textContent = 'Ada perubahan belum disimpan'; };
    const ambilMeta = () => { const v = (id) => box.querySelector('#' + id).value.trim(); Object.assign(L, { judul: v('eJudul'), mapelId: v('eMapel'), kelasId: v('eKelas'), bab: v('eBab'), durasi: v('eDur'), kkm: v('eKkm') }); };
    box.querySelectorAll('#eJudul,#eMapel,#eKelas,#eBab,#eDur,#eKkm').forEach((el) => el.addEventListener('input', () => { ambilMeta(); tandai(); }));
    const pasangSoal = () => {
      box.querySelectorAll('.qb').forEach((q) => {
        const i = +q.dataset.i, s = S[i];
        q.querySelector('[data-f=p]').addEventListener('input', (e) => { s.pertanyaan = e.target.value; tandai(); });
        q.querySelector('[data-f=b]').addEventListener('input', (e) => { s.bobot = e.target.value; tandai(); });
        q.querySelector('[data-f=pb]').addEventListener('input', (e) => { s.pembahasan = e.target.value; tandai(); });
        q.querySelectorAll('[data-o]').forEach((o) => o.addEventListener('input', (e) => { s.opsi[o.dataset.o] = e.target.value; tandai(); }));
        q.querySelectorAll('[data-key]').forEach((k) => k.addEventListener('click', () => { s.kunci = k.dataset.key; q.querySelectorAll('[data-key]').forEach((x) => { x.classList.toggle('on', x === k); x.setAttribute('aria-pressed', x === k); }); tandai(); }));
        q.querySelector('[data-del]').addEventListener('click', () => { if (S.length === 1) return toast('Minimal satu soal.', 'warning'); S.splice(i, 1); ambilMeta(); gambarEditor(box); tandai(); });
      });
    };
    pasangSoal();
    box.querySelector('#eTambah').addEventListener('click', () => { ambilMeta(); S.push(soalKosong()); gambarEditor(box); tandai(); setTimeout(() => { const last = box.querySelector('.qb:last-child textarea'); if (last) { last.focus(); last.scrollIntoView({ block: 'center' }); } }, 50); });
    box.querySelector('#eTempel').addEventListener('click', () => tempelSoal(box));
    const simpan = async (status, btn) => {
      ambilMeta();
      const kosong = S.findIndex((s) => !s.pertanyaan.trim() && !s.kunci && !Object.values(s.opsi).some((x) => x.trim()));
      const soal = S.filter((s, i) => !(i === kosong && S.length > 1));
      tombolSibuk(btn, true);
      const r = await API.tulis('latihan.simpan', { latihan: Object.assign({}, L, { status }), soal });
      tombolSibuk(btn, false);
      if (!r.success) return toast(r.message, 'error');
      latKotor = false; latAktif = r.data.id; latDraft = null;
      toast(r.message, 'success');
      latihan();
    };
    box.querySelector('#eDraf').addEventListener('click', (e) => simpan(L.status === 'Terbit' ? 'Terbit' : 'Draf', e.currentTarget));
    box.querySelector('#eTerbit').addEventListener('click', (e) => simpan('Terbit', e.currentTarget));
    const h = box.querySelector('#eHapus');
    if (h) h.addEventListener('click', async () => {
      if (!await UI.konfirmasi('Hapus latihan ini?', 'Bila sudah ada siswa yang mengerjakan, latihan akan diarsipkan (nilai tetap tersimpan).', { ok: 'Hapus', bahaya: true })) return;
      const r = await API.tulis('latihan.hapus', { id: L.id }); if (!r.success) return toast(r.message, 'error');
      toast(r.message, 'success'); latAktif = null; latDraft = null; latKotor = false; latihan();
    });
  }
  function blokSoal(s, i) {
    return '<div class="qb" data-i="' + i + '"><div class="row" style="align-items:flex-start;gap:10px"><span class="no">' + (i + 1) + '</span><div class="grow stack">' +
      '<textarea class="textarea" data-f="p" rows="2" placeholder="Tulis pertanyaan…" aria-label="Pertanyaan soal ' + (i + 1) + '">' + esc(s.pertanyaan) + '</textarea>' +
      ['A', 'B', 'C', 'D'].map((k) => '<div class="opt-in"><button type="button" class="key' + (s.kunci === k ? ' on' : '') + '" data-key="' + k + '" aria-pressed="' + (s.kunci === k) + '" title="Jadikan kunci jawaban" aria-label="Jadikan ' + k + ' kunci jawaban">' + k + '</button><input class="input" data-o="' + k + '" value="' + esc(s.opsi[k]) + '" placeholder="Pilihan ' + k + '" aria-label="Pilihan ' + k + ' soal ' + (i + 1) + '"></div>').join('') +
      '<div class="grid-2" style="grid-template-columns:120px 1fr"><input class="input" data-f="b" type="number" min="1" max="100" value="' + esc(s.bobot) + '" aria-label="Bobot poin" title="Bobot poin"><input class="input" data-f="pb" value="' + esc(s.pembahasan || '') + '" placeholder="Pembahasan (tampil setelah siswa mengirim)"></div>' +
      '<p class="xs muted">Klik huruf berwarna hijau untuk menandai kunci jawaban. Bobot = poin soal.</p></div>' +
      '<button type="button" class="btn btn-ghost btn-icon btn-sm" data-del aria-label="Hapus soal ' + (i + 1) + '" style="color:var(--danger)">' + ic('trash', 18) + '</button></div></div>';
  }
  function tempelSoal(box) {
    const d = UI.buka(UI.headHtml('Tempel soal dari teks', 'Cocok untuk menyalin soal dari Word / Google Docs.') + '<div class="modal-body stack">' +
      '<div class="info-box">' + ic('info', 18) + '<span>Format per soal:<br><code>1. Pertanyaan…<br>A. pilihan<br>B. pilihan<br>C. pilihan<br>D. pilihan<br>Kunci: B</code><br>Baris “Pembahasan: …” opsional.</span></div>' +
      '<textarea class="textarea" id="tTeks" rows="12" placeholder="Tempel soal di sini…"></textarea></div><div class="modal-foot"><button class="btn btn-outline" data-close>Batal</button><button class="btn btn-primary" id="tOk">' + ic('plus', 18) + ' Tambahkan</button></div>', { wide: true });
    d.el.querySelector('#tOk').addEventListener('click', () => {
      const blok = d.el.querySelector('#tTeks').value.replace(/\r/g, '').split(/\n(?=\s*\d+[.)]\s)/).map((b) => b.trim()).filter(Boolean);
      const hasil = [];
      blok.forEach((b) => {
        const s = soalKosong(); const baris = b.split('\n'); const tanya = [];
        baris.forEach((ln) => {
          const t = ln.trim(); let m;
          if ((m = t.match(/^([A-Da-d])[.)]\s*(.*)$/))) s.opsi[m[1].toUpperCase()] = m[2];
          else if ((m = t.match(/^kunci\s*(jawaban)?\s*[:=]\s*([A-Da-d])/i))) s.kunci = m[2].toUpperCase();
          else if ((m = t.match(/^pembahasan\s*[:=]\s*(.*)$/i))) s.pembahasan = m[1];
          else tanya.push(t.replace(/^\d+[.)]\s*/, ''));
        });
        s.pertanyaan = tanya.join('\n').trim();
        if (s.pertanyaan) hasil.push(s);
      });
      if (!hasil.length) return toast('Tidak ada soal yang terbaca. Periksa formatnya.', 'error');
      const S = latDraft.soal;
      if (S.length === 1 && !S[0].pertanyaan) S.splice(0, 1);
      hasil.forEach((s) => S.push(s));
      d.tutup(); latKotor = true; gambarEditor(box);
      const tanpaKunci = hasil.filter((s) => !s.kunci).length;
      toast(hasil.length + ' soal ditambahkan' + (tanpaKunci ? '. ' + tanpaKunci + ' soal belum punya kunci jawaban.' : '.'), tanpaKunci ? 'warning' : 'success');
    });
  }

  // ================================================================
  // NILAI
  // ================================================================
  let nKelas = '', nCari = '';
  function nilai() {
    main.innerHTML = '<div class="filters"><label class="search">' + ic('search', 20, 'muted') + '<input type="search" id="nCari" placeholder="Cari nama siswa…" value="' + esc(nCari) + '" aria-label="Cari siswa"></label>' +
      sel('nKelas', '<option value="">Semua kelas</option>' + opsiKelas(nKelas), 'aria-label="Filter kelas"') + '<button class="btn btn-outline" id="nCsv">' + ic('download', 18) + ' Ekspor CSV</button></div><div id="nIsi">' + UI.skeleton([400]) + '</div>';
    main.querySelector('#nKelas').addEventListener('change', (e) => { nKelas = e.target.value; nilai(); });
    API.muat('nilai.ringkasan', { kelasId: nKelas }, (d, c, err) => {
      if (halaman !== 'nilai') return;
      const box = main.querySelector('#nIsi');
      if (err) { box.innerHTML = UI.gagalMuat(err.message); box.querySelector('#btnUlang').onclick = nilai; return; }
      const gambar = () => {
        const q = nCari.toLowerCase(), siswa = d.siswa.filter((s) => !q || s.nama.toLowerCase().indexOf(q) > -1);
        box.innerHTML = !d.latihan.length ? '<div class="card">' + UI.kosong('chart', 'Belum ada latihan terbit', 'Nilai muncul setelah latihan diterbitkan dan dikerjakan siswa.', '<a class="btn btn-primary" href="#/guru/latihan/baru">' + ic('plus', 18) + ' Buat Latihan</a>') + '</div>'
          : '<div class="legend" style="margin-bottom:10px"><span><i style="background:var(--accent-tint);border:1px solid var(--accent)"></i>≥ KKM (tuntas)</span><span><i style="background:var(--warning-bg);border:1px solid #D97706"></i>&lt; KKM (remedial)</span><span>Klik nilai untuk melihat jawaban siswa.</span></div>' +
            '<div class="tbl-wrap"><table class="tbl sticky-first"><thead><tr><th>Siswa</th>' + d.latihan.map((l) => '<th title="' + esc(l.judul) + '"><span class="ellipsis" style="display:inline-block;max-width:140px">' + esc(l.judul) + '</span><br><span style="text-transform:none;font-weight:500">' + esc(l.mapel) + ' • KKM ' + l.kkm + '</span></th>').join('') + '<th class="num">Rata-rata</th></tr></thead><tbody>' +
            siswa.map((s) => '<tr><td><div class="who"><span class="av">' + esc(fmt.inisial(s.nama)) + '</span><div><b>' + esc(s.nama) + '</b><span>' + esc(s.kelas) + '</span></div></div></td>' +
              d.latihan.map((l) => { const n = s.nilai[l.id]; return '<td>' + (n ? '<button class="cell-score ' + (n.skor >= l.kkm ? 'ok' : 'no') + '" data-h="' + esc(n.hasilId) + '" aria-label="Nilai ' + n.skor + ', lihat jawaban">' + n.skor + '</button>' : '<span class="muted">–</span>') + '</td>'; }).join('') +
              '<td class="num"><b class="num">' + (s.rata === null ? '–' : fmt.angka(s.rata)) + '</b></td></tr>').join('') + '</tbody></table></div>';
        box.querySelectorAll('[data-h]').forEach((b) => b.addEventListener('click', () => lihatHasil(b.dataset.h)));
      };
      main.querySelector('#nCari').oninput = (e) => { nCari = e.target.value; gambar(); };
      main.querySelector('#nCsv').onclick = () => UI.unduhCsv('nilai-siswa.csv', ['Siswa', 'Kelas'].concat(d.latihan.map((l) => l.judul), ['Rata-rata']),
        d.siswa.map((s) => [s.nama, s.kelas].concat(d.latihan.map((l) => s.nilai[l.id] ? s.nilai[l.id].skor : ''), [s.rata])));
      gambar();
    }, { umur: 30000 });
  }

  // ================================================================
  // LAPORAN
  // ================================================================
  let lap = { dari: '', sampai: '', kelasId: '', mapelId: '' }, lapCari = '';
  function laporan() {
    if (!lap.sampai) { lap.sampai = fmt.hariIni(); lap.dari = fmt.geser(lap.sampai, -29); }
    main.innerHTML = '<div class="filters">' + fld('lDari', 'Dari', inp('lDari', lap.dari, 'type="date"')) + fld('lSampai', 'Sampai', inp('lSampai', lap.sampai, 'type="date"')) +
      fld('lKelas', 'Kelas', sel('lKelas', '<option value="">Semua kelas</option>' + opsiKelas(lap.kelasId))) + fld('lMapel', 'Mapel', sel('lMapel', '<option value="">Semua mapel</option>' + opsiMapel(lap.mapelId))) +
      '<div class="field"><span class="label">&nbsp;</span><button class="btn btn-primary" id="lGo">' + ic('filter', 18) + ' Terapkan</button></div></div><div id="lIsi">' + UI.skeleton([110, 300, 300]) + '</div>';
    main.querySelector('#lGo').addEventListener('click', () => { const v = (id) => main.querySelector('#' + id).value; lap = { dari: v('lDari'), sampai: v('lSampai'), kelasId: v('lKelas'), mapelId: v('lMapel') }; laporan(); });
    API.muat('laporan.data', lap, (d, c, err) => {
      if (halaman !== 'laporan') return;
      const box = main.querySelector('#lIsi');
      if (err) { box.innerHTML = UI.gagalMuat(err.message); box.querySelector('#btnUlang').onclick = laporan; return; }
      renderLaporan(box, d);
    }, { umur: 60000 });
  }
  function renderLaporan(box, d) {
    const r = d.ringkas;
    const kartu = (id, judul, sub, isi) => '<section class="card panel"><div class="panel-h"><div><h2>' + judul + '</h2><p>' + sub + '</p></div><button class="btn btn-ghost btn-sm" data-tabel="' + id + '">' + ic('table', 16) + ' Tabel</button></div>' + (isi || '<div class="chart" id="' + id + '"></div>') + '<div id="' + id + 'T" class="hidden"></div></section>';
    const perSiswa = d.tabel.filter((t) => t.hadirPersen !== null).sort((a, b) => a.hadirPersen - b.hadirPersen).slice(0, 10);
    box.innerHTML = '<div class="kpis enter" style="margin-bottom:20px">' +
      kpi(0, 'RATA-RATA KEHADIRAN', 'clipcheck', r.hadirPersen === null ? '–' : '<span data-count="' + r.hadirPersen + '" data-dec="1">0</span><small>%</small>', r.sesi + ' catatan presensi') +
      kpi(1, 'RATA-RATA NILAI', 'star', r.rataNilai === null ? '–' : '<span data-count="' + r.rataNilai + '" data-dec="1">0</span>', r.pengerjaan + ' nilai (terakhir per latihan)') +
      kpi(2, 'PROGRES MATERI', 'book', r.progresMateri === null ? '–' : '<span data-count="' + r.progresMateri + '">0</span><small>%</small>', r.dibuka + ' dari ' + r.mungkin + ' materi dibuka') +
      kpi(3, 'SISWA AKTIF', 'users', '<span data-count="' + r.siswa + '">0</span>', esc(fmt.tgl(d.periode.dari)) + ' – ' + esc(fmt.tgl(d.periode.sampai))) +
      '</div><div class="g-2">' +
      kartu('chTren', ic('trend', 20) + ' Tren Kehadiran', 'Persentase hadir per tanggal les') +
      kartu('chDist', ic('chart', 20) + ' Distribusi Nilai', 'Jumlah nilai per rentang skor') +
      kartu('chSiswa', ic('alert', 20) + ' Kehadiran Terendah', '10 siswa yang paling perlu perhatian') +
      kartu('chMat', ic('book', 20) + ' Progres Materi', 'Bagian materi yang sudah dibuka siswa', '<div class="row" style="gap:24px;padding:12px 0;flex-wrap:wrap" id="chMat">' + UI.cincin(r.progresMateri || 0, { size: 140, stroke: 14, track: 'var(--border-soft)', textColor: 'var(--text)', font: 30 }) +
        '<div class="stack"><p class="small muted">Materi dibuka</p><p class="num" style="font-size:28px;font-weight:700">' + r.dibuka + ' <span class="small muted">/ ' + r.mungkin + '</span></p><p class="small muted">Dihitung dari setiap pasangan siswa × materi di kelasnya.</p></div></div>') +
      '</div><section class="card panel" style="margin-top:20px"><div class="panel-h"><div><h2>' + ic('table', 20) + ' Rincian per Siswa</h2><p>Gabungan kehadiran, nilai, dan materi</p></div><div class="row wrap" style="flex:1;justify-content:flex-end"><label class="search" style="min-height:44px;box-shadow:none;flex:1;min-width:0;max-width:320px">' + ic('search', 18, 'muted') + '<input id="lCari" type="search" placeholder="Cari siswa…" value="' + esc(lapCari) + '" aria-label="Cari siswa"></label><button class="btn btn-outline" id="lCsv">' + ic('download', 18) + ' CSV</button></div></div><div id="lTabel"></div></section>';
    const tren = d.tren.map((t) => ({ label: fmt.tgl(t.tanggal, { tahun: false }), value: t.persen, tip: '<b>' + esc(fmt.tgl(t.tanggal, { hari: true })) + '</b><br>' + t.persen + '% hadir (' + t.hadir + '/' + t.total + ')' }));
    if (tren.length) UI.grafikGaris(box.querySelector('#chTren'), tren, { max: 100, satuan: '%', aria: 'Tren kehadiran' }); else box.querySelector('#chTren').innerHTML = UI.kosong('trend', 'Belum ada data', 'Tidak ada presensi pada periode ini.');
    pasangTabelL(box, 'chTren', ['Tanggal', 'Hadir', 'Tercatat', 'Persen'], d.tren.map((t) => [fmt.tgl(t.tanggal), t.hadir, t.total, t.persen + '%']));
    UI.grafikKolom(box.querySelector('#chDist'), d.distribusi.map((x) => ({ label: x.label, value: x.jumlah, tip: '<b>Nilai ' + x.label + '</b><br>' + x.jumlah + ' nilai' })), { aria: 'Distribusi nilai', lebar: 36 });
    pasangTabelL(box, 'chDist', ['Rentang', 'Jumlah'], d.distribusi.map((x) => [x.label, x.jumlah]));
    if (perSiswa.length) UI.grafikBatang(box.querySelector('#chSiswa'), perSiswa.map((t) => ({ label: t.nama, value: t.hadirPersen, warna: t.hadirPersen < 75 ? '#D97706' : 'var(--primary)', tip: '<b>' + esc(t.nama) + '</b><br>' + t.hadir + ' dari ' + t.sesi + ' sesi' })), { max: 100, satuan: '%', aria: 'Kehadiran terendah' });
    else box.querySelector('#chSiswa').innerHTML = UI.kosong('users', 'Belum ada data', 'Tidak ada presensi pada periode ini.');
    pasangTabelL(box, 'chSiswa', ['Siswa', 'Hadir', 'Sesi', 'Persen'], perSiswa.map((t) => [t.nama, t.hadir, t.sesi, t.hadirPersen + '%']));
    pasangTabelL(box, 'chMat', ['Siswa', 'Dibuka', 'Total'], d.tabel.map((t) => [t.nama, t.materiDibuka, t.materiTotal]));
    const gambar = () => {
      const q = lapCari.toLowerCase(), isi = d.tabel.filter((t) => !q || t.nama.toLowerCase().indexOf(q) > -1);
      box.querySelector('#lTabel').innerHTML = isi.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Siswa</th><th>Kelas</th><th class="num">Kehadiran</th><th class="num">Sesi</th><th class="num">Rata Nilai</th><th class="num">Latihan</th><th class="num">Materi dibuka</th></tr></thead><tbody>' +
        isi.map((t) => '<tr><td><b>' + esc(t.nama) + '</b></td><td>' + esc(t.kelas) + '</td><td class="num">' + (t.hadirPersen === null ? '–' : '<span style="color:' + (t.hadirPersen < 75 ? 'var(--warning)' : 'inherit') + '">' + fmt.angka(t.hadirPersen) + '%</span>') + '</td><td class="num">' + t.sesi + '</td><td class="num">' + (t.rata === null ? '–' : fmt.angka(t.rata)) + '</td><td class="num">' + t.latihan + '</td><td class="num">' + t.materiDibuka + ' / ' + t.materiTotal + '</td></tr>').join('') + '</tbody></table></div>'
        : UI.kosong('users', 'Tidak ada data', '');
    };
    box.querySelector('#lCari').addEventListener('input', (e) => { lapCari = e.target.value; gambar(); });
    box.querySelector('#lCsv').addEventListener('click', () => UI.unduhCsv('laporan-' + d.periode.dari + '_' + d.periode.sampai + '.csv', ['Siswa', 'Kelas', 'Kehadiran_%', 'Sesi', 'Rata_Nilai', 'Latihan', 'Materi_Dibuka', 'Materi_Total'], d.tabel.map((t) => [t.nama, t.kelas, t.hadirPersen, t.sesi, t.rata, t.latihan, t.materiDibuka, t.materiTotal])));
    gambar(); UI.animasi(box);
  }
  function pasangTabelL(box, id, kol, baris) {
    const btn = box.querySelector('[data-tabel="' + id + '"]'), t = box.querySelector('#' + id + 'T');
    t.innerHTML = UI.tabelGrafik(kol, baris);
    btn.addEventListener('click', () => { const on = t.classList.toggle('hidden'); box.querySelector('#' + id).classList.toggle('hidden', !on); btn.innerHTML = on ? ic('table', 16) + ' Tabel' : ic('chart', 16) + ' Grafik'; });
  }

  // ================================================================
  // PENGATURAN
  // ================================================================
  let tabSet = '';
  function pengaturan(tab) {
    const admin = isAdmin();
    const TABS = (admin ? [['identitas', 'droplet', 'Identitas Aplikasi'], ['akun', 'users', 'Akun Guru'], ['import', 'database', 'Import Data']] : []).concat([['keamanan', 'shield', 'Keamanan']], admin ? [['log', 'history', 'Log Aktivitas']] : []);
    if (tab) tabSet = tab;
    if (!TABS.find((t) => t[0] === tabSet)) tabSet = TABS[0][0];
    main.innerHTML = '<div class="tabs" role="tablist">' + TABS.map((t) => '<button data-tab="' + t[0] + '" class="' + (t[0] === tabSet ? 'on' : '') + '">' + ic(t[1], 18) + ' ' + t[2] + '</button>').join('') + '</div><div id="setIsi"></div>';
    main.querySelectorAll('[data-tab]').forEach((b) => b.addEventListener('click', () => { tabSet = b.dataset.tab; pengaturan(); }));
    const box = main.querySelector('#setIsi');
    ({ identitas: setIdentitas, akun: setAkun, import: setImport, keamanan: setKeamanan, log: setLog })[tabSet](box);
  }
  function setIdentitas(box) {
    const p = Object.assign({}, M.pengaturan || {}), app = M.app;
    box.innerHTML = '<div class="g-grid" style="margin-top:0"><section class="card panel"><div class="panel-h"><div><h2>' + ic('droplet', 20) + ' Identitas Aplikasi</h2><p>Nama, logo, dan warna tampil untuk semua siswa & guru.</p></div></div><form class="stack" id="fId" novalidate>' +
      '<div class="grid-2 sm-1">' + fld('iNama', 'Nama aplikasi *', inp('iNama', p.nama_app, 'maxlength="40"'), '<span id="iCnt"></span>') + fld('iTag', 'Tagline', inp('iTag', p.tagline, 'maxlength="80"')) + '</div>' +
      '<div class="field"><span class="label">Logo aplikasi</span><div class="row" style="gap:16px"><div style="width:88px;height:88px;border-radius:20px;background:var(--navy);display:grid;place-items:center;overflow:hidden;flex:none;color:#fff;font-family:var(--font-h);font-weight:700;font-size:28px" id="iLogoPrev">' + UI.logoHtml(app) + '</div>' +
        '<div class="col" style="flex:1;align-items:flex-start;gap:8px"><label class="btn btn-outline">' + ic('image', 18) + ' Pilih gambar<input type="file" id="iLogo" class="sr-only" accept="image/png,image/jpeg,image/webp,image/svg+xml"></label>' + (app.logo_url ? '<button type="button" class="btn btn-ghost btn-sm" id="iLogoDel">' + ic('trash', 16) + ' Hapus logo</button>' : '') + '<span class="hint">PNG/JPG persegi, maks. 2 MB. Ditampilkan sebagai thumbnail.</span></div></div></div>' +
      '<div class="grid-3 sm-1">' + warnaField('iUtama', 'Warna utama', p.warna_utama, 'Tombol & menu aktif') + warnaField('iGelap', 'Warna gelap', p.warna_gelap, 'Header & sidebar') + warnaField('iAksen', 'Warna aksen', p.warna_aksen, 'Progres & status hadir') + '</div>' +
      '<div id="iKontras"></div>' +
      '<div class="grid-2 sm-1">' + fld('iTA', 'Tahun ajaran', inp('iTA', p.tahun_ajaran, 'placeholder="2026/2027"')) + fld('iKontak', 'Kontak admin (tampil di halaman masuk)', inp('iKontak', p.kontak_admin, 'placeholder="WA 0812-xxxx-xxxx (Ustadzah Syarifah)"')) + '</div>' +
      '<div class="grid-2 sm-1">' + fld('iKkm', 'KKM umum', inp('iKkm', p.kkm, 'type="number" min="1" max="100"'), 'Dipakai bila latihan tidak punya KKM sendiri.') + fld('iTarget', 'Target jumlah siswa', inp('iTarget', p.target_siswa, 'type="number" min="0"')) + '</div>' +
      '<div class="row" style="justify-content:flex-end"><button type="button" class="btn btn-outline" id="iReset">Kembalikan warna awal</button><button class="btn btn-primary" type="submit" id="iSimpan">' + ic('save', 18) + ' Simpan Pengaturan</button></div></form></section>' +
      '<section class="card panel"><div class="panel-h"><div><h2>' + ic('eye', 20) + ' Pratinjau</h2><p>Tampilan beranda siswa</p></div></div><div class="preview-phone" id="iPrev"></div></section></div>';
    const v = (id) => box.querySelector('#' + id).value.trim();
    const pratinjau = () => {
      const u = v('iUtama'), g = v('iGelap'), a = v('iAksen'), ok = /^#[0-9a-f]{6}$/i;
      box.querySelector('#iCnt').textContent = v('iNama').length + '/40 karakter';
      const pesan = [];
      if (ok.test(u) && UI.kontras(u, '#FFFFFF') < 4.5) pesan.push('Warna utama terlalu terang — teks putih di tombol sulit dibaca (kontras ' + UI.kontras(u, '#FFFFFF').toFixed(1) + ':1, minimal 4,5:1).');
      if (ok.test(g) && UI.kontras(g, '#FFFFFF') < 7) pesan.push('Warna gelap kurang gelap untuk header (kontras ' + UI.kontras(g, '#FFFFFF').toFixed(1) + ':1, minimal 7:1).');
      if (ok.test(a) && UI.kontras(a, '#FFFFFF') < 3) pesan.push('Warna aksen terlalu pucat untuk progres (kontras ' + UI.kontras(a, '#FFFFFF').toFixed(1) + ':1, minimal 3:1).');
      box.querySelector('#iKontras').innerHTML = pesan.length ? '<div class="warn-box">' + ic('alert', 18) + '<span>' + pesan.map(esc).join('<br>') + '</span></div>' : '<div class="info-box">' + ic('checkCircle', 18) + '<span>Kombinasi warna lolos uji keterbacaan (WCAG).</span></div>';
      box.querySelector('#iSimpan').disabled = pesan.length > 0;
      const nama = v('iNama') || 'Syarifah Course';
      box.querySelector('#iPrev').innerHTML = '<div style="background:radial-gradient(130% 90% at 100% 0%, color-mix(in srgb,' + g + ' 82%, #3B6FB6),' + g + ');padding:16px 14px 60px;border-radius:0 0 24px 24px;color:#fff">' +
        '<div class="row"><div style="width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.12);display:grid;place-items:center;overflow:hidden;font-weight:700;color:' + a + '">' + box.querySelector('#iLogoPrev').innerHTML + '</div><div><b style="font-family:var(--font-h)">' + esc(nama) + '</b><p style="font-size:12px;opacity:.75">' + esc(v('iTag')) + '</p></div></div>' +
        '<p style="font-family:var(--font-h);font-size:20px;font-weight:700;margin-top:14px">Halo, Syarifah</p></div>' +
        '<div style="margin:-44px 12px 0;background:linear-gradient(140deg, color-mix(in srgb,' + g + ' 82%, #3B6FB6),' + g + ');border-radius:14px;padding:14px;color:#fff;position:relative">' +
        '<div class="row">' + UI.cincin(75, { size: 54, stroke: 6, color: a, font: 13 }) + '<div class="grow"><p style="font-size:12px;opacity:.8">Progres Belajar Kamu</p><div class="bar on-dark" style="margin-top:6px"><i style="width:75%;background:' + a + '"></i></div></div></div>' +
        '<div style="text-align:right;margin-top:10px"><span style="display:inline-block;background:' + u + ';color:#fff;border-radius:8px;padding:8px 12px;font-weight:600;font-size:13px">Lanjut Belajar →</span></div></div>' +
        '<div style="padding:14px 12px 18px;display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + ['book', 'quiz', 'clipcheck'].map((k) => '<div style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:10px 4px;text-align:center"><span style="display:inline-grid;place-items:center;width:34px;height:34px;border-radius:10px;background:color-mix(in srgb,' + u + ' 14%, #fff);color:' + u + '">' + ic(k, 18) + '</span></div>').join('') + '</div>';
      UI.animasi(box.querySelector('#iPrev'));
    };
    box.querySelectorAll('[data-hex]').forEach((pk) => {
      const t = box.querySelector('#' + pk.dataset.hex);
      pk.addEventListener('input', () => { t.value = pk.value.toUpperCase(); pratinjau(); });
      t.addEventListener('input', () => { if (/^#[0-9a-f]{6}$/i.test(t.value)) pk.value = t.value; pratinjau(); });
    });
    box.querySelectorAll('#iNama,#iTag').forEach((el) => el.addEventListener('input', pratinjau));
    box.querySelector('#iReset').addEventListener('click', () => { [['iUtama', '#2563EB'], ['iGelap', '#0B1F3A'], ['iAksen', '#16A34A']].forEach(([id, c]) => { box.querySelector('#' + id).value = c; box.querySelector('[data-hex=' + id + ']').value = c; }); pratinjau(); });
    box.querySelector('#iLogo').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (f.size > 2 * 1024 * 1024) return toast('Ukuran logo melebihi 2 MB.', 'error');
      box.querySelector('#iLogoPrev').innerHTML = '<img src="' + URL.createObjectURL(f) + '" alt="Pratinjau logo" style="width:100%;height:100%;object-fit:cover">'; pratinjau();
      toast('Mengunggah logo…', 'info');
      const r = await API.tulis('logo.unggah', { file: { nama: f.name, mime: f.type, base64: await UI.bacaFileBase64(f) } });
      if (!r.success) return toast(r.message, 'error');
      toast(r.message, 'success'); if (r.data.peringatan) toast(r.data.peringatan, 'warning');
      App.setApp(r.data.app); M.app = r.data.app; kerangka('pengaturan');
    });
    const del = box.querySelector('#iLogoDel');
    if (del) del.addEventListener('click', async () => { const r = await API.tulis('logo.unggah', { hapus: true }); if (!r.success) return toast(r.message, 'error'); App.setApp(r.data.app); M = null; toast(r.message, 'success'); Guru.route(['pengaturan', 'identitas']); });
    box.querySelector('#fId').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = box.querySelector('#iSimpan'); tombolSibuk(btn, true);
      const r = await API.tulis('pengaturan.simpan', { pengaturan: { nama_app: v('iNama'), tagline: v('iTag'), warna_utama: v('iUtama'), warna_gelap: v('iGelap'), warna_aksen: v('iAksen'), tahun_ajaran: v('iTA'), kontak_admin: v('iKontak'), kkm: v('iKkm'), target_siswa: v('iTarget') } });
      tombolSibuk(btn, false);
      if (!r.success) return toast(r.message, 'error');
      App.setApp(r.data.app); M = null; toast(r.message, 'success'); Guru.route(['pengaturan', 'identitas']);
    });
    pratinjau();
  }
  function warnaField(id, label, val, hint) {
    val = val || '#000000';
    return '<div class="field"><label for="' + id + '">' + label + '</label><div class="row"><input type="color" data-hex="' + id + '" value="' + esc(val) + '" aria-label="Pilih ' + label + '" style="width:48px;height:44px;border:1px solid var(--border);border-radius:8px;padding:2px;background:#fff;cursor:pointer;flex:none">' + inp(id, val, 'maxlength="7" style="font-family:ui-monospace,monospace"') + '</div><span class="hint">' + hint + '</span></div>';
  }
  function setAkun(box) {
    const list = M.guru || [], me = API.Sesi.me() || {};
    box.innerHTML = '<section class="card panel"><div class="panel-h"><div><h2>' + ic('users', 20) + ' Akun Guru & Pengelola</h2><p>Guru masuk lewat tab “Guru / Pengelola” dengan email & kata sandi.</p></div><button class="btn btn-primary" id="aTambah">' + ic('plus', 18) + ' Tambah Akun</button></div>' +
      '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Nama</th><th>Email</th><th>Peran</th><th>Login terakhir</th><th>Status</th><th></th></tr></thead><tbody>' +
      list.map((g) => '<tr><td><div class="who"><span class="av">' + esc(fmt.inisial(g.nama)) + '</span><b>' + esc(g.nama) + (g.id === me.id ? ' <span class="pill pill-blue">Anda</span>' : '') + '</b></div></td><td>' + esc(g.email) + '</td><td><span class="pill ' + (g.peran === 'admin' ? 'pill-dark' : 'pill-outline') + '">' + (g.peran === 'admin' ? 'Admin' : 'Guru') + '</span></td>' +
        '<td class="small muted">' + (g.loginTerakhir ? esc(fmt.relatif(g.loginTerakhir)) : 'Belum pernah') + '</td><td><span class="pill ' + (g.aktif ? 'pill-green' : '') + '">' + (g.aktif ? 'Aktif' : 'Nonaktif') + '</span></td>' +
        '<td><div class="acts"><button class="btn btn-ghost btn-icon btn-sm" data-ed="' + esc(g.id) + '" aria-label="Ubah akun ' + esc(g.nama) + '">' + ic('pencil', 18) + '</button><button class="btn btn-ghost btn-icon btn-sm" data-rs="' + esc(g.id) + '" aria-label="Reset sandi ' + esc(g.nama) + '">' + ic('key', 18) + '</button></div></td></tr>').join('') +
      '</tbody></table></div><div class="info-box" style="margin-top:14px">' + ic('info', 18) + '<span><b>Admin</b> dapat mengubah identitas aplikasi, akun guru, dan import data. <b>Guru</b> dapat mengelola siswa, presensi, materi, latihan, nilai, jadwal, dan tagihan.</span></div></section>';
    const form = (g) => {
      const baru = !g; g = g || { peran: 'guru', aktif: true };
      const d = UI.buka(UI.headHtml(baru ? 'Tambah Akun Guru' : 'Ubah Akun') + '<form class="modal-body stack" id="fA">' + fld('aNama', 'Nama *', inp('aNama', g.nama, 'placeholder="Ustadzah Syarifah, M.Pd"')) + fld('aEmail', 'Email (untuk masuk) *', inp('aEmail', g.email, 'type="email"')) +
        '<div class="grid-2">' + fld('aPeran', 'Peran', sel('aPeran', '<option value="guru"' + (g.peran === 'guru' ? ' selected' : '') + '>Guru</option><option value="admin"' + (g.peran === 'admin' ? ' selected' : '') + '>Admin</option>')) +
        (baru ? '' : fld('aAktif', 'Status', sel('aAktif', '<option value="1"' + (g.aktif ? ' selected' : '') + '>Aktif</option><option value="0"' + (!g.aktif ? ' selected' : '') + '>Nonaktif</option>'))) + '</div>' +
        '<button class="btn btn-primary btn-block" type="submit">' + ic('save', 18) + ' Simpan</button></form>');
      d.el.querySelector('#fA').addEventListener('submit', async (e) => {
        e.preventDefault(); const v = (id) => { const el = d.el.querySelector('#' + id); return el ? el.value.trim() : ''; };
        tombolSibuk(e.submitter, true);
        const r = await API.tulis('guru.simpan', { guru: { id: baru ? '' : g.id, nama: v('aNama'), email: v('aEmail'), peran: v('aPeran'), aktif: baru ? true : v('aAktif') === '1' } });
        tombolSibuk(e.submitter, false);
        if (!r.success) return toast(r.message, 'error');
        d.tutup(); toast(r.message, 'success'); M = null;
        if (r.data.sandiAwal) UI.tampilKredensial('Akun guru dibuat', [{ label: 'Email', nilai: v('aEmail').toLowerCase() }, { label: 'Kata sandi awal', nilai: r.data.sandiAwal }]);
        Guru.route(['pengaturan', 'akun']);
      });
    };
    box.querySelector('#aTambah').addEventListener('click', () => form(null));
    box.querySelectorAll('[data-ed]').forEach((b) => b.addEventListener('click', () => form(list.find((g) => g.id === b.dataset.ed))));
    box.querySelectorAll('[data-rs]').forEach((b) => b.addEventListener('click', async () => {
      const g = list.find((x) => x.id === b.dataset.rs);
      if (!await UI.konfirmasi('Reset kata sandi ' + g.nama + '?', 'Kata sandi lama tidak berlaku dan semua sesinya berakhir.', { ok: 'Buat sandi baru' })) return;
      const r = await API.tulis('guru.resetSandi', { id: g.id }); if (!r.success) return toast(r.message, 'error');
      UI.tampilKredensial('Kata sandi baru — ' + g.nama, [{ label: 'Email', nilai: g.email }, { label: 'Kata sandi baru', nilai: r.data.sandiBaru }]);
    }));
  }
  function setImport(box) {
    const TARGET = [['', 'Lewati'], ['Siswa', 'Siswa'], ['Kelas', 'Kelas'], ['Mapel', 'Mata Pelajaran'], ['Pembayaran', 'Tagihan/Pembayaran'], ['Jadwal', 'Jadwal']];
    let sumber = '', info = null;
    box.innerHTML = '<div class="g-grid" style="margin-top:0"><section class="card panel"><div class="panel-h"><div><h2>' + ic('database', 20) + ' Import dari Spreadsheet Lama</h2><p>Spreadsheet sumber hanya <b>dibaca</b>, tidak pernah diubah. Aman dijalankan berulang (tidak membuat data ganda).</p></div></div>' +
      '<div class="row" style="align-items:flex-end;gap:10px"><div class="field grow"><label for="imUrl">URL atau ID Google Sheets lama</label>' + inp('imUrl', '', 'placeholder="https://docs.google.com/spreadsheets/d/…"') + '</div><button class="btn btn-primary" id="imBaca">' + ic('search', 18) + ' Baca</button></div>' +
      '<p class="hint" style="margin-top:6px">Spreadsheet harus bisa dibuka oleh akun Google pemilik aplikasi ini.</p><div id="imPeta" style="margin-top:16px"></div><div id="imHasil"></div></section>' +
      '<section class="card panel"><div class="panel-h"><div><h2>' + ic('upload', 20) + ' Import Siswa dari CSV</h2><p>Untuk data dari Excel/aplikasi lain.</p></div></div><div class="stack">' +
      '<button class="btn btn-outline btn-block" id="imTpl">' + ic('download', 18) + ' Unduh template CSV</button>' +
      '<label class="drop">' + ic('file', 28) + '<b id="csvNama">Pilih berkas .csv</b><span>Kolom minimal: Nama, Kelas. Opsional: No_HP, Email, Alamat, Nama_Wali, HP_Wali</span><input type="file" id="imCsv" class="sr-only" accept=".csv,text/csv"></label>' +
      '<div class="row"><button class="btn btn-outline grow" id="csvPindai" disabled>' + ic('eye', 18) + ' Pindai</button><button class="btn btn-primary grow" id="csvJalan" disabled>' + ic('upload', 18) + ' Import</button></div><div id="csvHasil"></div></div></section></div>';
    const laporanHtml = (d) => '<div class="' + (d.dryRun ? 'info-box' : 'info-box') + '" style="margin-top:16px">' + ic(d.dryRun ? 'eye' : 'checkCircle', 18) + '<span><b>' + esc(d.dryRun ? 'Hasil pindai (belum ada yang ditulis)' : 'Import selesai') + '</b> — sumber: ' + esc(d.sumber) + '</span></div>' +
      '<div class="tbl-wrap" style="margin-top:10px"><table class="tbl"><thead><tr><th>Data</th><th class="num">Di sumber</th><th class="num">Ditambah</th><th class="num">Diperbarui</th><th class="num">Dilewati</th></tr></thead><tbody>' +
      ['Kelas', 'Mapel', 'Siswa', 'Pembayaran', 'Jadwal'].filter((k) => d.laporan[k] && (d.laporan[k].sumber || d.laporan[k].ditambah)).map((k) => { const x = d.laporan[k]; return '<tr><td><b>' + k + '</b></td><td class="num">' + x.sumber + '</td><td class="num" style="color:var(--accent-text)"><b>' + x.ditambah + '</b></td><td class="num">' + x.diperbarui + '</td><td class="num">' + x.dilewati + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      (d.peringatan.length ? '<div class="warn-box" style="margin-top:10px;display:block"><b>' + ic('alert', 16) + ' Peringatan:</b><ul style="margin:6px 0 0 18px;padding:0">' + d.peringatan.map((p) => '<li>' + esc(p) + '</li>').join('') + '</ul></div>' : '') +
      (d.akunBaru && d.akunBaru.length ? '<div class="warn-box" style="margin-top:10px">' + ic('key', 18) + '<span><b>' + d.akunBaru.length + ' akun siswa baru dibuat.</b> Unduh daftar ID & kata sandi sekarang — hanya tersedia sekali. <button class="btn btn-primary btn-sm" data-unduh-akun style="margin-left:6px">' + ic('download', 16) + ' Unduh daftar akun</button></span></div>' : '');
    const pasangUnduh = (el, d) => { const b = el.querySelector('[data-unduh-akun]'); if (b) b.addEventListener('click', () => UI.unduhCsv('akun-siswa-baru.csv', ['ID_Siswa', 'Nama', 'Kata_Sandi_Awal'], d.akunBaru.map((a) => [a.id, a.nama, a.sandi]))); };
    box.querySelector('#imBaca').addEventListener('click', async (e) => {
      sumber = box.querySelector('#imUrl').value.trim(); if (!sumber) return toast('Tempel URL spreadsheet lama.', 'error');
      tombolSibuk(btnOf(e), true, 'Membaca…');
      const r = await API.api('import.baca', { sumber });
      tombolSibuk(btnOf(e), false);
      if (!r.success) return toast(r.message, 'error');
      info = r.data;
      box.querySelector('#imHasil').innerHTML = '';
      box.querySelector('#imPeta').innerHTML = '<p class="bold">' + ic('file', 18) + ' ' + esc(info.nama) + '</p><p class="small muted" style="margin-bottom:10px">Tentukan sheet mana diimpor ke data apa. Kolom dicocokkan otomatis berdasarkan nama kolom.</p>' +
        '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Sheet</th><th class="num">Baris</th><th>Kolom terdeteksi</th><th>Impor sebagai</th></tr></thead><tbody>' +
        info.sheet.map((s, i) => '<tr><td><b>' + esc(s.nama) + '</b></td><td class="num">' + s.baris + '</td><td class="small muted">' + esc(s.kolom.slice(0, 8).join(', ')) + (s.kolom.length > 8 ? '…' : '') + '</td><td>' + sel('imT' + i, TARGET.map((t) => '<option value="' + t[0] + '"' + (t[0] === s.target ? ' selected' : '') + '>' + t[1] + '</option>').join(''), 'aria-label="Target ' + esc(s.nama) + '" style="min-width:170px"') + '</td></tr>').join('') +
        '</tbody></table></div><label class="check" style="margin-top:8px"><input type="checkbox" id="imTimpa"> Timpa data yang sudah ada (bawaan: hanya mengisi kolom yang masih kosong)</label>' +
        '<div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn btn-outline" id="imPindai">' + ic('eye', 18) + ' Pindai (Dry-run)</button><button class="btn btn-primary" id="imJalan">' + ic('upload', 18) + ' Jalankan Import</button></div>';
      const peta = () => info.sheet.map((s, i) => ({ sheet: s.nama, target: box.querySelector('#imT' + i).value })).filter((p) => p.target);
      const jalan = async (dry, btn) => {
        const p = peta(); if (!p.length) return toast('Pilih minimal satu sheet untuk diimpor.', 'error');
        if (!dry && !await UI.konfirmasi('Jalankan import?', 'Data baru akan ditulis ke database aplikasi. Spreadsheet lama tidak diubah. Disarankan menjalankan Pindai terlebih dahulu.', { ok: 'Jalankan' })) return;
        tombolSibuk(btn, true, dry ? 'Memindai…' : 'Mengimpor…');
        const r2 = await (dry ? API.api : API.tulis)('import.jalankan', { sumber, peta: p, dryRun: dry, timpa: box.querySelector('#imTimpa').checked }, { timeout: 360000 });
        tombolSibuk(btn, false);
        if (!r2.success) return toast(r2.message, 'error');
        const hb = box.querySelector('#imHasil'); hb.innerHTML = laporanHtml(r2.data); pasangUnduh(hb, r2.data);
        if (!dry) { M = null; toast(r2.message, 'success'); }
      };
      box.querySelector('#imPindai').addEventListener('click', (ev) => jalan(true, ev.currentTarget));
      box.querySelector('#imJalan').addEventListener('click', (ev) => jalan(false, ev.currentTarget));
    });
    // CSV
    let rows = null;
    box.querySelector('#imTpl').addEventListener('click', () => UI.unduhCsv('template-siswa.csv', ['Nama', 'Kelas', 'No_HP', 'Email', 'Tgl_Lahir', 'Alamat', 'Nama_Wali', 'HP_Wali', 'Hubungan_Wali'], [['Contoh Nama Siswa', '12 SMA Intensif', '081234567890', '', '2008-05-14', 'Depok', 'Nama Orang Tua', '081398765432', 'Ayah']]));
    box.querySelector('#imCsv').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      rows = UI.bacaCsv(await f.text());
      box.querySelector('#csvNama').textContent = f.name + ' • ' + rows.length + ' baris';
      box.querySelector('#csvPindai').disabled = box.querySelector('#csvJalan').disabled = !rows.length;
      if (!rows.length) toast('Berkas CSV kosong atau formatnya tidak terbaca.', 'error');
    });
    const jalanCsv = async (dry, btn) => {
      if (!dry && !await UI.konfirmasi('Import ' + rows.length + ' baris siswa?', 'Siswa yang sudah ada (ID/nomor HP/nama+kelas sama) tidak akan dibuat ganda.', { ok: 'Import' })) return;
      tombolSibuk(btn, true, dry ? 'Memindai…' : 'Mengimpor…');
      const r = await (dry ? API.api : API.tulis)('import.jalankan', { csv: { target: 'Siswa', rows }, dryRun: dry }, { timeout: 360000 });
      tombolSibuk(btn, false);
      if (!r.success) return toast(r.message, 'error');
      const hb = box.querySelector('#csvHasil'); hb.innerHTML = laporanHtml(r.data); pasangUnduh(hb, r.data);
      if (!dry) { M = null; toast(r.message, 'success'); }
    };
    box.querySelector('#csvPindai').addEventListener('click', (e) => jalanCsv(true, e.currentTarget));
    box.querySelector('#csvJalan').addEventListener('click', (e) => jalanCsv(false, e.currentTarget));
  }
  function setKeamanan(box) {
    const me = API.Sesi.me() || {};
    box.innerHTML = '<section class="card panel" style="max-width:720px"><div class="panel-h"><h2>' + ic('shield', 20) + ' Keamanan Akun</h2></div>' +
      (me.darurat || me.peran === 'superadmin' ? '<div class="warn-box" style="margin-bottom:14px">' + ic('alert', 18) + '<span>Anda masuk dengan <b>akses darurat</b>. Gunakan hanya untuk memulihkan akun admin, lalu ganti kata sandi darurat (minimal 12 karakter).</span></div>' : '') +
      '<button class="li" id="kSandi" style="width:100%;box-shadow:none"><span class="sq">' + ic('key', 22) + '</span><div class="grow"><h4>Ubah kata sandi</h4><p class="sub">Disarankan berkala, minimal 8 karakter berisi huruf & angka</p></div>' + ic('chevR', 20, 'muted') + '</button>' +
      '<button class="li" id="kSemua" style="width:100%;box-shadow:none"><span class="sq">' + ic('logout', 22) + '</span><div class="grow"><h4>Keluar dari semua perangkat</h4><p class="sub">Akhiri sesi Anda di HP/laptop lain</p></div>' + ic('chevR', 20, 'muted') + '</button>' +
      '<div class="info-box" style="margin-top:14px">' + ic('info', 18) + '<span>Rahasia aplikasi (kunci sesi, pepper sandi, kredensial darurat) disimpan di <b>Script Properties</b> Apps Script, bukan di spreadsheet. Jangan bagikan spreadsheet database atau menambah editor proyek Apps Script sembarangan.</span></div></section>';
    box.querySelector('#kSandi').addEventListener('click', () => App.modalGantiSandi(false));
    box.querySelector('#kSemua').addEventListener('click', () => App.keluar(true));
  }
  function setLog(box) {
    box.innerHTML = UI.skeleton([400]);
    API.api('audit.list', {}).then((r) => {
      if (!r.success) { box.innerHTML = UI.gagalMuat(r.message); return; }
      box.innerHTML = '<section class="card panel"><div class="panel-h"><div><h2>' + ic('history', 20) + ' Log Aktivitas</h2><p>100 aktivitas terakhir (kata sandi & berkas tidak pernah dicatat).</p></div></div>' +
        (r.data.log.length ? '<div class="tbl-wrap"><table class="tbl"><thead><tr><th>Waktu</th><th>Pengguna</th><th>Aksi</th><th>Entitas</th><th>Detail</th></tr></thead><tbody>' +
          r.data.log.map((l) => '<tr><td class="small" style="white-space:nowrap">' + esc(fmt.tgl(l.waktu)) + ' ' + esc(fmt.jam(l.waktu)) + '</td><td>' + esc(l.pengguna) + '</td><td><span class="pill pill-outline">' + esc(l.aksi) + '</span></td><td class="small">' + esc(l.entitas) + '</td><td class="small muted" style="max-width:360px">' + esc(l.detail) + '</td></tr>').join('') + '</tbody></table></div>'
          : UI.kosong('history', 'Belum ada aktivitas', '')) + '</section>';
    });
  }
})();
