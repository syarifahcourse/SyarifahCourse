/* ==================================================================
   API — fetch ke GAS (text/plain, tanpa preflight CORS), sesi, dedupe
   baca in-flight, penggabung batch otomatis, cache SWR, pengukur, warmup
   (skill gas-pro-api + gas-scale-turbo)
   ================================================================== */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const URL_API = CFG.GAS_URL || '';
  const konfigValid = () => !!URL_API && !/GANTI|XXXX/.test(URL_API);

  // ---------- Sesi (token dikirim di BODY POST, bukan query string) ----------
  const KS = 'sc_sesi';
  const Sesi = {
    _c: null,
    baca() {
      if (this._c) return this._c;
      try { this._c = JSON.parse(localStorage.getItem(KS) || sessionStorage.getItem(KS) || 'null'); } catch (e) { this._c = null; }
      return this._c;
    },
    simpan(token, me, ingat) {
      this._c = { token, me, ingat: !!ingat, t: Date.now() };
      try {
        localStorage.removeItem(KS); sessionStorage.removeItem(KS);
        (ingat ? localStorage : sessionStorage).setItem(KS, JSON.stringify(this._c));
      } catch (e) { /* mode privat: sesi hanya di memori */ }
    },
    perbaruiToken(token) { const s = this.baca(); if (s) this.simpan(token, s.me, s.ingat); },
    perbaruiMe(patch) { const s = this.baca(); if (s) { Object.assign(s.me, patch); this.simpan(s.token, s.me, s.ingat); } },
    token() { const s = this.baca(); return s ? s.token : ''; },
    me() { const s = this.baca(); return s ? s.me : null; },
    hapus() { this._c = null; try { localStorage.removeItem(KS); sessionStorage.removeItem(KS); } catch (e) { /* */ } Cache.hapusSemua(); }
  };

  // ---------- Pengukur performa: Perf.table() di console ----------
  const log = [];
  const Perf = {
    table() { console.table(log.slice(-40)); },
    summary() {
      const g = {}; log.forEach((r) => { (g[r.aksi] = g[r.aksi] || []).push(r); });
      console.table(Object.keys(g).map((k) => ({ aksi: k, n: g[k].length, rataTotal: Math.round(g[k].reduce((a, b) => a + b.total, 0) / g[k].length), rataServer: Math.round(g[k].reduce((a, b) => a + (b.server || 0), 0) / g[k].length) })));
    }
  };
  window.Perf = Perf;

  // ---------- Inti fetch ----------
  const BACA = /^(app\.publik|auth\.saya|siswa\.boot|materi\.(saya|list)|latihan\.(saya|ambil|list|detail)|hasil\.detail|nilai\.(saya|ringkasan)|jadwal\.(saya|list)|profil\.saya|guru\.dashboard|master\.list|siswa\.list|hadir\.ambil|laporan\.data|bayar\.list|import\.baca|audit\.list|batch)$/;
  let epochTulis = 0;
  const inflight = {};
  let onAuthHilang = null;

  async function jalankan(action, data, opt) {
    const t0 = performance.now();
    let res;
    try {
      const ctrl = new AbortController(), batas = setTimeout(() => ctrl.abort(), (opt && opt.timeout) || 60000);
      const r = await fetch(URL_API, {
        method: 'POST', redirect: 'follow', signal: ctrl.signal,
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },        // WAJIB text/plain → tanpa preflight CORS
        body: JSON.stringify({ action, token: Sesi.token(), data: data || {} })
      });
      clearTimeout(batas);
      const teks = await r.text();
      try { res = JSON.parse(teks); }
      catch (e) { res = { success: false, code: 'NET', message: /<html/i.test(teks) ? 'Server belum siap. Pastikan Web App sudah di-deploy dengan akses "Anyone".' : 'Respons server tidak valid.' }; }
    } catch (e) {
      res = { success: false, code: 'NET', message: e.name === 'AbortError' ? 'Server terlalu lama merespons. Coba lagi.' : 'Tidak dapat terhubung ke server. Periksa koneksi internet Anda.' };
    }
    log.push({ aksi: action, total: Math.round(performance.now() - t0), server: res.ms, cache: !!res.cached });
    if (log.length > 200) log.shift();
    if (res.code === 'AUTH' && action !== 'auth.login' && onAuthHilang) onAuthHilang(res.message);
    return res;
  }
  /** Panggil aksi. Aksi baca identik yang sedang berjalan ditumpangi; aksi tulis menaikkan epoch. */
  function api(action, data, opt) {
    if (!BACA.test(action)) { epochTulis++; return jalankan(action, data, opt); }
    const k = epochTulis + '|' + action + '|' + JSON.stringify(data || {});
    if (inflight[k]) return inflight[k];
    const p = jalankan(action, data, opt);
    inflight[k] = p;
    p.then(() => delete inflight[k], () => delete inflight[k]);
    return p;
  }

  // ---------- Penggabung batch: beberapa aksi baca dalam satu tik → 1 eksekusi ----------
  let antre = null;
  function apiQ(action, data) {
    return new Promise((res) => {
      if (!antre) { antre = []; setTimeout(kirimAntre, 0); }
      antre.push({ action, data: data || {}, res });
    });
  }
  async function kirimAntre() {
    const q = antre; antre = null;
    const kelompok = {}, unik = [];
    q.forEach((it) => { const k = it.action + '|' + JSON.stringify(it.data); if (kelompok[k]) kelompok[k].push(it); else { kelompok[k] = [it]; unik.push(it); } });
    for (let i = 0; i < unik.length; i += 10) {
      const potong = unik.slice(i, i + 10);
      if (potong.length === 1) {
        const r = await api(potong[0].action, potong[0].data);
        kelompok[potong[0].action + '|' + JSON.stringify(potong[0].data)].forEach((it) => it.res(r));
        continue;
      }
      const r = await api('batch', { calls: potong.map((p) => ({ action: p.action, data: p.data })) });
      potong.forEach((p, j) => {
        const hasil = r.success ? r.data.results[j] : r;
        if (hasil && hasil.code === 'AUTH' && onAuthHilang) onAuthHilang(hasil.message);
        kelompok[p.action + '|' + JSON.stringify(p.data)].forEach((it) => it.res(hasil));
      });
    }
  }

  // ---------- Cache lokal (stale-while-revalidate) ----------
  const PREF = 'scc:';
  let basiSebelum = 0;
  const Cache = {
    kunci(action, data) { const me = Sesi.me(); return PREF + (me ? me.id : 'anon') + ':' + action + ':' + JSON.stringify(data || {}); },
    get(action, data) { try { const v = localStorage.getItem(this.kunci(action, data)); return v ? JSON.parse(v) : null; } catch (e) { return null; } },
    set(action, data, val) {
      try { localStorage.setItem(this.kunci(action, data), JSON.stringify({ t: Date.now(), d: val })); }
      catch (e) { this.hapusSemua(); }                    // penyimpanan penuh → kosongkan cache
    },
    tandaiBasi() { basiSebelum = Date.now(); },
    hapusSemua() { try { Object.keys(localStorage).forEach((k) => { if (k.indexOf(PREF) === 0) localStorage.removeItem(k); }); } catch (e) { /* */ } }
  };
  const sidik = (o) => { const s = JSON.stringify(o); let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; };

  /**
   * Muat data: tampilkan cache dulu (instan), lalu segarkan dari server bila sudah lewat umur.
   * render(data, dariCache, error)
   */
  async function muat(action, data, render, opt) {
    opt = opt || {};
    const c = opt.paksa ? null : Cache.get(action, data);
    if (c) render(c.d, true, null);
    const segar = c && (Date.now() - c.t < (opt.umur || 30000)) && c.t > basiSebelum;
    if (segar) return c.d;
    const r = await apiQ(action, data);
    if (r.success) {
      Cache.set(action, data, r.data);
      if (!c || sidik(c.d) !== sidik(r.data)) render(r.data, false, null);
      return r.data;
    }
    if (r.code === 'AUTH') return null;
    if (!c) render(null, false, r);
    else if (r.code === 'NET') UI.toast('Menampilkan data tersimpan — ' + r.message, 'warning');
    return null;
  }
  /** Panggil aksi tulis lalu tandai cache basi agar layar berikutnya mengambil data baru. */
  async function tulis(action, data, opt) {
    const r = await api(action, data, opt);
    if (r.success) Cache.tandaiBasi();
    return r;
  }

  // ---------- Warmup dari browser (maks 1x / 4 menit per lingkup) ----------
  function warmUp(scope) {
    if (!konfigValid()) return;
    try {
      const k = 'scw_' + scope, t = +sessionStorage.getItem(k) || 0;
      if (Date.now() - t < 240000) return;
      sessionStorage.setItem(k, String(Date.now()));
    } catch (e) { /* */ }
    fetch(URL_API + (URL_API.indexOf('?') > -1 ? '&' : '?') + 'w=' + scope, { mode: 'no-cors' }).catch(() => {});
  }

  window.API = { api, apiQ, muat, tulis, Sesi, Cache, warmUp, konfigValid, setOnAuthHilang: (fn) => { onAuthHilang = fn; } };
})();
