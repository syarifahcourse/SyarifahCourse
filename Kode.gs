/**
 * ==================================================================
 *  SYARIFAH COURSE — Backend REST API (Google Apps Script)
 *  Versi 1.0.0
 * ==================================================================
 *  Arsitektur : GAS sebagai REST API murni (JSON via doGet/doPost).
 *               Frontend statis di GitHub Pages memanggil lewat fetch().
 *  Keamanan   : semua rahasia & ID di Script Properties, sandi = hash
 *               iteratif + salt + pepper, sesi = token HMAC tanpa state.
 *  Performa   : cache berversi per sheet (CacheX berpotongan), endpoint
 *               batch, warmup, tulis blok, lock pendek.
 *  Migrasi    : modul Import Data (pindai dulu, aman diulang, membaca
 *               berdasarkan NAMA kolom, sumber hanya dibaca).
 * ------------------------------------------------------------------
 *  Fungsi yang dijalankan MANUAL dari editor Apps Script:
 *    setupAppEnvironment()  → sekali saat instalasi (aman diulang)
 *    isiDataContoh()        → opsional, data contoh untuk uji coba
 *    cekPerforma()          → status cache, trigger, Script Properties
 *    resetSandiAdmin()      → bila admin pertama lupa kata sandi
 *    resetAksesDarurat()    → buat ulang kredensial akses darurat
 *    rotasiSecretSesi()     → keluarkan semua pengguna dari aplikasi
 *    nyalakanKeepWarm() / matikanKeepWarm()
 * ==================================================================
 */

const APP_VERSION = '1.2.0';
const TZ = 'Asia/Jakarta';
const SESI_JAM = 12;               // sesi biasa
const SESI_INGAT_JAM = 24 * 7;     // "Ingat Sesi Saya"
const MAKS_FILE_MB = 10;           // batas berkas materi
const MAKS_LOGO_MB = 2;            // batas logo
const CACHE_TTL = 900;             // 15 menit — data tabel di cache

const PUB = 'PUB';
const R_SISWA = ['siswa'];
const R_GURU = ['guru', 'admin', 'superadmin'];
const R_ADMIN = ['admin', 'superadmin'];
const R_SEMUA = ['siswa', 'guru', 'admin', 'superadmin'];

/** Skema database. Kolom baru boleh ditambah di akhir; setup menambahkannya otomatis. */
const SKEMA = {
  AppConfig:    ['Kunci', 'Nilai', 'Keterangan'],
  Pengaturan:   ['Kunci', 'Nilai'],
  Pengguna:     ['ID', 'Peran', 'Username', 'Nama', 'Email', 'Hash', 'Salt', 'Aktif', 'Wajib_Ganti_Sandi', 'Dibuat', 'Login_Terakhir'],
  Siswa:        ['ID_Siswa', 'Nama', 'Kelas_ID', 'No_HP', 'Email', 'Tgl_Lahir', 'Alamat', 'Nama_Wali', 'HP_Wali', 'Hubungan_Wali', 'Status', 'Tgl_Daftar', 'Catatan_Guru', 'Catatan_Oleh', 'Catatan_Tgl'],
  Kelas:        ['ID_Kelas', 'Nama_Kelas', 'Jenjang', 'Keterangan'],
  Mapel:        ['ID_Mapel', 'Nama_Mapel', 'Label'],
  Jadwal:       ['ID', 'Kelas_ID', 'Mapel_ID', 'Tanggal', 'Jam_Mulai', 'Jam_Selesai', 'Ruang', 'Tutor', 'Catatan'],
  Kehadiran:    ['ID', 'Tanggal', 'Kelas_ID', 'Siswa_ID', 'Status', 'Keterangan', 'Jadwal_ID', 'Dicatat_Oleh', 'Waktu'],
  Pembayaran:   ['ID', 'Siswa_ID', 'Periode', 'Jumlah', 'Jatuh_Tempo', 'Status', 'Tgl_Bayar', 'Catatan', 'Minggu_Mulai'],   // tagihan per minggu (Senin–Minggu)
  Materi:       ['ID', 'Judul', 'Mapel_ID', 'Kelas_ID', 'Bab', 'Deskripsi', 'Tag', 'File_ID', 'Nama_File', 'Ukuran', 'Halaman', 'Diunggah_Oleh', 'Tanggal'],
  Materi_Akses: ['Siswa_ID', 'Materi_ID', 'Pertama', 'Terakhir', 'Diunduh'],
  Latihan:      ['ID', 'Judul', 'Mapel_ID', 'Kelas_ID', 'Bab', 'Durasi_Menit', 'KKM', 'Status', 'Dibuat_Oleh', 'Dibuat', 'Diubah'],
  Soal:         ['ID', 'Latihan_ID', 'No', 'Pertanyaan', 'Opsi_A', 'Opsi_B', 'Opsi_C', 'Opsi_D', 'Kunci', 'Bobot', 'Pembahasan'],
  Hasil:        ['ID', 'Latihan_ID', 'Siswa_ID', 'Skor', 'Benar', 'Salah', 'Kosong', 'Durasi_Detik', 'Jawaban', 'Waktu'],
  Audit_Log:    ['Waktu', 'Pengguna', 'Aksi', 'Entitas', 'Detail']
};
const SEMUA_TABEL = Object.keys(SKEMA).filter(function (n) { return n !== 'AppConfig' && n !== 'Audit_Log'; });

const PENGATURAN_DEFAULT = {
  nama_app: 'Syarifah Course',
  tagline: 'Bimbingan Belajar Digital',
  warna_utama: '#2563EB',
  warna_aksen: '#16A34A',
  warna_gelap: '#0B1F3A',
  logo_file_id: '',
  kkm: '75',
  target_siswa: '150',
  tahun_ajaran: '',
  kontak_admin: ''
};
const PENGATURAN_PUBLIK = ['nama_app', 'tagline', 'warna_utama', 'warna_aksen', 'warna_gelap', 'logo_file_id', 'kontak_admin', 'tahun_ajaran', 'kkm'];

// ==================================================================
// 1. SCRIPT PROPERTIES — satu pintu (skill gas-rahasia-script-properties)
// ==================================================================
const PROPS = PropertiesService.getScriptProperties();
let _PROP_MEMO = null;
function prop_(key, def) {
  if (!_PROP_MEMO) _PROP_MEMO = PROPS.getProperties();
  const v = _PROP_MEMO[key];
  return v === undefined || v === null || v === '' ? (def === undefined ? '' : def) : v;
}
function setProp_(key, val) { PROPS.setProperty(key, String(val)); if (_PROP_MEMO) _PROP_MEMO[key] = String(val); }
function setProps_(obj) { PROPS.setProperties(obj); if (_PROP_MEMO) Object.keys(obj).forEach(function (k) { _PROP_MEMO[k] = String(obj[k]); }); }
function delProp_(key) { PROPS.deleteProperty(key); if (_PROP_MEMO) delete _PROP_MEMO[key]; }

// ==================================================================
// 2. KRIPTO — acak kuat, hash sandi, perbandingan aman, token sesi
// ==================================================================
function acak_(n, huruf) {
  huruf = huruf || 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  while (s.length < n) {
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, Utilities.getUuid())
      .forEach(function (b) { if (s.length < n) s += huruf[(b & 0xff) % huruf.length]; });
  }
  return s;
}
function sandiAcak_(n) {
  const s = acak_(n || 10, 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789');
  return /\d/.test(s) && /[A-Za-z]/.test(s) ? s : sandiAcak_(n);
}
function pepper_() {
  let p = prop_('PASSWORD_PEPPER');
  if (!p) { p = acak_(48); setProp_('PASSWORD_PEPPER', p); }
  return p;
}
/** HMAC-SHA256 iteratif (sengaja lambat). Pepper di Script Properties → sheet bocor saja tidak cukup untuk menebak sandi. */
function hashPass_(pass, salt) {
  const kunci = salt + pepper_();
  let h = String(pass);
  for (let i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeHmacSha256Signature(h + salt, kunci));
  return h;
}
function hashDarurat_(pass, salt) {
  let h = String(pass);
  for (let i = 0; i < 300; i++) h = Utilities.base64Encode(Utilities.computeHmacSha256Signature(h + salt, salt));
  return h;
}
function samaAman_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function samarkan_(v) { v = String(v || ''); return !v ? '' : v.length <= 8 ? '••••••' : v.slice(0, 4) + '••••••' + v.slice(-3); }

function secret_() {
  let s = prop_('SESSION_SECRET');
  if (!s) { s = acak_(64); setProp_('SESSION_SECRET', s); }
  return s;
}
function hmac_(s) { return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature(s, secret_())).replace(/=+$/, ''); }
function signToken_(p) {
  const body = Utilities.base64EncodeWebSafe(Utilities.newBlob(JSON.stringify(p)).getBytes()).replace(/=+$/, '');
  return body + '.' + hmac_(body);
}
function buatSesi_(id, role, nama, ingat, darurat) {
  const now = Date.now(), jam = ingat ? SESI_INGAT_JAM : SESI_JAM;
  return signToken_({ e: id, r: role, n: nama || '', i: now, x: now + jam * 3600e3, d: darurat ? 1 : 0 });
}
function verifyToken_(t) {
  try {
    const parts = String(t || '').split('.');
    if (parts.length !== 2 || !samaAman_(hmac_(parts[0]), parts[1])) return null;
    let b = parts[0]; while (b.length % 4) b += '=';
    const p = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(b)).getDataAsString());
    if (!p.x || p.x < Date.now()) return null;
    const rev = Number(CacheService.getScriptCache().get('rev_' + p.e) || prop_('REV_' + p.e) || 0);
    if (p.i < rev) return null;                         // dicabut (ganti sandi / keluar semua perangkat)
    return { id: p.e, role: p.r, nama: p.n || '', exp: p.x, darurat: !!p.d };
  } catch (e) { return null; }
}
function revokeAll_(id) {
  const t = String(Date.now());
  setProp_('REV_' + id, t);
  CacheService.getScriptCache().put('rev_' + id, t, 21600);
}

// ==================================================================
// 3. CACHE — CacheX berpotongan + versi per lingkup (skill gas-scale-turbo)
// ==================================================================
const CacheX = {
  SZ: 90000,
  c: function () { return CacheService.getScriptCache(); },
  get: function (key) {
    try {
      const c = this.c(), head = c.get(key);
      if (head == null) return null;
      if (head.indexOf('__chunks:') !== 0) return JSON.parse(head);
      const n = +head.slice(9), keys = [];
      for (let i = 0; i < n; i++) keys.push(key + '#' + i);
      const parts = c.getAll(keys); let s = '';
      for (let i = 0; i < n; i++) { if (parts[keys[i]] == null) return null; s += parts[keys[i]]; }
      return JSON.parse(s);
    } catch (e) { return null; }
  },
  put: function (key, val, ttl) {
    try {
      const s = JSON.stringify(val), c = this.c();
      if (s.length <= this.SZ) { c.put(key, s, ttl); return true; }
      const n = Math.ceil(s.length / this.SZ); if (n > 10) return false;   // > ±900 KB → baca dari Sheets
      const m = {}; for (let i = 0; i < n; i++) m[key + '#' + i] = s.substr(i * this.SZ, this.SZ);
      c.putAll(m, ttl); c.put(key, '__chunks:' + n, ttl);                 // kepala ditulis TERAKHIR
      return true;
    } catch (e) { return false; }
  }
};

let _VER = null;
function muatVersi_() {
  if (_VER) return _VER;
  const c = CacheService.getScriptCache();
  const keys = SEMUA_TABEL.map(function (n) { return 'ver_t_' + n; }).concat(['ver_adm']);
  const got = c.getAll(keys), baru = {};
  _VER = {};
  keys.forEach(function (k) {
    let v = got[k];
    if (!v) { v = String(Date.now()) + Math.floor(Math.random() * 1000); baru[k] = v; }
    _VER[k.slice(4)] = v;
  });
  if (Object.keys(baru).length) c.putAll(baru, 21600);
  return _VER;
}
function ver_(scope) { return muatVersi_()[scope] || '0'; }
function bump_(scope) {
  const v = String(Date.now()) + Math.floor(Math.random() * 1000);
  CacheService.getScriptCache().put('ver_' + scope, v, 21600);
  muatVersi_()[scope] = v;
}
function bumpTabel_(name) { bump_('t_' + name); bump_('adm'); delete _TB[name]; }

/** Cache hasil hitungan berat (dashboard/laporan) — kunci memuat versi tabel yang dipakai. */
function hitungCache_(nama, tabel, param, ttl, fn) {
  const v = tabel.map(function (t) { return ver_('t_' + t); }).join('.');
  const key = 'hc_' + nama + '_' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, v + '|' + JSON.stringify(param || {}))).slice(0, 22);
  const hit = CacheX.get(key);
  if (hit) return hit;
  const res = fn();
  CacheX.put(key, res, ttl || 600);
  return res;
}

// ==================================================================
// 4. DATA LAYER — baca dari cache, tulis blok di bawah lock pendek
// ==================================================================
let _SS = null, _TB = {}, _LOCK_DEPTH = 0, _AUDIT = [];
function ss_() {
  if (_SS) return _SS;
  const id = prop_('SPREADSHEET_ID');
  if (!id) throw new Error('Aplikasi belum disiapkan. Jalankan setupAppEnvironment() di editor Apps Script.');
  _SS = SpreadsheetApp.openById(id);
  return _SS;
}
function sheet_(name) {
  const s = ss_().getSheetByName(name);
  if (!s) throw new Error('Sheet "' + name + '" tidak ditemukan. Jalankan setupAppEnvironment() sekali lagi.');
  return s;
}
function sel_(v, kolom) {
  if (v === null || v === undefined) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') {
    if (isNaN(v.getTime())) return '';
    if (/^(Tanggal|Tgl_|Jatuh_Tempo|Minggu_Mulai)/.test(kolom)) return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
    if (/^Jam_/.test(kolom)) return Utilities.formatDate(v, TZ, 'HH:mm');
    return v.toISOString();
  }
  return typeof v === 'string' ? v.trim() : String(v);
}
function bacaLangsung_(name) {
  const sh = sheet_(name), vals = sh.getDataRange().getValues();
  const head = (vals[0] || []).map(String);
  const rows = [];
  for (let r = 1; r < vals.length; r++) {
    const row = vals[r];
    if (row.join('') === '') continue;
    const o = { _r: r + 1 };
    head.forEach(function (h, i) { if (h) o[h] = sel_(row[i], h); });
    rows.push(o);
  }
  return { sh: sh, head: head, vals: vals, rows: rows };
}
/** Baca tabel (cache berversi → Sheets). Hanya untuk BACA. Untuk tulis pakai segar_(). */
function tabel_(name) {
  if (_TB[name]) return _TB[name];
  const key = 'tb_' + name + '_' + ver_('t_' + name);
  let t = CacheX.get(key);
  if (!t) {
    const d = bacaLangsung_(name);
    t = { head: d.head, rows: d.rows };
    CacheX.put(key, t, CACHE_TTL);
  }
  _TB[name] = t;
  return t;
}
function rows_(name) { return tabel_(name).rows; }
function peta_(rows, key) { const m = {}; rows.forEach(function (r) { m[r[key]] = r; }); return m; }

function denganKunci_(fn) {
  if (_LOCK_DEPTH > 0) return fn();                    // sudah di dalam lock (non-reentrant aman)
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw new Error('Server sedang sibuk. Coba lagi beberapa detik lagi.');
  _LOCK_DEPTH++;
  try { return fn(); } finally { _LOCK_DEPTH--; lock.releaseLock(); }
}
/** Baca langsung dari Sheets untuk diubah (dipanggil di dalam lock). */
function segar_(name) { return bacaLangsung_(name); }

function barisKe_(head, o) { return head.map(function (h) { return o[h] === undefined || o[h] === null ? '' : o[h]; }); }
function tulisRentang_(sh, r, rowsVals, nCol) {
  const need = r + rowsVals.length - 1;
  if (need > sh.getMaxRows()) sh.insertRowsAfter(sh.getMaxRows(), need - sh.getMaxRows() + 50);
  const rg = sh.getRange(r, 1, rowsVals.length, nCol);
  rg.setNumberFormat('@');
  rg.setValues(rowsVals);
}
/** Tambah banyak baris sekaligus (1× tulis). */
function tambah_(name, objs) {
  if (!objs.length) return;
  const sh = sheet_(name), head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  tulisRentang_(sh, sh.getLastRow() + 1, objs.map(function (o) { return barisKe_(head, o); }), head.length);
  bumpTabel_(name);
}
/** Tulis ulang baris-baris yang berubah (blok minRow..maxRow saja). t = hasil segar_(). */
function simpanUbah_(name, t, ubah) {
  if (!ubah.length) return;
  let min = Infinity, max = 0;
  ubah.forEach(function (o) {
    t.vals[o._r - 1] = barisKe_(t.head, o);
    min = Math.min(min, o._r); max = Math.max(max, o._r);
  });
  const blok = t.vals.slice(min - 1, max).map(function (row) {
    const r = row.slice(0, t.head.length); while (r.length < t.head.length) r.push(''); return r;
  });
  tulisRentang_(t.sh, min, blok, t.head.length);
  bumpTabel_(name);
}
/** Hapus baris. Sedikit → deleteRow; banyak → tulis ulang sheet sekali. */
function hapusBaris_(name, t, nomorBaris) {
  if (!nomorBaris.length) return;
  const set = {}; nomorBaris.forEach(function (r) { set[r] = 1; });
  if (nomorBaris.length <= 5) {
    nomorBaris.slice().sort(function (a, b) { return b - a; }).forEach(function (r) { t.sh.deleteRow(r); });
  } else {
    const sisa = t.vals.filter(function (row, i) { return i === 0 || !set[i + 1]; });
    const total = t.vals.length;
    tulisRentang_(t.sh, 1, sisa, t.head.length);
    if (total > sisa.length) t.sh.getRange(sisa.length + 1, 1, total - sisa.length, t.head.length).clearContent();
  }
  bumpTabel_(name);
}

function audit_(ctx, aksi, entitas, detail) {
  const s = ctx && ctx.session;
  _AUDIT.push({ Waktu: new Date().toISOString(), Pengguna: s ? (s.username || s.id) : '-', Aksi: aksi, Entitas: entitas || '', Detail: String(detail || '').slice(0, 300) });
}
function flushAudit_() {
  if (!_AUDIT.length) return;
  try {
    const q = _AUDIT; _AUDIT = [];
    denganKunci_(function () {
      const sh = sheet_('Audit_Log'), head = SKEMA.Audit_Log;
      tulisRentang_(sh, sh.getLastRow() + 1, q.map(function (o) { return barisKe_(head, o); }), head.length);
    });
  } catch (e) { console.error('Audit gagal: ' + e.message); }
}

// ==================================================================
// 5. UTILITAS
// ==================================================================
function ok_(data, message) { const r = { success: true }; if (data !== undefined) r.data = data; if (message) r.message = message; return r; }
function fail_(message, extra) { const r = { success: false, message: message }; if (extra) Object.keys(extra).forEach(function (k) { r[k] = extra[k]; }); return r; }
function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
function teks_(v, maks) { return String(v === undefined || v === null ? '' : v).trim().slice(0, maks || 500); }
function idBaru_(prefix) { return prefix + '-' + Utilities.getUuid().replace(/-/g, '').slice(0, 8).toUpperCase(); }
function hariIni_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }
function tglGeser_(tgl, hari) {
  const p = tgl.split('-'); const d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + hari));
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2);
}
function tglValid_(v) { return /^\d{4}-\d{2}-\d{2}$/.test(String(v || '')); }
// ---- Siklus tagihan mingguan (Senin–Minggu) ----
const BLN_PENDEK = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const HARI_TEMPO_DEFAULT = 5;                           // jatuh tempo bawaan: Sabtu (Senin + 5 hari)
function seninDari_(tgl) {
  const p = tgl.split('-'), hari = (new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay() + 6) % 7;
  return tglGeser_(tgl, -hari);
}
/** "Minggu 16–22 Nov 2026" • "Minggu 30 Nov – 6 Des 2026" • "Minggu 28 Des 2026 – 3 Jan 2027" */
function labelMinggu_(senin) {
  const a = senin.split('-'), b = tglGeser_(senin, 6).split('-');
  const tg = function (x, th) { return (+x[2]) + ' ' + BLN_PENDEK[+x[1] - 1] + (th ? ' ' + x[0] : ''); };
  if (a[0] !== b[0]) return 'Minggu ' + tg(a, true) + ' – ' + tg(b, true);
  if (a[1] !== b[1]) return 'Minggu ' + tg(a) + ' – ' + tg(b, true);
  return 'Minggu ' + (+a[2]) + '–' + (+b[2]) + ' ' + BLN_PENDEK[+a[1] - 1] + ' ' + a[0];
}
/** Tambahkan kolom skema yang belum ada di akhir sheet (tanpa perlu menjalankan setup ulang). */
function pastikanKolom_(nama) {
  const sh = sheet_(nama), lastCol = sh.getLastColumn(), ada = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  const kurang = SKEMA[nama].filter(function (h) { return ada.indexOf(h) === -1; });
  if (!kurang.length) return;
  const mulai = ada.filter(String).length + 1;
  sh.getRange(1, mulai, sh.getMaxRows(), kurang.length).setNumberFormat('@');
  sh.getRange(1, mulai, 1, kurang.length).setValues([kurang]);
  sh.getRange(1, mulai, 1, kurang.length).setFontWeight('bold').setBackground('#0B1F3A').setFontColor('#FFFFFF');
  bumpTabel_(nama);
}
function jamValid_(v) { return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(v || '')); }
function hp_(v) {                                       // normalisasi nomor HP Indonesia (0 di depan hilang di Sheets)
  let s = String(v || '').replace(/[^\d+]/g, '');
  if (!s) return '';
  if (s.indexOf('+62') === 0) s = '0' + s.slice(3);
  else if (s.indexOf('62') === 0 && s.length > 10) s = '0' + s.slice(2);
  else if (s.charAt(0) === '8') s = '0' + s;
  return s;
}
function angka_(v) { const n = Number(String(v === undefined ? '' : v).replace(/[^\d.\-]/g, '')); return isNaN(n) ? 0 : n; }
function rata_(arr) { return arr.length ? arr.reduce(function (a, b) { return a + b; }, 0) / arr.length : null; }
function bulat_(n, d) { if (n === null || n === undefined) return null; const f = Math.pow(10, d || 0); return Math.round(n * f) / f; }
function hexValid_(v) { return /^#[0-9A-Fa-f]{6}$/.test(String(v || '')); }
function luminans_(hex) {
  const c = [1, 3, 5].map(function (i) { const v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function kontras_(a, b) { const l1 = luminans_(a), l2 = luminans_(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }
const POLA_RAHASIA = /(token|password|passwd|sandi|secret|rahasia|credential|api[_-]?key|hash|salt|base64|file)/i;
function redaksi_(o, d) {
  d = d || 0;
  if (o === null || typeof o !== 'object' || d > 4) return o;
  if (Array.isArray(o)) return o.length > 5 ? '[' + o.length + ' item]' : o.map(function (x) { return redaksi_(x, d + 1); });
  const out = {};
  Object.keys(o).forEach(function (k) { out[k] = POLA_RAHASIA.test(k) ? '[DISAMARKAN]' : redaksi_(o[k], d + 1); });
  return out;
}
function ringkasData_(d) { try { const s = JSON.stringify(redaksi_(d || {})); return s.length > 300 ? s.slice(0, 297) + '…' : s; } catch (e) { return ''; } }
function huruf_(skor) {
  if (skor === null) return { huruf: '-', label: 'Belum ada nilai' };
  if (skor >= 85) return { huruf: 'A', label: 'Sangat Baik' };
  if (skor >= 75) return { huruf: 'B', label: 'Baik' };
  if (skor >= 60) return { huruf: 'C', label: 'Cukup' };
  return { huruf: 'D', label: 'Perlu Bimbingan' };
}

function pengaturan_() {
  const o = {};
  Object.keys(PENGATURAN_DEFAULT).forEach(function (k) { o[k] = PENGATURAN_DEFAULT[k]; });
  rows_('Pengaturan').forEach(function (r) { if (r.Kunci && r.Nilai !== '') o[r.Kunci] = r.Nilai; });
  return o;
}
function pengaturanPublik_() {
  const p = pengaturan_(), o = {};
  PENGATURAN_PUBLIK.forEach(function (k) { o[k] = p[k]; });
  o.logo_url = p.logo_file_id ? 'https://drive.google.com/thumbnail?id=' + p.logo_file_id + '&sz=w400' : '';
  if (typeof demoInfo_ === 'function') { const di = demoInfo_(); if (di) o.demo = di; }   // versi demo saja
  return o;
}
function kkm_(latihan) { const k = angka_(latihan && latihan.KKM); return k > 0 ? k : angka_(pengaturan_().kkm) || 75; }

// ==================================================================
// 6. ENTRY POINTS
// ==================================================================
function doGet(e) {
  const t0 = Date.now();
  let res;
  try {
    const p = (e && e.parameter) || {};
    if (!p.w && !p.action && typeof halamanWeb_ === 'function') return halamanWeb_();   // versi demo: GAS menyajikan tampilan
    if (p.w) res = ok_({ warm: warmCaches_(p.w === 'guru' ? 'guru' : 'pub') });
    else if (p.action === 'app.publik') res = ok_(pengaturanPublik_());
    else res = ok_({ app: 'Syarifah Course API', versi: APP_VERSION, siap: !!prop_('SPREADSHEET_ID') });
  } catch (err) { res = fail_(pesanAman_(err)); }
  res.ms = Date.now() - t0; res.v = APP_VERSION;
  return out_(res);
}

function doPost(e) {
  const t0 = Date.now();
  let res, action = '';
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    action = String(body.action || '');
    res = dispatch_(action, body.token, body.data || {});
  } catch (err) {
    console.error(action + ': ' + err.message);
    res = fail_(pesanAman_(err));
  }
  flushAudit_();
  res.ms = Date.now() - t0; res.v = APP_VERSION;
  if (res.ms > 5000) console.warn('LAMBAT ' + action + ' ' + res.ms + ' ms');
  return out_(res);
}
function pesanAman_(err) {
  const m = String((err && err.message) || err || 'Terjadi kesalahan.');
  return POLA_RAHASIA.test(m) && /[A-Za-z0-9+/=]{24,}/.test(m) ? 'Terjadi kesalahan di server.' : m;
}

/** Peta rute: roles (siapa boleh), write (aksi tulis), audit (catat ke Audit_Log). */
const ROUTES = {
  // publik
  'app.publik':        { roles: PUB, fn: function () { return ok_(pengaturanPublik_()); } },
  'auth.login':        { roles: PUB, fn: apiLogin_, write: true },
  // semua peran
  'auth.saya':         { roles: R_SEMUA, fn: apiSaya_ },
  'auth.gantiSandi':   { roles: R_SEMUA, fn: apiGantiSandi_, write: true },
  'auth.keluarSemua':  { roles: R_SEMUA, fn: apiKeluarSemua_, write: true },
  // siswa
  'siswa.boot':        { roles: R_SISWA, fn: apiSiswaBoot_ },
  'materi.saya':       { roles: R_SISWA, fn: apiMateriSaya_ },
  'materi.buka':       { roles: R_SISWA, fn: apiMateriBuka_, write: true },
  'latihan.saya':      { roles: R_SISWA, fn: apiLatihanSaya_ },
  'latihan.ambil':     { roles: R_SISWA, fn: apiLatihanAmbil_ },
  'latihan.kirim':     { roles: R_SISWA, fn: apiLatihanKirim_, write: true },
  'hasil.detail':      { roles: R_SEMUA, fn: apiHasilDetail_ },
  'nilai.saya':        { roles: R_SISWA, fn: apiNilaiSaya_ },
  'jadwal.saya':       { roles: R_SISWA, fn: apiJadwalSaya_ },
  'profil.saya':       { roles: R_SISWA, fn: apiProfilSaya_ },
  'profil.simpan':     { roles: R_SISWA, fn: apiProfilSimpan_, write: true, audit: true },
  // guru
  'guru.dashboard':    { roles: R_GURU, fn: apiGuruDashboard_ },
  'master.list':       { roles: R_GURU, fn: apiMasterList_ },
  'siswa.list':        { roles: R_GURU, fn: apiSiswaList_ },
  'siswa.simpan':      { roles: R_GURU, fn: apiSiswaSimpan_, write: true, audit: true },
  'siswa.hapus':       { roles: R_GURU, fn: apiSiswaHapus_, write: true, audit: true },
  'siswa.resetSandi':  { roles: R_GURU, fn: apiSiswaResetSandi_, write: true },
  'kelas.simpan':      { roles: R_GURU, fn: apiKelasSimpan_, write: true, audit: true },
  'kelas.hapus':       { roles: R_GURU, fn: apiKelasHapus_, write: true, audit: true },
  'mapel.simpan':      { roles: R_GURU, fn: apiMapelSimpan_, write: true, audit: true },
  'mapel.hapus':       { roles: R_GURU, fn: apiMapelHapus_, write: true, audit: true },
  'hadir.ambil':       { roles: R_GURU, fn: apiHadirAmbil_ },
  'hadir.simpan':      { roles: R_GURU, fn: apiHadirSimpan_, write: true, audit: true },
  'materi.list':       { roles: R_GURU, fn: apiMateriList_ },
  'materi.unggah':     { roles: R_GURU, fn: apiMateriUnggah_, write: true, audit: true },
  'materi.ubah':       { roles: R_GURU, fn: apiMateriUbah_, write: true, audit: true },
  'materi.hapus':      { roles: R_GURU, fn: apiMateriHapus_, write: true, audit: true },
  'latihan.list':      { roles: R_GURU, fn: apiLatihanList_ },
  'latihan.detail':    { roles: R_GURU, fn: apiLatihanDetail_ },
  'latihan.simpan':    { roles: R_GURU, fn: apiLatihanSimpan_, write: true, audit: true },
  'latihan.hapus':     { roles: R_GURU, fn: apiLatihanHapus_, write: true, audit: true },
  'nilai.ringkasan':   { roles: R_GURU, fn: apiNilaiRingkasan_ },
  'laporan.data':      { roles: R_GURU, fn: apiLaporan_ },
  'jadwal.list':       { roles: R_GURU, fn: apiJadwalList_ },
  'jadwal.simpan':     { roles: R_GURU, fn: apiJadwalSimpan_, write: true, audit: true },
  'jadwal.hapus':      { roles: R_GURU, fn: apiJadwalHapus_, write: true, audit: true },
  'bayar.list':        { roles: R_GURU, fn: apiBayarList_ },
  'bayar.simpan':      { roles: R_GURU, fn: apiBayarSimpan_, write: true, audit: true },
  'bayar.massal':      { roles: R_GURU, fn: apiBayarMassal_, write: true, audit: true },
  'bayar.hapus':       { roles: R_GURU, fn: apiBayarHapus_, write: true, audit: true },
  'bayar.lunasBanyak': { roles: R_GURU, fn: apiBayarLunasBanyak_, write: true, audit: true },
  'sistem.segarkan':   { roles: R_GURU, fn: apiSegarkan_, write: true },
  // admin
  'pengaturan.simpan': { roles: R_ADMIN, fn: apiPengaturanSimpan_, write: true, audit: true },
  'logo.unggah':       { roles: R_ADMIN, fn: apiLogoUnggah_, write: true, audit: true },
  'guru.simpan':       { roles: R_ADMIN, fn: apiGuruSimpan_, write: true, audit: true },
  'guru.resetSandi':   { roles: R_ADMIN, fn: apiGuruResetSandi_, write: true },
  'import.baca':       { roles: R_ADMIN, fn: apiImportBaca_ },
  'import.jalankan':   { roles: R_ADMIN, fn: apiImportJalankan_, write: true },
  'audit.list':        { roles: R_ADMIN, fn: apiAuditList_ },
  // gabungan
  'batch':             { roles: R_SEMUA, fn: null }
};

function dispatch_(action, token, data) {
  const route = ROUTES[action];
  if (!route) return fail_('Aksi tidak dikenal: ' + action);
  const ctx = { session: null, token: token };
  if (route.roles !== PUB) {
    const s = sesi_(token);
    if (!s) return fail_('Sesi Anda berakhir. Silakan masuk lagi.', { code: 'AUTH' });
    if (route.roles.indexOf(s.role) === -1) return fail_('Anda tidak punya akses ke fitur ini.', { code: 'FORBIDDEN' });
    ctx.session = s;
  }
  if (typeof demoBlokir_ === 'function') { const blok = demoBlokir_(action, data || {}, ctx); if (blok) return blok; }   // versi demo saja
  if (action === 'batch') return apiBatch_(ctx, data);
  const res = route.fn(ctx, data || {}) || ok_();
  if (route.audit && res.success) audit_(ctx, action, res.auditEntitas || '', res.auditDetail || ringkasData_(data));
  delete res.auditEntitas; delete res.auditDetail;
  return res;
}

/** Maks. 10 aksi BACA dalam satu eksekusi; hak akses dicek per aksi. */
function apiBatch_(ctx, d) {
  const calls = (d && d.calls) || [];
  if (!Array.isArray(calls) || calls.length > 10) return fail_('Batch maksimal 10 aksi.');
  const hasil = calls.map(function (c) {
    const route = ROUTES[c.action];
    if (!route || route.write || c.action === 'batch') return fail_('Aksi tidak boleh di-batch: ' + c.action);
    if (route.roles !== PUB && route.roles.indexOf(ctx.session.role) === -1) return fail_('Anda tidak punya akses ke fitur ini.', { code: 'FORBIDDEN' });
    try { return route.fn(ctx, c.data || {}); } catch (e) { return fail_(pesanAman_(e)); }
  });
  return ok_({ results: hasil });
}

// ==================================================================
// 7. AUTENTIKASI
// ==================================================================
function penggunaById_(id) { return peta_(rows_('Pengguna'), 'ID')[id] || null; }
function siswaById_(id) { return peta_(rows_('Siswa'), 'ID_Siswa')[id] || null; }

function sesi_(token) {
  const p = verifyToken_(token);
  if (!p) return null;
  if (p.darurat) return { id: 'darurat', role: 'superadmin', nama: 'Akses Darurat', username: 'darurat', darurat: true };
  const u = penggunaById_(p.id);
  if (!u || u.Aktif !== 'Ya' || u.Peran !== p.role) return null;
  const s = { id: u.ID, role: u.Peran, nama: u.Nama, username: u.Username, email: u.Email };
  if (u.Peran === 'siswa') {
    const sw = siswaById_(u.Username);
    if (!sw || sw.Status === 'Nonaktif') return null;
    s.siswaId = sw.ID_Siswa; s.kelasId = sw.Kelas_ID; s.nama = sw.Nama;
  }
  return s;
}

function apiLogin_(ctx, d) {
  const peran = d.peran === 'guru' ? 'guru' : 'siswa';
  let user = teks_(d.username, 120);
  const pass = String(d.password || '');
  if (!user || !pass) return fail_('Isi ID/email dan kata sandi.');
  user = peran === 'guru' ? user.toLowerCase() : user.toUpperCase();

  const c = CacheService.getScriptCache(), kunciGagal = 'lg_' + peran + '_' + user;
  const terkunci = Number(c.get('lgk_' + peran + '_' + user) || 0);
  if (terkunci > Date.now()) return fail_('Terlalu banyak percobaan. Coba lagi ' + Math.ceil((terkunci - Date.now()) / 60000) + ' menit lagi.', { code: 'LOCKED' });

  const gagal = function () {
    const n = Number(c.get(kunciGagal) || 0) + 1;
    c.put(kunciGagal, String(n), 900);
    if (n >= 5) { c.put('lgk_' + peran + '_' + user, String(Date.now() + 15 * 60000), 900); c.remove(kunciGagal); }
    Utilities.sleep(400);
    return fail_((peran === 'guru' ? 'Email atau kata sandi salah.' : 'ID Siswa atau kata sandi salah.') + (n >= 3 && n < 5 ? ' Sisa percobaan: ' + (5 - n) + '.' : ''));
  };

  // Akses darurat (tab Guru, nama pengguna "darurat")
  if (peran === 'guru' && user === 'darurat') {
    const kunciD = Number(prop_('DARURAT_KUNCI_SAMPAI') || 0);
    if (kunciD > Date.now()) return fail_('Akses darurat dikunci sementara.', { code: 'LOCKED' });
    const h = prop_('EMERGENCY_PASS_HASH'), s = prop_('EMERGENCY_SALT');
    if (!h || !s || !samaAman_(hashDarurat_(pass, s), h)) {
      const n = Number(c.get('darurat_gagal') || 0) + 1;
      c.put('darurat_gagal', String(n), 900);
      if (n >= 5) { setProp_('DARURAT_KUNCI_SAMPAI', String(Date.now() + 15 * 60000)); c.remove('darurat_gagal'); }
      audit_({ session: { username: 'darurat' } }, 'LOGIN_DARURAT_GAGAL', 'Keamanan', 'Percobaan ke-' + n);
      Utilities.sleep(600);
      return fail_('Email atau kata sandi salah.');
    }
    c.remove('darurat_gagal');
    audit_({ session: { username: 'darurat' } }, 'LOGIN_DARURAT', 'Keamanan', 'Akses darurat dipakai');
    return ok_({ token: buatSesi_('darurat', 'superadmin', 'Akses Darurat', false, true), me: { id: 'darurat', peran: 'superadmin', nama: 'Akses Darurat', darurat: true } });
  }

  const u = rows_('Pengguna').filter(function (r) {
    return r.Username === user && (peran === 'siswa' ? r.Peran === 'siswa' : r.Peran !== 'siswa');
  })[0];
  if (!u || !u.Hash || !samaAman_(hashPass_(pass, u.Salt), u.Hash)) return gagal();
  if (u.Aktif !== 'Ya') return fail_('Akun Anda dinonaktifkan. Hubungi pengelola bimbel.');
  let nama = u.Nama;
  if (u.Peran === 'siswa') {
    const sw = siswaById_(u.Username);
    if (!sw || sw.Status === 'Nonaktif') return fail_('Akun siswa tidak aktif. Hubungi pengelola bimbel.');
    nama = sw.Nama;
  }
  c.remove(kunciGagal);
  catatLogin_(u.ID);
  audit_({ session: { username: u.Username } }, 'LOGIN', 'Pengguna:' + u.ID, u.Peran);
  return ok_({
    token: buatSesi_(u.ID, u.Peran, nama, !!d.ingat, false),
    me: { id: u.ID, peran: u.Peran, nama: nama, username: u.Username, wajibGanti: u.Wajib_Ganti_Sandi === 'Ya' }
  });
}
function catatLogin_(id) {
  try {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(3000)) return;                    // bukan data penting — lewati bila sibuk
    try {
      const t = segar_('Pengguna'), u = t.rows.filter(function (r) { return r.ID === id; })[0];
      if (!u) return;
      const col = t.head.indexOf('Login_Terakhir') + 1;
      t.sh.getRange(u._r, col).setNumberFormat('@').setValue(new Date().toISOString());
      // sengaja TIDAK bump cache: data ini tidak penting & login sering terjadi
    } finally { lock.releaseLock(); }
  } catch (e) { /* abaikan */ }
}
function apiSaya_(ctx) {
  const s = ctx.session, u = s.darurat ? null : penggunaById_(s.id);
  return ok_({ id: s.id, peran: s.role, nama: s.nama, username: s.username, darurat: !!s.darurat, wajibGanti: !!(u && u.Wajib_Ganti_Sandi === 'Ya'), app: pengaturanPublik_() });
}
function cekSandiKuat_(p) {
  if (p.length < 8) return 'Kata sandi baru minimal 8 karakter.';
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Kata sandi baru harus berisi huruf dan angka.';
  return '';
}
function apiGantiSandi_(ctx, d) {
  const s = ctx.session, lama = String(d.lama || ''), baru = String(d.baru || '');
  const err = cekSandiKuat_(baru); if (err) return fail_(err);
  if (s.darurat) {
    if (!samaAman_(hashDarurat_(lama, prop_('EMERGENCY_SALT')), prop_('EMERGENCY_PASS_HASH'))) return fail_('Kata sandi lama salah.');
    if (baru.length < 12) return fail_('Sandi darurat minimal 12 karakter.');
    const salt = Utilities.getUuid();
    setProps_({ EMERGENCY_SALT: salt, EMERGENCY_PASS_HASH: hashDarurat_(baru, salt) });
    revokeAll_('darurat');
    audit_(ctx, 'GANTI_SANDI', 'Keamanan', 'Sandi darurat dirotasi');
    return ok_({ token: buatSesi_('darurat', 'superadmin', 'Akses Darurat', false, true) }, 'Kata sandi darurat diperbarui.');
  }
  return denganKunci_(function () {
    const t = segar_('Pengguna'), u = t.rows.filter(function (r) { return r.ID === s.id; })[0];
    if (!u) return fail_('Akun tidak ditemukan.');
    if (!samaAman_(hashPass_(lama, u.Salt), u.Hash)) return fail_('Kata sandi lama salah.');
    u.Salt = Utilities.getUuid(); u.Hash = hashPass_(baru, u.Salt); u.Wajib_Ganti_Sandi = 'Tidak';
    simpanUbah_('Pengguna', t, [u]);
    revokeAll_(u.ID);
    audit_(ctx, 'GANTI_SANDI', 'Pengguna:' + u.ID, 'Kata sandi diganti');
    return ok_({ token: buatSesi_(u.ID, u.Peran, s.nama, !!d.ingat, false) }, 'Kata sandi berhasil diganti.');
  });
}
function apiKeluarSemua_(ctx) {
  revokeAll_(ctx.session.id);
  audit_(ctx, 'KELUAR_SEMUA', 'Pengguna:' + ctx.session.id, 'Semua sesi dicabut');
  return ok_(null, 'Anda keluar dari semua perangkat.');
}

/** Buat akun login baru. Mengembalikan sandi awal (tampil sekali). Dipanggil di dalam lock. */
function buatPengguna_(peran, username, nama, email) {
  const sandi = sandiAcak_(peran === 'siswa' ? 8 : 12), salt = Utilities.getUuid();
  const u = {
    ID: idBaru_('U'), Peran: peran, Username: username, Nama: nama, Email: email || '',
    Hash: hashPass_(sandi, salt), Salt: salt, Aktif: 'Ya', Wajib_Ganti_Sandi: 'Ya',
    Dibuat: new Date().toISOString(), Login_Terakhir: ''
  };
  return { baris: u, sandi: sandi };
}

// ==================================================================
// 8. API SISWA
// ==================================================================
function untukKelas_(row, kelasId) { return row.Kelas_ID === kelasId || row.Kelas_ID === 'SEMUA' || !row.Kelas_ID; }
function materiKelas_(kelasId) { return rows_('Materi').filter(function (m) { return untukKelas_(m, kelasId); }); }
function latihanKelas_(kelasId) { return rows_('Latihan').filter(function (l) { return l.Status === 'Terbit' && untukKelas_(l, kelasId); }); }
function hasilSiswa_(siswaId) {
  return rows_('Hasil').filter(function (h) { return h.Siswa_ID === siswaId; })
    .sort(function (a, b) { return a.Waktu < b.Waktu ? -1 : 1; });
}
/** Nilai terakhir per latihan (untuk rata-rata & rapor). */
function terakhirPerLatihan_(hasil) { const m = {}; hasil.forEach(function (h) { m[h.Latihan_ID] = h; }); return m; }
function jumlahSoal_() { const m = {}; rows_('Soal').forEach(function (s) { m[s.Latihan_ID] = (m[s.Latihan_ID] || 0) + 1; }); return m; }
function namaGuru_() { const m = {}; rows_('Pengguna').forEach(function (u) { if (u.Peran !== 'siswa') m[u.ID] = u.Nama; }); return m; }

function apiSiswaBoot_(ctx) {
  const s = ctx.session, sw = siswaById_(s.siswaId), kelas = peta_(rows_('Kelas'), 'ID_Kelas')[sw.Kelas_ID];
  const mapel = peta_(rows_('Mapel'), 'ID_Mapel');
  const materi = materiKelas_(sw.Kelas_ID);
  const akses = rows_('Materi_Akses').filter(function (a) { return a.Siswa_ID === sw.ID_Siswa; });
  const dibuka = peta_(akses, 'Materi_ID');
  const latihan = latihanKelas_(sw.Kelas_ID), latMap = peta_(rows_('Latihan'), 'ID');
  const hasil = hasilSiswa_(sw.ID_Siswa), terakhir = terakhirPerLatihan_(hasil);
  const kini = hariIni_(), tujuhHari = tglGeser_(kini, -7);

  // progres per mapel (kartu "Kategori Kelas")
  const perMapel = {};
  materi.forEach(function (m) {
    const k = m.Mapel_ID || '-';
    perMapel[k] = perMapel[k] || { total: 0, selesai: 0 };
    perMapel[k].total++; if (dibuka[m.ID]) perMapel[k].selesai++;
  });
  latihan.forEach(function (l) { const k = l.Mapel_ID || '-'; perMapel[k] = perMapel[k] || { total: 0, selesai: 0 }; });
  const kartuMapel = Object.keys(perMapel).map(function (k) {
    const mp = mapel[k] || {}, v = perMapel[k];
    return { id: k, nama: mp.Nama_Mapel || 'Umum', label: mp.Label || '', total: v.total, selesai: v.selesai, persen: v.total ? Math.round(v.selesai / v.total * 100) : 0 };
  }).sort(function (a, b) { return b.total - a.total; });

  const selesai = materi.filter(function (m) { return dibuka[m.ID]; }).length;
  const aktivitas = [];
  hasil.slice(-4).forEach(function (h) {
    const l = latMap[h.Latihan_ID]; if (!l) return;
    const sk = angka_(h.Skor);
    aktivitas.push({ tipe: 'hasil', id: h.ID, judul: l.Judul, skor: sk, lulus: sk >= kkm_(l), waktu: h.Waktu });
  });
  const materiMap = peta_(materi, 'ID');
  akses.slice().sort(function (a, b) { return a.Terakhir < b.Terakhir ? 1 : -1; }).slice(0, 4).forEach(function (a) {
    const m = materiMap[a.Materi_ID]; if (!m) return;
    aktivitas.push({ tipe: 'materi', id: m.ID, judul: m.Nama_File || m.Judul, diunduh: a.Diunduh === 'Ya', ukuran: angka_(m.Ukuran), waktu: a.Terakhir });
  });
  aktivitas.sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; });

  return ok_({
    me: { id: sw.ID_Siswa, nama: sw.Nama, kelas: kelas ? kelas.Nama_Kelas : '-', kelasId: sw.Kelas_ID },
    app: pengaturanPublik_(),
    progres: { selesai: selesai, total: materi.length, persen: materi.length ? Math.round(selesai / materi.length * 100) : 0 },
    mapel: kartuMapel,
    badge: {
      materiBaru: materi.filter(function (m) { return !dibuka[m.ID] && String(m.Tanggal).slice(0, 10) >= tujuhHari; }).length,
      latihanBaru: latihan.filter(function (l) { return !terakhir[l.ID]; }).length
    },
    aktivitas: aktivitas.slice(0, 4),
    notif: notifSiswa_(sw)
  });
}

function notifSiswa_(sw) {
  const kini = hariIni_(), batasJadwal = tglGeser_(kini, 7), batasBaru = tglGeser_(kini, -14);
  const mapel = peta_(rows_('Mapel'), 'ID_Mapel'), out = [];
  rows_('Jadwal').forEach(function (j) {
    if (!untukKelas_(j, sw.Kelas_ID) || j.Tanggal < kini || j.Tanggal > batasJadwal) return;
    const mp = mapel[j.Mapel_ID] || {};
    out.push({ id: 'j_' + j.ID, kategori: 'jadwal', judul: 'Sesi Les ' + (mp.Nama_Mapel || 'Bimbel'),
      teks: (j.Catatan || 'Jangan lupa hadir tepat waktu.'), tanggal: j.Tanggal, jam: j.Jam_Mulai + (j.Jam_Selesai ? '–' + j.Jam_Selesai : ''),
      ruang: j.Ruang, tutor: j.Tutor, penting: j.Tanggal <= tglGeser_(kini, 1), urut: j.Tanggal + ' ' + j.Jam_Mulai });
  });
  rows_('Pembayaran').forEach(function (b) {
    if (b.Siswa_ID !== sw.ID_Siswa || b.Status === 'Lunas') return;
    out.push({ id: 'b_' + b.ID, kategori: 'pembayaran', judul: 'Tagihan ' + b.Periode, teks: b.Catatan || '',
      jumlah: angka_(b.Jumlah), jatuhTempo: b.Jatuh_Tempo, lewat: !!b.Jatuh_Tempo && b.Jatuh_Tempo < kini, penting: true, urut: b.Jatuh_Tempo || kini });
  });
  rows_('Materi').forEach(function (m) {
    if (!untukKelas_(m, sw.Kelas_ID) || String(m.Tanggal).slice(0, 10) < batasBaru) return;
    out.push({ id: 'm_' + m.ID, kategori: 'materi', judul: 'Materi baru: ' + m.Judul, teks: (mapel[m.Mapel_ID] || {}).Nama_Mapel || '', materiId: m.ID, urut: String(m.Tanggal).slice(0, 10) });
  });
  rows_('Latihan').forEach(function (l) {
    if (l.Status !== 'Terbit' || !untukKelas_(l, sw.Kelas_ID) || String(l.Diubah || l.Dibuat).slice(0, 10) < batasBaru) return;
    out.push({ id: 'l_' + l.ID, kategori: 'latihan', judul: 'Latihan baru: ' + l.Judul, teks: (mapel[l.Mapel_ID] || {}).Nama_Mapel || '', latihanId: l.ID, urut: String(l.Diubah || l.Dibuat).slice(0, 10) });
  });
  return out.sort(function (a, b) { return (b.penting ? 1 : 0) - (a.penting ? 1 : 0) || (a.urut < b.urut ? 1 : -1); }).slice(0, 30);
}

function apiMateriSaya_(ctx) {
  const sw = siswaById_(ctx.session.siswaId), mapel = peta_(rows_('Mapel'), 'ID_Mapel'), guru = namaGuru_();
  const akses = peta_(rows_('Materi_Akses').filter(function (a) { return a.Siswa_ID === sw.ID_Siswa; }), 'Materi_ID');
  const list = materiKelas_(sw.Kelas_ID).map(function (m) {
    const a = akses[m.ID];
    return {
      id: m.ID, judul: m.Judul, bab: m.Bab, deskripsi: m.Deskripsi, tag: m.Tag, fileId: m.File_ID, namaFile: m.Nama_File,
      ukuran: angka_(m.Ukuran), halaman: angka_(m.Halaman), tanggal: m.Tanggal, mapelId: m.Mapel_ID,
      mapel: (mapel[m.Mapel_ID] || {}).Nama_Mapel || 'Umum', label: (mapel[m.Mapel_ID] || {}).Label || '',
      guru: guru[m.Diunggah_Oleh] || '', status: a ? (a.Diunduh === 'Ya' ? 'diunduh' : 'dibuka') : 'baru'
    };
  }).sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; });
  return ok_({ materi: list });
}
function apiMateriBuka_(ctx, d) {
  const sw = siswaById_(ctx.session.siswaId), id = teks_(d.id, 40), unduh = !!d.unduh;
  const m = peta_(rows_('Materi'), 'ID')[id];
  if (!m || !untukKelas_(m, sw.Kelas_ID)) return fail_('Materi tidak ditemukan.');
  const now = new Date().toISOString();
  denganKunci_(function () {
    const t = segar_('Materi_Akses');
    const a = t.rows.filter(function (r) { return r.Siswa_ID === sw.ID_Siswa && r.Materi_ID === id; })[0];
    if (a) { a.Terakhir = now; if (unduh) a.Diunduh = 'Ya'; simpanUbah_('Materi_Akses', t, [a]); }
    else tambah_('Materi_Akses', [{ Siswa_ID: sw.ID_Siswa, Materi_ID: id, Pertama: now, Terakhir: now, Diunduh: unduh ? 'Ya' : 'Tidak' }]);
  });
  return ok_({ id: id, status: unduh ? 'diunduh' : 'dibuka' });
}

function apiLatihanSaya_(ctx) {
  const sw = siswaById_(ctx.session.siswaId), mapel = peta_(rows_('Mapel'), 'ID_Mapel'), nSoal = jumlahSoal_();
  const hasil = hasilSiswa_(sw.ID_Siswa), terakhir = terakhirPerLatihan_(hasil);
  const percobaan = {}; hasil.forEach(function (h) { percobaan[h.Latihan_ID] = (percobaan[h.Latihan_ID] || 0) + 1; });
  const list = latihanKelas_(sw.Kelas_ID).map(function (l) {
    const h = terakhir[l.ID], kkm = kkm_(l);
    return {
      id: l.ID, judul: l.Judul, bab: l.Bab, mapel: (mapel[l.Mapel_ID] || {}).Nama_Mapel || 'Umum', mapelId: l.Mapel_ID,
      durasi: angka_(l.Durasi_Menit), jumlahSoal: nSoal[l.ID] || 0, kkm: kkm, dibuat: l.Diubah || l.Dibuat,
      hasil: h ? { id: h.ID, skor: angka_(h.Skor), lulus: angka_(h.Skor) >= kkm, waktu: h.Waktu, percobaan: percobaan[l.ID] } : null
    };
  }).sort(function (a, b) { return (a.hasil ? 1 : 0) - (b.hasil ? 1 : 0) || (a.dibuat < b.dibuat ? 1 : -1); });
  return ok_({ latihan: list });
}
function apiLatihanAmbil_(ctx, d) {
  const sw = siswaById_(ctx.session.siswaId), id = teks_(d.id, 40);
  const l = peta_(rows_('Latihan'), 'ID')[id];
  if (!l || l.Status !== 'Terbit' || !untukKelas_(l, sw.Kelas_ID)) return fail_('Latihan tidak tersedia.');
  const mapel = peta_(rows_('Mapel'), 'ID_Mapel');
  const soal = rows_('Soal').filter(function (s) { return s.Latihan_ID === id; })
    .sort(function (a, b) { return angka_(a.No) - angka_(b.No); })
    .map(function (s) {      // KUNCI & PEMBAHASAN TIDAK dikirim sebelum jawaban dikumpulkan
      return { id: s.ID, no: angka_(s.No), pertanyaan: s.Pertanyaan, opsi: { A: s.Opsi_A, B: s.Opsi_B, C: s.Opsi_C, D: s.Opsi_D }, bobot: angka_(s.Bobot) || 1 };
    });
  return ok_({ id: l.ID, judul: l.Judul, bab: l.Bab, mapel: (mapel[l.Mapel_ID] || {}).Nama_Mapel || '', durasi: angka_(l.Durasi_Menit), kkm: kkm_(l), soal: soal });
}
function apiLatihanKirim_(ctx, d) {
  const sw = siswaById_(ctx.session.siswaId), id = teks_(d.id, 40), jaw = d.jawaban || {};
  const l = peta_(rows_('Latihan'), 'ID')[id];
  if (!l || l.Status !== 'Terbit' || !untukKelas_(l, sw.Kelas_ID)) return fail_('Latihan tidak tersedia.');
  const soal = rows_('Soal').filter(function (s) { return s.Latihan_ID === id; });
  if (!soal.length) return fail_('Latihan ini belum berisi soal.');
  let benar = 0, salah = 0, kosong = 0, poin = 0, total = 0;
  const simpanJaw = {};
  soal.forEach(function (s) {
    const b = angka_(s.Bobot) || 1, j = String(jaw[s.ID] || '').toUpperCase();
    total += b;
    if (!j) { kosong++; return; }
    simpanJaw[s.ID] = j.slice(0, 1);
    if (j === String(s.Kunci).toUpperCase()) { benar++; poin += b; } else salah++;
  });
  const skor = Math.round(poin / total * 100), kkm = kkm_(l);
  const h = { ID: idBaru_('H'), Latihan_ID: id, Siswa_ID: sw.ID_Siswa, Skor: String(skor), Benar: String(benar), Salah: String(salah),
    Kosong: String(kosong), Durasi_Detik: String(Math.max(0, Math.min(86400, Math.round(angka_(d.durasi))))), Jawaban: JSON.stringify(simpanJaw), Waktu: new Date().toISOString() };
  denganKunci_(function () { tambah_('Hasil', [h]); });
  audit_(ctx, 'latihan.kirim', 'Latihan:' + id, 'Skor ' + skor);
  return ok_({ hasilId: h.ID, skor: skor, benar: benar, salah: salah, kosong: kosong, kkm: kkm, lulus: skor >= kkm, total: soal.length });
}
function apiHasilDetail_(ctx, d) {
  const s = ctx.session, h = peta_(rows_('Hasil'), 'ID')[teks_(d.id, 40)];
  if (!h) return fail_('Hasil tidak ditemukan.');
  if (s.role === 'siswa' && h.Siswa_ID !== s.siswaId) return fail_('Anda tidak punya akses ke hasil ini.', { code: 'FORBIDDEN' });
  const l = peta_(rows_('Latihan'), 'ID')[h.Latihan_ID] || {};
  let jaw = {}; try { jaw = JSON.parse(h.Jawaban || '{}'); } catch (e) { jaw = {}; }
  const soal = rows_('Soal').filter(function (x) { return x.Latihan_ID === h.Latihan_ID; })
    .sort(function (a, b) { return angka_(a.No) - angka_(b.No); })
    .map(function (x) {
      return { id: x.ID, no: angka_(x.No), pertanyaan: x.Pertanyaan, opsi: { A: x.Opsi_A, B: x.Opsi_B, C: x.Opsi_C, D: x.Opsi_D },
        kunci: String(x.Kunci).toUpperCase(), jawaban: jaw[x.ID] || '', pembahasan: x.Pembahasan };
    });
  const sw = siswaById_(h.Siswa_ID) || {};
  return ok_({ id: h.ID, latihanId: h.Latihan_ID, judul: l.Judul || 'Latihan', siswa: sw.Nama || '', skor: angka_(h.Skor), benar: angka_(h.Benar), salah: angka_(h.Salah),
    kosong: angka_(h.Kosong), kkm: kkm_(l), waktu: h.Waktu, durasi: angka_(h.Durasi_Detik), soal: soal });
}

function rataSiswa_(siswaId, latMap) {
  const t = terakhirPerLatihan_(hasilSiswa_(siswaId));
  return rata_(Object.keys(t).filter(function (k) { return latMap[k]; }).map(function (k) { return angka_(t[k].Skor); }));
}
function ringkasHadir_(rows) {
  const r = { hadir: 0, izin: 0, alfa: 0, total: rows.length };
  rows.forEach(function (x) { if (x.Status === 'Hadir') r.hadir++; else if (x.Status === 'Izin') r.izin++; else if (x.Status === 'Alfa') r.alfa++; });
  r.persen = r.total ? bulat_(r.hadir / r.total * 100, 1) : null;
  r.label = r.persen === null ? 'Belum ada data' : r.persen >= 90 ? 'Rajin' : r.persen >= 75 ? 'Baik' : 'Perlu Perhatian';
  return r;
}
function apiNilaiSaya_(ctx) {
  const sw = siswaById_(ctx.session.siswaId), latMap = peta_(rows_('Latihan'), 'ID'), mapel = peta_(rows_('Mapel'), 'ID_Mapel');
  const hasil = hasilSiswa_(sw.ID_Siswa), terakhir = terakhirPerLatihan_(hasil);
  const daftar = Object.keys(terakhir).filter(function (k) { return latMap[k]; }).map(function (k) {
    const h = terakhir[k], l = latMap[k], sk = angka_(h.Skor);
    return { hasilId: h.ID, latihanId: k, judul: l.Judul, bab: l.Bab, mapel: (mapel[l.Mapel_ID] || {}).Nama_Mapel || 'Umum', mapelId: l.Mapel_ID,
      skor: sk, kkm: kkm_(l), lulus: sk >= kkm_(l), waktu: h.Waktu, durasi: angka_(h.Durasi_Detik), bisaUlang: l.Status === 'Terbit' };
  }).sort(function (a, b) { return a.waktu < b.waktu ? 1 : -1; });
  const rata = rata_(daftar.map(function (x) { return x.skor; }));

  // tren: rata-rata 30 hari terakhir dibanding 30 hari sebelumnya
  const kini = Date.now(), d30 = new Date(kini - 30 * 864e5).toISOString(), d60 = new Date(kini - 60 * 864e5).toISOString();
  const baru = rata_(hasil.filter(function (h) { return h.Waktu >= d30; }).map(function (h) { return angka_(h.Skor); }));
  const lama = rata_(hasil.filter(function (h) { return h.Waktu >= d60 && h.Waktu < d30; }).map(function (h) { return angka_(h.Skor); }));

  // peringkat di kelas (rata-rata nilai terakhir per latihan)
  const teman = rows_('Siswa').filter(function (x) { return x.Kelas_ID === sw.Kelas_ID && x.Status !== 'Nonaktif'; });
  const semuaHasil = rows_('Hasil'), perSiswa = {};
  semuaHasil.forEach(function (h) { if (latMap[h.Latihan_ID]) { (perSiswa[h.Siswa_ID] = perSiswa[h.Siswa_ID] || {})[h.Latihan_ID] = angka_(h.Skor); } });
  const rataTeman = teman.map(function (x) {
    const m = perSiswa[x.ID_Siswa]; return { id: x.ID_Siswa, r: m ? rata_(Object.keys(m).map(function (k) { return m[k]; })) : null };
  }).filter(function (x) { return x.r !== null; }).sort(function (a, b) { return b.r - a.r; });
  const pos = rataTeman.map(function (x) { return x.id; }).indexOf(sw.ID_Siswa);

  const tersedia = latihanKelas_(sw.Kelas_ID).length;
  const hadir = rows_('Kehadiran').filter(function (k) { return k.Siswa_ID === sw.ID_Siswa; })
    .sort(function (a, b) { return a.Tanggal < b.Tanggal ? 1 : -1; });
  const bulanIni = hariIni_().slice(0, 7);
  const jadwal = peta_(rows_('Jadwal'), 'ID');
  const log = hadir.slice(0, 6).map(function (k) {
    const j = jadwal[k.Jadwal_ID] || {}, mp = mapel[j.Mapel_ID] || {};
    return { tanggal: k.Tanggal, status: k.Status, keterangan: k.Keterangan, judul: mp.Nama_Mapel ? 'Sesi ' + mp.Nama_Mapel : 'Sesi Les', jam: j.Jam_Mulai || '' };
  });
  return ok_({
    me: { nama: sw.Nama, kelas: (peta_(rows_('Kelas'), 'ID_Kelas')[sw.Kelas_ID] || {}).Nama_Kelas || '-' },
    ringkasan: {
      rata: bulat_(rata, 1), grade: huruf_(rata === null ? null : rata), tren: baru !== null && lama !== null ? bulat_(baru - lama, 1) : null,
      selesai: daftar.length, tersedia: Math.max(tersedia, daftar.length), tuntas: daftar.filter(function (x) { return x.lulus; }).length,
      peringkat: pos >= 0 ? pos + 1 : null, jumlahKelas: teman.length
    },
    daftar: daftar,
    hadir: { bulanIni: ringkasHadir_(hadir.filter(function (k) { return k.Tanggal.slice(0, 7) === bulanIni; })), semua: ringkasHadir_(hadir), log: log },
    catatan: sw.Catatan_Guru ? { teks: sw.Catatan_Guru, oleh: sw.Catatan_Oleh, tanggal: sw.Catatan_Tgl } : null
  });
}
function apiJadwalSaya_(ctx) {
  const sw = siswaById_(ctx.session.siswaId), kini = hariIni_(), mapel = peta_(rows_('Mapel'), 'ID_Mapel');
  const dari = tglGeser_(kini, -14), sampai = tglGeser_(kini, 45);
  const hadirJ = {}, hadirT = {};
  rows_('Kehadiran').forEach(function (k) { if (k.Siswa_ID !== sw.ID_Siswa) return; if (k.Jadwal_ID) hadirJ[k.Jadwal_ID] = k; else hadirT[k.Tanggal] = k; });
  const jadwal = rows_('Jadwal').filter(function (j) { return untukKelas_(j, sw.Kelas_ID) && j.Tanggal >= dari && j.Tanggal <= sampai; })
    .map(function (j) {
      const mp = mapel[j.Mapel_ID] || {};
      return { id: j.ID, tanggal: j.Tanggal, mulai: j.Jam_Mulai, selesai: j.Jam_Selesai, ruang: j.Ruang, tutor: j.Tutor, catatan: j.Catatan,
        mapel: mp.Nama_Mapel || 'Sesi Les', label: mp.Label || '', status: (hadirJ[j.ID] || hadirT[j.Tanggal] || {}).Status || '' };
    }).sort(function (a, b) { return (a.tanggal + a.mulai) < (b.tanggal + b.mulai) ? -1 : 1; });
  const tagihan = rows_('Pembayaran').filter(function (b) { return b.Siswa_ID === sw.ID_Siswa; })
    .map(function (b) { return { id: b.ID, periode: b.Periode, minggu: b.Minggu_Mulai || '', jumlah: angka_(b.Jumlah), jatuhTempo: b.Jatuh_Tempo, status: b.Status, tglBayar: b.Tgl_Bayar, catatan: b.Catatan }; })
    .sort(function (a, b) { return (a.jatuhTempo || '') < (b.jatuhTempo || '') ? 1 : -1; });
  return ok_({ hariIni: kini, mingguIni: seninDari_(kini), jadwal: jadwal, tagihan: tagihan });
}
const PROFIL_KOLOM = ['Nama', 'No_HP', 'Email', 'Tgl_Lahir', 'Alamat', 'Nama_Wali', 'HP_Wali', 'Hubungan_Wali'];
function profilKeluar_(sw) {
  const kelas = peta_(rows_('Kelas'), 'ID_Kelas')[sw.Kelas_ID] || {};
  return { id: sw.ID_Siswa, nama: sw.Nama, kelas: kelas.Nama_Kelas || '-', noHp: hp_(sw.No_HP), email: sw.Email, tglLahir: sw.Tgl_Lahir, alamat: sw.Alamat,
    namaWali: sw.Nama_Wali, hpWali: hp_(sw.HP_Wali), hubunganWali: sw.Hubungan_Wali, status: sw.Status || 'Aktif', tglDaftar: sw.Tgl_Daftar };
}
function apiProfilSaya_(ctx) {
  const u = penggunaById_(ctx.session.id) || {};
  return ok_({ profil: profilKeluar_(siswaById_(ctx.session.siswaId)), wajibGanti: u.Wajib_Ganti_Sandi === 'Ya', loginTerakhir: u.Login_Terakhir });
}
function apiProfilSimpan_(ctx, d) {
  const p = d.profil || {};
  const nama = teks_(p.nama, 80);
  if (!nama) return fail_('Nama lengkap wajib diisi.');
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return fail_('Format email tidak valid.');
  if (p.tglLahir && !tglValid_(p.tglLahir)) return fail_('Format tanggal lahir tidak valid.');
  return denganKunci_(function () {
    const t = segar_('Siswa'), sw = t.rows.filter(function (r) { return r.ID_Siswa === ctx.session.siswaId; })[0];
    if (!sw) return fail_('Data siswa tidak ditemukan.');
    sw.Nama = nama; sw.No_HP = hp_(p.noHp); sw.Email = teks_(p.email, 120).toLowerCase(); sw.Tgl_Lahir = teks_(p.tglLahir, 10);
    sw.Alamat = teks_(p.alamat, 300); sw.Nama_Wali = teks_(p.namaWali, 80); sw.HP_Wali = hp_(p.hpWali); sw.Hubungan_Wali = teks_(p.hubunganWali, 30);
    simpanUbah_('Siswa', t, [sw]);
    const tu = segar_('Pengguna'), u = tu.rows.filter(function (r) { return r.ID === ctx.session.id; })[0];
    if (u && (u.Nama !== nama || u.Email !== sw.Email)) { u.Nama = nama; u.Email = sw.Email; simpanUbah_('Pengguna', tu, [u]); }
    const res = ok_({ profil: profilKeluar_(sw) }, 'Profil berhasil disimpan.');
    res.auditEntitas = 'Siswa:' + sw.ID_Siswa; res.auditDetail = 'Profil diperbarui oleh siswa';
    return res;
  });
}

// ==================================================================
// 9. API GURU — DASHBOARD & MASTER
// ==================================================================
function apiGuruDashboard_(ctx) {
  return ok_(hitungCache_('dash', ['Siswa', 'Kehadiran', 'Jadwal', 'Materi', 'Latihan', 'Hasil', 'Kelas', 'Mapel', 'Pengaturan', 'Pembayaran'], { d: hariIni_() }, 300, function () {
    const kini = hariIni_(), set = pengaturan_();
    const siswa = rows_('Siswa').filter(function (s) { return s.Status !== 'Nonaktif'; });
    const sMap = peta_(rows_('Siswa'), 'ID_Siswa'), kelas = peta_(rows_('Kelas'), 'ID_Kelas'), mapel = peta_(rows_('Mapel'), 'ID_Mapel');
    const hadir = rows_('Kehadiran'), latihan = rows_('Latihan'), latMap = peta_(latihan, 'ID'), hasil = rows_('Hasil');
    const hariIniRows = hadir.filter(function (k) { return k.Tanggal === kini; });
    const rhi = ringkasHadir_(hariIniRows);
    const awalBulan = kini.slice(0, 7) + '-01';
    const baruBulanIni = siswa.filter(function (s) { return String(s.Tgl_Daftar).slice(0, 10) >= awalBulan; }).length;

    const grafik = [];
    for (let i = 6; i >= 0; i--) {
      const tgl = tglGeser_(kini, -i), r = ringkasHadir_(hadir.filter(function (k) { return k.Tanggal === tgl; }));
      grafik.push({ tanggal: tgl, persen: r.persen, hadir: r.hadir, total: r.total });
    }
    const materi = rows_('Materi').slice().sort(function (a, b) { return a.Tanggal < b.Tanggal ? 1 : -1; });
    const perKelas = {}; siswa.forEach(function (s) { perKelas[s.Kelas_ID] = (perKelas[s.Kelas_ID] || 0) + 1; });
    const sesi = rows_('Jadwal').filter(function (j) { return j.Tanggal === kini; })
      .sort(function (a, b) { return a.Jam_Mulai < b.Jam_Mulai ? -1 : 1; })
      .map(function (j) {
        const tercatat = hariIniRows.filter(function (k) { return k.Jadwal_ID ? k.Jadwal_ID === j.ID : (j.Kelas_ID === 'SEMUA' || k.Kelas_ID === j.Kelas_ID); });
        const kapasitas = j.Kelas_ID === 'SEMUA' ? siswa.length : (perKelas[j.Kelas_ID] || 0);
        return { id: j.ID, kelasId: j.Kelas_ID, kelas: j.Kelas_ID === 'SEMUA' ? 'Semua Kelas' : ((kelas[j.Kelas_ID] || {}).Nama_Kelas || '-'),
          mapel: (mapel[j.Mapel_ID] || {}).Nama_Mapel || '', mulai: j.Jam_Mulai, selesai: j.Jam_Selesai, ruang: j.Ruang, tutor: j.Tutor,
          tercatat: tercatat.length, hadir: tercatat.filter(function (k) { return k.Status === 'Hadir'; }).length, kapasitas: kapasitas };
      });
    const terbaru = hasil.slice().sort(function (a, b) { return a.Waktu < b.Waktu ? 1 : -1; }).slice(0, 5).map(function (h) {
      const l = latMap[h.Latihan_ID] || {}, s = sMap[h.Siswa_ID] || {}, sk = angka_(h.Skor);
      return { id: h.ID, nama: s.Nama || h.Siswa_ID, kelas: (kelas[s.Kelas_ID] || {}).Nama_Kelas || '', latihan: l.Judul || '-', skor: sk, lulus: sk >= kkm_(l) };
    });
    const nunggak = rows_('Pembayaran').filter(function (b) { return b.Status !== 'Lunas' && b.Jatuh_Tempo && b.Jatuh_Tempo < kini; }).length;
    return {
      hariIni: kini,
      kpi: {
        siswaAktif: siswa.length, target: angka_(set.target_siswa) || 0, baruBulanIni: baruBulanIni,
        hadirPersen: rhi.persen, hadir: rhi.hadir, izin: rhi.izin, alfa: rhi.alfa, tercatat: rhi.total,
        materi: materi.length, materiTerbaru: materi[0] ? materi[0].Judul : '',
        latihanTerbit: latihan.filter(function (l) { return l.Status === 'Terbit'; }).length, pengerjaan: hasil.length,
        rataNilai: bulat_(rata_(hasil.map(function (h) { return angka_(h.Skor); })), 1), tagihanLewat: nunggak
      },
      grafik: grafik, sesi: sesi, terbaru: terbaru
    };
  }));
}
function apiMasterList_(ctx) {
  const siswa = rows_('Siswa'), perKelas = {};
  siswa.forEach(function (s) { if (s.Status !== 'Nonaktif') perKelas[s.Kelas_ID] = (perKelas[s.Kelas_ID] || 0) + 1; });
  const data = {
    kelas: rows_('Kelas').map(function (k) { return { id: k.ID_Kelas, nama: k.Nama_Kelas, jenjang: k.Jenjang, keterangan: k.Keterangan, jumlah: perKelas[k.ID_Kelas] || 0 }; }),
    mapel: rows_('Mapel').map(function (m) { return { id: m.ID_Mapel, nama: m.Nama_Mapel, label: m.Label }; }),
    app: pengaturanPublik_(),
    pengaturan: R_ADMIN.indexOf(ctx.session.role) > -1 ? pengaturan_() : null,
    saya: { id: ctx.session.id, nama: ctx.session.nama, peran: ctx.session.role, darurat: !!ctx.session.darurat }
  };
  if (R_ADMIN.indexOf(ctx.session.role) > -1) {
    data.guru = rows_('Pengguna').filter(function (u) { return u.Peran !== 'siswa'; })
      .map(function (u) { return { id: u.ID, nama: u.Nama, email: u.Username, peran: u.Peran, aktif: u.Aktif === 'Ya', loginTerakhir: u.Login_Terakhir }; });
  }
  return ok_(data);
}
function apiSegarkan_(ctx) {
  SEMUA_TABEL.forEach(function (n) { bump_('t_' + n); });
  bump_('adm');
  return ok_(null, 'Data disegarkan dari Google Sheets.');
}

// ==================================================================
// 10. API GURU — SISWA, KELAS, MAPEL
// ==================================================================
function apiSiswaList_(ctx) {
  const kelas = peta_(rows_('Kelas'), 'ID_Kelas');
  const akun = {}; rows_('Pengguna').forEach(function (u) { if (u.Peran === 'siswa') akun[u.Username] = u; });
  const hadir = {}; rows_('Kehadiran').forEach(function (k) { (hadir[k.Siswa_ID] = hadir[k.Siswa_ID] || []).push(k); });
  const latMap = peta_(rows_('Latihan'), 'ID'), nilai = {};
  rows_('Hasil').forEach(function (h) { if (latMap[h.Latihan_ID]) (nilai[h.Siswa_ID] = nilai[h.Siswa_ID] || {})[h.Latihan_ID] = angka_(h.Skor); });
  const tunggak = {}; const kini = hariIni_();
  rows_('Pembayaran').forEach(function (b) { if (b.Status !== 'Lunas') tunggak[b.Siswa_ID] = (tunggak[b.Siswa_ID] || 0) + 1; });
  return ok_({
    siswa: rows_('Siswa').map(function (s) {
      const p = profilKeluar_(s), u = akun[s.ID_Siswa], rh = ringkasHadir_(hadir[s.ID_Siswa] || []), n = nilai[s.ID_Siswa];
      p.kelasId = s.Kelas_ID; p.kelas = (kelas[s.Kelas_ID] || {}).Nama_Kelas || '-';
      p.akunAktif = !!(u && u.Aktif === 'Ya'); p.loginTerakhir = u ? u.Login_Terakhir : '';
      p.catatan = s.Catatan_Guru; p.catatanOleh = s.Catatan_Oleh; p.catatanTgl = s.Catatan_Tgl;
      p.hadirPersen = rh.persen; p.rataNilai = n ? bulat_(rata_(Object.keys(n).map(function (k) { return n[k]; })), 1) : null;
      p.tagihanBelum = tunggak[s.ID_Siswa] || 0;
      return p;
    }).sort(function (a, b) { return a.nama.localeCompare(b.nama); }),
    hariIni: kini
  });
}
function idSiswaBaru_(rowsSiswa) {
  const yy = Utilities.formatDate(new Date(), TZ, 'yy'), pref = 'SC' + yy;
  let maks = 0;
  rowsSiswa.forEach(function (s) { const m = String(s.ID_Siswa).match(new RegExp('^' + pref + '(\\d+)$')); if (m) maks = Math.max(maks, +m[1]); });
  return function () { maks++; return pref + ('00' + maks).slice(-3); };
}
function apiSiswaSimpan_(ctx, d) {
  const p = d.siswa || {}, nama = teks_(p.nama, 80), kelasId = teks_(p.kelasId, 40);
  if (!nama) return fail_('Nama siswa wajib diisi.');
  if (!kelasId || !peta_(rows_('Kelas'), 'ID_Kelas')[kelasId]) return fail_('Pilih kelas yang valid.');
  if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) return fail_('Format email tidak valid.');
  const status = p.status === 'Nonaktif' ? 'Nonaktif' : 'Aktif';
  return denganKunci_(function () {
    const t = segar_('Siswa');
    let sw = p.id ? t.rows.filter(function (r) { return r.ID_Siswa === p.id; })[0] : null;
    let sandi = null;
    const isi = function (o) {
      o.Nama = nama; o.Kelas_ID = kelasId; o.No_HP = hp_(p.noHp); o.Email = teks_(p.email, 120).toLowerCase(); o.Tgl_Lahir = tglValid_(p.tglLahir) ? p.tglLahir : '';
      o.Alamat = teks_(p.alamat, 300); o.Nama_Wali = teks_(p.namaWali, 80); o.HP_Wali = hp_(p.hpWali); o.Hubungan_Wali = teks_(p.hubunganWali, 30); o.Status = status;
      if (p.catatan !== undefined && teks_(p.catatan, 600) !== (o.Catatan_Guru || '')) {
        o.Catatan_Guru = teks_(p.catatan, 600); o.Catatan_Oleh = ctx.session.nama; o.Catatan_Tgl = hariIni_();
      }
    };
    if (sw) { isi(sw); simpanUbah_('Siswa', t, [sw]); }
    else {
      if (p.id) return fail_('Siswa tidak ditemukan.');
      sw = { ID_Siswa: idSiswaBaru_(t.rows)(), Tgl_Daftar: hariIni_() }; isi(sw);
      tambah_('Siswa', [sw]);
    }
    // akun login siswa
    const tu = segar_('Pengguna');
    const u = tu.rows.filter(function (r) { return r.Peran === 'siswa' && r.Username === sw.ID_Siswa; })[0];
    if (!u) { const b = buatPengguna_('siswa', sw.ID_Siswa, sw.Nama, sw.Email); tambah_('Pengguna', [b.baris]); sandi = b.sandi; }
    else {
      const aktif = status === 'Aktif' ? 'Ya' : 'Tidak';
      if (u.Nama !== sw.Nama || u.Aktif !== aktif) { u.Nama = sw.Nama; u.Aktif = aktif; simpanUbah_('Pengguna', tu, [u]); }
      if (aktif === 'Tidak') revokeAll_(u.ID);
    }
    const res = ok_({ id: sw.ID_Siswa, sandiAwal: sandi }, p.id ? 'Data siswa diperbarui.' : 'Siswa baru ditambahkan.');
    res.auditEntitas = 'Siswa:' + sw.ID_Siswa; res.auditDetail = p.id ? 'Ubah data' : 'Tambah siswa';
    return res;
  });
}
function apiSiswaHapus_(ctx, d) {
  const id = teks_(d.id, 40);
  return denganKunci_(function () {
    const t = segar_('Siswa'), sw = t.rows.filter(function (r) { return r.ID_Siswa === id; })[0];
    if (!sw) return fail_('Siswa tidak ditemukan.');
    hapusBaris_('Siswa', t, [sw._r]);
    const tu = segar_('Pengguna'), u = tu.rows.filter(function (r) { return r.Peran === 'siswa' && r.Username === id; })[0];
    if (u) { hapusBaris_('Pengguna', tu, [u._r]); revokeAll_(u.ID); }
    const res = ok_(null, 'Data siswa dihapus. Riwayat nilai & kehadiran tetap tersimpan di Sheets.');
    res.auditEntitas = 'Siswa:' + id; res.auditDetail = 'Hapus siswa ' + sw.Nama;
    return res;
  });
}
function apiSiswaResetSandi_(ctx, d) {
  const id = teks_(d.id, 40);
  return denganKunci_(function () {
    const tu = segar_('Pengguna');
    let u = tu.rows.filter(function (r) { return r.Peran === 'siswa' && r.Username === id; })[0];
    const sw = siswaById_(id); if (!sw) return fail_('Siswa tidak ditemukan.');
    const sandi = sandiAcak_(8);
    if (!u) { const b = buatPengguna_('siswa', id, sw.Nama, sw.Email); b.baris.Salt = Utilities.getUuid(); b.baris.Hash = hashPass_(sandi, b.baris.Salt); tambah_('Pengguna', [b.baris]); }
    else { u.Salt = Utilities.getUuid(); u.Hash = hashPass_(sandi, u.Salt); u.Wajib_Ganti_Sandi = 'Ya'; simpanUbah_('Pengguna', tu, [u]); revokeAll_(u.ID); }
    audit_(ctx, 'siswa.resetSandi', 'Siswa:' + id, 'Kata sandi direset');   // sandi tidak dicatat
    return ok_({ id: id, sandiBaru: sandi }, 'Kata sandi baru dibuat.');
  });
}
function apiKelasSimpan_(ctx, d) {
  const k = d.kelas || {}, nama = teks_(k.nama, 60);
  if (!nama) return fail_('Nama kelas wajib diisi.');
  return denganKunci_(function () {
    const t = segar_('Kelas');
    if (t.rows.some(function (r) { return r.Nama_Kelas.toLowerCase() === nama.toLowerCase() && r.ID_Kelas !== k.id; })) return fail_('Nama kelas sudah ada.');
    let r = k.id ? t.rows.filter(function (x) { return x.ID_Kelas === k.id; })[0] : null;
    if (r) { r.Nama_Kelas = nama; r.Jenjang = teks_(k.jenjang, 30); r.Keterangan = teks_(k.keterangan, 200); simpanUbah_('Kelas', t, [r]); }
    else { r = { ID_Kelas: idBaru_('KLS'), Nama_Kelas: nama, Jenjang: teks_(k.jenjang, 30), Keterangan: teks_(k.keterangan, 200) }; tambah_('Kelas', [r]); }
    const res = ok_({ id: r.ID_Kelas }, 'Kelas disimpan.'); res.auditEntitas = 'Kelas:' + r.ID_Kelas; return res;
  });
}
function apiKelasHapus_(ctx, d) {
  const id = teks_(d.id, 40);
  const dipakai = rows_('Siswa').filter(function (s) { return s.Kelas_ID === id; }).length;
  if (dipakai) return fail_('Kelas masih dipakai ' + dipakai + ' siswa. Pindahkan siswanya dulu.');
  return denganKunci_(function () {
    const t = segar_('Kelas'), r = t.rows.filter(function (x) { return x.ID_Kelas === id; })[0];
    if (!r) return fail_('Kelas tidak ditemukan.');
    hapusBaris_('Kelas', t, [r._r]);
    const res = ok_(null, 'Kelas dihapus.'); res.auditEntitas = 'Kelas:' + id; return res;
  });
}
function apiMapelSimpan_(ctx, d) {
  const m = d.mapel || {}, nama = teks_(m.nama, 60);
  if (!nama) return fail_('Nama mata pelajaran wajib diisi.');
  return denganKunci_(function () {
    const t = segar_('Mapel');
    if (t.rows.some(function (r) { return r.Nama_Mapel.toLowerCase() === nama.toLowerCase() && r.ID_Mapel !== m.id; })) return fail_('Mata pelajaran sudah ada.');
    let r = m.id ? t.rows.filter(function (x) { return x.ID_Mapel === m.id; })[0] : null;
    if (r) { r.Nama_Mapel = nama; r.Label = teks_(m.label, 30); simpanUbah_('Mapel', t, [r]); }
    else { r = { ID_Mapel: idBaru_('MP'), Nama_Mapel: nama, Label: teks_(m.label, 30) }; tambah_('Mapel', [r]); }
    const res = ok_({ id: r.ID_Mapel }, 'Mata pelajaran disimpan.'); res.auditEntitas = 'Mapel:' + r.ID_Mapel; return res;
  });
}
function apiMapelHapus_(ctx, d) {
  const id = teks_(d.id, 40);
  const pakai = rows_('Materi').filter(function (x) { return x.Mapel_ID === id; }).length + rows_('Latihan').filter(function (x) { return x.Mapel_ID === id; }).length;
  if (pakai) return fail_('Mata pelajaran masih dipakai ' + pakai + ' materi/latihan.');
  return denganKunci_(function () {
    const t = segar_('Mapel'), r = t.rows.filter(function (x) { return x.ID_Mapel === id; })[0];
    if (!r) return fail_('Mata pelajaran tidak ditemukan.');
    hapusBaris_('Mapel', t, [r._r]);
    const res = ok_(null, 'Mata pelajaran dihapus.'); res.auditEntitas = 'Mapel:' + id; return res;
  });
}

// ==================================================================
// 11. API GURU — KEHADIRAN
// ==================================================================
function apiHadirAmbil_(ctx, d) {
  const tgl = tglValid_(d.tanggal) ? d.tanggal : hariIni_(), kelasId = teks_(d.kelasId, 40);
  if (!kelasId) return fail_('Pilih kelas.');
  const siswa = rows_('Siswa').filter(function (s) { return s.Status !== 'Nonaktif' && (kelasId === 'SEMUA' || s.Kelas_ID === kelasId); })
    .sort(function (a, b) { return a.Nama.localeCompare(b.Nama); });
  const mapel = peta_(rows_('Mapel'), 'ID_Mapel');
  const jadwal = rows_('Jadwal').filter(function (j) { return j.Tanggal === tgl && (j.Kelas_ID === kelasId || j.Kelas_ID === 'SEMUA'); })
    .sort(function (a, b) { return a.Jam_Mulai < b.Jam_Mulai ? -1 : 1; })
    .map(function (j) { return { id: j.ID, mapel: (mapel[j.Mapel_ID] || {}).Nama_Mapel || 'Sesi', mulai: j.Jam_Mulai, selesai: j.Jam_Selesai, ruang: j.Ruang }; });
  // satu sesi = tanggal + jadwal. Bila hanya ada satu jadwal di hari itu, otomatis dipakai.
  const jadwalId = d.jadwalId !== undefined ? teks_(d.jadwalId, 40) : (jadwal.length === 1 ? jadwal[0].id : '');
  const ada = {};
  rows_('Kehadiran').forEach(function (k) { if (k.Tanggal === tgl && (k.Jadwal_ID || '') === jadwalId) ada[k.Siswa_ID] = k; });
  return ok_({
    tanggal: tgl, kelasId: kelasId, jadwal: jadwal, jadwalId: jadwalId,
    siswa: siswa.map(function (s) { const k = ada[s.ID_Siswa]; return { id: s.ID_Siswa, nama: s.Nama, status: k ? k.Status : '', keterangan: k ? k.Keterangan : '', tersimpan: !!k }; })
  });
}
function apiHadirSimpan_(ctx, d) {
  const tgl = d.tanggal, kelasId = teks_(d.kelasId, 40), entri = d.entri || [];
  if (!tglValid_(tgl)) return fail_('Tanggal tidak valid.');
  if (!entri.length) return fail_('Belum ada status yang dipilih.');
  const STATUS = ['Hadir', 'Izin', 'Alfa'], valid = peta_(rows_('Siswa'), 'ID_Siswa');
  const jadwalId = teks_(d.jadwalId, 40);
  return denganKunci_(function () {
    const t = segar_('Kehadiran'), idx = {};
    t.rows.forEach(function (r) { if (r.Tanggal === tgl && (r.Jadwal_ID || '') === jadwalId) idx[r.Siswa_ID] = r; });
    const ubah = [], baru = [], now = new Date().toISOString();
    entri.forEach(function (e) {
      if (!valid[e.siswaId] || STATUS.indexOf(e.status) === -1) return;
      const r = idx[e.siswaId];
      if (r) {
        if (r.Status !== e.status || r.Keterangan !== teks_(e.keterangan, 120)) {
          r.Status = e.status; r.Keterangan = teks_(e.keterangan, 120); r.Dicatat_Oleh = ctx.session.nama; r.Waktu = now; ubah.push(r);
        }
      } else {
        baru.push({ ID: idBaru_('HD'), Tanggal: tgl, Kelas_ID: valid[e.siswaId].Kelas_ID, Siswa_ID: e.siswaId, Status: e.status, Keterangan: teks_(e.keterangan, 120),
          Jadwal_ID: jadwalId, Dicatat_Oleh: ctx.session.nama, Waktu: now });
      }
    });
    simpanUbah_('Kehadiran', t, ubah);
    tambah_('Kehadiran', baru);
    const res = ok_({ baru: baru.length, diubah: ubah.length }, 'Daftar hadir tersimpan (' + (baru.length + ubah.length) + ' siswa).');
    res.auditEntitas = 'Kehadiran:' + tgl + ':' + kelasId; res.auditDetail = baru.length + ' baru, ' + ubah.length + ' diubah';
    return res;
  });
}

// ==================================================================
// 12. API GURU — MATERI (Google Drive)
// ==================================================================
function apiMateriList_() {
  const mapel = peta_(rows_('Mapel'), 'ID_Mapel'), kelas = peta_(rows_('Kelas'), 'ID_Kelas'), guru = namaGuru_();
  const dibuka = {}; rows_('Materi_Akses').forEach(function (a) { dibuka[a.Materi_ID] = (dibuka[a.Materi_ID] || 0) + 1; });
  return ok_({
    materi: rows_('Materi').map(function (m) {
      return { id: m.ID, judul: m.Judul, bab: m.Bab, deskripsi: m.Deskripsi, tag: m.Tag, mapelId: m.Mapel_ID, kelasId: m.Kelas_ID,
        mapel: (mapel[m.Mapel_ID] || {}).Nama_Mapel || 'Umum', kelas: m.Kelas_ID === 'SEMUA' ? 'Semua Kelas' : ((kelas[m.Kelas_ID] || {}).Nama_Kelas || '-'),
        fileId: m.File_ID, namaFile: m.Nama_File, ukuran: angka_(m.Ukuran), halaman: angka_(m.Halaman), tanggal: m.Tanggal, guru: guru[m.Diunggah_Oleh] || '', dibuka: dibuka[m.ID] || 0 };
    }).sort(function (a, b) { return a.tanggal < b.tanggal ? 1 : -1; })
  });
}
function hitungHalamanPdf_(blob) {
  try {
    if (blob.getContentType() !== 'application/pdf') return '';
    const s = blob.getDataAsString('ISO-8859-1'), m = s.match(/\/Type\s*\/Page[^s]/g);
    return m ? String(m.length) : '';
  } catch (e) { return ''; }
}
function bagikanLink_(file) {
  try { file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); return ''; }
  catch (e) { return 'Berkas tersimpan, tetapi gagal dibagikan lewat tautan (kebijakan Google Workspace). Siswa mungkin tidak bisa membukanya.'; }
}
function validasiMateri_(m) {
  if (!teks_(m.judul, 150)) return 'Judul materi wajib diisi.';
  if (!peta_(rows_('Mapel'), 'ID_Mapel')[m.mapelId]) return 'Pilih mata pelajaran.';
  if (m.kelasId !== 'SEMUA' && !peta_(rows_('Kelas'), 'ID_Kelas')[m.kelasId]) return 'Pilih kelas.';
  return '';
}
function apiMateriUnggah_(ctx, d) {
  const m = d.materi || {}, f = d.file || {};
  const err = validasiMateri_(m); if (err) return fail_(err);
  if (!f.base64 || !f.nama) return fail_('Pilih berkas materi.');
  const bytes = Utilities.base64Decode(String(f.base64));
  if (bytes.length > MAKS_FILE_MB * 1024 * 1024) return fail_('Ukuran berkas melebihi ' + MAKS_FILE_MB + ' MB.');
  const nama = teks_(f.nama, 150).replace(/[\\/:*?"<>|]/g, '_');
  const blob = Utilities.newBlob(bytes, teks_(f.mime, 100) || 'application/pdf', nama);
  const folder = DriveApp.getFolderById(prop_('FOLDER_MATERI'));
  const file = folder.createFile(blob);
  const peringatan = bagikanLink_(file);
  const row = { ID: idBaru_('MTR'), Judul: teks_(m.judul, 150), Mapel_ID: m.mapelId, Kelas_ID: m.kelasId, Bab: teks_(m.bab, 80), Deskripsi: teks_(m.deskripsi, 400),
    Tag: teks_(m.tag, 30), File_ID: file.getId(), Nama_File: nama, Ukuran: String(bytes.length), Halaman: hitungHalamanPdf_(blob), Diunggah_Oleh: ctx.session.id, Tanggal: new Date().toISOString() };
  denganKunci_(function () { tambah_('Materi', [row]); });
  const res = ok_({ id: row.ID, fileId: row.File_ID, peringatan: peringatan }, 'Materi berhasil diunggah.');
  res.auditEntitas = 'Materi:' + row.ID; res.auditDetail = row.Judul + ' (' + Math.round(bytes.length / 1024) + ' KB)';
  return res;
}
function apiMateriUbah_(ctx, d) {
  const m = d.materi || {};
  const err = validasiMateri_(m); if (err) return fail_(err);
  return denganKunci_(function () {
    const t = segar_('Materi'), r = t.rows.filter(function (x) { return x.ID === m.id; })[0];
    if (!r) return fail_('Materi tidak ditemukan.');
    r.Judul = teks_(m.judul, 150); r.Mapel_ID = m.mapelId; r.Kelas_ID = m.kelasId; r.Bab = teks_(m.bab, 80); r.Deskripsi = teks_(m.deskripsi, 400); r.Tag = teks_(m.tag, 30);
    simpanUbah_('Materi', t, [r]);
    const res = ok_(null, 'Materi diperbarui.'); res.auditEntitas = 'Materi:' + r.ID; return res;
  });
}
function apiMateriHapus_(ctx, d) {
  const id = teks_(d.id, 40);
  return denganKunci_(function () {
    const t = segar_('Materi'), r = t.rows.filter(function (x) { return x.ID === id; })[0];
    if (!r) return fail_('Materi tidak ditemukan.');
    try { if (r.File_ID) DriveApp.getFileById(r.File_ID).setTrashed(true); } catch (e) { /* berkas sudah tidak ada */ }
    hapusBaris_('Materi', t, [r._r]);
    const res = ok_(null, 'Materi dihapus (berkas dipindah ke Sampah Drive).'); res.auditEntitas = 'Materi:' + id; res.auditDetail = r.Judul; return res;
  });
}

// ==================================================================
// 13. API GURU — LATIHAN SOAL & NILAI
// ==================================================================
function apiLatihanList_() {
  const mapel = peta_(rows_('Mapel'), 'ID_Mapel'), kelas = peta_(rows_('Kelas'), 'ID_Kelas'), nSoal = jumlahSoal_();
  const stat = {}; rows_('Hasil').forEach(function (h) { (stat[h.Latihan_ID] = stat[h.Latihan_ID] || []).push(angka_(h.Skor)); });
  return ok_({
    latihan: rows_('Latihan').map(function (l) {
      const s = stat[l.ID] || [];
      return { id: l.ID, judul: l.Judul, bab: l.Bab, mapelId: l.Mapel_ID, kelasId: l.Kelas_ID, mapel: (mapel[l.Mapel_ID] || {}).Nama_Mapel || 'Umum',
        kelas: l.Kelas_ID === 'SEMUA' ? 'Semua Kelas' : ((kelas[l.Kelas_ID] || {}).Nama_Kelas || '-'), durasi: angka_(l.Durasi_Menit), kkm: kkm_(l),
        status: l.Status, jumlahSoal: nSoal[l.ID] || 0, pengerjaan: s.length, rata: bulat_(rata_(s), 1), diubah: l.Diubah || l.Dibuat };
    }).sort(function (a, b) { return a.diubah < b.diubah ? 1 : -1; })
  });
}
function apiLatihanDetail_(ctx, d) {
  const l = peta_(rows_('Latihan'), 'ID')[teks_(d.id, 40)];
  if (!l) return fail_('Latihan tidak ditemukan.');
  const soal = rows_('Soal').filter(function (s) { return s.Latihan_ID === l.ID; }).sort(function (a, b) { return angka_(a.No) - angka_(b.No); })
    .map(function (s) { return { id: s.ID, pertanyaan: s.Pertanyaan, opsi: { A: s.Opsi_A, B: s.Opsi_B, C: s.Opsi_C, D: s.Opsi_D }, kunci: s.Kunci, bobot: angka_(s.Bobot) || 1, pembahasan: s.Pembahasan }; });
  return ok_({ latihan: { id: l.ID, judul: l.Judul, bab: l.Bab, mapelId: l.Mapel_ID, kelasId: l.Kelas_ID, durasi: angka_(l.Durasi_Menit), kkm: angka_(l.KKM), status: l.Status }, soal: soal });
}
function apiLatihanSimpan_(ctx, d) {
  const l = d.latihan || {}, soal = d.soal || [];
  if (!teks_(l.judul, 150)) return fail_('Judul latihan wajib diisi.');
  if (!peta_(rows_('Mapel'), 'ID_Mapel')[l.mapelId]) return fail_('Pilih mata pelajaran.');
  if (l.kelasId !== 'SEMUA' && !peta_(rows_('Kelas'), 'ID_Kelas')[l.kelasId]) return fail_('Pilih kelas.');
  const status = l.status === 'Terbit' ? 'Terbit' : (l.status === 'Arsip' ? 'Arsip' : 'Draf');
  for (let i = 0; i < soal.length; i++) {
    const s = soal[i];
    if (!teks_(s.pertanyaan, 2000)) return fail_('Soal nomor ' + (i + 1) + ': pertanyaan masih kosong.');
    if (['A', 'B', 'C', 'D'].indexOf(String(s.kunci || '').toUpperCase()) === -1) return fail_('Soal nomor ' + (i + 1) + ': pilih kunci jawaban.');
    if (!s.opsi || ['A', 'B', 'C', 'D'].some(function (k) { return !teks_(s.opsi[k], 500); })) return fail_('Soal nomor ' + (i + 1) + ': keempat pilihan jawaban wajib diisi.');
  }
  if (status === 'Terbit' && !soal.length) return fail_('Tambahkan minimal satu soal sebelum diterbitkan.');
  return denganKunci_(function () {
    const now = new Date().toISOString(), t = segar_('Latihan');
    let r = l.id ? t.rows.filter(function (x) { return x.ID === l.id; })[0] : null;
    const isi = function (o) {
      o.Judul = teks_(l.judul, 150); o.Mapel_ID = l.mapelId; o.Kelas_ID = l.kelasId; o.Bab = teks_(l.bab, 80);
      o.Durasi_Menit = String(Math.max(0, Math.min(300, Math.round(angka_(l.durasi))))); o.KKM = l.kkm ? String(Math.max(0, Math.min(100, Math.round(angka_(l.kkm))))) : '';
      o.Status = status; o.Diubah = now;
    };
    if (r) { isi(r); simpanUbah_('Latihan', t, [r]); }
    else { r = { ID: idBaru_('LAT'), Dibuat_Oleh: ctx.session.id, Dibuat: now }; isi(r); tambah_('Latihan', [r]); }
    // ganti seluruh soal latihan ini (1× hapus + 1× tambah)
    const ts = segar_('Soal');
    hapusBaris_('Soal', ts, ts.rows.filter(function (x) { return x.Latihan_ID === r.ID; }).map(function (x) { return x._r; }));
    tambah_('Soal', soal.map(function (s, i) {
      return { ID: s.id && /^SOAL-/.test(s.id) ? s.id : idBaru_('SOAL'), Latihan_ID: r.ID, No: String(i + 1), Pertanyaan: teks_(s.pertanyaan, 2000),
        Opsi_A: teks_(s.opsi.A, 500), Opsi_B: teks_(s.opsi.B, 500), Opsi_C: teks_(s.opsi.C, 500), Opsi_D: teks_(s.opsi.D, 500),
        Kunci: String(s.kunci).toUpperCase(), Bobot: String(Math.max(1, Math.min(100, Math.round(angka_(s.bobot) || 10)))), Pembahasan: teks_(s.pembahasan, 1500) };
    }));
    const res = ok_({ id: r.ID }, status === 'Terbit' ? 'Latihan diterbitkan ke siswa.' : 'Latihan disimpan.');
    res.auditEntitas = 'Latihan:' + r.ID; res.auditDetail = r.Judul + ' — ' + soal.length + ' soal, ' + status;
    return res;
  });
}
function apiLatihanHapus_(ctx, d) {
  const id = teks_(d.id, 40);
  const adaHasil = rows_('Hasil').some(function (h) { return h.Latihan_ID === id; });
  return denganKunci_(function () {
    const t = segar_('Latihan'), r = t.rows.filter(function (x) { return x.ID === id; })[0];
    if (!r) return fail_('Latihan tidak ditemukan.');
    if (adaHasil) {
      r.Status = 'Arsip'; r.Diubah = new Date().toISOString(); simpanUbah_('Latihan', t, [r]);
      const res = ok_({ diarsip: true }, 'Latihan sudah dikerjakan siswa, jadi diarsipkan (nilai tetap tersimpan).'); res.auditEntitas = 'Latihan:' + id; return res;
    }
    hapusBaris_('Latihan', t, [r._r]);
    const ts = segar_('Soal');
    hapusBaris_('Soal', ts, ts.rows.filter(function (x) { return x.Latihan_ID === id; }).map(function (x) { return x._r; }));
    const res = ok_({ diarsip: false }, 'Latihan dihapus.'); res.auditEntitas = 'Latihan:' + id; res.auditDetail = r.Judul; return res;
  });
}
function apiNilaiRingkasan_(ctx, d) {
  const kelasId = teks_(d.kelasId, 40);
  const mapel = peta_(rows_('Mapel'), 'ID_Mapel'), kelas = peta_(rows_('Kelas'), 'ID_Kelas');
  const latihan = rows_('Latihan').filter(function (l) { return l.Status !== 'Draf' && (!kelasId || l.Kelas_ID === kelasId || l.Kelas_ID === 'SEMUA'); })
    .sort(function (a, b) { return a.Dibuat < b.Dibuat ? -1 : 1; });
  const latIds = {}; latihan.forEach(function (l) { latIds[l.ID] = l; });
  const nilai = {};
  rows_('Hasil').slice().sort(function (a, b) { return a.Waktu < b.Waktu ? -1 : 1; }).forEach(function (h) {
    if (latIds[h.Latihan_ID]) (nilai[h.Siswa_ID] = nilai[h.Siswa_ID] || {})[h.Latihan_ID] = { skor: angka_(h.Skor), hasilId: h.ID };
  });
  const siswa = rows_('Siswa').filter(function (s) { return s.Status !== 'Nonaktif' && (!kelasId || s.Kelas_ID === kelasId); })
    .map(function (s) {
      const n = nilai[s.ID_Siswa] || {}, arr = Object.keys(n).map(function (k) { return n[k].skor; });
      return { id: s.ID_Siswa, nama: s.Nama, kelasId: s.Kelas_ID, kelas: (kelas[s.Kelas_ID] || {}).Nama_Kelas || '-', nilai: n, rata: bulat_(rata_(arr), 1) };
    }).sort(function (a, b) { return a.nama.localeCompare(b.nama); });
  return ok_({
    latihan: latihan.map(function (l) { return { id: l.ID, judul: l.Judul, mapel: (mapel[l.Mapel_ID] || {}).Nama_Mapel || '', kkm: kkm_(l), kelasId: l.Kelas_ID, status: l.Status }; }),
    siswa: siswa
  });
}

// ==================================================================
// 14. API GURU — LAPORAN
// ==================================================================
function apiLaporan_(ctx, d) {
  const sampai = tglValid_(d.sampai) ? d.sampai : hariIni_(), dari = tglValid_(d.dari) ? d.dari : tglGeser_(sampai, -29);
  const kelasId = teks_(d.kelasId, 40), mapelId = teks_(d.mapelId, 40);
  return ok_(hitungCache_('lap', ['Siswa', 'Kehadiran', 'Jadwal', 'Materi', 'Materi_Akses', 'Latihan', 'Hasil', 'Kelas'], { a: dari, b: sampai, k: kelasId, m: mapelId }, 600, function () {
    const kelas = peta_(rows_('Kelas'), 'ID_Kelas'), jadwal = peta_(rows_('Jadwal'), 'ID');
    const siswa = rows_('Siswa').filter(function (s) { return s.Status !== 'Nonaktif' && (!kelasId || s.Kelas_ID === kelasId); });
    const sSet = peta_(siswa, 'ID_Siswa');
    const hadir = rows_('Kehadiran').filter(function (k) {
      if (k.Tanggal < dari || k.Tanggal > sampai || !sSet[k.Siswa_ID]) return false;
      if (mapelId) { const j = jadwal[k.Jadwal_ID]; return !!j && j.Mapel_ID === mapelId; }
      return true;
    });
    const perTgl = {}; hadir.forEach(function (k) { (perTgl[k.Tanggal] = perTgl[k.Tanggal] || []).push(k); });
    const tren = Object.keys(perTgl).sort().map(function (t) { const r = ringkasHadir_(perTgl[t]); return { tanggal: t, persen: r.persen, hadir: r.hadir, total: r.total }; });
    const perSiswaHadir = {}; hadir.forEach(function (k) { (perSiswaHadir[k.Siswa_ID] = perSiswaHadir[k.Siswa_ID] || []).push(k); });

    const latihan = peta_(rows_('Latihan').filter(function (l) { return (!mapelId || l.Mapel_ID === mapelId) && (!kelasId || l.Kelas_ID === kelasId || l.Kelas_ID === 'SEMUA'); }), 'ID');
    const awal = dari + 'T00:00:00', akhir = sampai + 'T23:59:59~';
    const terakhir = {};
    rows_('Hasil').slice().sort(function (a, b) { return a.Waktu < b.Waktu ? -1 : 1; }).forEach(function (h) {
      if (!latihan[h.Latihan_ID] || !sSet[h.Siswa_ID] || h.Waktu < awal || h.Waktu > akhir) return;
      (terakhir[h.Siswa_ID] = terakhir[h.Siswa_ID] || {})[h.Latihan_ID] = angka_(h.Skor);
    });
    const ember = [{ label: '0–59', min: 0, max: 59 }, { label: '60–69', min: 60, max: 69 }, { label: '70–79', min: 70, max: 79 }, { label: '80–89', min: 80, max: 89 }, { label: '90–100', min: 90, max: 100 }];
    const distribusi = ember.map(function (e) { return { label: e.label, jumlah: 0 }; });
    Object.keys(terakhir).forEach(function (sid) { Object.keys(terakhir[sid]).forEach(function (lid) {
      const v = terakhir[sid][lid]; for (let i = 0; i < ember.length; i++) if (v >= ember[i].min && v <= ember[i].max) { distribusi[i].jumlah++; break; }
    }); });

    const materi = rows_('Materi').filter(function (m) { return !mapelId || m.Mapel_ID === mapelId; });
    const akses = {}; rows_('Materi_Akses').forEach(function (a) { akses[a.Siswa_ID + '|' + a.Materi_ID] = 1; });
    let dibukaTotal = 0, mungkin = 0;
    const tabel = siswa.map(function (s) {
      const mk = materi.filter(function (m) { return untukKelas_(m, s.Kelas_ID); });
      const db = mk.filter(function (m) { return akses[s.ID_Siswa + '|' + m.ID]; }).length;
      dibukaTotal += db; mungkin += mk.length;
      const rh = ringkasHadir_(perSiswaHadir[s.ID_Siswa] || []), n = terakhir[s.ID_Siswa] || {}, arr = Object.keys(n).map(function (k) { return n[k]; });
      return { id: s.ID_Siswa, nama: s.Nama, kelas: (kelas[s.Kelas_ID] || {}).Nama_Kelas || '-', hadirPersen: rh.persen, sesi: rh.total, hadir: rh.hadir,
        rata: bulat_(rata_(arr), 1), latihan: arr.length, materiDibuka: db, materiTotal: mk.length };
    }).sort(function (a, b) { return a.nama.localeCompare(b.nama); });
    const totalHadir = ringkasHadir_(hadir);
    const semuaNilai = []; Object.keys(terakhir).forEach(function (s) { Object.keys(terakhir[s]).forEach(function (l) { semuaNilai.push(terakhir[s][l]); }); });
    return {
      periode: { dari: dari, sampai: sampai },
      ringkas: { hadirPersen: totalHadir.persen, sesi: totalHadir.total, rataNilai: bulat_(rata_(semuaNilai), 1), pengerjaan: semuaNilai.length,
        progresMateri: mungkin ? Math.round(dibukaTotal / mungkin * 100) : null, dibuka: dibukaTotal, mungkin: mungkin, siswa: siswa.length },
      tren: tren, distribusi: distribusi, tabel: tabel
    };
  }));
}

// ==================================================================
// 15. API GURU — JADWAL & PEMBAYARAN
// ==================================================================
function apiJadwalList_(ctx, d) {
  const dari = tglValid_(d.dari) ? d.dari : tglGeser_(hariIni_(), -7), sampai = tglValid_(d.sampai) ? d.sampai : tglGeser_(hariIni_(), 60);
  const kelas = peta_(rows_('Kelas'), 'ID_Kelas'), mapel = peta_(rows_('Mapel'), 'ID_Mapel');
  return ok_({ jadwal: rows_('Jadwal').filter(function (j) { return j.Tanggal >= dari && j.Tanggal <= sampai; })
    .map(function (j) { return { id: j.ID, kelasId: j.Kelas_ID, mapelId: j.Mapel_ID, tanggal: j.Tanggal, mulai: j.Jam_Mulai, selesai: j.Jam_Selesai, ruang: j.Ruang, tutor: j.Tutor, catatan: j.Catatan,
      kelas: j.Kelas_ID === 'SEMUA' ? 'Semua Kelas' : ((kelas[j.Kelas_ID] || {}).Nama_Kelas || '-'), mapel: (mapel[j.Mapel_ID] || {}).Nama_Mapel || '-' }; })
    .sort(function (a, b) { return (a.tanggal + a.mulai) < (b.tanggal + b.mulai) ? -1 : 1; }), dari: dari, sampai: sampai });
}
function apiJadwalSimpan_(ctx, d) {
  const j = d.jadwal || {}, ulang = Math.max(1, Math.min(26, Math.round(angka_(d.ulangMingguan) || 1)));
  if (!tglValid_(j.tanggal)) return fail_('Tanggal wajib diisi.');
  if (!jamValid_(j.mulai)) return fail_('Jam mulai tidak valid (format JJ:MM).');
  if (j.selesai && !jamValid_(j.selesai)) return fail_('Jam selesai tidak valid.');
  if (j.kelasId !== 'SEMUA' && !peta_(rows_('Kelas'), 'ID_Kelas')[j.kelasId]) return fail_('Pilih kelas.');
  if (!peta_(rows_('Mapel'), 'ID_Mapel')[j.mapelId]) return fail_('Pilih mata pelajaran.');
  return denganKunci_(function () {
    const isi = function (o, tgl) { o.Kelas_ID = j.kelasId; o.Mapel_ID = j.mapelId; o.Tanggal = tgl; o.Jam_Mulai = j.mulai; o.Jam_Selesai = j.selesai || ''; o.Ruang = teks_(j.ruang, 60); o.Tutor = teks_(j.tutor, 80); o.Catatan = teks_(j.catatan, 300); };
    if (j.id) {
      const t = segar_('Jadwal'), r = t.rows.filter(function (x) { return x.ID === j.id; })[0];
      if (!r) return fail_('Jadwal tidak ditemukan.');
      isi(r, j.tanggal); simpanUbah_('Jadwal', t, [r]);
      const res = ok_({ id: r.ID }, 'Jadwal diperbarui.'); res.auditEntitas = 'Jadwal:' + r.ID; return res;
    }
    const baru = [];
    for (let i = 0; i < ulang; i++) { const o = { ID: idBaru_('JDW') }; isi(o, tglGeser_(j.tanggal, i * 7)); baru.push(o); }
    tambah_('Jadwal', baru);
    const res = ok_({ jumlah: baru.length }, baru.length > 1 ? baru.length + ' jadwal mingguan ditambahkan.' : 'Jadwal ditambahkan.');
    res.auditEntitas = 'Jadwal'; res.auditDetail = baru.length + ' jadwal mulai ' + j.tanggal; return res;
  });
}
function apiJadwalHapus_(ctx, d) {
  const id = teks_(d.id, 40);
  return denganKunci_(function () {
    const t = segar_('Jadwal'), r = t.rows.filter(function (x) { return x.ID === id; })[0];
    if (!r) return fail_('Jadwal tidak ditemukan.');
    hapusBaris_('Jadwal', t, [r._r]);
    const res = ok_(null, 'Jadwal dihapus.'); res.auditEntitas = 'Jadwal:' + id; return res;
  });
}
function apiBayarList_(ctx, d) {
  const sMap = peta_(rows_('Siswa'), 'ID_Siswa'), kelas = peta_(rows_('Kelas'), 'ID_Kelas'), kini = hariIni_();
  return ok_({ tagihan: rows_('Pembayaran').map(function (b) {
    const s = sMap[b.Siswa_ID] || {};
    return { id: b.ID, siswaId: b.Siswa_ID, nama: s.Nama || b.Siswa_ID, kelasId: s.Kelas_ID || '', kelas: (kelas[s.Kelas_ID] || {}).Nama_Kelas || '-', periode: b.Periode,
      minggu: b.Minggu_Mulai || '', jumlah: angka_(b.Jumlah), jatuhTempo: b.Jatuh_Tempo, status: b.Status || 'Belum Bayar', tglBayar: b.Tgl_Bayar, catatan: b.Catatan,
      lewat: b.Status !== 'Lunas' && !!b.Jatuh_Tempo && b.Jatuh_Tempo < kini };
  }).sort(function (a, b) { return ((a.minggu || a.jatuhTempo || '') < (b.minggu || b.jatuhTempo || '') ? 1 : (a.minggu || a.jatuhTempo || '') > (b.minggu || b.jatuhTempo || '') ? -1 : a.nama < b.nama ? -1 : 1); }),
    hariIni: kini, mingguIni: seninDari_(kini), hariTempo: HARI_TEMPO_DEFAULT });
}
/** Simpan satu tagihan. Mode mingguan: kirim `minggu` (tanggal mana saja di minggu itu) → periode & Minggu_Mulai otomatis. */
function apiBayarSimpan_(ctx, d) {
  const b = d.tagihan || {};
  if (!siswaById_(b.siswaId)) return fail_('Pilih siswa.');
  const senin = tglValid_(b.minggu) ? seninDari_(b.minggu) : '';
  const periode = senin ? labelMinggu_(senin) : teks_(b.periode, 40);
  if (!periode) return fail_('Pilih minggu tagihan.');
  if (angka_(b.jumlah) <= 0) return fail_('Jumlah tagihan harus lebih dari 0.');
  if (b.jatuhTempo && !tglValid_(b.jatuhTempo)) return fail_('Tanggal jatuh tempo tidak valid.');
  const status = b.status === 'Lunas' ? 'Lunas' : 'Belum Bayar';
  return denganKunci_(function () {
    pastikanKolom_('Pembayaran');
    const t = segar_('Pembayaran');
    let r = b.id ? t.rows.filter(function (x) { return x.ID === b.id; })[0] : null;
    if (b.id && !r) return fail_('Tagihan tidak ditemukan. Muat ulang halaman.');
    const kembar = t.rows.some(function (x) {
      return x.Siswa_ID === b.siswaId && (!r || x.ID !== r.ID) && ((senin && x.Minggu_Mulai === senin) || String(x.Periode).toLowerCase() === periode.toLowerCase());
    });
    if (kembar) return fail_('Siswa ini sudah punya tagihan untuk ' + periode + '.');
    const isi = function (o) {
      o.Siswa_ID = b.siswaId; o.Periode = periode; o.Minggu_Mulai = senin || (o.Minggu_Mulai || '');
      o.Jumlah = String(Math.round(angka_(b.jumlah))); o.Jatuh_Tempo = b.jatuhTempo || (senin ? tglGeser_(senin, HARI_TEMPO_DEFAULT) : ''); o.Status = status;
      o.Tgl_Bayar = status === 'Lunas' ? (tglValid_(b.tglBayar) ? b.tglBayar : (o.Tgl_Bayar || hariIni_())) : ''; o.Catatan = teks_(b.catatan, 200);
    };
    if (r) { isi(r); simpanUbah_('Pembayaran', t, [r]); }
    else { r = { ID: idBaru_('BYR') }; isi(r); tambah_('Pembayaran', [r]); }
    const res = ok_({ id: r.ID, periode: periode }, status === 'Lunas' ? 'Tagihan ditandai lunas.' : 'Tagihan disimpan.'); res.auditEntitas = 'Pembayaran:' + r.ID; return res;
  });
}
/** Tagihan mingguan massal: satu kelas (atau semua), mulai minggu X, sebanyak N minggu (1–12). Aman diulang. */
function apiBayarMassal_(ctx, d) {
  const kelasId = teks_(d.kelasId, 40), jumlah = Math.round(angka_(d.jumlah));
  if (!tglValid_(d.mulai) && teks_(d.periode, 40)) return bayarMassalLama_(d, kelasId, jumlah);   // frontend versi lama (periode teks)
  if (!tglValid_(d.mulai)) return fail_('Pilih minggu pertama tagihan.');
  if (jumlah <= 0) return fail_('Jumlah tagihan per minggu harus lebih dari 0.');
  const nMinggu = Math.max(1, Math.min(12, Math.round(angka_(d.jumlahMinggu)) || 1));
  const hariTempo = d.hariTempo === undefined || d.hariTempo === '' ? HARI_TEMPO_DEFAULT : Math.max(0, Math.min(6, Math.round(angka_(d.hariTempo))));
  const siswa = rows_('Siswa').filter(function (s) { return s.Status !== 'Nonaktif' && (!kelasId || kelasId === 'SEMUA' || s.Kelas_ID === kelasId); });
  if (!siswa.length) return fail_('Tidak ada siswa aktif di kelas ini.');
  const awal = seninDari_(d.mulai), daftarMinggu = [];
  for (let i = 0; i < nMinggu; i++) daftarMinggu.push(tglGeser_(awal, 7 * i));
  return denganKunci_(function () {
    pastikanKolom_('Pembayaran');
    const t = segar_('Pembayaran'), ada = {};
    t.rows.forEach(function (x) { ada[x.Siswa_ID + '|' + String(x.Periode).toLowerCase()] = 1; if (x.Minggu_Mulai) ada[x.Siswa_ID + '|' + x.Minggu_Mulai] = 1; });
    const baru = []; let lewat = 0;
    daftarMinggu.forEach(function (senin) {
      const per = labelMinggu_(senin);
      siswa.forEach(function (s) {
        if (ada[s.ID_Siswa + '|' + senin] || ada[s.ID_Siswa + '|' + per.toLowerCase()] || (s.Tgl_Daftar && s.Tgl_Daftar > tglGeser_(senin, 6))) { lewat++; return; }
        baru.push({ ID: idBaru_('BYR'), Siswa_ID: s.ID_Siswa, Periode: per, Minggu_Mulai: senin, Jumlah: String(jumlah), Jatuh_Tempo: tglGeser_(senin, hariTempo),
          Status: 'Belum Bayar', Tgl_Bayar: '', Catatan: teks_(d.catatan, 200) });
      });
    });
    tambah_('Pembayaran', baru);
    const res = ok_({ dibuat: baru.length, dilewati: lewat, minggu: daftarMinggu.length },
      baru.length + ' tagihan dibuat untuk ' + daftarMinggu.length + ' minggu' + (lewat ? ', ' + lewat + ' dilewati (sudah ada atau siswa belum terdaftar).' : '.'));
    res.auditEntitas = 'Pembayaran'; res.auditDetail = 'Massal ' + labelMinggu_(awal) + ' ×' + daftarMinggu.length + ': ' + baru.length; return res;
  });
}
/** Kompatibilitas frontend lama: satu tagihan per siswa dengan periode teks bebas. */
function bayarMassalLama_(d, kelasId, jumlah) {
  const periode = teks_(d.periode, 40);
  if (jumlah <= 0) return fail_('Jumlah tagihan harus lebih dari 0.');
  if (d.jatuhTempo && !tglValid_(d.jatuhTempo)) return fail_('Tanggal jatuh tempo tidak valid.');
  const siswa = rows_('Siswa').filter(function (s) { return s.Status !== 'Nonaktif' && (!kelasId || kelasId === 'SEMUA' || s.Kelas_ID === kelasId); });
  return denganKunci_(function () {
    const t = segar_('Pembayaran'), ada = {};
    t.rows.forEach(function (x) { ada[x.Siswa_ID + '|' + String(x.Periode).toLowerCase()] = 1; });
    const baru = siswa.filter(function (s) { return !ada[s.ID_Siswa + '|' + periode.toLowerCase()]; }).map(function (s) {
      return { ID: idBaru_('BYR'), Siswa_ID: s.ID_Siswa, Periode: periode, Jumlah: String(jumlah), Jatuh_Tempo: d.jatuhTempo || '', Status: 'Belum Bayar', Tgl_Bayar: '', Catatan: teks_(d.catatan, 200) };
    });
    tambah_('Pembayaran', baru);
    const res = ok_({ dibuat: baru.length, dilewati: siswa.length - baru.length }, baru.length + ' tagihan dibuat' + (siswa.length - baru.length ? ', ' + (siswa.length - baru.length) + ' dilewati karena sudah ada.' : '.'));
    res.auditEntitas = 'Pembayaran'; res.auditDetail = 'Massal ' + periode + ': ' + baru.length; return res;
  });
}
/** Tandai banyak tagihan lunas sekaligus (mis. orang tua membayar beberapa minggu tunggakan). */
function apiBayarLunasBanyak_(ctx, d) {
  const ids = (Array.isArray(d.ids) ? d.ids : []).slice(0, 200).map(function (x) { return teks_(x, 40); }).filter(String);
  if (!ids.length) return fail_('Tidak ada tagihan yang dipilih.');
  if (d.tglBayar && !tglValid_(d.tglBayar)) return fail_('Tanggal bayar tidak valid.');
  const tgl = d.tglBayar || hariIni_(), pilih = {};
  ids.forEach(function (i) { pilih[i] = 1; });
  return denganKunci_(function () {
    const t = segar_('Pembayaran'), ubah = t.rows.filter(function (x) { return pilih[x.ID] && x.Status !== 'Lunas'; });
    ubah.forEach(function (x) { x.Status = 'Lunas'; x.Tgl_Bayar = tgl; });
    simpanUbah_('Pembayaran', t, ubah);
    const total = ubah.reduce(function (a, x) { return a + angka_(x.Jumlah); }, 0);
    const res = ok_({ diubah: ubah.length, total: total }, ubah.length + ' tagihan ditandai lunas.');
    res.auditEntitas = 'Pembayaran'; res.auditDetail = 'Lunas ' + ubah.length + ' tagihan (Rp ' + total + ')'; return res;
  });
}
function apiBayarHapus_(ctx, d) {
  const id = teks_(d.id, 40);
  return denganKunci_(function () {
    const t = segar_('Pembayaran'), r = t.rows.filter(function (x) { return x.ID === id; })[0];
    if (!r) return fail_('Tagihan tidak ditemukan.');
    hapusBaris_('Pembayaran', t, [r._r]);
    const res = ok_(null, 'Tagihan dihapus.'); res.auditEntitas = 'Pembayaran:' + id; return res;
  });
}

// ==================================================================
// 16. API ADMIN — PENGATURAN, LOGO, AKUN GURU, AUDIT
// ==================================================================
function apiPengaturanSimpan_(ctx, d) {
  const p = d.pengaturan || {}, simpan = {};
  if (p.nama_app !== undefined) { const v = teks_(p.nama_app, 40); if (!v) return fail_('Nama aplikasi wajib diisi.'); simpan.nama_app = v; }
  if (p.tagline !== undefined) simpan.tagline = teks_(p.tagline, 80);
  ['warna_utama', 'warna_gelap', 'warna_aksen'].forEach(function (k) {
    if (p[k] === undefined) return;
    if (!hexValid_(p[k])) throw new Error('Warna harus berformat #RRGGBB.');
    simpan[k] = p[k].toUpperCase();
  });
  if (simpan.warna_utama && kontras_(simpan.warna_utama, '#FFFFFF') < 4.5) return fail_('Warna Utama terlalu terang: teks putih di atasnya sulit dibaca. Pilih warna yang lebih gelap.');
  if (simpan.warna_gelap && kontras_(simpan.warna_gelap, '#FFFFFF') < 7) return fail_('Warna Gelap kurang gelap untuk latar header. Pilih warna yang lebih gelap.');
  if (simpan.warna_aksen && kontras_(simpan.warna_aksen, '#FFFFFF') < 3) return fail_('Warna Aksen terlalu terang untuk grafik dan progres. Pilih warna yang lebih pekat.');
  if (p.kkm !== undefined) { const k = Math.round(angka_(p.kkm)); if (k < 1 || k > 100) return fail_('KKM harus 1–100.'); simpan.kkm = String(k); }
  if (p.target_siswa !== undefined) simpan.target_siswa = String(Math.max(0, Math.round(angka_(p.target_siswa))));
  if (p.tahun_ajaran !== undefined) simpan.tahun_ajaran = teks_(p.tahun_ajaran, 20);
  if (p.kontak_admin !== undefined) simpan.kontak_admin = teks_(p.kontak_admin, 80);
  return denganKunci_(function () {
    simpanPengaturan_(simpan);
    const res = ok_({ app: pengaturanPublik_() }, 'Pengaturan disimpan.');
    res.auditEntitas = 'Pengaturan'; res.auditDetail = Object.keys(simpan).join(', ');
    return res;
  });
}
function simpanPengaturan_(obj) {
  const t = segar_('Pengaturan'), idx = {}, ubah = [], baru = [];
  t.rows.forEach(function (r) { idx[r.Kunci] = r; });
  Object.keys(obj).forEach(function (k) {
    if (idx[k]) { if (idx[k].Nilai !== obj[k]) { idx[k].Nilai = obj[k]; ubah.push(idx[k]); } }
    else baru.push({ Kunci: k, Nilai: obj[k] });
  });
  simpanUbah_('Pengaturan', t, ubah);
  tambah_('Pengaturan', baru);
}
function apiLogoUnggah_(ctx, d) {
  const f = d.file || {};
  if (d.hapus) { denganKunci_(function () { simpanPengaturan_({ logo_file_id: '' }); }); return ok_({ app: pengaturanPublik_() }, 'Logo dihapus.'); }
  if (!f.base64) return fail_('Pilih gambar logo.');
  if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(String(f.mime))) return fail_('Logo harus berupa gambar PNG, JPG, WEBP, atau SVG.');
  const bytes = Utilities.base64Decode(String(f.base64));
  if (bytes.length > MAKS_LOGO_MB * 1024 * 1024) return fail_('Ukuran logo melebihi ' + MAKS_LOGO_MB + ' MB.');
  const file = DriveApp.getFolderById(prop_('FOLDER_LOGO')).createFile(Utilities.newBlob(bytes, f.mime, 'logo-' + Date.now() + '.' + (f.mime.split('/')[1] || 'png').replace('svg+xml', 'svg')));
  const peringatan = bagikanLink_(file);
  denganKunci_(function () { simpanPengaturan_({ logo_file_id: file.getId() }); });
  const res = ok_({ app: pengaturanPublik_(), peringatan: peringatan }, 'Logo diperbarui.'); res.auditEntitas = 'Pengaturan:logo'; res.auditDetail = 'Logo baru'; return res;
}
function apiGuruSimpan_(ctx, d) {
  const g = d.guru || {}, email = teks_(g.email, 120).toLowerCase(), nama = teks_(g.nama, 80);
  const peran = g.peran === 'admin' ? 'admin' : 'guru';
  if (!nama) return fail_('Nama guru wajib diisi.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail_('Email guru tidak valid (dipakai untuk masuk).');
  return denganKunci_(function () {
    const t = segar_('Pengguna');
    if (t.rows.some(function (r) { return r.Peran !== 'siswa' && r.Username === email && r.ID !== g.id; })) return fail_('Email ini sudah dipakai akun guru lain.');
    let r = g.id ? t.rows.filter(function (x) { return x.ID === g.id && x.Peran !== 'siswa'; })[0] : null;
    if (r) {
      const aktif = g.aktif === false ? 'Tidak' : 'Ya';
      if (r.ID === ctx.session.id && (aktif === 'Tidak' || peran !== r.Peran)) return fail_('Anda tidak bisa menonaktifkan atau menurunkan peran akun sendiri.');
      if (r.Peran === 'admin' && (peran !== 'admin' || aktif === 'Tidak') && t.rows.filter(function (x) { return x.Peran === 'admin' && x.Aktif === 'Ya'; }).length <= 1) return fail_('Harus ada minimal satu admin aktif.');
      r.Nama = nama; r.Username = email; r.Email = email; r.Peran = peran; r.Aktif = aktif;
      simpanUbah_('Pengguna', t, [r]);
      revokeAll_(r.ID);
      const res = ok_({ id: r.ID }, 'Akun guru diperbarui.'); res.auditEntitas = 'Pengguna:' + r.ID; res.auditDetail = 'Ubah akun guru'; return res;
    }
    const b = buatPengguna_(peran, email, nama, email);
    tambah_('Pengguna', [b.baris]);
    const res = ok_({ id: b.baris.ID, sandiAwal: b.sandi }, 'Akun guru dibuat.'); res.auditEntitas = 'Pengguna:' + b.baris.ID; res.auditDetail = 'Tambah akun ' + peran; return res;
  });
}
function apiGuruResetSandi_(ctx, d) {
  return denganKunci_(function () {
    const t = segar_('Pengguna'), r = t.rows.filter(function (x) { return x.ID === d.id && x.Peran !== 'siswa'; })[0];
    if (!r) return fail_('Akun tidak ditemukan.');
    const sandi = sandiAcak_(12); r.Salt = Utilities.getUuid(); r.Hash = hashPass_(sandi, r.Salt); r.Wajib_Ganti_Sandi = 'Ya';
    simpanUbah_('Pengguna', t, [r]); revokeAll_(r.ID);
    audit_(ctx, 'guru.resetSandi', 'Pengguna:' + r.ID, 'Kata sandi direset');
    return ok_({ sandiBaru: sandi }, 'Kata sandi baru dibuat.');
  });
}
function apiAuditList_() {
  const sh = sheet_('Audit_Log'), n = sh.getLastRow();
  if (n < 2) return ok_({ log: [] });
  const ambil = Math.min(100, n - 1), vals = sh.getRange(n - ambil + 1, 1, ambil, 5).getValues();
  return ok_({ log: vals.reverse().map(function (r) { return { waktu: sel_(r[0], 'Waktu'), pengguna: sel_(r[1]), aksi: sel_(r[2]), entitas: sel_(r[3]), detail: sel_(r[4]) }; }) });
}

// ==================================================================
// 17. IMPORT DATA (skill gas-migrasi-database)
//     Sumber HANYA dibaca. Baca berdasarkan nama kolom. Aman diulang.
// ==================================================================
const IMPORT_TARGET = {
  Kelas: { Nama_Kelas: ['nama_kelas', 'nama kelas', 'kelas', 'nama'], Jenjang: ['jenjang', 'tingkat'], Keterangan: ['keterangan', 'catatan'] },
  Mapel: { Nama_Mapel: ['nama_mapel', 'nama mapel', 'mapel', 'mata pelajaran', 'pelajaran', 'nama'], Label: ['label', 'kategori', 'program'] },
  Siswa: {
    ID_Siswa: ['id_siswa', 'id siswa', 'nis', 'no induk', 'nomor induk', 'id'], Nama: ['nama', 'nama lengkap', 'nama_siswa', 'nama siswa', 'nama murid'],
    Kelas: ['kelas', 'nama_kelas', 'nama kelas', 'kelas_id'], No_HP: ['no_hp', 'no hp', 'hp', 'wa', 'no wa', 'nomor wa', 'whatsapp', 'telepon', 'no telepon', 'nomor hp'],
    Email: ['email', 'e-mail', 'surel'], Tgl_Lahir: ['tgl_lahir', 'tanggal lahir', 'tgl lahir'], Alamat: ['alamat', 'alamat rumah'],
    Nama_Wali: ['nama_wali', 'nama wali', 'orang tua', 'nama orang tua', 'wali'], HP_Wali: ['hp_wali', 'hp wali', 'no hp wali', 'hp orang tua', 'no hp orang tua', 'wa orang tua'],
    Hubungan_Wali: ['hubungan_wali', 'hubungan wali', 'hubungan'], Status: ['status'], Tgl_Daftar: ['tgl_daftar', 'tanggal daftar', 'tanggal masuk', 'tgl masuk', 'timestamp']
  },
  Pembayaran: {
    ID_Siswa: ['id_siswa', 'id siswa', 'nis', 'siswa_id'], Nama: ['nama', 'nama siswa', 'nama_siswa'], Periode: ['periode', 'minggu', 'pekan', 'bulan', 'keterangan tagihan'],
    Jumlah: ['jumlah', 'nominal', 'biaya', 'total'], Jatuh_Tempo: ['jatuh_tempo', 'jatuh tempo', 'batas bayar'], Status: ['status', 'status bayar'], Tgl_Bayar: ['tgl_bayar', 'tanggal bayar', 'tgl bayar']
  },
  Jadwal: {
    Kelas: ['kelas', 'nama_kelas', 'nama kelas'], Mapel: ['mapel', 'mata pelajaran', 'nama_mapel', 'pelajaran'], Tanggal: ['tanggal', 'tgl'],
    Jam_Mulai: ['jam_mulai', 'jam mulai', 'mulai', 'jam'], Jam_Selesai: ['jam_selesai', 'jam selesai', 'selesai'], Ruang: ['ruang', 'ruangan', 'lokasi'], Tutor: ['tutor', 'guru', 'pengajar'], Catatan: ['catatan', 'keterangan']
  }
};
const IMPORT_URUTAN = ['Kelas', 'Mapel', 'Siswa', 'Pembayaran', 'Jadwal'];
function normKol_(s) { return String(s || '').toLowerCase().replace(/[_\-.]+/g, ' ').replace(/\s+/g, ' ').trim(); }
function petaKolom_(headers, target) {
  const def = IMPORT_TARGET[target], hasil = {}, norm = headers.map(normKol_);
  Object.keys(def).forEach(function (f) {
    const cands = [normKol_(f)].concat(def[f].map(normKol_));
    for (let i = 0; i < cands.length; i++) { const p = norm.indexOf(cands[i]); if (p > -1) { hasil[f] = headers[p]; break; } }
  });
  return hasil;
}
function tebakTarget_(namaSheet, headers) {
  const n = normKol_(namaSheet);
  if (/siswa|murid|peserta|anggota|member/.test(n)) return 'Siswa';
  if (/bayar|tagihan|spp|keuangan/.test(n)) return 'Pembayaran';
  if (/jadwal/.test(n)) return 'Jadwal';
  if (/mapel|pelajaran/.test(n)) return 'Mapel';
  if (/kelas/.test(n)) return 'Kelas';
  const p = petaKolom_(headers, 'Siswa');
  return p.Nama && (p.No_HP || p.Kelas) ? 'Siswa' : '';
}
function bukaSumber_(idOrUrl) {
  const m = String(idOrUrl || '').match(/\/d\/([A-Za-z0-9_-]{20,})/);
  const id = m ? m[1] : String(idOrUrl || '').trim();
  if (!id) throw new Error('Tempel URL atau ID spreadsheet lama.');
  if (id === prop_('SPREADSHEET_ID')) throw new Error('Itu spreadsheet database aplikasi ini. Tempel spreadsheet LAMA.');
  try { return SpreadsheetApp.openById(id); }
  catch (e) { throw new Error('Spreadsheet tidak bisa dibuka. Pastikan URL benar dan file bisa diakses oleh akun Google pemilik aplikasi.'); }
}
function bacaSumber_(ss, nama) {
  const sh = ss.getSheetByName(nama); if (!sh) return null;
  const v = sh.getDataRange().getValues(); if (v.length <= 1) return { headers: v[0] ? v[0].map(String) : [], rows: [] };
  const h = v[0].map(function (x) { return String(x).trim(); });
  return { headers: h, rows: v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    const o = {}; h.forEach(function (k, i) { if (k) o[k] = sel_(r[i], /tanggal|tgl|tempo/i.test(k) ? 'Tanggal' : k); }); return o;
  }) };
}
function apiImportBaca_(ctx, d) {
  const ss = bukaSumber_(d.sumber);
  return ok_({ nama: ss.getName(), sheet: ss.getSheets().map(function (sh) {
    const lastCol = sh.getLastColumn(), headers = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String).filter(String) : [];
    const target = tebakTarget_(sh.getName(), headers);
    return { nama: sh.getName(), baris: Math.max(0, sh.getLastRow() - 1), kolom: headers.slice(0, 20), target: target, peta: target ? petaKolom_(headers, target) : {} };
  }) });
}
/**
 * d = { sumber?, peta:[{sheet, target}], csv?:{target, rows:[{...}]}, dryRun, timpa }
 * Kunci alami: Kelas=nama, Mapel=nama, Siswa=ID→HP→nama+kelas, Pembayaran=siswa+periode, Jadwal=tanggal+jam+kelas+mapel
 */
function apiImportJalankan_(ctx, d) {
  const dry = d.dryRun !== false, timpa = !!d.timpa;
  const paket = {};                                       // target → [baris sumber yang sudah dipetakan]
  let namaSumber = 'CSV';
  if (d.csv && d.csv.rows) {
    const target = d.csv.target || 'Siswa'; if (!IMPORT_TARGET[target]) return fail_('Target import tidak dikenal.');
    const headers = Object.keys(d.csv.rows[0] || {}), pk = petaKolom_(headers, target);
    paket[target] = d.csv.rows.slice(0, 3000).map(function (r) { const o = {}; Object.keys(pk).forEach(function (f) { o[f] = teks_(r[pk[f]], 500); }); return o; });
  } else {
    const ss = bukaSumber_(d.sumber); namaSumber = ss.getName();
    (d.peta || []).forEach(function (p) {
      if (!IMPORT_TARGET[p.target]) return;
      const src = bacaSumber_(ss, p.sheet); if (!src) return;
      const pk = petaKolom_(src.headers, p.target);
      paket[p.target] = (paket[p.target] || []).concat(src.rows.map(function (r) { const o = {}; Object.keys(pk).forEach(function (f) { o[f] = teks_(r[pk[f]], 500); }); return o; }));
    });
  }
  if (!Object.keys(paket).length) return fail_('Tidak ada sheet yang dipilih untuk diimpor.');

  const jalan = function () {
    const lap = {}, peringatan = [], akunBaru = [];
    const tk = segar_('Kelas'), tm = segar_('Mapel');
    const kelasIdx = {}; tk.rows.forEach(function (r) { kelasIdx[r.Nama_Kelas.toLowerCase()] = r.ID_Kelas; });
    const mapelIdx = {}; tm.rows.forEach(function (r) { mapelIdx[r.Nama_Mapel.toLowerCase()] = r.ID_Mapel; });
    const kelasBaru = [], mapelBaru = [];
    const pastikanKelas = function (nama) {
      nama = teks_(nama, 60); if (!nama) return '';
      const k = nama.toLowerCase(); if (kelasIdx[k]) return kelasIdx[k];
      const id = idBaru_('KLS'); kelasIdx[k] = id; kelasBaru.push({ ID_Kelas: id, Nama_Kelas: nama, Jenjang: '', Keterangan: 'Import ' + namaSumber });
      return id;
    };
    const pastikanMapel = function (nama) {
      nama = teks_(nama, 60); if (!nama) return '';
      const k = nama.toLowerCase(); if (mapelIdx[k]) return mapelIdx[k];
      const id = idBaru_('MP'); mapelIdx[k] = id; mapelBaru.push({ ID_Mapel: id, Nama_Mapel: nama, Label: '' });
      return id;
    };
    (paket.Kelas || []).forEach(function (r) { pastikanKelas(r.Nama_Kelas); });
    const kelasDariPaket = kelasBaru.length;
    (paket.Mapel || []).forEach(function (r) { pastikanMapel(r.Nama_Mapel); });
    const mapelDariPaket = mapelBaru.length;

    // --- Siswa
    const ts = segar_('Siswa'), byId = {}, byHp = {}, byNama = {};
    const daftarkan = function (s) { byId[s.ID_Siswa] = s; if (hp_(s.No_HP)) byHp[hp_(s.No_HP)] = s; byNama[(s.Nama + '|' + s.Kelas_ID).toLowerCase()] = s; };
    ts.rows.forEach(daftarkan);
    const nextId = idSiswaBaru_(ts.rows), siswaBaru = [], siswaUbah = [], dilihat = {};
    const KOLOM_SISWA = ['Nama', 'No_HP', 'Email', 'Tgl_Lahir', 'Alamat', 'Nama_Wali', 'HP_Wali', 'Hubungan_Wali'];
    let lewatSiswa = 0;
    (paket.Siswa || []).forEach(function (r) {
      const nama = teks_(r.Nama, 80); if (!nama) { lewatSiswa++; return; }
      const kelasId = r.Kelas ? pastikanKelas(r.Kelas) : '';
      const idSrc = teks_(r.ID_Siswa, 30).toUpperCase(), hp = hp_(r.No_HP);
      const kunci = idSrc || hp || (nama + '|' + kelasId).toLowerCase();
      if (dilihat[kunci]) { lewatSiswa++; peringatan.push('Data ganda di sumber dilewati: ' + nama); return; }
      dilihat[kunci] = 1;
      const ada = (idSrc && byId[idSrc]) || (hp && byHp[hp]) || byNama[(nama + '|' + kelasId).toLowerCase()];
      const nilai = { Nama: nama, No_HP: hp, Email: teks_(r.Email, 120).toLowerCase(), Tgl_Lahir: tglValid_(r.Tgl_Lahir) ? r.Tgl_Lahir : '', Alamat: teks_(r.Alamat, 300),
        Nama_Wali: teks_(r.Nama_Wali, 80), HP_Wali: hp_(r.HP_Wali), Hubungan_Wali: teks_(r.Hubungan_Wali, 30) };
      if (ada) {
        let berubah = false;
        KOLOM_SISWA.forEach(function (f) { if (nilai[f] && (timpa ? ada[f] !== nilai[f] : !ada[f])) { ada[f] = nilai[f]; berubah = true; } });
        if (kelasId && (timpa ? ada.Kelas_ID !== kelasId : !ada.Kelas_ID)) { ada.Kelas_ID = kelasId; berubah = true; }
        if (berubah && ada._r && siswaUbah.indexOf(ada) === -1) siswaUbah.push(ada);
        if (!berubah) lewatSiswa++;
        return;
      }
      if (!kelasId) peringatan.push(nama + ' tidak punya kelas — tetap diimpor, atur kelasnya nanti.');
      const st = /non|keluar|lulus|berhenti/i.test(r.Status || '') ? 'Nonaktif' : 'Aktif';
      const baru = { ID_Siswa: idSrc && !byId[idSrc] && /^[A-Z0-9\-]{3,20}$/.test(idSrc) ? idSrc : nextId(), Kelas_ID: kelasId, Status: st,
        Tgl_Daftar: tglValid_(String(r.Tgl_Daftar).slice(0, 10)) ? String(r.Tgl_Daftar).slice(0, 10) : hariIni_() };
      KOLOM_SISWA.forEach(function (f) { baru[f] = nilai[f]; });
      siswaBaru.push(baru); daftarkan(baru);
    });
    lap.Siswa = { sumber: (paket.Siswa || []).length, ditambah: siswaBaru.length, diperbarui: siswaUbah.length, dilewati: lewatSiswa };

    // --- Pembayaran
    const tb = segar_('Pembayaran'), adaBayar = {}, bayarBaru = []; let lewatBayar = 0;
    tb.rows.forEach(function (x) { adaBayar[x.Siswa_ID + '|' + String(x.Periode).toLowerCase()] = x; });
    const cariSiswa = function (r) {
      const id = teks_(r.ID_Siswa, 30).toUpperCase(); if (id && byId[id]) return byId[id];
      const nm = teks_(r.Nama, 80).toLowerCase(); if (!nm) return null;
      const c = Object.keys(byNama).filter(function (k) { return k.split('|')[0] === nm; });
      return c.length === 1 ? byNama[c[0]] : null;
    };
    (paket.Pembayaran || []).forEach(function (r) {
      const s = cariSiswa(r), per = teks_(r.Periode, 40);
      if (!s || !per) { lewatBayar++; if (!s && (r.Nama || r.ID_Siswa)) peringatan.push('Tagihan dilewati, siswa tidak ditemukan/ganda: ' + (r.Nama || r.ID_Siswa)); return; }
      const k = s.ID_Siswa + '|' + per.toLowerCase();
      if (adaBayar[k]) { lewatBayar++; return; }
      const lunas = /lunas|sudah|paid/i.test(r.Status || '');
      const o = { ID: idBaru_('BYR'), Siswa_ID: s.ID_Siswa, Periode: per, Jumlah: String(Math.round(angka_(r.Jumlah))), Jatuh_Tempo: tglValid_(r.Jatuh_Tempo) ? r.Jatuh_Tempo : '',
        Status: lunas ? 'Lunas' : 'Belum Bayar', Tgl_Bayar: lunas && tglValid_(r.Tgl_Bayar) ? r.Tgl_Bayar : '', Catatan: 'Import' };
      adaBayar[k] = o; bayarBaru.push(o);
    });
    lap.Pembayaran = { sumber: (paket.Pembayaran || []).length, ditambah: bayarBaru.length, diperbarui: 0, dilewati: lewatBayar };

    // --- Jadwal
    const tj = segar_('Jadwal'), adaJ = {}, jadwalBaru = []; let lewatJ = 0;
    tj.rows.forEach(function (x) { adaJ[[x.Tanggal, x.Jam_Mulai, x.Kelas_ID, x.Mapel_ID].join('|')] = 1; });
    (paket.Jadwal || []).forEach(function (r) {
      const tgl = String(r.Tanggal || '').slice(0, 10), jam = String(r.Jam_Mulai || '').slice(0, 5);
      if (!tglValid_(tgl) || !jamValid_(jam)) { lewatJ++; return; }
      const kid = /semua/i.test(r.Kelas || '') ? 'SEMUA' : pastikanKelas(r.Kelas), mid = pastikanMapel(r.Mapel || 'Umum');
      const k = [tgl, jam, kid, mid].join('|'); if (adaJ[k]) { lewatJ++; return; }
      adaJ[k] = 1;
      jadwalBaru.push({ ID: idBaru_('JDW'), Kelas_ID: kid, Mapel_ID: mid, Tanggal: tgl, Jam_Mulai: jam, Jam_Selesai: jamValid_(String(r.Jam_Selesai).slice(0, 5)) ? String(r.Jam_Selesai).slice(0, 5) : '',
        Ruang: teks_(r.Ruang, 60), Tutor: teks_(r.Tutor, 80), Catatan: teks_(r.Catatan, 300) });
    });
    lap.Jadwal = { sumber: (paket.Jadwal || []).length, ditambah: jadwalBaru.length, diperbarui: 0, dilewati: lewatJ };
    // kelas/mapel bisa bertambah dari data siswa & jadwal juga
    lap.Kelas = { sumber: (paket.Kelas || []).length, ditambah: kelasBaru.length, diperbarui: 0, dilewati: (paket.Kelas || []).length - kelasDariPaket };
    lap.Mapel = { sumber: (paket.Mapel || []).length, ditambah: mapelBaru.length, diperbarui: 0, dilewati: (paket.Mapel || []).length - mapelDariPaket };

    if (!dry) {
      tambah_('Kelas', kelasBaru);
      tambah_('Mapel', mapelBaru);
      simpanUbah_('Siswa', ts, siswaUbah);
      tambah_('Siswa', siswaBaru);
      if (siswaBaru.length) {
        const tu = segar_('Pengguna'), punyaAkun = {};
        tu.rows.forEach(function (u) { if (u.Peran === 'siswa') punyaAkun[u.Username] = 1; });
        const akun = siswaBaru.filter(function (s) { return !punyaAkun[s.ID_Siswa]; }).map(function (s) {
          const b = buatPengguna_('siswa', s.ID_Siswa, s.Nama, s.Email);
          if (s.Status === 'Nonaktif') b.baris.Aktif = 'Tidak';
          akunBaru.push({ id: s.ID_Siswa, nama: s.Nama, sandi: b.sandi });
          return b.baris;
        });
        tambah_('Pengguna', akun);
      }
      tambah_('Pembayaran', bayarBaru);
      tambah_('Jadwal', jadwalBaru);
    }
    return { lap: lap, peringatan: peringatan, akunBaru: akunBaru };
  };
  const h = dry ? jalan() : denganKunci_(jalan);
  if (!dry) {
    SEMUA_TABEL.forEach(function (n) { bump_('t_' + n); });
    audit_(ctx, 'IMPORT_RUN', 'Import:' + namaSumber, Object.keys(h.lap).map(function (k) { return k + '+' + h.lap[k].ditambah + '~' + h.lap[k].diperbarui; }).join(' '));
  }
  return ok_({ sumber: namaSumber, dryRun: dry, laporan: h.lap, peringatan: h.peringatan.slice(0, 50), akunBaru: h.akunBaru },
    dry ? 'Pindai selesai — belum ada data yang ditulis.' : 'Import selesai.');
}

// ==================================================================
// 18. WARMUP & TRIGGER (skill gas-scale-turbo)
// ==================================================================
function warmCaches_(scope) {
  const c = CacheService.getScriptCache(), flag = 'warm_' + scope;
  if (scope !== 'setup' && c.get(flag)) return 'skip';
  c.put(flag, '1', scope === 'tick' ? 240 : 60);
  if (!prop_('SPREADSHEET_ID')) return 'belum-setup';
  const inti = ['Pengaturan', 'Pengguna', 'Siswa', 'Kelas', 'Mapel'];
  const daftar = scope === 'pub' ? inti : SEMUA_TABEL;
  daftar.forEach(function (n) { try { tabel_(n); } catch (e) { /* lewati */ } });
  c.put('warm_last', JSON.stringify({ at: new Date().toISOString(), scope: scope }), 21600);
  return 'ok';
}
function keepWarm() { if (prop_('KEEP_WARM') !== 'off') warmCaches_('tick'); }
function pasangTrigger_() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'keepWarm') ScriptApp.deleteTrigger(t); });
  if (prop_('KEEP_WARM') === 'off') return 'mati';
  ScriptApp.newTrigger('keepWarm').timeBased().everyMinutes(5).create();
  return 'aktif (5 menit)';
}
function nyalakanKeepWarm() { setProp_('KEEP_WARM', 'on'); Logger.log('✅ keepWarm: ' + pasangTrigger_()); }
function matikanKeepWarm() { setProp_('KEEP_WARM', 'off'); pasangTrigger_(); Logger.log('⏸️ keepWarm dimatikan.'); }

// ==================================================================
// 19. SETUP — jalankan sekali (idempoten, tidak menimpa rahasia)
// ==================================================================
function setupAppEnvironment() {
  const APP = prop_('DEMO_MODE') === 'on' ? 'Syarifah Course (Demo)' : 'Syarifah Course';
  Logger.log('🚀 Menyiapkan ' + APP + ' v' + APP_VERSION + ' ...');

  // 1) Folder Drive — cari dari properti, buat bila belum ada
  const folder = function (key, nama, induk) {
    const id = prop_(key);
    if (id) { try { return DriveApp.getFolderById(id); } catch (e) { /* hilang → buat ulang */ } }
    const f = induk ? induk.createFolder(nama) : DriveApp.createFolder(nama);
    setProp_(key, f.getId());
    return f;
  };
  const root = folder('DRIVE_ROOT_FOLDER_ID', '📁 ' + APP);
  folder('FOLDER_MATERI', '📂 Materi', root);
  folder('FOLDER_LOGO', '📂 Logo', root);

  // 2) Spreadsheet database
  let ss = null;
  if (prop_('SPREADSHEET_ID')) { try { ss = SpreadsheetApp.openById(prop_('SPREADSHEET_ID')); } catch (e) { ss = null; } }
  if (!ss) {
    ss = SpreadsheetApp.create('🗃️ Database — ' + APP);
    DriveApp.getFileById(ss.getId()).moveTo(root);
    setProp_('SPREADSHEET_ID', ss.getId());
  }
  _SS = ss;
  try { ss.setSpreadsheetTimeZone(TZ); } catch (e) { /* abaikan */ }

  // 3) Sheet & kolom (kolom yang belum ada ditambahkan di akhir — data lama tidak disentuh)
  Object.keys(SKEMA).forEach(function (nama) {
    let sh = ss.getSheetByName(nama);
    if (!sh) {
      const kosong = ss.getSheets().filter(function (s) { return /^(Sheet1|Lembar1|Sheet 1)$/.test(s.getName()) && s.getLastRow() === 0; })[0];
      sh = kosong ? kosong.setName(nama) : ss.insertSheet(nama);
    }
    const lastCol = sh.getLastColumn(), ada = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
    const kurang = SKEMA[nama].filter(function (h) { return ada.indexOf(h) === -1; });
    if (kurang.length) sh.getRange(1, ada.filter(String).length + 1, 1, kurang.length).setValues([kurang]);
    const n = sh.getLastColumn();
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, n).setFontWeight('bold').setBackground('#0B1F3A').setFontColor('#FFFFFF');
    sh.getRange(1, 1, sh.getMaxRows(), n).setNumberFormat('@');           // semua teks: 0 di depan & tanggal aman
  });

  // 4) Pengaturan default (hanya yang belum ada)
  const set = ss.getSheetByName('Pengaturan'), adaSet = {};
  if (set.getLastRow() > 1) set.getRange(2, 1, set.getLastRow() - 1, 1).getValues().forEach(function (r) { adaSet[r[0]] = 1; });
  const tambahSet = Object.keys(PENGATURAN_DEFAULT).filter(function (k) { return !adaSet[k]; }).map(function (k) { return [k, PENGATURAN_DEFAULT[k]]; });
  if (tambahSet.length) set.getRange(set.getLastRow() + 1, 1, tambahSet.length, 2).setValues(tambahSet);

  // 5) Rahasia (tidak menimpa yang sudah ada)
  secret_(); pepper_();
  if (!prop_('EMERGENCY_PASS_HASH')) {
    const sandi = sandiAcak_(16), salt = Utilities.getUuid();
    setProps_({ EMERGENCY_USER: 'darurat', EMERGENCY_SALT: salt, EMERGENCY_PASS_HASH: hashDarurat_(sandi, salt) });
    Logger.log('');
    Logger.log('🔐 AKSES DARURAT — catat sekarang (hanya tampil sekali)');
    Logger.log('   Tab Guru → Email: darurat   Kata sandi: ' + sandi);
  }

  // 6) Akun admin pertama (bila belum ada admin)
  const pg = ss.getSheetByName('Pengguna');
  const adaAdmin = pg.getLastRow() > 1 && pg.getRange(2, 2, pg.getLastRow() - 1, 1).getValues().some(function (r) { return r[0] === 'admin'; });
  if (!adaAdmin && prop_('DEMO_MODE') !== 'on') {             // versi demo memakai akun demo (lihat setupDemo)
    let email = '';
    try { email = Session.getEffectiveUser().getEmail(); } catch (e) { email = ''; }
    email = (email || 'admin@syarifah.course').toLowerCase();
    const b = buatPengguna_('admin', email, 'Admin Syarifah Course', email);
    const head = SKEMA.Pengguna;
    tulisRentang_(pg, pg.getLastRow() + 1, [barisKe_(head, b.baris)], head.length);
    Logger.log('');
    Logger.log('👤 AKUN ADMIN PERTAMA — catat sekarang (hanya tampil sekali)');
    Logger.log('   Tab Guru → Email: ' + email + '   Kata sandi: ' + b.sandi);
    Logger.log('   Setelah masuk, ganti kata sandi di menu Pengaturan → Keamanan.');
  }

  // 7) Cermin konfigurasi Kelas B (catatan baca-saja; kode TIDAK membaca dari sini)
  const ac = ss.getSheetByName('AppConfig');
  if (ac.getLastRow() > 1) ac.getRange(2, 1, ac.getLastRow() - 1, 3).clearContent();
  const cermin = [
    ['SPREADSHEET_ID', ss.getId(), 'Database (sumber kebenaran: Script Properties)'],
    ['DRIVE_ROOT_FOLDER_ID', prop_('DRIVE_ROOT_FOLDER_ID'), 'Folder utama di Drive'],
    ['FOLDER_MATERI', prop_('FOLDER_MATERI'), 'Folder berkas materi'],
    ['FOLDER_LOGO', prop_('FOLDER_LOGO'), 'Folder logo aplikasi'],
    ['APP_VERSION', APP_VERSION, 'Versi backend'],
    ['DISIAPKAN', new Date().toISOString(), 'Terakhir setup dijalankan'],
    ['CATATAN', 'Rahasia (token, sandi, secret) TIDAK disimpan di sheet ini.', 'Lihat Script Properties']
  ];
  ac.getRange(2, 1, cermin.length, 3).setValues(cermin);
  ac.autoResizeColumns(1, 3);

  // 8) Trigger & cache
  SEMUA_TABEL.forEach(function (n) { bump_('t_' + n); });
  const tr = pasangTrigger_();
  warmCaches_('setup');

  Logger.log('');
  Logger.log('✅ Setup selesai.');
  Logger.log('   Spreadsheet : ' + ss.getUrl());
  Logger.log('   Folder Drive: ' + root.getUrl());
  Logger.log('   keepWarm    : ' + tr);
  Logger.log('   Langkah berikutnya: Deploy → New deployment → Web app (Execute as: Me, Who has access: Anyone).');
}

/** Opsional — isi data contoh agar aplikasi bisa langsung dicoba. Aman diulang (tidak dobel). */
function isiDataContoh() {
  if (!prop_('SPREADSHEET_ID')) throw new Error('Jalankan setupAppEnvironment() dulu.');
  const sudah = rows_('Siswa').some(function (s) { return s.Catatan_Oleh === 'Data Contoh' || /^Contoh/.test(s.Alamat); });
  if (sudah) { Logger.log('ℹ️ Data contoh sudah ada — tidak ditambah lagi.'); return; }
  denganKunci_(function () {
    const kini = hariIni_(), now = new Date().toISOString();
    const k1 = { ID_Kelas: idBaru_('KLS'), Nama_Kelas: '12 SMA Intensif', Jenjang: 'SMA', Keterangan: 'Persiapan UTBK' };
    const k2 = { ID_Kelas: idBaru_('KLS'), Nama_Kelas: '9 SMP Reguler', Jenjang: 'SMP', Keterangan: '' };
    tambah_('Kelas', [k1, k2]);
    const m1 = { ID_Mapel: idBaru_('MP'), Nama_Mapel: 'Matematika', Label: 'SMA - K13' };
    const m2 = { ID_Mapel: idBaru_('MP'), Nama_Mapel: 'Bahasa Inggris', Label: 'Intensif UTBK' };
    const m3 = { ID_Mapel: idBaru_('MP'), Nama_Mapel: 'Fisika', Label: 'Saintek' };
    tambah_('Mapel', [m1, m2, m3]);
    const nama = [['Syarifah Nurul Aini', k1], ['Muhammad Farhan', k1], ['Aulia Rahma', k1], ['Rizki Pratama', k1], ['Nabila Putri', k2], ['Fajar Hidayat', k2]];
    const next = idSiswaBaru_(rows_('Siswa'));
    const siswa = nama.map(function (n, i) {
      return { ID_Siswa: next(), Nama: n[0], Kelas_ID: n[1].ID_Kelas, No_HP: '08123456780' + i, Email: '', Tgl_Lahir: '', Alamat: 'Contoh — ubah atau hapus', Nama_Wali: '', HP_Wali: '',
        Hubungan_Wali: '', Status: 'Aktif', Tgl_Daftar: kini, Catatan_Guru: i === 0 ? 'Pertahankan pemahaman trigonometri dan tingkatkan latihan fisika. Semangat menuju try out!' : '', Catatan_Oleh: i === 0 ? 'Ustadzah Syarifah' : '', Catatan_Tgl: i === 0 ? kini : '' };
    });
    tambah_('Siswa', siswa);
    const akun = siswa.map(function (s) { const b = buatPengguna_('siswa', s.ID_Siswa, s.Nama, ''); Logger.log('   ' + s.ID_Siswa + ' — ' + s.Nama + ' — sandi: ' + b.sandi); return b.baris; });
    tambah_('Pengguna', akun);
    const jadwal = [];
    [-6, -3, 0, 1, 4].forEach(function (g, i) {
      jadwal.push({ ID: idBaru_('JDW'), Kelas_ID: k1.ID_Kelas, Mapel_ID: [m1, m2, m3][i % 3].ID_Mapel, Tanggal: tglGeser_(kini, g), Jam_Mulai: '16:00', Jam_Selesai: '17:30', Ruang: 'Ruang A', Tutor: 'Ustadzah Syarifah', Catatan: '' });
    });
    tambah_('Jadwal', jadwal);
    const hadir = [];
    jadwal.filter(function (j) { return j.Tanggal < kini; }).forEach(function (j) {
      siswa.filter(function (s) { return s.Kelas_ID === k1.ID_Kelas; }).forEach(function (s, i) {
        hadir.push({ ID: idBaru_('HD'), Tanggal: j.Tanggal, Kelas_ID: k1.ID_Kelas, Siswa_ID: s.ID_Siswa, Status: i === 3 ? 'Izin' : 'Hadir', Keterangan: i === 3 ? 'Sakit' : '', Jadwal_ID: j.ID, Dicatat_Oleh: 'Data Contoh', Waktu: now });
      });
    });
    tambah_('Kehadiran', hadir);
    tambah_('Pembayaran', siswa.map(function (s, i) {
      const senin = seninDari_(kini);
      return { ID: idBaru_('BYR'), Siswa_ID: s.ID_Siswa, Periode: labelMinggu_(senin), Minggu_Mulai: senin, Jumlah: '120000', Jatuh_Tempo: tglGeser_(senin, HARI_TEMPO_DEFAULT), Status: i % 2 ? 'Lunas' : 'Belum Bayar', Tgl_Bayar: i % 2 ? kini : '', Catatan: '' };
    }));
    const lat = { ID: idBaru_('LAT'), Judul: 'Trigonometri Dasar', Mapel_ID: m1.ID_Mapel, Kelas_ID: k1.ID_Kelas, Bab: 'Bab 3', Durasi_Menit: '20', KKM: '75', Status: 'Terbit', Dibuat_Oleh: 'contoh', Dibuat: now, Diubah: now };
    tambah_('Latihan', [lat]);
    const soal = [
      ['Jika sin α = 3/5 dan α di kuadran I, nilai cos α adalah…', '3/4', '4/5', '5/4', '3/5', 'B', 'cos α = √(1 − sin²α) = √(1 − 9/25) = 4/5.'],
      ['Nilai tan 45° adalah…', '0', '1/2', '1', '√3', 'C', 'tan 45° = sin 45° / cos 45° = 1.'],
      ['sin² x + cos² x = …', '0', '1', '2', 'tan x', 'B', 'Identitas Pythagoras.'],
      ['Nilai sin 30° adalah…', '1/2', '√2/2', '√3/2', '1', 'A', 'Sudut istimewa: sin 30° = 1/2.'],
      ['Jika cos α = 0, maka α (0°–180°) adalah…', '0°', '45°', '90°', '180°', 'C', 'cos 90° = 0.']
    ];
    tambah_('Soal', soal.map(function (s, i) {
      return { ID: idBaru_('SOAL'), Latihan_ID: lat.ID, No: String(i + 1), Pertanyaan: s[0], Opsi_A: s[1], Opsi_B: s[2], Opsi_C: s[3], Opsi_D: s[4], Kunci: s[5], Bobot: '10', Pembahasan: s[6] };
    }));
    // materi contoh: PDF dibuat dari HTML
    const html = '<h1>Rumus Cepat Trigonometri</h1><p>Materi contoh Syarifah Course. Ganti dengan modul Anda.</p><ul><li>sin²x + cos²x = 1</li><li>tan x = sin x / cos x</li><li>sin 2x = 2 sin x cos x</li></ul>';
    const blob = Utilities.newBlob(html, 'text/html', 'contoh.html').getAs('application/pdf').setName('Modul-Rumus-Cepat-Trigonometri.pdf');
    const file = DriveApp.getFolderById(prop_('FOLDER_MATERI')).createFile(blob);
    bagikanLink_(file);
    tambah_('Materi', [{ ID: idBaru_('MTR'), Judul: 'Rumus Cepat Identitas Trigonometri', Mapel_ID: m1.ID_Mapel, Kelas_ID: k1.ID_Kelas, Bab: 'Bab 3 • Trigonometri Analitik',
      Deskripsi: 'Ringkasan identitas trigonometri dan trik mengerjakan soal UTBK.', Tag: 'Wajib', File_ID: file.getId(), Nama_File: file.getName(), Ukuran: String(file.getSize()), Halaman: '1',
      Diunggah_Oleh: 'contoh', Tanggal: now }]);
  });
  Logger.log('✅ Data contoh ditambahkan. Akun siswa contoh tercantum di atas.');
}

// ==================================================================
// 20. FUNSI EDITOR — perawatan
// ==================================================================
function cekPerforma() {
  const c = CacheService.getScriptCache(), hasil = [];
  muatVersi_();
  SEMUA_TABEL.forEach(function (n) { hasil.push(n + ': ' + (c.get('tb_' + n + '_' + ver_('t_' + n)) ? 'HANGAT' : 'dingin')); });
  Logger.log('📊 Cache tabel:\n   ' + hasil.join('\n   '));
  Logger.log('🔥 Warmup terakhir: ' + (c.get('warm_last') || '-'));
  Logger.log('⏱️ Trigger: ' + ScriptApp.getProjectTriggers().map(function (t) { return t.getHandlerFunction(); }).join(', '));
  const props = PROPS.getProperties(), ukuran = JSON.stringify(props).length;
  Logger.log('🔑 Script Properties: ' + Object.keys(props).length + ' kunci, ±' + Math.round(ukuran / 1024) + ' KB dari 500 KB');
}
function resetSandiAdmin() {
  denganKunci_(function () {
    const t = segar_('Pengguna'), admin = t.rows.filter(function (r) { return r.Peran === 'admin'; })[0];
    if (!admin) { Logger.log('Tidak ada akun admin. Jalankan setupAppEnvironment().'); return; }
    const sandi = sandiAcak_(12); admin.Salt = Utilities.getUuid(); admin.Hash = hashPass_(sandi, admin.Salt); admin.Aktif = 'Ya'; admin.Wajib_Ganti_Sandi = 'Ya';
    simpanUbah_('Pengguna', t, [admin]); revokeAll_(admin.ID);
    Logger.log('🔐 Admin: ' + admin.Username + '  Kata sandi baru: ' + sandi);
  });
}
function resetAksesDarurat() {
  const p = sandiAcak_(16), salt = Utilities.getUuid();
  setProps_({ EMERGENCY_USER: 'darurat', EMERGENCY_SALT: salt, EMERGENCY_PASS_HASH: hashDarurat_(p, salt) });
  delProp_('DARURAT_KUNCI_SAMPAI'); revokeAll_('darurat');
  Logger.log('🔐 Akses darurat baru → Email: darurat   Kata sandi: ' + p);
}
function rotasiSecretSesi() { setProp_('SESSION_SECRET', acak_(64)); Logger.log('✅ SESSION_SECRET dirotasi — semua pengguna harus masuk lagi.'); }

// ==================================================================
// 21. MODE DEMO — hanya untuk versi demo (deploy di Google Apps Script saja)
// ------------------------------------------------------------------
// • Tampilan disajikan langsung oleh GAS (HtmlService, berkas Index.html)
//   dan memanggil server lewat google.script.run → tanpa GitHub.
// • Akun demo tetap (sandi sama), data contoh lengkap, dan semua data
//   dipulihkan otomatis setiap malam pukul 00.00 WIB (trigger resetDemo).
// • Fitur yang bisa merusak akun demo bagi pengunjung lain dikunci.
// Jalankan sekali di editor: setupDemo()
// ==================================================================
const DEMO_SANDI = 'demo1234';                     // sengaja publik — hanya untuk akun demo
const DEMO_EMAIL = { admin: 'admin@syarifah.demo', guru: 'guru@syarifah.demo' };
const DEMO_UID = { admin: 'U-DEMO-ADMIN', guru: 'U-DEMO-GURU', siswa: 'U-DEMO-SISWA' };
const DEMO_MAKS_UNGGAH_MB = 2;
const DEMO_TERKUNCI = {
  'auth.gantiSandi': 'Ganti kata sandi',
  'auth.keluarSemua': 'Keluar dari semua perangkat',
  'siswa.resetSandi': 'Reset kata sandi siswa',
  'guru.resetSandi': 'Reset kata sandi guru',
  'import.baca': 'Import dari Google Sheets'
};

function demoAktif_() { return prop_('DEMO_MODE') === 'on'; }

/** Info demo untuk halaman login (lewat pengaturanPublik_). */
function demoInfo_() {
  if (!demoAktif_()) return null;
  return {
    sandi: DEMO_SANDI,
    reset: 'Data demo dipulihkan otomatis setiap hari pukul 00.00 WIB.',
    akun: [
      { label: 'Admin', peran: 'guru', username: DEMO_EMAIL.admin, ket: 'Akses penuh + Pengaturan' },
      { label: 'Guru', peran: 'guru', username: DEMO_EMAIL.guru, ket: 'Kelas, materi & nilai' },
      { label: 'Siswa', peran: 'siswa', username: prop_('DEMO_SISWA_ID') || '', ket: 'Materi & latihan soal' }
    ]
  };
}

/** Penjaga aksi di versi demo. Mengembalikan respons gagal bila aksi dikunci. */
function demoBlokir_(action, d, ctx) {
  if (!demoAktif_()) return null;
  const kunci = function (fitur) { return fail_(fitur + ' dinonaktifkan di versi demo agar akun demo tetap bisa dipakai semua pengunjung.', { code: 'DEMO' }); };
  if (DEMO_TERKUNCI[action]) return kunci(DEMO_TERKUNCI[action]);
  if (action === 'auth.login' && String(d.password || '') === DEMO_SANDI) {      // sandi demo benar → buka kunci percobaan gagal
    const p = d.peran === 'guru' ? 'guru' : 'siswa', u = p === 'guru' ? teks_(d.username, 120).toLowerCase() : teks_(d.username, 120).toUpperCase();
    CacheService.getScriptCache().removeAll(['lgk_' + p + '_' + u, 'lg_' + p + '_' + u]);
  }
  if (action === 'import.jalankan') {
    if (!d.csv) return kunci('Import dari Google Sheets');
    if (d.csv.rows && d.csv.rows.length > 100) return fail_('Di versi demo, import CSV dibatasi 100 baris.');
  }
  const uidDemo = [DEMO_UID.admin, DEMO_UID.guru, DEMO_UID.siswa], siswaDemo = prop_('DEMO_SISWA_ID');
  if (action === 'guru.simpan' && d.guru && uidDemo.indexOf(d.guru.id) > -1) return kunci('Mengubah akun demo');
  if (action === 'siswa.hapus' && d.id && d.id === siswaDemo) return kunci('Menghapus siswa akun demo');
  if (action === 'siswa.simpan' && d.siswa && d.siswa.id && d.siswa.id === siswaDemo && d.siswa.status === 'Nonaktif') return kunci('Menonaktifkan siswa akun demo');
  if (action === 'materi.unggah' && String((d.file || {}).base64 || '').length > DEMO_MAKS_UNGGAH_MB * 1024 * 1024 * 4 / 3 + 8)
    return fail_('Di versi demo, ukuran berkas materi dibatasi ' + DEMO_MAKS_UNGGAH_MB + ' MB.');
  return null;
}

// ---------- Tampilan web (HtmlService) & jembatan google.script.run ----------
function halamanWeb_() {
  let pub;
  try { pub = pengaturanPublik_(); }
  catch (e) {
    return HtmlService.createHtmlOutput('<div style="font-family:sans-serif;padding:32px;max-width:520px;margin:auto"><h2>Aplikasi belum disiapkan</h2>' +
      '<p>Buka editor Apps Script, pilih fungsi <b>setupDemo</b>, lalu klik <b>Run</b>. Setelah selesai, muat ulang halaman ini.</p></div>')
      .setTitle('Syarifah Course').addMetaTag('viewport', 'width=device-width, initial-scale=1');
  }
  const out = HtmlService.createHtmlOutputFromFile('Index');
  const boot = JSON.stringify(pub).replace(/</g, '\\u003c');
  out.setContent(out.getContent().replace('window.SC_BOOT = null;', function () { return 'window.SC_BOOT = ' + boot + ';'; }));
  return out.setTitle(pub.nama_app + (pub.demo ? ' — Demo' : ''))
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, viewport-fit=cover')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
/** Dipanggil frontend: google.script.run.apiRun(bodyJson) → string JSON (sama persis dengan doPost). */
function apiRun(body) {
  const t0 = Date.now();
  let res, action = '';
  try {
    const b = JSON.parse(String(body || '{}'));
    action = String(b.action || '');
    res = dispatch_(action, b.token, b.data || {});
  } catch (err) {
    console.error(action + ': ' + err.message);
    res = fail_(pesanAman_(err));
  }
  flushAudit_();
  res.ms = Date.now() - t0; res.v = APP_VERSION;
  return JSON.stringify(res);
}
function apiWarm(scope) { try { return warmCaches_(scope === 'guru' ? 'guru' : 'pub'); } catch (e) { return 'gagal'; } }

// ---------- Setup & reset ----------
/** JALANKAN SEKALI: menyiapkan Sheets, Drive, akun demo, data contoh, dan reset harian. */
function setupDemo() {
  setProp_('DEMO_MODE', 'on');
  setupAppEnvironment();
  resetDemo();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'resetDemo') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('resetDemo').timeBased().atHour(0).everyDays(1).inTimezone(TZ).create();
  Logger.log('');
  Logger.log('🎉 VERSI DEMO SIAP');
  Logger.log('   Admin : ' + DEMO_EMAIL.admin + '  /  ' + DEMO_SANDI + '   (tab Guru)');
  Logger.log('   Guru  : ' + DEMO_EMAIL.guru + '  /  ' + DEMO_SANDI + '   (tab Guru)');
  Logger.log('   Siswa : ' + prop_('DEMO_SISWA_ID') + '  /  ' + DEMO_SANDI + '   (tab Siswa)');
  Logger.log('   Reset otomatis: setiap hari 00.00 WIB (fungsi resetDemo).');
  Logger.log('   Langkah berikutnya: Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.');
}

/** Kosongkan semua data lalu isi ulang data demo. Dipanggil trigger harian atau manual. */
function resetDemo() {
  if (!demoAktif_()) { Logger.log('Mode demo tidak aktif — resetDemo dibatalkan.'); return; }
  denganKunci_(function () {
    const ss = ss_();
    Object.keys(SKEMA).forEach(function (n) { if (ss.getSheetByName(n)) pastikanKolom_(n); });   // kolom baru dari pembaruan kode
    Object.keys(SKEMA).forEach(function (n) {
      if (n === 'AppConfig') return;
      const sh = ss.getSheetByName(n); if (!sh) return;
      const last = sh.getLastRow(), col = Math.max(1, sh.getLastColumn());
      if (last > 1) sh.getRange(2, 1, last - 1, col).clearContent();
    });
    SEMUA_TABEL.forEach(function (n) { bumpTabel_(n); });
    bersihkanBerkasDemo_();
    isiDataDemo_();
    SEMUA_TABEL.forEach(function (n) { bumpTabel_(n); });
  });
  try { warmCaches_('setup'); } catch (e) { /* abaikan */ }
  Logger.log('♻️ Data demo dipulihkan (' + new Date().toISOString() + ').');
}

/** Buang berkas unggahan pengunjung (materi & logo); berkas PDF contoh dipertahankan. */
function bersihkanBerkasDemo_() {
  let simpan = {};
  try { simpan = JSON.parse(prop_('DEMO_BERKAS') || '{}'); } catch (e) { simpan = {}; }
  const pakai = {}; Object.keys(simpan).forEach(function (k) { pakai[simpan[k]] = 1; });
  [['FOLDER_MATERI', true], ['FOLDER_LOGO', false]].forEach(function (f) {
    const id = prop_(f[0]); if (!id) return;
    try {
      const it = DriveApp.getFolderById(id).getFiles();
      while (it.hasNext()) { const file = it.next(); if (!(f[1] && pakai[file.getId()])) file.setTrashed(true); }
    } catch (e) { /* folder hilang → abaikan */ }
  });
}

// ---------- Data contoh ----------
function acakTetap_(seed) {                               // pembangkit acak deterministik (mulberry32)
  let a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function isiDataDemo_() {
  const kini = hariIni_(), rnd = acakTetap_(Number(kini.replace(/-/g, '')));
  const pilih = function (arr) { return arr[Math.floor(rnd() * arr.length)]; };
  const sekarang = Date.now(), now = new Date(sekarang).toISOString();
  const waktu = function (tgl, jam, menit) {                 // ISO; tidak pernah melewati 'sekarang'
    const hm = String(jam).indexOf(':') > -1 ? String(jam) : ('0' + jam).slice(-2) + ':' + ('0' + (menit || 0)).slice(-2);
    const t = new Date(tgl + 'T' + hm + ':00+07:00').getTime();
    return new Date(Math.min(t, sekarang - 60000 * (5 + Math.floor(rnd() * 50)))).toISOString();
  };

  // 1) Pengaturan
  const set = {}; Object.keys(PENGATURAN_DEFAULT).forEach(function (k) { set[k] = PENGATURAN_DEFAULT[k]; });
  const th = Number(kini.slice(0, 4)), bl = Number(kini.slice(5, 7));
  set.tahun_ajaran = bl >= 7 ? th + '/' + (th + 1) : (th - 1) + '/' + th;
  tambah_('Pengaturan', Object.keys(set).map(function (k) { return { Kunci: k, Nilai: set[k] }; }));

  // 2) Kelas & mapel
  const K = [
    { ID_Kelas: 'KLS-12UTBK', Nama_Kelas: '12 SMA Intensif UTBK', Jenjang: 'SMA', Keterangan: 'Persiapan UTBK-SNBT' },
    { ID_Kelas: 'KLS-10SMA', Nama_Kelas: '10 SMA Reguler', Jenjang: 'SMA', Keterangan: 'Penguatan materi sekolah' },
    { ID_Kelas: 'KLS-9SMP', Nama_Kelas: '9 SMP Persiapan ANBK', Jenjang: 'SMP', Keterangan: 'Asesmen & ujian sekolah' }
  ];
  tambah_('Kelas', K);
  const M = {
    mat: { ID_Mapel: 'MP-MAT', Nama_Mapel: 'Matematika', Label: 'Wajib' },
    fis: { ID_Mapel: 'MP-FIS', Nama_Mapel: 'Fisika', Label: 'Saintek' },
    ing: { ID_Mapel: 'MP-ING', Nama_Mapel: 'Bahasa Inggris', Label: 'Intensif UTBK' },
    kim: { ID_Mapel: 'MP-KIM', Nama_Mapel: 'Kimia', Label: 'Saintek' },
    ind: { ID_Mapel: 'MP-IND', Nama_Mapel: 'Bahasa Indonesia', Label: 'Literasi' }
  };
  tambah_('Mapel', Object.keys(M).map(function (k) { return M[k]; }));

  // 3) Siswa
  const daftar = [
    ['Syarifah Nurul Aini', 0, 'Hj. Fatimah Zahra', 'Ibu'], ['Muhammad Farhan Akbar', 0, 'Bapak Ridwan', 'Ayah'], ['Aulia Rahma Putri', 0, 'Ibu Siti Aminah', 'Ibu'],
    ['Rizki Pratama', 0, 'Bapak Hendra', 'Ayah'], ['Dinda Ayu Lestari', 0, 'Ibu Wulan', 'Ibu'], ['Hafiz Maulana', 0, 'Bapak Yusuf', 'Ayah'],
    ['Nabila Zahra', 1, 'Ibu Nurhayati', 'Ibu'], ['Fajar Hidayat', 1, 'Bapak Slamet', 'Ayah'], ['Salsabila Azzahra', 1, 'Ibu Rina', 'Ibu'],
    ['Raka Aditya', 1, 'Bapak Agus', 'Ayah'], ['Keisha Amanda', 1, 'Ibu Dewi', 'Ibu'],
    ['Alif Ramadhan', 2, 'Bapak Imran', 'Ayah'], ['Naura Khairunnisa', 2, 'Ibu Laila', 'Ibu'], ['Daffa Arkana', 2, 'Bapak Bayu', 'Ayah'], ['Zahira Putri', 2, 'Ibu Maya', 'Ibu']
  ];
  const next = idSiswaBaru_([]);
  const siswa = daftar.map(function (d, i) {
    const baru = i >= daftar.length - 3;                  // 3 siswa terakhir mendaftar bulan ini
    return {
      ID_Siswa: next(), Nama: d[0], Kelas_ID: K[d[1]].ID_Kelas, No_HP: '0812000001' + ('0' + (i + 1)).slice(-2), Email: '',
      Tgl_Lahir: (d[1] === 2 ? '2011' : d[1] === 1 ? '2010' : '2008') + '-' + ('0' + (1 + (i * 5) % 12)).slice(-2) + '-' + ('0' + (3 + (i * 7) % 25)).slice(-2),
      Alamat: 'Alamat contoh — Jl. Melati No. ' + (i + 3), Nama_Wali: d[2], HP_Wali: '0813000002' + ('0' + (i + 1)).slice(-2), Hubungan_Wali: d[3],
      Status: 'Aktif', Tgl_Daftar: baru ? tglGeser_(kini, -(2 + i % 5)) : tglGeser_(kini, -(40 + i * 6)),
      Catatan_Guru: i === 0 ? 'Pemahaman trigonometri sudah baik. Tingkatkan latihan soal Fisika bab Hukum Newton, ya. Semangat menuju try out!' : (i === 6 ? 'Rajin dan teliti. Pertahankan!' : ''),
      Catatan_Oleh: i === 0 || i === 6 ? 'Ustadzah Syarifah' : '', Catatan_Tgl: i === 0 || i === 6 ? tglGeser_(kini, -2) : ''
    };
  });
  tambah_('Siswa', siswa);
  setProp_('DEMO_SISWA_ID', siswa[0].ID_Siswa);

  // 4) Akun (semua bersandi demo, tidak wajib ganti sandi)
  const akun = function (id, peran, username, nama, email) {
    const salt = Utilities.getUuid();
    return { ID: id, Peran: peran, Username: username, Nama: nama, Email: email || '', Hash: hashPass_(DEMO_SANDI, salt), Salt: salt,
      Aktif: 'Ya', Wajib_Ganti_Sandi: 'Tidak', Dibuat: now, Login_Terakhir: '' };
  };
  const users = [
    akun(DEMO_UID.admin, 'admin', DEMO_EMAIL.admin, 'Ustadzah Syarifah', DEMO_EMAIL.admin),
    akun(DEMO_UID.guru, 'guru', DEMO_EMAIL.guru, 'Pak Ahmad Fauzi', DEMO_EMAIL.guru)
  ].concat(siswa.map(function (s, i) { return akun(i === 0 ? DEMO_UID.siswa : idBaru_('U'), 'siswa', s.ID_Siswa, s.Nama, ''); }));
  tambah_('Pengguna', users);

  // 5) Jadwal: tiap kelas berselang hari, 3 minggu ke belakang s.d. 2 minggu ke depan, + semua kelas hari ini
  const pola = [
    { jam: ['16:00', '17:30'], ruang: 'Ruang A', tutor: 'Ustadzah Syarifah', mapel: [M.mat, M.fis, M.ing, M.kim] },
    { jam: ['14:00', '15:30'], ruang: 'Ruang B', tutor: 'Pak Ahmad Fauzi', mapel: [M.mat, M.fis, M.ind] },
    { jam: ['19:00', '20:30'], ruang: 'Online (Zoom)', tutor: 'Pak Ahmad Fauzi', mapel: [M.mat, M.ing, M.ind] }
  ];
  const jadwal = [];
  K.forEach(function (k, c) {
    let n = 0;
    for (let g = -21; g <= 14; g++) {
      if (g !== 0 && (g + c) % 2 !== 0) continue;
      const tgl = tglGeser_(kini, g), p = pola[c];
      if (new Date(tgl + 'T00:00:00+07:00').getDay() === 0 && g !== 0) continue;      // Minggu libur
      jadwal.push({ ID: 'JDW-' + k.ID_Kelas.slice(4) + '-' + (n++), Kelas_ID: k.ID_Kelas, Mapel_ID: p.mapel[n % p.mapel.length].ID_Mapel, Tanggal: tgl,
        Jam_Mulai: p.jam[0], Jam_Selesai: p.jam[1], Ruang: p.ruang, Tutor: p.tutor, Catatan: g === 0 && c === 0 ? 'Bawa kalkulator & modul trigonometri' : '' });
    }
  });
  tambah_('Jadwal', jadwal);

  // 6) Kehadiran untuk sesi yang sudah lewat (+ sesi kelas 10 SMA hari ini)
  const hadir = [];
  jadwal.forEach(function (j) {
    if (j.Tanggal > kini || (j.Tanggal === kini && j.Kelas_ID !== 'KLS-10SMA')) return;
    siswa.filter(function (s) { return s.Kelas_ID === j.Kelas_ID && s.Tgl_Daftar <= j.Tanggal; }).forEach(function (s, i) {
      const r = rnd(), st = s.ID_Siswa === siswa[0].ID_Siswa ? (r < .06 ? 'Izin' : 'Hadir') : r < .86 ? 'Hadir' : r < .94 ? 'Izin' : 'Alfa';
      hadir.push({ ID: idBaru_('HD'), Tanggal: j.Tanggal, Kelas_ID: j.Kelas_ID, Siswa_ID: s.ID_Siswa, Status: st,
        Keterangan: st === 'Izin' ? pilih(['Sakit', 'Acara keluarga', 'Ujian sekolah']) : '', Jadwal_ID: j.ID,
        Dicatat_Oleh: j.Kelas_ID === 'KLS-12UTBK' ? 'Ustadzah Syarifah' : 'Pak Ahmad Fauzi', Waktu: waktu(j.Tanggal, j.Jam_Selesai) });
    });
  });
  tambah_('Kehadiran', hadir);

  // 7) Tagihan MINGGUAN (Senin–Minggu, jatuh tempo Sabtu): 5 minggu lalu + minggu ini, beberapa siswa menunggak
  const tarif = { 'KLS-12UTBK': 165000, 'KLS-10SMA': 115000, 'KLS-9SMP': 100000 };
  const seninIni = seninDari_(kini), bayar = [];
  const nunggak = { 3: [-3, -2, -1], 9: [-2, -1], 0: [-1], 12: [-1] };     // indeks siswa → minggu yang belum dibayar
  for (let w = -5; w <= 0; w++) {
    const senin = tglGeser_(seninIni, 7 * w), tempo = tglGeser_(senin, HARI_TEMPO_DEFAULT);
    siswa.forEach(function (s, i) {
      if (s.Tgl_Daftar > tglGeser_(senin, 6)) return;                        // belum terdaftar pada minggu itu
      const lunas = w === 0 ? (i % 3 === 1 || i === 6) : (nunggak[i] || []).indexOf(w) === -1;
      const tglBayar = lunas ? (w === 0 ? kini : tglGeser_(senin, i % 5)) : '';
      bayar.push({ ID: idBaru_('BYR'), Siswa_ID: s.ID_Siswa, Periode: labelMinggu_(senin), Minggu_Mulai: senin, Jumlah: String(tarif[s.Kelas_ID]),
        Jatuh_Tempo: tempo, Status: lunas ? 'Lunas' : 'Belum Bayar', Tgl_Bayar: tglBayar > kini ? kini : tglBayar,
        Catatan: i === 0 && w === 0 ? 'Bayar tunai saat les atau transfer ke rekening bimbel' : '' });
    });
  }
  tambah_('Pembayaran', bayar);

  // 8) Latihan & soal
  const L = [
    { k: 'trig', Judul: 'Trigonometri Dasar', Mapel_ID: M.mat.ID_Mapel, Kelas_ID: 'KLS-12UTBK', Bab: 'Bab 3', Durasi_Menit: '20', KKM: '75', Status: 'Terbit', soal: [
      ['Jika sin α = 3/5 dan α di kuadran I, nilai cos α adalah…', '3/4', '4/5', '5/4', '3/5', 'B', 'cos α = √(1 − sin²α) = √(1 − 9/25) = 4/5.'],
      ['Nilai tan 45° adalah…', '0', '1/2', '1', '√3', 'C', 'tan 45° = sin 45° / cos 45° = 1.'],
      ['sin² x + cos² x = …', '0', '1', '2', 'tan x', 'B', 'Identitas Pythagoras.'],
      ['Nilai sin 30° adalah…', '1/2', '√2/2', '√3/2', '1', 'A', 'Sudut istimewa: sin 30° = 1/2.'],
      ['Jika cos α = 0 dengan 0° ≤ α ≤ 180°, maka α = …', '0°', '45°', '90°', '180°', 'C', 'cos 90° = 0.']] },
    { k: 'newton', Judul: 'Hukum Newton tentang Gerak', Mapel_ID: M.fis.ID_Mapel, Kelas_ID: 'KLS-12UTBK', Bab: 'Bab 2', Durasi_Menit: '25', KKM: '75', Status: 'Terbit', soal: [
      ['Benda 2 kg didorong gaya 10 N tanpa gesekan. Percepatannya adalah…', '2 m/s²', '5 m/s²', '10 m/s²', '20 m/s²', 'B', 'a = F/m = 10/2 = 5 m/s².'],
      ['Hukum Newton I disebut juga hukum…', 'Aksi-reaksi', 'Kelembaman', 'Gravitasi', 'Kekekalan energi', 'B', 'Hukum I Newton = hukum inersia/kelembaman.'],
      ['Satuan gaya dalam SI adalah…', 'Joule', 'Watt', 'Newton', 'Pascal', 'C', '1 N = 1 kg·m/s².'],
      ['Berat benda 5 kg (g = 10 m/s²) adalah…', '5 N', '15 N', '50 N', '500 N', 'C', 'w = m·g = 5 × 10 = 50 N.'],
      ['Pasangan gaya aksi-reaksi bekerja pada…', 'Satu benda yang sama', 'Dua benda berbeda', 'Benda diam saja', 'Benda bergerak saja', 'B', 'Aksi-reaksi selalu bekerja pada dua benda berbeda.']] },
    { k: 'reading', Judul: 'Reading Comprehension: Main Idea', Mapel_ID: M.ing.ID_Mapel, Kelas_ID: 'SEMUA', Bab: 'Unit 1', Durasi_Menit: '15', KKM: '70', Status: 'Terbit', soal: [
      ['"Most students learn better when they study in short, regular sessions." The main idea is…', 'Students dislike studying', 'Short regular study is effective', 'Long sessions are better', 'Studying is optional', 'B', 'Kalimat menekankan sesi belajar singkat dan rutin.'],
      ['The word "regular" is closest in meaning to…', 'rare', 'routine', 'random', 'difficult', 'B', 'Regular = routine / teratur.'],
      ['A topic sentence is usually found…', 'at the beginning of a paragraph', 'only in the title', 'in the footnote', 'after the conclusion', 'A', 'Kalimat topik biasanya di awal paragraf.'],
      ['Which question asks for the main idea?', 'What color is the book?', 'What is the passage mainly about?', 'Who wrote the book?', 'When was it published?', 'B', 'Pertanyaan "mainly about" menanyakan ide pokok.'],
      ['"However" is used to show…', 'addition', 'contrast', 'example', 'time order', 'B', 'However = namun (pertentangan).']] },
    { k: 'pangkat', Judul: 'Bilangan Berpangkat & Bentuk Akar', Mapel_ID: M.mat.ID_Mapel, Kelas_ID: 'KLS-9SMP', Bab: 'Bab 1', Durasi_Menit: '20', KKM: '75', Status: 'Terbit', soal: [
      ['Hasil dari 2³ × 2² adalah…', '2⁵', '2⁶', '4⁵', '4⁶', 'A', 'aᵐ × aⁿ = aᵐ⁺ⁿ → 2⁵.'],
      ['Nilai dari 5⁰ adalah…', '0', '1', '5', 'tidak terdefinisi', 'B', 'Setiap bilangan (≠ 0) pangkat nol = 1.'],
      ['Bentuk sederhana √50 adalah…', '5√2', '2√5', '10√5', '25√2', 'A', '√50 = √(25 × 2) = 5√2.'],
      ['Hasil dari (3²)³ adalah…', '3⁵', '3⁶', '9⁵', '6³', 'B', '(aᵐ)ⁿ = aᵐⁿ → 3⁶.'],
      ['Nilai 4^(1/2) adalah…', '1', '2', '8', '16', 'B', 'Pangkat 1/2 = akar kuadrat → √4 = 2.']] },
    { k: 'kuadrat', Judul: 'Persamaan Kuadrat', Mapel_ID: M.mat.ID_Mapel, Kelas_ID: 'KLS-10SMA', Bab: 'Bab 4', Durasi_Menit: '20', KKM: '75', Status: 'Terbit', soal: [
      ['Akar-akar x² − 5x + 6 = 0 adalah…', '1 dan 6', '2 dan 3', '−2 dan −3', '−1 dan 6', 'B', '(x − 2)(x − 3) = 0 → x = 2 atau 3.'],
      ['Diskriminan dari x² + 4x + 4 = 0 adalah…', '0', '4', '8', '16', 'A', 'D = b² − 4ac = 16 − 16 = 0.'],
      ['Jika D < 0, maka akar-akarnya…', 'real berbeda', 'real kembar', 'tidak real', 'nol', 'C', 'D negatif → akar imajiner (tidak real).'],
      ['Jumlah akar-akar 2x² − 8x + 3 = 0 adalah…', '−4', '4', '3/2', '−3/2', 'B', 'x₁ + x₂ = −b/a = 8/2 = 4.'],
      ['Hasil kali akar-akar x² − 7x + 10 = 0 adalah…', '7', '−7', '10', '−10', 'C', 'x₁·x₂ = c/a = 10.']] },
    { k: 'stoikio', Judul: 'Stoikiometri (draf)', Mapel_ID: M.kim.ID_Mapel, Kelas_ID: 'KLS-12UTBK', Bab: 'Bab 5', Durasi_Menit: '30', KKM: '75', Status: 'Draf', soal: [
      ['1 mol zat mengandung … partikel.', '6,02 × 10²³', '3,01 × 10²³', '6,02 × 10²²', '1,0 × 10²³', 'A', 'Bilangan Avogadro.'],
      ['Massa molar H₂O (H = 1, O = 16) adalah…', '16 g/mol', '17 g/mol', '18 g/mol', '20 g/mol', 'C', '2(1) + 16 = 18 g/mol.'],
      ['Volume 1 mol gas pada STP adalah…', '11,2 L', '22,4 L', '24 L', '44,8 L', 'B', 'Volume molar STP = 22,4 L.']] }
  ];
  const latRows = [], soalRows = [], soalMap = {};
  L.forEach(function (l, i) {
    const id = 'LAT-' + l.k.toUpperCase(), dibuat = waktu(tglGeser_(kini, -(16 - i * 2)), '09', 15);
    latRows.push({ ID: id, Judul: l.Judul, Mapel_ID: l.Mapel_ID, Kelas_ID: l.Kelas_ID, Bab: l.Bab, Durasi_Menit: l.Durasi_Menit, KKM: l.KKM, Status: l.Status,
      Dibuat_Oleh: i % 2 ? DEMO_UID.guru : DEMO_UID.admin, Dibuat: dibuat, Diubah: dibuat });
    soalMap[id] = l.soal.map(function (s, n) {
      const row = { ID: id.replace('LAT', 'SOAL') + '-' + (n + 1), Latihan_ID: id, No: String(n + 1), Pertanyaan: s[0], Opsi_A: s[1], Opsi_B: s[2], Opsi_C: s[3], Opsi_D: s[4], Kunci: s[5], Bobot: '10', Pembahasan: s[6] };
      soalRows.push(row); return row;
    });
  });
  tambah_('Latihan', latRows);
  tambah_('Soal', soalRows);

  // 9) Hasil pengerjaan (siswa akun demo baru mengerjakan Trigonometri → sisanya bisa dicoba)
  const hasil = [];
  siswa.forEach(function (s, i) {
    const kemampuan = i === 0 ? .82 : .5 + rnd() * .45;
    latRows.forEach(function (l) {
      if (l.Status !== 'Terbit' || (l.Kelas_ID !== 'SEMUA' && l.Kelas_ID !== s.Kelas_ID)) return;
      if (i === 0 ? l.ID !== 'LAT-TRIG' : rnd() > .82) return;
      const soal = soalMap[l.ID], jaw = {};
      let benar = 0, salah = 0, kosong = 0;
      soal.forEach(function (q) {
        const r = rnd();
        if (r < .05 && i !== 0) { kosong++; return; }
        if (i === 0 ? q.No !== '5' : r < kemampuan) { jaw[q.ID] = q.Kunci; benar++; }
        else { jaw[q.ID] = ['A', 'B', 'C', 'D'].filter(function (o) { return o !== q.Kunci; })[Math.floor(rnd() * 3)]; salah++; }
      });
      const g = -Math.floor(rnd() * 12);
      hasil.push({ ID: idBaru_('H'), Latihan_ID: l.ID, Siswa_ID: s.ID_Siswa, Skor: String(Math.round(benar / soal.length * 100)), Benar: String(benar), Salah: String(salah),
        Kosong: String(kosong), Durasi_Detik: String(300 + Math.floor(rnd() * 700)), Jawaban: JSON.stringify(jaw), Waktu: waktu(tglGeser_(kini, g), String(19 + Math.floor(rnd() * 3)), Math.floor(rnd() * 59)) });
    });
  });
  hasil.sort(function (a, b) { return a.Waktu < b.Waktu ? -1 : 1; });
  tambah_('Hasil', hasil);

  // 10) Materi PDF contoh (dibuat sekali, dipakai ulang setiap reset)
  const materi = berkasDemo_().map(function (b, i) {
    return { ID: 'MTR-' + b.k.toUpperCase(), Judul: b.judul, Mapel_ID: b.mapel, Kelas_ID: b.kelas, Bab: b.bab, Deskripsi: b.desk, Tag: b.tag,
      File_ID: b.fileId, Nama_File: b.nama, Ukuran: String(b.ukuran), Halaman: b.halaman, Diunggah_Oleh: i % 2 ? DEMO_UID.guru : DEMO_UID.admin,
      Tanggal: waktu(tglGeser_(kini, -(1 + i * 3)), '08', 30) };
  });
  tambah_('Materi', materi);
  const akses = [];
  siswa.forEach(function (s, i) {
    materi.forEach(function (m) {
      if (m.Kelas_ID !== 'SEMUA' && m.Kelas_ID !== s.Kelas_ID) return;
      if (i !== 0 && rnd() > .7) return;
      if (i === 0 && m.ID !== 'MTR-TRIG') return;
      const t = waktu(tglGeser_(kini, -Math.floor(rnd() * 6)), '20', Math.floor(rnd() * 59));
      akses.push({ Siswa_ID: s.ID_Siswa, Materi_ID: m.ID, Pertama: t, Terakhir: t, Diunduh: rnd() > .6 ? 'Ya' : 'Tidak' });
    });
  });
  tambah_('Materi_Akses', akses);

  // 11) Log aktivitas awal
  tambah_('Audit_Log', [
    { Waktu: waktu(tglGeser_(kini, -1), '08', 30), Pengguna: DEMO_EMAIL.admin, Aksi: 'materi.unggah', Entitas: 'Materi:MTR-TRIG', Detail: 'Rumus Cepat Identitas Trigonometri' },
    { Waktu: waktu(tglGeser_(kini, -1), '17', 35), Pengguna: DEMO_EMAIL.admin, Aksi: 'hadir.simpan', Entitas: 'Kehadiran', Detail: '12 SMA Intensif UTBK' },
    { Waktu: waktu(kini, '06', 0), Pengguna: 'sistem', Aksi: 'DEMO_RESET', Entitas: 'Sistem', Detail: 'Data demo dipulihkan otomatis' }
  ]);
}

/** Lima PDF materi contoh. Dibuat sekali, ID disimpan di Script Properties (DEMO_BERKAS). */
function berkasDemo_() {
  let simpan = {};
  try { simpan = JSON.parse(prop_('DEMO_BERKAS') || '{}'); } catch (e) { simpan = {}; }
  const folder = DriveApp.getFolderById(prop_('FOLDER_MATERI'));
  const daftar = [
    { k: 'trig', judul: 'Rumus Cepat Identitas Trigonometri', mapel: 'MP-MAT', kelas: 'KLS-12UTBK', bab: 'Bab 3 • Trigonometri Analitik', tag: 'Wajib',
      desk: 'Ringkasan identitas trigonometri, sudut istimewa, dan trik mengerjakan soal UTBK.',
      isi: [['Identitas dasar', ['sin²x + cos²x = 1', 'tan x = sin x / cos x', '1 + tan²x = sec²x']], ['Sudut rangkap', ['sin 2x = 2 sin x cos x', 'cos 2x = cos²x − sin²x = 1 − 2 sin²x']],
        ['Sudut istimewa', ['sin 30° = 1/2, cos 30° = ½√3', 'sin 45° = cos 45° = ½√2', 'tan 60° = √3']]],
      contoh: ['Jika sin α = 3/5 (kuadran I), tentukan cos α.', 'cos α = √(1 − 9/25) = √(16/25) = 4/5.'] },
    { k: 'newton', judul: 'Ringkasan Hukum Newton & Contoh Soal', mapel: 'MP-FIS', kelas: 'KLS-12UTBK', bab: 'Bab 2 • Dinamika Gerak', tag: 'Rangkuman',
      desk: 'Hukum I, II, III Newton beserta contoh soal gaya, massa, dan percepatan.',
      isi: [['Hukum I (Kelembaman)', ['ΣF = 0 → benda diam tetap diam, bergerak lurus beraturan tetap bergerak']], ['Hukum II', ['ΣF = m · a', 'Satuan gaya: Newton (kg·m/s²)']],
        ['Hukum III (Aksi-Reaksi)', ['F aksi = − F reaksi', 'Bekerja pada dua benda berbeda']]],
      contoh: ['Benda 2 kg didorong 10 N tanpa gesekan. Berapa percepatannya?', 'a = F/m = 10/2 = 5 m/s².'] },
    { k: 'tenses', judul: 'Tenses Cheat Sheet untuk UTBK', mapel: 'MP-ING', kelas: 'SEMUA', bab: 'Grammar', tag: 'Intensif UTBK',
      desk: 'Rumus 8 tenses yang paling sering keluar beserta penanda waktunya.',
      isi: [['Present', ['Simple: S + V1(s/es) — every day', 'Continuous: S + am/is/are + V-ing — now', 'Perfect: S + have/has + V3 — already, since']],
        ['Past', ['Simple: S + V2 — yesterday, ago', 'Continuous: S + was/were + V-ing — while']], ['Future', ['Simple: S + will + V1 — tomorrow', 'Going to: S + am/is/are going to + V1']]],
      contoh: ['She ___ (study) English since 2020.', 'has studied — penanda "since" → Present Perfect.'] },
    { k: 'pangkat', judul: 'Bilangan Berpangkat & Bentuk Akar', mapel: 'MP-MAT', kelas: 'KLS-9SMP', bab: 'Bab 1 • Bilangan', tag: 'Wajib',
      desk: 'Sifat-sifat perpangkatan dan cara menyederhanakan bentuk akar.',
      isi: [['Sifat pangkat', ['aᵐ × aⁿ = aᵐ⁺ⁿ', 'aᵐ : aⁿ = aᵐ⁻ⁿ', '(aᵐ)ⁿ = aᵐⁿ', 'a⁰ = 1 (a ≠ 0)']], ['Bentuk akar', ['√(a × b) = √a × √b', 'a^(1/n) = ⁿ√a']]],
      contoh: ['Sederhanakan √50.', '√50 = √(25 × 2) = 5√2.'] },
    { k: 'kuadrat', judul: 'Persamaan Kuadrat: Rumus ABC', mapel: 'MP-MAT', kelas: 'KLS-10SMA', bab: 'Bab 4 • Persamaan Kuadrat', tag: 'Pengayaan',
      desk: 'Memfaktorkan, rumus ABC, diskriminan, serta jumlah dan hasil kali akar.',
      isi: [['Bentuk umum', ['ax² + bx + c = 0, a ≠ 0']], ['Rumus ABC', ['x = (−b ± √D) / 2a', 'D = b² − 4ac']], ['Sifat akar', ['x₁ + x₂ = −b/a', 'x₁ · x₂ = c/a']]],
      contoh: ['Tentukan akar x² − 5x + 6 = 0.', '(x − 2)(x − 3) = 0 → x = 2 atau x = 3.'] }
  ];
  let berubah = false;
  const hasil = daftar.map(function (b) {
    let file = null;
    if (simpan[b.k]) { try { file = DriveApp.getFileById(simpan[b.k]); if (file.isTrashed()) file = null; } catch (e) { file = null; } }
    if (!file) {
      const blob = Utilities.newBlob(htmlMateri_(b), 'text/html', b.k + '.html').getAs('application/pdf').setName('Modul-' + b.judul.replace(/[^A-Za-z0-9]+/g, '-').replace(/-+$/, '') + '.pdf');
      file = folder.createFile(blob); bagikanLink_(file);
      simpan[b.k] = file.getId(); berubah = true;
    }
    b.fileId = file.getId(); b.nama = file.getName(); b.ukuran = file.getSize();
    b.halaman = hitungHalamanPdf_(file.getBlob()) || '2';
    return b;
  });
  if (berubah) setProp_('DEMO_BERKAS', JSON.stringify(simpan));
  return hasil;
}
function htmlMateri_(b) {
  const e = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); };
  return '<html><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;color:#0F172A;margin:0}' +
    '.top{background:#0B1F3A;color:#fff;padding:22px 28px}.top small{color:#93C5FD;letter-spacing:1px;text-transform:uppercase;font-size:11px}.top h1{margin:6px 0 0;font-size:24px}' +
    '.wrap{padding:22px 28px}h2{color:#2563EB;font-size:16px;margin:18px 0 8px;border-bottom:2px solid #DBEAFE;padding-bottom:4px}' +
    'ul{margin:0;padding-left:18px}li{margin:4px 0;font-size:14px}.box{background:#EFF6FF;border-left:4px solid #2563EB;padding:12px 14px;margin-top:20px;font-size:14px}' +
    '.box b{color:#16A34A}.foot{margin-top:26px;font-size:11px;color:#64748B}</style></head><body>' +
    '<div class="top"><small>Syarifah Course • ' + e(b.bab) + '</small><h1>' + e(b.judul) + '</h1></div><div class="wrap"><p style="font-size:14px;color:#475569">' + e(b.desk) + '</p>' +
    b.isi.map(function (s) { return '<h2>' + e(s[0]) + '</h2><ul>' + s[1].map(function (x) { return '<li>' + e(x) + '</li>'; }).join('') + '</ul>'; }).join('') +
    '<div class="box"><b>Contoh soal:</b> ' + e(b.contoh[0]) + '<br><br><b>Pembahasan:</b> ' + e(b.contoh[1]) + '</div>' +
    '<p class="foot">Materi contoh untuk versi demo Syarifah Course.</p></div></body></html>';
}
