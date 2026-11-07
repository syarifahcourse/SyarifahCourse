/* ==================================================================
   UI KIT — ikon, format, toast, modal/sheet/drawer, grafik SVG, animasi
   ================================================================== */
(function () {
  'use strict';

  // ---------- Ikon garis (gaya Lucide, stroke 2) ----------
  const P = {
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    clipboard: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
    clipcheck: '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
    book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
    quiz: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><path d="M9.6 10a2.4 2.4 0 1 1 3.3 2.2c-.5.2-.9.7-.9 1.3v.5M12 17.5h.01"/>',
    chart: '<path d="M3 3v18h18"/><path d="M18 17V9M13 17V5M8 17v-3"/>',
    report: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 16v-3M12 16V8M17 16v-6"/>',
    megaphone: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    left: '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
    right: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    chevR: '<path d="m9 18 6-6-6-6"/>', chevL: '<path d="m15 18-6-6 6-6"/>', chevD: '<path d="m6 9 6 6 6-6"/>',
    search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
    sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><path d="M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><path d="M12 3v12"/>',
    printer: '<polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
    eye: '<path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    eyeOff: '<path d="M9.88 9.88a3 3 0 1 0 4.24 4.24M10.73 5.08A10.4 10.4 0 0 1 12 5c7 0 10 7 10 7a13 13 0 0 1-1.67 2.68M6.61 6.61A13.5 13.5 0 0 0 2 12s3 7 10 7a9.7 9.7 0 0 0 5.39-1.61M2 2l20 20"/>',
    lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    idcard: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16a3 3 0 0 1 6 0M14 10h4M14 14h4"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 6L2 7"/>',
    check: '<polyline points="20 6 9 17 4 12"/>',
    checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
    clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>',
    xCircle: '<circle cx="12" cy="12" r="10"/><path d="m15 9-6 6M9 9l6 6"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4M12 17h.01"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
    flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    trash: '<path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
    pencil: '<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    file: '<path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5z"/><polyline points="14 2 14 8 20 8"/><path d="M16 13H8M16 17H8M10 9H8"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>',
    logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><path d="M21 12H9"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/>',
    folder: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>',
    folderUser: '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/><circle cx="12" cy="11.5" r="2"/><path d="M8.5 17a3.5 3.5 0 0 1 7 0"/>',
    trophy: '<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>',
    trend: '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>',
    trendDown: '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>',
    cap: '<path d="M22 10 12 5 2 10l10 5 10-5Z"/><path d="M6 12v5c3 3 9 3 12 0v-5M22 10v6"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.09-3.09a2 2 0 0 0-2.82 0L6 21"/>',
    droplet: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>',
    key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6M15.5 7.5l3 3L22 7l-3-3"/>',
    database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    wallet: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/>',
    cloudCheck: '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/><path d="m9 14 2 2 4-4"/>',
    zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
    star: '<polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>',
    starCircle: '<circle cx="12" cy="12" r="10"/><path d="m12 7 1.5 3.1 3.4.5-2.5 2.4.6 3.4-3-1.6-3 1.6.6-3.4-2.5-2.4 3.4-.5z"/>',
    rotate: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/>',
    headset: '<path d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    external: '<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><path d="M10 14 21 3"/>',
    filter: '<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/>',
    more: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
    table: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18"/>',
    layers: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5M2 12l10 5 10-5"/>',
    sparkle: '<path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l4 2"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
  };
  function ic(name, size, cls) {
    size = size || 20;
    return '<svg class="ic ' + (cls || '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (P[name] || P.info) + '</svg>';
  }

  // ---------- Format ----------
  const esc = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const BLN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  function tglObj(s) {
    if (!s) return null;
    const m = String(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
    const d = new Date(s); return isNaN(d) ? null : d;
  }
  const fmt = {
    tgl(s, opt) {
      const d = tglObj(s); if (!d) return '-';
      const t = d.getDate() + ' ' + BLN[d.getMonth()] + ((opt && opt.tahun === false) ? '' : ' ' + d.getFullYear());
      return opt && opt.hari ? HARI[d.getDay()] + ', ' + t : t;
    },
    tglPanjang(s) { const d = tglObj(s); return d ? HARI[d.getDay()] + ', ' + d.getDate() + ' ' + BULAN[d.getMonth()] + ' ' + d.getFullYear() : '-'; },
    jam(s) { const d = tglObj(s); return d ? String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0') : ''; },
    relatif(s) {
      const d = tglObj(s); if (!d) return '';
      const det = (Date.now() - d.getTime()) / 1000;
      if (det < 60) return 'Baru saja';
      if (det < 3600) return Math.floor(det / 60) + ' menit lalu';
      if (det < 86400) return Math.floor(det / 3600) + ' jam lalu';
      if (det < 172800) return 'Kemarin';
      if (det < 604800) return Math.floor(det / 86400) + ' hari lalu';
      return fmt.tgl(s);
    },
    rp(n) { return 'Rp ' + Number(n || 0).toLocaleString('id-ID'); },
    ukuran(b) { b = Number(b || 0); return b >= 1048576 ? (b / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; },
    angka(n, d) { if (n === null || n === undefined || n === '') return '-'; return Number(n).toLocaleString('id-ID', { maximumFractionDigits: d === undefined ? 1 : d }); },
    hariIni() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    geser(tgl, hari) { const d = tglObj(tgl); d.setDate(d.getDate() + hari); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    inisial(nama) { return String(nama || '?').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase(); },
    durasi(det) { det = Math.round(det || 0); const m = Math.floor(det / 60); return m ? m + ' Menit' : det + ' Detik'; },
    namaDepan(nama) { return String(nama || '').trim().split(/\s+/)[0] || ''; }
  };

  // ---------- Toast ----------
  function toast(msg, type) {
    type = type || 'info';
    const box = document.getElementById('toasts');
    const el = document.createElement('div');
    el.className = 'toast ' + type;
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML = ic({ success: 'checkCircle', error: 'xCircle', warning: 'alert', info: 'info' }[type] || 'info', 20) + '<div>' + esc(msg) + '</div>';
    box.appendChild(el);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 180); }, type === 'error' ? 5200 : 3400);
  }

  // ---------- Overlay (modal / sheet / drawer) ----------
  const stack = [];
  function buka(html, opt) {
    opt = opt || {};
    const kind = opt.kind || 'modal';
    const ov = document.createElement('div');
    ov.className = 'overlay' + (kind === 'sheet' ? ' sheet-wrap' : kind === 'drawer' ? ' drawer-wrap' : '');
    const box = document.createElement('div');
    box.className = kind + (opt.wide ? ' wide' : '');
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    if (opt.label) box.setAttribute('aria-label', opt.label);
    box.innerHTML = (kind === 'sheet' ? '<div class="grab"></div>' : '') + html;
    ov.appendChild(box);
    const prevFocus = document.activeElement;
    const tutup = (val) => {
      if (ov._tutup) return; ov._tutup = true;
      ov.classList.add('closing');
      setTimeout(() => ov.remove(), 150);
      const i = stack.indexOf(api); if (i > -1) stack.splice(i, 1);
      document.body.style.overflow = stack.length ? 'hidden' : '';
      if (prevFocus && prevFocus.focus) try { prevFocus.focus(); } catch (e) { /* */ }
      if (opt.onClose) opt.onClose(val);
    };
    ov.addEventListener('mousedown', (e) => { if (e.target === ov && opt.dismiss !== false) tutup(); });
    box.addEventListener('click', (e) => { const c = e.target.closest('[data-close]'); if (c) tutup(); });
    const api = { el: box, tutup, ov };
    stack.push(api);
    document.body.appendChild(ov);
    document.body.style.overflow = 'hidden';
    setTimeout(() => { const f = box.querySelector('[autofocus], input:not([type=hidden]), select, textarea, button:not([data-close])'); if (f && opt.focus !== false) f.focus(); }, 60);
    return api;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && stack.length) { const top = stack[stack.length - 1]; if (top) top.tutup(); } });
  function headHtml(judul, sub) {
    return '<div class="modal-head"><div class="grow"><h3>' + esc(judul) + '</h3>' + (sub ? '<p class="small muted">' + esc(sub) + '</p>' : '') + '</div><button class="icon-btn light" data-close aria-label="Tutup">' + ic('x') + '</button></div>';
  }
  function konfirmasi(judul, pesan, opt) {
    opt = opt || {};
    return new Promise((res) => {
      let hasil = false;
      const m = buka(headHtml(judul) + '<div class="modal-body"><p class="muted">' + esc(pesan) + '</p></div><div class="modal-foot"><button class="btn btn-outline" data-close>Batal</button><button class="btn ' + (opt.bahaya ? 'btn-danger' : 'btn-primary') + '" data-ok>' + esc(opt.ok || 'Ya, lanjutkan') + '</button></div>',
        { onClose: () => res(hasil), label: judul });
      m.el.querySelector('[data-ok]').addEventListener('click', () => { hasil = true; m.tutup(); });
    });
  }
  /** Tampilkan kredensial (sandi awal) — hanya sekali. */
  function tampilKredensial(judul, baris, catatan) {
    const isi = baris.map((b) => '<div class="field"><label>' + esc(b.label) + '</label><div class="cred"><span>' + esc(b.nilai) + '</span><button class="btn btn-sm btn-ghost" data-copy="' + esc(b.nilai) + '">' + ic('copy', 16) + ' Salin</button></div></div>').join('');
    const m = buka(headHtml(judul) + '<div class="modal-body stack">' + isi + '<div class="warn-box">' + ic('alert', 18) + '<span>' + esc(catatan || 'Catat sekarang. Kata sandi ini hanya ditampilkan sekali dan tidak disimpan dalam bentuk yang bisa dibaca.') + '</span></div></div><div class="modal-foot"><button class="btn btn-primary" data-close>Sudah saya catat</button></div>', { dismiss: false });
    m.el.querySelectorAll('[data-copy]').forEach((b) => b.addEventListener('click', () => salin(b.dataset.copy)));
  }
  function salin(teks) {
    const ok = () => toast('Disalin ke clipboard.', 'success');
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(teks).then(ok, () => toast('Gagal menyalin. Salin manual.', 'warning'));
    else { const t = document.createElement('textarea'); t.value = teks; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); ok(); } catch (e) { /* */ } t.remove(); }
  }

  // ---------- Animasi ----------
  const reduce = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function hitungNaik(el, target, opt) {
    opt = opt || {};
    if (!el) return;
    const d = opt.desimal || 0, akhir = Number(target);
    if (isNaN(akhir) || reduce()) { el.textContent = isNaN(akhir) ? (target === null ? '-' : target) : akhir.toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d }); return; }
    const t0 = performance.now(), dur = opt.dur || 650;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = (akhir * e).toLocaleString('id-ID', { maximumFractionDigits: d, minimumFractionDigits: d });
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }
  function animasi(root) {
    (root || document).querySelectorAll('[data-count]').forEach((el) => { hitungNaik(el, el.dataset.count, { desimal: +(el.dataset.dec || 0) }); el.removeAttribute('data-count'); });
    requestAnimationFrame(() => requestAnimationFrame(() => {
      (root || document).querySelectorAll('[data-w]').forEach((el) => { el.style.width = el.dataset.w + '%'; el.removeAttribute('data-w'); });
      (root || document).querySelectorAll('[data-off]').forEach((el) => { el.style.strokeDashoffset = el.dataset.off; el.removeAttribute('data-off'); });
    }));
  }
  /** Cincin progres SVG (dianimasikan lewat animasi()). */
  function cincin(persen, opt) {
    opt = opt || {};
    const s = opt.size || 72, w = opt.stroke || 7, r = (s - w) / 2, c = 2 * Math.PI * r;
    const p = Math.max(0, Math.min(100, Number(persen) || 0));
    const off = c * (1 - p / 100);
    const warna = opt.color || 'var(--accent)', track = opt.track || 'rgba(255,255,255,.15)';
    return '<div class="ring" style="width:' + s + 'px;height:' + s + 'px" role="img" aria-label="' + esc(opt.aria || (Math.round(p) + ' persen')) + '">' +
      '<svg width="' + s + '" height="' + s + '"><circle cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" stroke="' + track + '" stroke-width="' + w + '"/>' +
      '<circle class="val" cx="' + s / 2 + '" cy="' + s / 2 + '" r="' + r + '" stroke="' + warna + '" stroke-width="' + w + '" stroke-linecap="round" stroke-dasharray="' + c.toFixed(2) + '" stroke-dashoffset="' + (reduce() ? off : c).toFixed(2) + '" data-off="' + off.toFixed(2) + '"/></svg>' +
      '<span class="lbl" style="font-size:' + (opt.font || Math.round(s / 4.4)) + 'px;color:' + (opt.textColor || '#fff') + '">' + (opt.label !== undefined ? opt.label : Math.round(p) + '%') + '</span></div>';
  }
  function bar(persen, cls) { return '<div class="bar ' + (cls || '') + '"><i data-w="' + Math.max(0, Math.min(100, Number(persen) || 0)) + '"></i></div>'; }
  function skeleton(baris) {
    return '<div class="stack" aria-busy="true" aria-label="Memuat">' + (baris || [120, 80, 80]).map((h) => '<div class="sk" style="height:' + h + 'px"></div>').join('') + '</div>';
  }
  function kosong(ikon, judul, teks, aksi) {
    return '<div class="empty"><div class="art">' + ic(ikon, 32) + '</div><h3>' + esc(judul) + '</h3><p>' + esc(teks || '') + '</p>' + (aksi || '') + '</div>';
  }
  function gagalMuat(pesan, idTombol) {
    return '<div class="empty"><div class="art" style="background:var(--danger-bg);color:var(--danger)">' + ic('alert', 32) + '</div><h3>Gagal memuat data</h3><p>' + esc(pesan || 'Periksa koneksi internet Anda.') + '</p><button class="btn btn-outline" id="' + (idTombol || 'btnUlang') + '">' + ic('refresh', 18) + ' Coba lagi</button></div>';
  }

  // ---------- Tema dari Pengaturan ----------
  function terapkanTema(app) {
    if (!app) return;
    const r = document.documentElement.style;
    if (app.warna_utama) r.setProperty('--primary', app.warna_utama);
    if (app.warna_aksen) r.setProperty('--accent', app.warna_aksen);
    if (app.warna_gelap) {
      r.setProperty('--navy', app.warna_gelap);
      r.setProperty('--navy-2', 'color-mix(in srgb, ' + app.warna_gelap + ' 82%, #3B6FB6)');
      r.setProperty('--navy-dark', 'color-mix(in srgb, ' + app.warna_gelap + ' 75%, #000)');
      const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = app.warna_gelap;
    }
    if (app.nama_app) document.title = app.nama_app;
  }
  function logoHtml(app, cls) {
    app = app || {};
    const ini = '<span class="' + (cls || '') + '"' + (app.logo_url ? ' hidden' : '') + '>' + esc(fmt.inisial(app.nama_app || 'Syarifah Course')) + '</span>';
    if (app.logo_url) return '<img src="' + esc(app.logo_url) + '" alt="Logo ' + esc(app.nama_app || '') + '" referrerpolicy="no-referrer" onerror="this.hidden=true;this.nextElementSibling.hidden=false">' + ini;
    return ini;
  }

  // ---------- Kontras warna (WCAG) ----------
  function lum(hex) {
    const c = [1, 3, 5].map((i) => { const v = parseInt(hex.substr(i, 2), 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function kontras(a, b) { const l1 = lum(a), l2 = lum(b); return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05); }

  // ==================================================================
  //  GRAFIK SVG (mark tipis, ujung membulat 4px, hover tooltip, tabel)
  // ==================================================================
  function tipEl(wrap) { let t = wrap.querySelector('.tip'); if (!t) { t = document.createElement('div'); t.className = 'tip'; wrap.appendChild(t); } return t; }
  function sumbuY(max, n) { const out = []; for (let i = 0; i <= n; i++) out.push(Math.round(max / n * i)); return out; }
  function rPath(x, y, w, h, r) {    // kolom: ujung atas membulat, dasar persegi
    if (h <= 0) return '';
    r = Math.min(r, w / 2, h);
    return 'M' + x + ',' + (y + h) + 'V' + (y + r) + 'Q' + x + ',' + y + ' ' + (x + r) + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h) + 'Z';
  }
  function hPath(x, y, w, h, r) {    // batang horizontal: ujung kanan membulat
    if (w <= 0) return '';
    r = Math.min(r, h / 2, w);
    return 'M' + x + ',' + y + 'H' + (x + w - r) + 'Q' + (x + w) + ',' + y + ' ' + (x + w) + ',' + (y + r) + 'V' + (y + h - r) + 'Q' + (x + w) + ',' + (y + h) + ' ' + (x + w - r) + ',' + (y + h) + 'H' + x + 'Z';
  }
  /** Grafik kolom. items: [{label, value|null, tip}] */
  function grafikKolom(wrap, items, opt) {
    opt = opt || {};
    const W = Math.max(280, wrap.clientWidth || 600), H = opt.tinggi || 240, padL = 40, padR = 12, padT = 24, padB = 34;
    const max = opt.max || Math.max(1, ...items.map((i) => i.value || 0)) * 1.15;
    const iw = W - padL - padR, ih = H - padT - padB, band = iw / Math.max(1, items.length), bw = Math.min(opt.lebar || 24, band * 0.56);
    const sempit = band < 58;                     // label sumbu tidak muat → pakai label pendek
    const ticks = sumbuY(max, 4), warna = opt.warna || 'var(--primary)';
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.aria || 'Grafik') + '"><g class="grid axis">';
    ticks.forEach((t) => { const y = padT + ih - t / max * ih; s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + t + (opt.satuan || '') + '</text>'; });
    s += '</g>';
    if (opt.target) { const y = padT + ih - opt.target / max * ih; s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '" stroke="var(--muted)" stroke-width="1"/><text x="' + (W - padR) + '" y="' + (y - 6) + '" text-anchor="end" fill="var(--muted)" font-size="11">Target ' + opt.target + (opt.satuan || '') + '</text>'; }
    s += '<g class="bars">';
    items.forEach((it, i) => {
      const cx = padL + band * i + band / 2, x = cx - bw / 2;
      if (it.value !== null && it.value !== undefined) {
        const h = Math.max(2, it.value / max * ih), y = padT + ih - h;
        s += '<path class="bar-m" data-i="' + i + '" d="' + rPath(x, y, bw, h, 4) + '" fill="' + (it.warna || warna) + '"/>';
        if (opt.labelNilai !== false) s += '<g class="val"><text x="' + cx + '" y="' + (y - 7) + '" text-anchor="middle">' + fmt.angka(it.value, 1) + (opt.satuan || '') + '</text></g>';
      } else s += '<g class="axis"><text x="' + cx + '" y="' + (padT + ih - 6) + '" text-anchor="middle">—</text></g>';
      s += '<g class="axis"><text x="' + cx + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(sempit && it.pendek ? it.pendek : it.label) + '</text></g>';
      s += '<rect class="hit" data-i="' + i + '" x="' + (padL + band * i) + '" y="' + padT + '" width="' + band + '" height="' + ih + '"/>';
    });
    s += '</g><line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih) + '" y2="' + (padT + ih) + '" stroke="#CBD5E1"/></svg>';
    wrap.innerHTML = s;
    pasangHover(wrap, items, (i) => ({ x: padL + band * i + band / 2, y: items[i].value !== null && items[i].value !== undefined ? padT + ih - items[i].value / max * ih : padT + ih - 10 }), W);
  }
  /** Grafik garis dengan area tipis + crosshair. */
  function grafikGaris(wrap, items, opt) {
    opt = opt || {};
    const W = Math.max(280, wrap.clientWidth || 600), H = opt.tinggi || 240, padL = 40, padR = 16, padT = 20, padB = 34;
    const max = opt.max || Math.max(1, ...items.map((i) => i.value || 0)) * 1.15;
    const iw = W - padL - padR, ih = H - padT - padB, n = items.length;
    const xOf = (i) => padL + (n === 1 ? iw / 2 : iw * i / (n - 1)), yOf = (v) => padT + ih - v / max * ih;
    const ticks = sumbuY(max, 4), warna = opt.warna || 'var(--primary)';
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.aria || 'Grafik garis') + '"><g class="grid axis">';
    ticks.forEach((t) => { const y = yOf(t); s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + y + '" y2="' + y + '"/><text x="' + (padL - 8) + '" y="' + (y + 4) + '" text-anchor="end">' + t + (opt.satuan || '') + '</text>'; });
    s += '</g>';
    const pts = items.map((it, i) => it.value === null || it.value === undefined ? null : [xOf(i), yOf(it.value)]).filter(Boolean);
    if (pts.length) {
      const d = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('');
      s += '<path d="' + d + 'L' + pts[pts.length - 1][0] + ',' + (padT + ih) + 'L' + pts[0][0] + ',' + (padT + ih) + 'Z" fill="' + warna + '" opacity=".1"/>';
      s += '<path d="' + d + '" fill="none" stroke="' + warna + '" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>';
      const last = pts[pts.length - 1];
      s += '<circle cx="' + last[0] + '" cy="' + last[1] + '" r="5" fill="' + warna + '" stroke="#fff" stroke-width="2"/>';
      const lv = items.filter((i) => i.value !== null && i.value !== undefined).pop();
      s += '<g class="val"><text x="' + Math.min(last[0], W - padR - 4) + '" y="' + (last[1] - 10) + '" text-anchor="end">' + fmt.angka(lv.value, 1) + (opt.satuan || '') + '</text></g>';
    }
    const step = Math.ceil(n / Math.max(1, Math.floor(iw / 70)));
    items.forEach((it, i) => { if (i % step === 0 || i === n - 1) s += '<g class="axis"><text x="' + xOf(i) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(it.label) + '</text></g>'; });
    s += '<line class="xh" x1="0" x2="0" y1="' + padT + '" y2="' + (padT + ih) + '" stroke="#94A3B8" stroke-width="1" opacity="0"/><circle class="xd" r="5" fill="' + warna + '" stroke="#fff" stroke-width="2" opacity="0"/>';
    const bw = n > 1 ? iw / (n - 1) : iw;
    items.forEach((it, i) => { const x0 = Math.max(padL, xOf(i) - bw / 2), x1 = Math.min(W - padR, xOf(i) + bw / 2); s += '<rect class="hit" data-i="' + i + '" x="' + x0 + '" y="' + padT + '" width="' + Math.max(1, x1 - x0) + '" height="' + ih + '"/>'; });
    s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + (padT + ih) + '" y2="' + (padT + ih) + '" stroke="#CBD5E1"/></svg>';
    wrap.innerHTML = s;
    const xh = wrap.querySelector('.xh'), xd = wrap.querySelector('.xd');
    pasangHover(wrap, items, (i) => ({ x: xOf(i), y: items[i].value !== null && items[i].value !== undefined ? yOf(items[i].value) : padT + ih }), W, (i) => {
      if (i === null) { xh.setAttribute('opacity', 0); xd.setAttribute('opacity', 0); return; }
      xh.setAttribute('x1', xOf(i)); xh.setAttribute('x2', xOf(i)); xh.setAttribute('opacity', 1);
      if (items[i].value !== null && items[i].value !== undefined) { xd.setAttribute('cx', xOf(i)); xd.setAttribute('cy', yOf(items[i].value)); xd.setAttribute('opacity', 1); } else xd.setAttribute('opacity', 0);
    });
  }
  /** Batang horizontal (peringkat). */
  function grafikBatang(wrap, items, opt) {
    opt = opt || {};
    const W = Math.max(280, wrap.clientWidth || 500), row = 34, padL = Math.min(170, W * 0.38), padR = 52, H = items.length * row + 8;
    const max = opt.max || Math.max(1, ...items.map((i) => i.value || 0));
    const iw = W - padL - padR, bh = 16;
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(opt.aria || 'Grafik batang') + '">';
    items.forEach((it, i) => {
      const y = 4 + i * row, w = Math.max(2, (it.value || 0) / max * iw);
      s += '<g class="axis"><text x="' + (padL - 10) + '" y="' + (y + row / 2 + 4) + '" text-anchor="end">' + esc(String(it.label).length > 22 ? String(it.label).slice(0, 21) + '…' : it.label) + '</text></g>';
      s += '<rect x="' + padL + '" y="' + (y + (row - bh) / 2) + '" width="' + iw + '" height="' + bh + '" rx="4" fill="#EEF2F7"/>';
      s += '<path class="bar-m" data-i="' + i + '" d="' + hPath(padL, y + (row - bh) / 2, w, bh, 4) + '" fill="' + (it.warna || opt.warna || 'var(--primary)') + '"/>';
      s += '<g class="val"><text x="' + (padL + w + 8) + '" y="' + (y + row / 2 + 4) + '">' + fmt.angka(it.value, 1) + (opt.satuan || '') + '</text></g>';
      s += '<rect class="hit" data-i="' + i + '" x="0" y="' + y + '" width="' + (W - 1) + '" height="' + row + '"/>';
    });
    s += '</svg>';
    wrap.innerHTML = s;
    pasangHover(wrap, items, (i) => ({ x: padL + Math.max(2, (items[i].value || 0) / max * iw), y: 4 + i * row + 6 }), W);
  }
  function pasangHover(wrap, items, pos, W, onMove) {
    const tip = tipEl(wrap), svg = wrap.querySelector('svg');
    const show = (i) => {
      const it = items[i], p = pos(i), sc = wrap.clientWidth / W;
      tip.innerHTML = it.tip || ('<b>' + esc(it.label) + '</b>: ' + (it.value === null || it.value === undefined ? 'tidak ada data' : fmt.angka(it.value, 1)));
      tip.style.left = Math.max(60, Math.min(wrap.clientWidth - 60, p.x * sc)) + 'px'; tip.style.top = (p.y * sc) + 'px';
      tip.classList.add('on'); svg.classList.add('dim');
      svg.querySelectorAll('.bar-m').forEach((b) => b.classList.toggle('act', +b.dataset.i === i));
      if (onMove) onMove(i);
    };
    const hide = () => { tip.classList.remove('on'); svg.classList.remove('dim'); if (onMove) onMove(null); };
    svg.querySelectorAll('.hit').forEach((h) => {
      h.addEventListener('mouseenter', () => show(+h.dataset.i));
      h.addEventListener('click', () => show(+h.dataset.i));
    });
    svg.addEventListener('mouseleave', hide);
  }
  /** Tabel alternatif untuk grafik (aksesibilitas). */
  function tabelGrafik(kolom, baris) {
    return '<div class="tbl-wrap chart-tabel"><table class="tbl"><thead><tr>' + kolom.map((k) => '<th>' + esc(k) + '</th>').join('') + '</tr></thead><tbody>' +
      baris.map((b) => '<tr>' + b.map((c) => '<td>' + esc(c) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  // ---------- CSV ----------
  function unduhCsv(nama, kolom, baris) {
    const q = (v) => { const s = String(v === null || v === undefined ? '' : v); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    const isi = '﻿' + [kolom].concat(baris).map((r) => r.map(q).join(',')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([isi], { type: 'text/csv;charset=utf-8' }));
    a.download = nama; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  function bacaCsv(teks) {
    const baris = []; let cur = [''], q = false, i = 0;
    const pemisah = (teks.split('\n')[0].match(/;/g) || []).length > (teks.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    for (; i < teks.length; i++) {
      const c = teks[i];
      if (q) { if (c === '"') { if (teks[i + 1] === '"') { cur[cur.length - 1] += '"'; i++; } else q = false; } else cur[cur.length - 1] += c; }
      else if (c === '"') q = true;
      else if (c === pemisah) cur.push('');
      else if (c === '\n' || c === '\r') { if (c === '\r' && teks[i + 1] === '\n') i++; baris.push(cur); cur = ['']; }
      else cur[cur.length - 1] += c;
    }
    if (cur.length > 1 || cur[0]) baris.push(cur);
    const h = (baris.shift() || []).map((x) => x.replace(/^﻿/, '').trim());
    return baris.filter((r) => r.join('').trim()).map((r) => { const o = {}; h.forEach((k, j) => { if (k) o[k] = (r[j] || '').trim(); }); return o; });
  }
  function bacaFileBase64(file) {
    return new Promise((res, rej) => {
      const fr = new FileReader();
      fr.onload = () => res(String(fr.result).split(',')[1] || '');
      fr.onerror = () => rej(new Error('Gagal membaca berkas.'));
      fr.readAsDataURL(file);
    });
  }

  window.UI = { ic, esc, fmt, toast, buka, headHtml, konfirmasi, tampilKredensial, salin, hitungNaik, animasi, cincin, bar, skeleton, kosong, gagalMuat,
    terapkanTema, logoHtml, kontras, grafikKolom, grafikGaris, grafikBatang, tabelGrafik, unduhCsv, bacaCsv, bacaFileBase64, reduce };
})();
