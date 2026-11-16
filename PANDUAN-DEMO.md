# Panduan Versi Demo — Syarifah Course (khusus Google Apps Script)

Versi demo ini **tidak memakai GitHub**. Tampilan dan server berjalan di satu proyek Google Apps Script. Link yang dibagikan ke calon siswa atau orang tua adalah link Web App berakhiran `/exec`.

Isi paket:

| Berkas | Untuk apa |
|---|---|
| `Kode.gs` | Server + modul demo (sudah digabung) |
| `Index.html` | Seluruh tampilan aplikasi (CSS dan JavaScript sudah di dalamnya) |
| `appsscript.json` | Pengaturan proyek (zona waktu WIB, akses web app) |

---

## Akun demo (sudah jadi)

Semua akun memakai kata sandi **`demo1234`**. Di halaman login juga ada tombol **Admin / Guru / Siswa** untuk masuk dengan sekali klik.

| Peran | Tab login | Nama pengguna |
|---|---|---|
| Admin | Guru / Pengelola | `admin@syarifah.demo` |
| Guru | Guru / Pengelola | `guru@syarifah.demo` |
| Siswa | Siswa | `SC26001` (tampil di log saat setup) |

Data contoh yang langsung terisi: 3 kelas, 5 mapel, 15 siswa, jadwal 3 minggu ke belakang sampai 2 minggu ke depan, kehadiran, tagihan **mingguan** selama 6 minggu (ada yang lunas, belum bayar, dan menunggak beberapa minggu), 5 materi PDF, 6 latihan soal (1 masih draf), nilai siswa, dan log aktivitas.

---

## Langkah pemasangan (±10 menit)

### 1. Buat proyek Apps Script baru
1. Buka **https://script.google.com** lalu klik **New project** (Proyek baru).
2. Klik judul "Untitled project" di kiri atas dan ganti menjadi **Syarifah Course — Demo**.

> Proyek ini **terpisah** dari proyek Syarifah Course yang asli. Data demo tersimpan di folder Drive baru **📁 Syarifah Course (Demo)**, jadi tidak akan tercampur dengan data asli.

### 2. Tempel `Kode.gs`
1. Di panel kiri, klik berkas **Code.gs**.
2. Hapus semua isinya, lalu tempel seluruh isi `Kode.gs` dari paket ini.
3. Tekan **Ctrl + S** untuk menyimpan.

### 3. Tambahkan `Index.html`
1. Klik tombol **＋** di samping "Files", lalu pilih **HTML**.
2. Beri nama **`Index`** persis seperti itu (huruf I besar, tanpa `.html`).
3. Hapus isi bawaannya, tempel seluruh isi `Index.html`, lalu tekan **Ctrl + S**.

### 4. Tempel `appsscript.json`
1. Klik ikon ⚙️ **Project Settings** di kiri, lalu centang **Show "appsscript.json" manifest file in editor**.
2. Kembali ke **Editor** (ikon `< >`), buka `appsscript.json`, ganti isinya dengan berkas dari paket, lalu tekan **Ctrl + S**.

### 5. Jalankan `setupDemo`
1. Di bilah atas editor, pilih fungsi **`setupDemo`** dari daftar fungsi, lalu klik **▶ Run**.
2. Saat muncul **Authorization required**, klik **Review permissions** dan pilih akun Google Anda.
3. Kalau muncul "Google hasn't verified this app", klik **Advanced**, lalu **Go to Syarifah Course — Demo (unsafe)**, lalu **Allow**. Ini normal untuk skrip buatan sendiri.
4. Tunggu sampai log menampilkan **🎉 VERSI DEMO SIAP** beserta daftar akun. Proses ini kurang lebih 1 menit.

### 6. Deploy sebagai Web App
1. Klik **Deploy**, lalu **New deployment**.
2. Klik ikon ⚙️ di samping "Select type", lalu pilih **Web app**.
3. Isi:
   - **Description:** Demo v1
   - **Execute as:** **Me**
   - **Who has access:** **Anyone**
4. Klik **Deploy**, lalu salin **Web app URL** (berakhiran `/exec`).

Buka URL itu di browser. **Itulah link demo yang Anda bagikan.**

---

## Yang perlu diketahui

- **Reset otomatis.** Setiap hari pukul 00.00–01.00 WIB semua data dikembalikan seperti semula. Siswa tambahan, nilai baru, perubahan nama, warna, atau logo, dan berkas yang diunggah pengunjung akan dihapus. Untuk reset manual, jalankan fungsi **`resetDemo`** di editor.
- **Fitur yang dikunci di demo** (agar akun demo tetap bisa dipakai semua pengunjung):
  - ganti kata sandi
  - keluar dari semua perangkat
  - reset kata sandi siswa atau guru
  - import dari Google Sheets
  - mengubah, menghapus, atau menonaktifkan akun demo

  Import CSV tetap bisa (maks. 100 baris), dan unggah materi tetap bisa (maks. **2 MB**).
- **Penguncian login** setelah 5 kali salah sandi tetap aktif. Namun sandi demo yang benar selalu bisa masuk, jadi akun demo tidak bisa "dikunci" oleh pengunjung iseng.
- **Banner Google di atas halaman.** Akun Gmail biasa akan menampilkan tulisan *"This application was created by a Google Apps Script user"*. Ini bawaan Google dan tidak bisa dihilangkan.
- **Kuota.** Semua pengunjung memakai kuota akun Google Anda. Untuk demo dengan puluhan pengunjung per hari, ini aman.
- **Memperbarui kode demo.** Tempel berkas baru, lalu buka **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. URL demo **tidak berubah**. Setelah itu jalankan **`resetDemo`** sekali supaya data contoh ikut diperbarui (misalnya tagihan mingguan).
- **Menghapus demo.** Hapus proyek Apps Script-nya, lalu hapus folder **📁 Syarifah Course (Demo)** di Google Drive.

## Kendala umum

| Gejala | Solusi |
|---|---|
| Halaman "Aplikasi belum disiapkan" | `setupDemo` belum dijalankan atau gagal. Jalankan lagi lalu muat ulang halaman. |
| "No HTML file named Index was found" | Nama berkas HTML harus **Index** (bukan `index` atau `Index.html.html`). |
| Halaman meminta login Google | Saat deploy, **Who has access** harus **Anyone**, bukan "Anyone with Google account". |
| Perubahan kode tidak tampil | Buat **New version** di Manage deployments (lihat di atas). |
| Materi PDF tidak bisa dibuka | Pastikan akun Google Anda boleh berbagi berkas "Siapa saja yang memiliki link". Akun sekolah atau kantor kadang memblokir ini. |
