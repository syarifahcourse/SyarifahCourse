# Syarifah Course — Frontend

Aplikasi bimbingan belajar digital (area siswa + panel guru). Berkas statis HTML/CSS/JS yang di-host di GitHub Pages. Backend-nya adalah Google Apps Script (REST API JSON).

## Struktur

```
index.html        ← halaman utama (harus di root repository)
css/style.css     ← design system (navy #0B1F3A, biru #2563EB, hijau #16A34A)
js/config.js      ← SATU-SATUNYA yang perlu diisi: URL /exec Apps Script
js/ui.js          ← ikon, format, toast, modal, grafik SVG, animasi
js/api.js         ← fetch ke GAS, sesi, cache, batch, warmup
js/app.js         ← router & halaman masuk
js/siswa.js       ← area siswa (mobile-first)
js/guru.js        ← panel guru/pengelola
```

## Konfigurasi

Buka `js/config.js` dan ganti `GANTI_DENGAN_ID_DEPLOYMENT` dengan URL Web App Apps Script Anda (berakhiran `/exec`). URL ini bukan rahasia.

## Diagnosa performa

Buka Console browser (F12), lalu ketik `Perf.table()` atau `Perf.summary()`.

Panduan lengkap: **PANDUAN-INSTALASI.md**.
