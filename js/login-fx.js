/* ==================================================================
   Syarifah Course — Efek interaktif halaman masuk
   - Maskot burung hantu: mata mengikuti kursor/ketikan, menutup mata saat
     kata sandi diisi, mengintip saat sandi ditampilkan, sedih saat gagal,
     melompat saat berhasil. Pakai kacamata saat mode Guru.
   - Jaringan partikel (canvas) yang bereaksi pada kursor.
   - Teks mengetik (typewriter), parallax kartu melayang, sorot kartu,
     riak tombol, dan konfeti.
   Semua efek berhenti sendiri saat layar login ditinggalkan dan
   menghormati prefers-reduced-motion.
   ================================================================== */
(function () {
  'use strict';
  const kurangGerak = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const pakaiMouse = () => window.matchMedia && matchMedia('(hover: hover) and (pointer: fine)').matches;
  const batas = (v, a, b) => Math.max(a, Math.min(b, v));

  // ---------------- Maskot ----------------
  function owlSvg() {
    return '<div class="owl-wrap" aria-hidden="true"><svg class="owl" viewBox="0 0 140 124" focusable="false">' +
      '<g class="ow-tilt"><g class="ow-napas"><g class="ow-all">' +
        '<path class="ow-b" d="M36 48 L14 22 L50 36 Z"/><path class="ow-b" d="M104 48 L126 22 L90 36 Z"/>' +
        '<ellipse class="ow-b" cx="70" cy="80" rx="54" ry="46"/>' +
        '<ellipse class="ow-belly" cx="70" cy="108" rx="30" ry="22"/>' +
        '<path class="ow-f" d="M57 102 q4 4 8 0 M69 102 q4 4 8 0 M63 112 q4 4 8 0 M75 112 q4 4 8 0"/>' +
        '<path class="ow-face" d="M70 54 C52 38 18 50 22 76 C26 98 56 100 70 88 C84 100 114 98 118 76 C122 50 88 38 70 54 Z"/>' +
        '<ellipse class="ow-pipi" cx="33" cy="90" rx="7" ry="4"/><ellipse class="ow-pipi" cx="107" cy="90" rx="7" ry="4"/>' +
        '<g class="ow-eye"><circle class="ow-sclera" cx="50" cy="72" r="16"/><g class="ow-pupil"><circle cx="50" cy="72" r="8"/><circle class="ow-kilau" cx="53" cy="69" r="2.6"/></g></g>' +
        '<g class="ow-eye"><circle class="ow-sclera" cx="90" cy="72" r="16"/><g class="ow-pupil"><circle cx="90" cy="72" r="8"/><circle class="ow-kilau" cx="93" cy="69" r="2.6"/></g></g>' +
        '<g class="ow-happy"><path d="M38 75 q12 -13 24 0"/><path d="M78 75 q12 -13 24 0"/></g>' +
        '<g class="ow-alis"><path d="M35 56 L60 50"/><path d="M105 56 L80 50"/></g>' +
        '<g class="ow-kacamata"><circle cx="50" cy="72" r="20"/><circle cx="90" cy="72" r="20"/><path d="M68 68 Q70 64 72 68"/></g>' +
        '<path class="ow-paruh" d="M63 86 L77 86 L70 98 Z"/>' +
        '<g class="ow-topi"><path class="ow-topi-a" d="M44 38 L44 28 Q70 36 96 28 L96 38 Q70 46 44 38 Z"/>' +
          '<path class="ow-topi-b" d="M70 6 L120 22 L70 38 L20 22 Z"/><circle class="ow-topi-k" cx="70" cy="22" r="3"/>' +
          '<g class="ow-rumbai"><path d="M70 22 L106 30 L106 44"/><rect x="102" y="43" width="8" height="11" rx="2"/></g></g>' +
        '<ellipse class="ow-sayap ow-sl" cx="19" cy="98" rx="17" ry="26"/><ellipse class="ow-sayap ow-sr" cx="121" cy="98" rx="17" ry="26"/>' +
      '</g></g></g></svg></div>';
  }

  function maskot(root) {
    const wrap = root.querySelector('.owl-wrap'), svg = root.querySelector('.owl');
    if (!svg) return null;
    const tilt = svg.querySelector('.ow-tilt'), pupils = svg.querySelectorAll('.ow-pupil');
    const user = () => root.querySelector('#lUser'), pass = root.querySelector('#lPass');
    let fokus = null, timer = [];
    const hidup = () => svg.isConnected;
    const lihat = (dx, dy) => {
      pupils.forEach((p) => { p.style.transform = 'translate(' + dx.toFixed(1) + 'px,' + dy.toFixed(1) + 'px)'; });
      tilt.style.transform = 'rotate(' + (dx * .7).toFixed(2) + 'deg)';
    };
    const ikutKetikan = () => {
      const u = user(); if (!u) return;
      const panjang = (u.value || '').length;
      lihat(-6 + 12 * Math.min(1, panjang / 26), 5);
    };
    const status = () => {
      const tutup = fokus === 'pass';
      svg.classList.toggle('tutup', tutup);
      svg.classList.toggle('intip', tutup && pass.type === 'text');
      if (fokus === 'user') ikutKetikan();
      else if (!tutup) lihat(0, 2);
    };
    // kursor (desktop)
    const onMove = (e) => {
      if (!hidup()) { window.removeEventListener('pointermove', onMove); return; }
      if (e.pointerType !== 'mouse' || fokus) return;
      const r = svg.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height * .58;
      const vx = e.clientX - cx, vy = e.clientY - cy, d = Math.hypot(vx, vy) || 1, k = Math.min(6, d / 40);
      lihat(vx / d * k, vy / d * k);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    root.addEventListener('focusin', (e) => {
      if (e.target.id === 'lUser') fokus = 'user';
      else if (e.target.id === 'lPass') fokus = 'pass';
      else if (e.target.dataset && e.target.dataset.mata === 'lPass') fokus = 'pass';
      else fokus = null;
      status();
    });
    root.addEventListener('focusout', () => setTimeout(() => { if (!root.contains(document.activeElement)) { fokus = null; status(); } }, 0));
    root.addEventListener('input', (e) => { if (e.target.id === 'lUser') ikutKetikan(); });
    root.addEventListener('keyup', (e) => { if (e.target.id === 'lUser') ikutKetikan(); });
    // tombol mata (pasangMata sudah terpasang lebih dulu → tipe input sudah berubah di sini)
    const mata = root.querySelector('[data-mata="lPass"]');
    if (mata) mata.addEventListener('click', () => { fokus = 'pass'; status(); });
    // berkedip & melirik saat diam
    const kedip = () => {
      if (!hidup()) return;
      if (!svg.classList.contains('tutup') && !svg.classList.contains('senang')) {
        svg.classList.add('kedip'); setTimeout(() => svg.classList.remove('kedip'), 140);
      }
      timer.push(setTimeout(kedip, 2400 + Math.random() * 3200));
    };
    const lirik = () => {
      if (!hidup()) return;
      if (!fokus && !pakaiMouse()) lihat((Math.random() - .5) * 10, (Math.random() - .3) * 6);
      timer.push(setTimeout(lirik, 2600 + Math.random() * 2400));
    };
    if (!kurangGerak()) { timer.push(setTimeout(kedip, 1800)); timer.push(setTimeout(lirik, 3000)); }
    // ketuk maskot → melompat
    wrap.addEventListener('click', () => api.senang(900));
    const sekali = (cls, ms) => { svg.classList.remove(cls); void svg.getBoundingClientRect(); svg.classList.add(cls); setTimeout(() => svg.classList.remove(cls), ms); };
    const api = {
      peran(p) { svg.classList.toggle('guru', p === 'guru'); },
      senang(ms) { sekali('senang', ms || 1400); },
      sedih() { sekali('sedih', 1700); },
      reset() { fokus = null; status(); }
    };
    lihat(0, 2);
    return api;
  }

  // ---------------- Jaringan partikel ----------------
  function jaring(canvas) {
    if (!canvas || !canvas.getContext) return;
    const ctx = canvas.getContext('2d'), host = canvas.parentElement;
    let w = 0, h = 0, pts = [], mx = -9999, my = -9999;
    const ukur = () => {
      const r = host.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
      w = r.width; h = r.height; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.round(batas(w * h / 16000, 22, 70));
      while (pts.length < n) pts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .32, vy: (Math.random() - .5) * .32, r: Math.random() * 1.5 + .7 });
      pts.length = n;
      pts.forEach((p) => { p.x = Math.min(p.x, w); p.y = Math.min(p.y, h); });
    };
    const gambar = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 118) { ctx.strokeStyle = 'rgba(147,197,253,' + (.26 * (1 - d / 118)).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        const dm = Math.hypot(a.x - mx, a.y - my);
        if (dm < 170) { ctx.strokeStyle = 'rgba(74,222,128,' + (.45 * (1 - dm / 170)).toFixed(3) + ')'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(mx, my); ctx.stroke(); }
        ctx.fillStyle = dm < 170 ? 'rgba(187,247,208,.95)' : 'rgba(191,219,254,.7)';
        ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, Math.PI * 2); ctx.fill();
      }
    };
    const langkah = () => {
      if (!canvas.isConnected) { ro && ro.disconnect(); return; }
      for (const p of pts) {
        const dx = p.x - mx, dy = p.y - my, d = Math.hypot(dx, dy);
        if (d < 110 && d > 0) { p.x += dx / d * .9; p.y += dy / d * .9; }     // menghindar pelan dari kursor
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      gambar();
      requestAnimationFrame(langkah);
    };
    const ro = window.ResizeObserver ? new ResizeObserver(() => { ukur(); if (kurangGerak()) gambar(); }) : null;
    ukur();
    if (ro) ro.observe(host);
    host.addEventListener('pointermove', (e) => { if (e.pointerType !== 'mouse') return; const r = host.getBoundingClientRect(); mx = e.clientX - r.left; my = e.clientY - r.top; }, { passive: true });
    host.addEventListener('pointerleave', () => { mx = my = -9999; });
    if (kurangGerak()) gambar(); else requestAnimationFrame(langkah);
  }

  // ---------------- Teks mengetik ----------------
  function ketik(el, kalimat) {
    if (!el) return;
    if (kurangGerak() || kalimat.length < 2) { el.textContent = kalimat[0] || ''; return; }
    let k = 0, i = 0, hapus = false;
    const jalan = () => {
      if (!el.isConnected) return;
      const s = kalimat[k];
      el.textContent = s.slice(0, i);
      let jeda = hapus ? 22 : 48 + Math.random() * 40;
      if (!hapus && i === s.length) { hapus = true; jeda = 2200; }
      else if (hapus && i === 0) { hapus = false; k = (k + 1) % kalimat.length; jeda = 380; }
      i += hapus ? -1 : 1;
      if (i < 0) i = 0;
      setTimeout(jalan, jeda);
    };
    jalan();
  }

  // ---------------- Parallax & sorot ----------------
  function parallax(login) {
    if (kurangGerak()) return;
    let raf = 0, tx = 0, ty = 0;
    login.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      tx = (e.clientX / innerWidth - .5) * 2; ty = (e.clientY / innerHeight - .5) * 2;
      if (!raf) raf = requestAnimationFrame(() => { raf = 0; login.style.setProperty('--px', tx.toFixed(3)); login.style.setProperty('--py', ty.toFixed(3)); });
    }, { passive: true });
  }
  function sorot(card) {
    card.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px'); card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }
  function riak(btn) {
    btn.addEventListener('pointerdown', (e) => {
      if (kurangGerak()) return;
      const r = btn.getBoundingClientRect(), s = document.createElement('span'), d = Math.max(r.width, r.height) * 2;
      s.className = 'riak'; s.style.width = s.style.height = d + 'px';
      s.style.left = (e.clientX - r.left - d / 2) + 'px'; s.style.top = (e.clientY - r.top - d / 2) + 'px';
      btn.appendChild(s); setTimeout(() => s.remove(), 650);
    });
  }

  // ---------------- Konfeti ----------------
  function konfeti(dari) {
    if (kurangGerak() || !dari) return;
    const r = dari.getBoundingClientRect(), box = document.createElement('div');
    box.className = 'konfeti'; box.style.left = (r.left + r.width / 2) + 'px'; box.style.top = (r.top + r.height / 2) + 'px';
    const warna = ['var(--primary)', '#4ADE80', '#F59E0B', '#F472B6', '#38BDF8', '#A78BFA'];
    for (let i = 0; i < 34; i++) {
      const s = document.createElement('i'), sudut = Math.random() * Math.PI * 2, jarak = 70 + Math.random() * 140;
      s.style.setProperty('--tx', (Math.cos(sudut) * jarak).toFixed(0) + 'px');
      s.style.setProperty('--ty', (Math.sin(sudut) * jarak * .7 - 60).toFixed(0) + 'px');
      s.style.setProperty('--rot', (Math.random() * 720 - 360).toFixed(0) + 'deg');
      s.style.background = warna[i % warna.length];
      s.style.animationDelay = (Math.random() * 80).toFixed(0) + 'ms';
      if (i % 3 === 0) s.style.borderRadius = '50%';
      box.appendChild(s);
    }
    document.body.appendChild(box);
    setTimeout(() => box.remove(), 1300);
  }

  /** Pasang semua efek. Mengembalikan pengendali untuk app.js. */
  function pasang(root, opsi) {
    opsi = opsi || {};
    const login = root.querySelector('.login'), card = root.querySelector('.login-card');
    jaring(root.querySelector('.lg-net'));
    ketik(root.querySelector('#lType'), opsi.kalimat || []);
    if (login) parallax(login);
    if (card && pakaiMouse()) sorot(card);
    const btn = root.querySelector('#lBtn'); if (btn) riak(btn);
    const owl = maskot(root);
    return {
      owl,
      peran(p) { owl && owl.peran(p); },
      gagal() {
        owl && owl.sedih();
        if (card && !kurangGerak()) { card.classList.remove('goyang'); void card.offsetWidth; card.classList.add('goyang'); }
      },
      sukses() { owl && owl.senang(1600); konfeti(btn); },
      jeda: () => kurangGerak() ? 0 : 650
    };
  }

  window.LoginFX = { owlSvg, pasang, konfeti };
})();
