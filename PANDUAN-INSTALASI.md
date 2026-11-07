# Panduan Instalasi — Syarifah Course v1.0

Aplikasi bimbingan belajar digital untuk **siswa** (di HP) dan **guru/pengelola** (di laptop maupun HP).

| Bagian | Teknologi | Tempat |
|---|---|---|
| Tampilan (frontend) | HTML, CSS, dan JavaScript tanpa framework | GitHub Pages (gratis) |
| Server (backend) | Google Apps Script sebagai REST API | Akun Google Anda |
| Database | Google Sheets (15 sheet) | Google Drive Anda |
| Berkas materi & logo | Google Drive | Folder `📁 Syarifah Course` |

---

## 0. Isi paket

| Berkas | Untuk apa | Cara pakai |
|---|---|---|
| `Kode.gs` | Kode server | Disalin-tempel ke editor Apps Script |
| `appsscript.json` | Pengaturan proyek Apps Script (zona waktu Jakarta, akses Web App) | Disalin-tempel ke editor Apps Script |
| `syarifah-course-frontend.zip` | Tampilan aplikasi | Diekstrak, lalu diunggah ke GitHub |
| `PANDUAN-INSTALASI.md` | Panduan ini | Dibaca |

> **Penting:** berkas `.gs` **tidak** ikut diunggah ke GitHub. GitHub hanya untuk tampilan.

---

## 1. Persiapan

1. Akun Google yang akan menjadi pemilik aplikasi. Data dan berkas disimpan di Drive akun ini.
2. Akun GitHub. Daftar di https://github.com. Username Anda akan menjadi bagian alamat situs: `username.github.io`.
3. Git di komputer. Unduh dari https://git-scm.com/download/win (Windows) dan pasang dengan pengaturan bawaan.

---

## 2. Bagian A — Backend (Google Apps Script)

### A1. Buat proyek
1. Buka https://script.google.com dan klik **Proyek baru**.
2. Ganti nama proyek, misalnya `Syarifah Course API`.
3. Hapus isi `Code.gs`, lalu tempel **seluruh isi `Kode.gs`**. Tekan **Simpan** (ikon disket).
4. Klik **⚙️ Setelan Proyek**, lalu centang **Tampilkan file manifes "appsscript.json" di editor**.
5. Kembali ke **Editor**, buka `appsscript.json`, ganti seluruh isinya dengan berkas `appsscript.json` dari paket, lalu **Simpan**.

### A2. Jalankan setup (sekali saja)
1. Di bagian atas editor, pilih fungsi **`setupAppEnvironment`**, lalu klik **▶ Jalankan**.
2. Klik **Tinjau izin**, pilih akun Anda, lalu klik **Lanjutan → Buka Syarifah Course API (tidak aman) → Izinkan**.
   Peringatan "tidak aman" ini muncul karena skrip buatan sendiri belum diverifikasi Google. Itu normal.
3. Buka **Log eksekusi**. Anda akan melihat log seperti ini:

```
🔐 AKSES DARURAT — catat sekarang (hanya tampil sekali)
   Tab Guru → Email: darurat   Kata sandi: XXXXXXXXXXXXXXXX

👤 AKUN ADMIN PERTAMA — catat sekarang (hanya tampil sekali)
   Tab Guru → Email: emailanda@gmail.com   Kata sandi: XXXXXXXXXXXX

✅ Setup selesai.
   Spreadsheet : https://docs.google.com/spreadsheets/d/…
   Folder Drive: https://drive.google.com/drive/folders/…
   keepWarm    : aktif (5 menit)
```

4. **Catat kedua kredensial itu sekarang.** Keduanya hanya tampil sekali dan tidak tersimpan dalam bentuk yang bisa dibaca.
   - Akun admin memakai **email akun Google yang menjalankan setup**.
   - Akses darurat dipakai bila Anda terkunci dari akun admin. Simpan di tempat aman.
5. Cek Google Drive. Folder `📁 Syarifah Course` sudah dibuat dan berisi spreadsheet `🗃️ Database — Syarifah Course`, folder `📂 Materi`, dan folder `📂 Logo`.

`setupAppEnvironment` **aman dijalankan ulang**. Fungsi ini tidak membuat database baru, tidak menimpa kunci rahasia, dan tidak membuat admin ganda. Bila suatu saat kolom baru ditambahkan di versi berikutnya, cukup jalankan fungsi ini lagi.

### A3. (Opsional) Data contoh untuk uji coba
Pilih fungsi **`isiDataContoh`**, lalu klik **▶ Jalankan**. Fungsi ini menambahkan:
- 2 kelas dan 3 mata pelajaran,
- 6 siswa contoh (ID dan kata sandinya tampil di log),
- jadwal, kehadiran, dan tagihan,
- 1 latihan soal,
- 1 modul PDF contoh.

Hapus data contoh lewat aplikasi sebelum dipakai sungguhan. Siswa contoh beralamat "Contoh — ubah atau hapus".

### A4. Deploy sebagai Web App
1. Klik **Terapkan → Deployment baru**.
2. Klik ikon ⚙️ di samping "Pilih jenis", lalu pilih **Aplikasi web**.
3. Isi pengaturannya:
   - **Jalankan sebagai:** *Saya (email Anda)*
   - **Siapa yang memiliki akses:** *Siapa saja*
4. Klik **Terapkan**, lalu **salin URL Aplikasi web** (berakhiran `/exec`).

Akses "Siapa saja" diperlukan agar halaman GitHub bisa menghubungi server. Keamanan dijaga oleh login dan token sesi di server, bukan dengan menyembunyikan URL.

### A5. Cek server
Buka `URL_EXEC?action=app.publik` di browser. Hasilnya harus berupa teks JSON yang diawali `{"success":true,...`.

---

## 3. Bagian B — Frontend ke GitHub Pages

> Semua langkah dilakukan lewat **terminal**. Jangan memakai tombol "Upload files" di situs GitHub, karena folder `css/` dan `js/` akan rusak dan halaman tampil tanpa gaya.

### B1. Siapkan folder
1. Ekstrak `syarifah-course-frontend.zip`. Hasilnya folder `syarifah-course-frontend`.
2. **Folder inilah yang akan menjadi repository.** Di dalamnya langsung ada `index.html`, `css`, dan `js`.
3. Buka `js/config.js` dengan Notepad, lalu ganti URL-nya dengan URL `/exec` dari langkah A4:
   ```js
   GAS_URL: 'https://script.google.com/macros/s/AKfy…/exec'
   ```
   Lalu simpan.

### B2. Identitas Git (sekali per komputer)
Buka folder `syarifah-course-frontend` di File Explorer. Klik address bar, ketik `powershell`, lalu tekan Enter. Kemudian jalankan:
```bash
git config --global user.name "Nama Anda"
git config --global user.email "email-github-anda@gmail.com"
```

### B3. Buat repository di GitHub
Di github.com, klik **+ → New repository**:
- Nama: misalnya `syarifah-course`.
- Pilih **Public** (wajib untuk GitHub Pages gratis).
- **Jangan** centang README, .gitignore, atau license.

### B4. Unggah pertama kali
Pastikan dulu Anda berada di folder yang benar:
```powershell
dir
```
Harus terlihat `index.html`, `css`, dan `js`. Bila belum, **jangan lanjut**: masuk dulu ke folder yang benar.

Lalu jalankan perintah ini **satu per satu**:
```bash
git init
git add .
git commit -m "Upload pertama"
git branch -M main
git remote add origin https://github.com/USERNAME/syarifah-course.git
git push -u origin main
```
Perhatikan titik di akhir `git add .`.

Saat diminta **Password**, tempel **Personal Access Token**, bukan kata sandi GitHub. Layar memang tetap kosong saat Anda menempel; itu normal. Cara membuat token:
1. Buka https://github.com/settings/tokens.
2. Pilih **Generate new token (classic)**.
3. Centang **repo**, lalu klik **Generate**.
4. Salin token (diawali `ghp_…`). Token hanya tampil sekali.

### B5. Aktifkan GitHub Pages
Di repository, buka **Settings → Pages**, lalu atur:
- **Source:** Deploy from a branch
- **Branch:** main, folder `/ (root)`
- Centang **Enforce HTTPS**

Klik **Save** dan tunggu 1–2 menit. Alamat aplikasi Anda: `https://USERNAME.github.io/syarifah-course/`.

### B6. Memperbarui tampilan di kemudian hari
Dari folder yang sama, jalankan:
```bash
git add .
git commit -m "Perbarui tampilan"
git push
```
Bila yang tampil masih versi lama, tekan **Ctrl+Shift+R**.

---

## 4. Bagian C — Mulai memakai

1. Buka alamat GitHub Pages. Pilih tab **Guru / Pengelola**, lalu masuk dengan email dan kata sandi admin dari langkah A2.
2. Aplikasi akan meminta Anda membuat **kata sandi baru**.
3. Buka **Pengaturan → Identitas Aplikasi** untuk mengatur:
   - nama aplikasi, tagline, dan logo,
   - warna utama, warna gelap, dan warna aksen (aplikasi menolak warna yang membuat teks sulit dibaca),
   - tahun ajaran, kontak admin, dan KKM umum.
4. Buka **Siswa & Kelas → Kelas & Mapel** untuk membuat kelas (misalnya `12 SMA Intensif`) dan mata pelajaran.
5. Tambahkan siswa lewat **Siswa & Kelas → Tambah Siswa**, atau impor sekaligus (lihat Bagian D).
   Setiap siswa baru mendapat **ID** (contoh `SC26001`) dan **kata sandi awal** yang tampil sekali. Berikan keduanya ke siswa. Siswa diminta mengganti kata sandi saat pertama masuk.
6. Bila ada guru lain, buka **Pengaturan → Akun Guru → Tambah Akun**.
   - **Admin** bisa mengubah identitas aplikasi, akun guru, dan import.
   - **Guru** bisa mengelola siswa, presensi, materi, latihan, nilai, jadwal, dan tagihan.

| Menu guru | Kegunaan |
|---|---|
| Presensi Kehadiran | Pilih tanggal, kelas, dan sesi, lalu tandai Hadir, Izin, atau Alfa. Bisa diubah lagi tanpa data ganda. |
| Jadwal & Tagihan | Jadwal bisa diulang mingguan. Tagihan bisa dibuat per siswa atau massal per kelas, lalu ditandai lunas. |
| Materi Pembelajaran | Unggah PDF, Word, PPT, atau gambar (maks. 10 MB) ke Drive. Terlihat berapa siswa yang sudah membuka. |
| Latihan Soal | Soal pilihan ganda dengan kunci, bobot, dan pembahasan. Bisa ditempel dari Word/Docs. Nilai dihitung di server. |
| Nilai Siswa | Tabel nilai siswa × latihan. Klik nilai untuk melihat jawaban. Bisa diekspor ke CSV. |
| Laporan | Tren kehadiran, distribusi nilai, kehadiran terendah, dan progres materi. Bisa diekspor ke CSV. |

---

## 5. Bagian D — Import data lama (migrasi)

Buka **Pengaturan → Import Data** (khusus admin).

### Dari Google Sheets lama
1. Tempel URL spreadsheet lama, lalu klik **Baca**. Spreadsheet itu **hanya dibaca** dan tidak pernah diubah.
2. Untuk setiap sheet, pilih akan diimpor sebagai apa: **Siswa / Kelas / Mata Pelajaran / Tagihan / Jadwal / Lewati**. Aplikasi menebak otomatis dari nama sheet.
3. Kolom dicocokkan berdasarkan **nama kolom**, jadi urutannya bebas. Contoh nama kolom yang dikenali:

   | Data | Nama kolom yang dikenali |
   |---|---|
   | Nama | `Nama`, `Nama Lengkap` |
   | Kelas | `Kelas` |
   | Nomor HP | `No HP`, `WA`, `WhatsApp` |
   | Orang tua | `Nama Orang Tua`, `HP Orang Tua` |
   | Tagihan | `Periode` atau `Bulan`, `Jumlah` atau `Nominal`, `Status` |

4. Klik **Pindai (Dry-run)**. Anda akan melihat berapa data yang ditambah, diperbarui, dan dilewati, **tanpa ada yang ditulis**.
5. Klik **Jalankan Import**. Lalu klik **Unduh daftar akun** untuk menyimpan ID dan kata sandi awal siswa baru. Daftar ini hanya tersedia sekali.

Yang perlu diketahui tentang import:
- **Aman diulang.** Siswa yang sama dikenali dari ID, nomor HP, atau nama + kelas. Menjalankan import dua kali tidak membuat data ganda.
- **Data yang sudah ada tidak ditimpa.** Bawaannya hanya kolom kosong yang diisi. Centang "Timpa data yang sudah ada" bila memang ingin mengganti.
- **Angka 0 di depan nomor HP dipulihkan otomatis.** Contoh: `812…` menjadi `0812…`.
- **Spreadsheet lama harus bisa dibuka oleh akun Google pemilik aplikasi.**

### Dari CSV / Excel
Klik **Unduh template CSV**, isi datanya di Excel, lalu **Simpan Sebagai CSV**. Setelah itu pilih berkasnya, klik **Pindai**, lalu **Import**.

### Pindah penuh (cutover) dari sistem lama
1. Import, lalu periksa data siswa, kelas, dan tagihan.
2. Tepat sebelum mengumumkan aplikasi baru, **jalankan import sekali lagi** untuk menangkap data yang masuk ke sistem lama selama masa transisi.
3. Bagikan alamat aplikasi dan akun ke siswa.

---

## 6. Keamanan & Script Properties

Semua rahasia disimpan di **Script Properties** Apps Script (⚙️ Setelan Proyek → Properti Skrip). Rahasia **tidak** disimpan di kode, spreadsheet, atau GitHub.

| Kunci | Dibuat oleh | Keterangan |
|---|---|---|
| `SESSION_SECRET` | Setup, otomatis | Penandatangan token sesi. Jangan dihapus. |
| `PASSWORD_PEPPER` | Setup, otomatis | Membuat hash sandi di sheet tidak bisa ditebak tanpa kunci ini. **Jangan dihapus**: bila hilang, semua kata sandi harus direset. |
| `EMERGENCY_USER/SALT/PASS_HASH` | Setup, otomatis | Akses darurat. Hanya hash yang disimpan. |
| `SPREADSHEET_ID`, `DRIVE_ROOT_FOLDER_ID`, `FOLDER_MATERI`, `FOLDER_LOGO` | Setup, otomatis | Lokasi database dan folder. |
| `REV_*`, `KEEP_WARM` | Aplikasi | Pencabutan sesi dan saklar warmup. |

Aturan dan fungsi pemeliharaan:
- **Kata sandi tidak pernah disimpan.** Yang disimpan hanya hash + salt + pepper.
- **Batas percobaan masuk.** Salah 5 kali, akun dikunci 15 menit.
- **Rotasi sesi.** Jalankan `rotasiSecretSesi()` di editor untuk mengeluarkan semua orang (misalnya bila curiga ada kebocoran).
- **Admin lupa sandi.** Masuk dengan akses darurat, atau jalankan `resetSandiAdmin()`. Sandi baru tampil di log.
- **Sandi darurat hilang.** Jalankan `resetAksesDarurat()`.
- **Jangan membagikan spreadsheet database** dan **jangan menambah editor proyek Apps Script sembarangan.** Siapa pun yang bisa mengedit proyek bisa melihat Script Properties.

---

## 7. Performa

- **Cache.** Data dibaca dari cache (15 menit, berversi per sheet). Simpan dari aplikasi langsung memperbarui cache.
- **Edit langsung di Google Sheets.** Perubahan muncul paling lama ±15 menit, atau segera bila Anda menekan tombol **⟳ Segarkan** di panel guru.
- **keepWarm.** Trigger 5 menit menjaga cache tetap hangat, memakai kuota trigger ±10–15 menit per hari dari jatah ±90 menit untuk akun @gmail.com. Matikan dengan `matikanKeepWarm()` dan nyalakan lagi dengan `nyalakanKeepWarm()`.
- **Status cache.** Jalankan `cekPerforma()` di editor untuk melihat status cache, trigger, dan ukuran Script Properties.
- **Waktu respons dari browser.** Di Console (F12), ketik `Perf.table()`.
- **Batasan jujur.** Server Apps Script yang lama tidak dipakai bisa butuh 1–3 detik untuk bangun. Warmup menjaga cache, bukan menjamin server selalu hangat.

---

## 8. Memperbarui backend di kemudian hari

1. Cadangkan `Kode.gs` lama (salin ke Notepad).
2. Tempel `Kode.gs` baru, lalu **Simpan**. Bila panduan versi baru memintanya, jalankan `setupAppEnvironment()` (aman diulang).
3. Buka **Terapkan → Kelola deployment → ✏️ Edit → Versi: Versi baru → Terapkan.**
   **Jangan** membuat "Deployment baru", karena URL `/exec` akan berubah dan `config.js` harus diisi ulang.

---

## 9. Kendala umum

| Gejala | Penyebab | Solusi |
|---|---|---|
| Halaman "Konfigurasi belum lengkap" | `js/config.js` belum diisi | Isi `GAS_URL`, lalu `git add . && git commit -m "config" && git push` |
| "Server belum siap…" | Web App belum di-deploy atau aksesnya bukan "Siapa saja" | Ulangi A4 |
| "Aplikasi belum disiapkan…" | `setupAppEnvironment` belum dijalankan | Jalankan A2 |
| Situs GitHub 404 | Repository berisi folder pembungkus, `index.html` tidak di root | `git init` harus di folder yang langsung berisi `index.html`, lalu push ulang dengan `--force` |
| Tampilan polos tanpa warna | `css/` dan `js/` hilang strukturnya (upload via web) | Unggah ulang lewat terminal (B4) |
| `Password authentication is not supported` | GitHub butuh token | Buat Personal Access Token (B4) |
| Siswa tidak bisa membuka modul | Domain Google Workspace memblokir berbagi tautan | Unggah dari akun @gmail.com, atau minta admin Workspace mengizinkan berbagi tautan |
| Perubahan di Sheets belum terlihat | Cache | Tekan ⟳ Segarkan di panel guru |
| "Terlalu banyak percobaan" | 5 kali salah sandi | Tunggu 15 menit, atau guru melakukan reset sandi siswa |

---

## 10. Batasan versi ini

- **Materi bisa dibuka siapa pun yang memegang tautannya.** Berkas di Drive dibagikan "siapa pun yang memiliki tautan dapat melihat" agar siswa bisa membuka tanpa akun Google. Tautan memang tidak ditampilkan publik, tetapi siswa bisa meneruskannya.
- **Notifikasi hanya muncul di dalam aplikasi.** Tidak ada email atau WhatsApp, sesuai PRD.
- **Rapor dicetak dari browser.** Tombol "Rapor" memakai fitur cetak, lalu pilih "Simpan sebagai PDF". Tidak ada PDF yang dibuat otomatis.
- **Soal belum mendukung gambar.** Soal saat ini berupa teks pilihan ganda A–D.
- **"Ragu-ragu" dan jawaban sementara disimpan di HP siswa** sampai jawaban dikirim.

---

## 11. Ringkasan pengujian sebelum diserahkan

| Pengujian | Hasil |
|---|---|
| Backend di simulator Apps Script (Node) | **98/98 lulus** |
| Uji browser (Playwright) alur siswa di HP: login → materi → kuis → hasil → nilai → jadwal → profil → notifikasi | 0 error JavaScript |
| Uji browser alur guru di desktop & HP: semua menu, tambah siswa, presensi, tandai lunas, tempel soal, pengaturan warna | 0 error JavaScript, tidak ada halaman yang meluber di layar 390px |
| Audit rahasia: grep literal token/sandi, satu pintu Script Properties, respons API & Audit_Log | Bersih |

Cakupan uji backend:
- **Akun & sesi:** login, kunci setelah 5 kali salah, token palsu atau yang diubah ditolak, hak akses siswa/guru/admin, ganti dan reset sandi mencabut sesi lama.
- **Nilai:** dihitung di server, dan kunci jawaban tidak terkirim sebelum jawaban dikumpulkan.
- **Data:** presensi dan tagihan tidak ganda, import aman diulang, angka 0 di depan nomor HP terjaga.
- **Performa:** cache memotong pembacaan Sheets (11 → 0 baca saat cache hangat), dan tabel 3.000+ baris di-cache berpotongan.
