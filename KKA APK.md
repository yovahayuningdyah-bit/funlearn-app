# 📘 KKA APK — EduQuest: Bermain & Belajar

**Dokumen Konfigurasi & Komponen Aplikasi (KKA)**
Aplikasi Game Edukasi Interaktif SD / SMP / SMA · 1–5 Pemain

| Item | Keterangan |
| :--- | :--- |
| **Nama aplikasi** | EduQuest — Bermain & Belajar (`eduquest-funlearn`) |
| **Jenis** | Aplikasi web (SPA / PWA-ready) berbasis React + Vite |
| **Repositori GitHub** | `https://github.com/yovahayuningdyah-bit/funlearn-app` |
| **Branch pengembangan** | `arena/35b7aa04-funlearn-app` → di-*merge* ke `main` |
| **Backend & Database** | Supabase (PostgreSQL + Auth + REST/PostgREST) |
| **Supabase Project Ref** | `qlqzcznvfudpfiuvvafe` |
| **Supabase URL** | `https://qlqzcznvfudpfiuvvafe.supabase.co` |
| **Region** | `ap-southeast-1` (Singapura — terdekat dengan Indonesia) |
| **Versi dokumen** | 1.0 — 20 Oktober 2026 |
| **Status** | Login & integrasi database berjalan; mode permainan arcade/board menyusul |

---

## 1. Ringkasan Aplikasi

EduQuest adalah game edukasi berbasis **Game-Based Learning** yang memadukan hiburan digital
dengan kurikulum nasional. Fitur khasnya adalah **Gerbang Kebangkitan Pengetahuan (Revival Gate)**:
saat pemain kalah, permainan tidak berhenti, melainkan memunculkan pilihan soal SD / SMP / SMA
sebagai syarat bangkit kembali.

| Jenjang | Efek kebangkitan |
| :--- | :--- |
| 🎒 **SD** | Nyawa penuh (*Full Revive*) |
| 📚 **SMP** | Nyawa + *Invulnerability Shield* + 150 poin |
| 🎓 **SMA** | Nyawa + *Double Score* 2× + Perisai Emas + 250 poin |

Dokumen ini menjelaskan **bagaimana aplikasi terhubung ke GitHub dan Supabase**, struktur folder,
skema database, alur autentikasi, serta langkah menjalankan dan men-deploy aplikasi.

---

## 2. Arsitektur Sistem

```
┌──────────────────────────┐        git push / pull request
│  Pengembang (lokal)      │ ─────────────────────────────────┐
│  VSCode + Node.js 22     │                                  ▼
└──────────────────────────┘                     ┌──────────────────────────┐
                                                 │  GitHub                  │
                                                 │  yovahayuningdyah-bit/   │
                                                 │  funlearn-app            │
                                                 │  • source code           │
                                                 │  • Actions CI (build)    │
                                                 │  • Secrets .env          │
                                                 └────────────┬─────────────┘
                                                              │ deploy otomatis
                                                              ▼
┌──────────────────────────┐                     ┌──────────────────────────┐
│  Pengguna (browser/HP)   │ ◄─────────────────► │  Hosting statis          │
│  siswa / guru / orang tua│      HTTPS          │  (Vercel / Netlify)      │
└────────────┬─────────────┘                     └──────────────────────────┘
             │  HTTPS + anon key (JWT)
             ▼
┌────────────────────────────────────────────────────────────────────────┐
│  SUPABASE PROJECT  qlqzcznvfudpfiuvvafe                                │
│  ┌──────────────┐   ┌──────────────┐   ┌───────────────────────────┐  │
│  │ Auth (GoTrue)│   │ REST (PostgREST) │  │ PostgreSQL 15          │  │
│  │ email+password│  │ auto API tabel   │  │ profiles, questions,    │  │
│  │ JWT session  │   │ + Row Level Sec. │  │ game_sessions, badges…  │  │
│  └──────────────┘   └──────────────┘   └───────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

**Prinsip penting**

1. **Frontend hanya memakai `anon` / `publishable key`.** Kunci ini memang dirancang publik;
   keamanan data dijaga oleh **Row Level Security (RLS)** di PostgreSQL.
2. **`service_role` / `secret key` tidak boleh masuk repo maupun browser** — hanya untuk
   Edge Function / skrip server.
3. File `.env` **di-*ignore* Git**; nilai aslinya disimpan sebagai *GitHub Secrets* dan
   *Environment Variables* di hosting.

---

## 3. Struktur Proyek

```
funlearn-app/
├─ .github/
│  └─ workflows/
│     └─ ci.yml                 # CI GitHub Actions: install → typecheck → build
├─ public/                      # (aset statis: ikon, audio BGM)
├─ src/
│  ├─ lib/
│  │  ├─ supabase.ts            # ⭐ inisialisasi klien Supabase + pemetaan error
│  │  └─ auth.tsx               # ⭐ AuthProvider, useAuth, signIn/signUp/signOut/reset
│  ├─ types/
│  │  └─ db.ts                  # tipe TypeScript tabel DB + label jenjang/mode
│  ├─ pages/
│  │  ├─ LoginPage.tsx          # ⭐ HALAMAN AWAL: masuk / daftar / lupa sandi
│  │  ├─ DashboardPage.tsx      # beranda: profil, poin, lencana, leaderboard, riwayat
│  │  └─ PracticePage.tsx       # latihan kuis dari tabel questions + simpan sesi
│  ├─ App.tsx                   # routing + guard RequireAuth
│  ├─ main.tsx                  # entry React, BrowserRouter, AuthProvider
│  └─ styles.css                # tema dark modern (violet–cyan), responsif
├─ supabase/
│  └─ migrations/
│     └─ 0001_init_eduquest.sql # ⭐ skema DB lengkap: enum, tabel, RLS, seed
├─ .env.example                 # template variabel lingkungan
├─ .env                         # nilai asli (TIDAK di-commit)
├─ .gitignore
├─ index.html                   # meta viewport, theme-color, title
├─ package.json                 # script dev / build / typecheck
├─ tsconfig.json
├─ vite.config.ts               # host 0.0.0.0, allowedHosts (siap preview cloud)
└─ KKA APK.md                   # dokumen ini
```

### 3.1 Peta file ↔ tanggung jawab

| File | Tanggung jawab | Terhubung ke |
| :--- | :--- | :--- |
| `src/lib/supabase.ts` | Membuat satu instance `SupabaseClient`, membaca env, `describeAuthError()` | Supabase Auth & REST |
| `src/lib/auth.tsx` | Menyimpan `session` + `profile`, berlangganan `onAuthStateChange` | `auth.users`, `public.profiles` |
| `src/App.tsx` | Rute `/login`, `/dashboard`, `/latihan`; redirect sesuai status sesi | — |
| `src/pages/LoginPage.tsx` | Form masuk, daftar (nama, jenjang, avatar), lupa sandi | `supabase.auth.*` |
| `src/pages/DashboardPage.tsx` | Statistik, lencana, papan peringkat, riwayat sesi | `profiles`, `badges`, `user_badges`, `leaderboard`, `game_sessions` |
| `src/pages/PracticePage.tsx` | Kuis 8 soal/jenjang, hitung poin, simpan hasil | `questions`, `game_sessions`, `session_answers`, `profiles` |
| `supabase/migrations/0001_init_eduquest.sql` | Sumber kebenaran skema database | PostgreSQL Supabase |

---

## 4. Koneksi ke GitHub

### 4.1 Repositori

```
Remote  : origin
URL     : https://github.com/yovahayuningdyah-bit/funlearn-app.git
Branch  : main (produksi) · arena/35b7aa04-funlearn-app (pengembangan)
```

### 4.2 Alur kerja harian

```bash
# 1. Ambil kode terbaru
git checkout arena/35b7aa04-funlearn-app
git pull origin arena/35b7aa04-funlearn-app

# 2. Install dependensi (sekali per perubahan package.json)
npm install

# 3. Jalankan server pengembangan
npm run dev            # http://localhost:5173

# 4. Simpan perubahan
git add .
git commit -m "feat(login): halaman login + integrasi Supabase Auth"
git push origin arena/35b7aa04-funlearn-app

# 5. Buka Pull Request ke main
gh pr create --base main --head arena/35b7aa04-funlearn-app \
  --title "feat: halaman login & integrasi Supabase" \
  --body "Menambahkan halaman login, skema database, dan dokumentasi KKA."
```

### 4.3 Secrets untuk CI (GitHub Actions)

`Settings → Secrets and variables → Actions → New repository secret`

| Nama secret | Contoh nilai | Wajib |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://qlqzcznvfudpfiuvvafe.supabase.co` | ✅ |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOi…` (anon/publishable) | ✅ |
| `VITE_SUPABASE_PROJECT_REF` | `qlqzcznvfudpfiuvvafe` | opsional |

> Workflow `.github/workflows/ci.yml` berjalan pada setiap push/PR: `npm ci` → `npm run typecheck`
> → `npm run build`, lalu mengunggah artefak `dist`.

### 4.4 Deploy otomatis (Vercel — opsi termudah)

1. Buka [vercel.com](https://vercel.com) → **Add New Project** → import repo `funlearn-app`.
2. Framework preset: **Vite** · Build command `npm run build` · Output `dist`.
3. Tambahkan *Environment Variables*: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`,
   `VITE_SUPABASE_PROJECT_REF`, `VITE_GITHUB_REPO`.
4. Tambahkan **rewrite** agar SPA tidak 404 saat refresh di `/login` atau `/dashboard`:
   ```json
   { "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }] }
   ```
5. Setelah domain produksi jadi, tambahkan domain itu ke Supabase:
   **Authentication → URL Configuration → Site URL & Redirect URLs**.

---

## 5. Koneksi ke Supabase

### 5.1 Kredensial proyek

| Item | Nilai |
| :--- | :--- |
| Project name | `eduquest-funlearn` |
| Project ref | `qlqzcznvfudpfiuvvafe` |
| API URL | `https://qlqzcznvfudpfiuvvafe.supabase.co` |
| Auth endpoint | `https://qlqzcznvfudpfiuvvafe.supabase.co/auth/v1` |
| REST endpoint | `https://qlqzcznvfudpfiuvvafe.supabase.co/rest/v1` |
| Kunci frontend | `anon` (legacy JWT) atau `sb_publishable_…` — **boleh publik** |
| Kunci server | `service_role` / `sb_secret_…` — **rahasia, jangan pernah di frontend** |
| Dashboard | `https://supabase.com/dashboard/project/qlqzcznvfudpfiuvvafe` |

### 5.2 Variabel lingkungan (`.env`)

```env
VITE_SUPABASE_URL=https://qlqzcznvfudpfiuvvafe.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-or-publishable-key>
VITE_SUPABASE_PROJECT_REF=qlqzcznvfudpfiuvvafe
VITE_GITHUB_REPO=https://github.com/yovahayuningdyah-bit/funlearn-app
```

Aturan:

- Awalan **`VITE_`** wajib, karena Vite hanya mengekspos variabel berawalan itu ke browser.
- Setelah mengubah `.env`, **hentikan dan jalankan ulang** `npm run dev`.
- `.env` masuk `.gitignore`; bagikan nilainya lewat *password manager* atau *Secrets*, bukan Git.

### 5.3 Cara aplikasi memakai Supabase

```ts
// src/lib/supabase.ts
const url    = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
export const supabase = createClient(url, anonKey, { auth: { storageKey: 'eduquest-auth' } })
```

```ts
// Login
await supabase.auth.signInWithPassword({ email, password })

// Daftar (metadata tersimpan ke user_metadata, lalu disalin trigger ke public.profiles)
await supabase.auth.signUp({
  email, password,
  options: { data: { full_name, username, school_level, avatar_emoji } },
})

// Baca soal sesuai jenjang
await supabase.from('questions').select('*').eq('level', 'smp').eq('is_published', true)
```

### 5.4 Skema database

```
auth.users (Supabase, terkelola)
   │ 1
   │
   │ 1                    trigger on_auth_user_created
   ▼                        └─ INSERT public.profiles
profiles ──────────┐
   │ 1            │ 1
   │              │
   │ N            │ N
user_badges        game_sessions ────── N ── session_answers ─── N ── questions
   │ N            │                       (jawaban per soal)          │ N
   │              │                                                  │ 1
   │ 1            │ 1                                                │
   ▼              ▼                                                  │
badges          profiles                                             │
                                                      profiles ───────┘ (created_by)
```

| Tabel | Fungsi | Kolom kunci |
| :--- | :--- | :--- |
| `profiles` | Profil pemain/guru, salinan 1:1 dari `auth.users` | `id` (FK auth.users), `school_level`, `role`, `total_points`, `best_streak`, `avatar_emoji` |
| `questions` | Bank soal SD/SMP/SMA + soal kustom | `level`, `subject`, `choices` (jsonb 4 opsi), `correct_index`, `explanation`, `fun_fact`, `hint`, `created_by` |
| `badges` | Katalog lencana | `code`, `name`, `icon`, `min_points`, `min_accuracy` |
| `user_badges` | Lencana yang diraih | `user_id` + `badge_code` (PK gabungan) |
| `game_sessions` | Satu baris per sesi/mode | `mode`, `level`, `score`, `correct_answers`, `revivals_used`, `max_streak`, `players_count` (1–5) |
| `session_answers` | Rekaman tiap jawaban | `session_id`, `question_id`, `is_correct`, `is_revival_gate` |
| `leaderboard` *(view)* | Peringkat global dari `total_points` | `display_name`, `position`, `badge_count` |

**Enum PostgreSQL**: `school_level ('sd','smp','sma')`, `user_role ('student','teacher','admin')`,
`game_mode ('arcade_runner','board','survival','bank_belajar')`.

### 5.5 Row Level Security (RLS)

RLS **aktif pada semua tabel**. Ringkasan kebijakan:

| Tabel | SELECT | INSERT | UPDATE | DELETE |
| :--- | :--- | :--- | :--- | :--- |
| `profiles` | semua user login | hanya `id = auth.uid()` | hanya baris sendiri | – |
| `questions` | soal publik **atau** milik sendiri | hanya guru/admin, `created_by = auth.uid()` | milik sendiri | milik sendiri |
| `badges` | semua user login | – | – | – |
| `user_badges` | semua user login | milik sendiri | – | – |
| `game_sessions` | milik sendiri | milik sendiri | – | – |
| `session_answers` | milik sendiri | milik sendiri | – | – |

Konsekuensinya: skor dan poin tidak bisa diubah pemain lain, dan tab *Network* browser
tidak bisa dipakai membaca data pribadi orang lain meski memakai anon key.

### 5.6 Konfigurasi Auth yang dipakai

| Pengaturan | Nilai | Alasan |
| :--- | :--- | :--- |
| Provider | Email + password | Paling sederhana untuk siswa sekolah |
| **Confirm email** | **Nonaktif** (`mailer_autoconfirm = true`) | Uji coba kelas tidak perlu verifikasi email; bisa diaktifkan saat produksi |
| Panjang sandi minimal | 6 karakter | Default Supabase, cukup ramah anak |
| Sesi | persist + auto refresh, `flowType: pkce` | Login tetap terjaga saat tab ditutup |
| Site URL | `http://localhost:5173` | Diganti ke domain produksi saat deploy |
| Redirect allow list | `localhost:5173/**`, `localhost:4173/**`, `*.e2b.app/**` | Link reset sandi |

> ⚠️ Untuk produksi sekolah: aktifkan kembali **Confirm email**, gunakan SMTP sendiri
> (Resend/SendGrid), dan naikkan panjang sandi minimum menjadi 8.

### 5.7 Menerapkan / memperbarui skema

**Cara A — SQL Editor (tanpa CLI)**

1. Buka **Supabase Dashboard → SQL Editor → New query**.
2. Salin seluruh isi `supabase/migrations/0001_init_eduquest.sql`.
3. **Run**. Skrip bersifat *idempotent* (`create table if not exists`, `do $$ … $$`,
   `on conflict do nothing`), aman dijalankan ulang.

**Cara B — Supabase CLI**

```bash
npm i -g supabase
supabase login
supabase link --project-ref qlqzcznvfudpfiuvvafe
supabase db push          # menerapkan semua file di supabase/migrations
```

**Verifikasi cepat**

```sql
select (select count(*) from public.questions) as soal,
       (select count(*) from public.badges)    as lencana,
       (select count(*) from pg_policies where schemaname = 'public') as policy;
-- hasil saat ini: 12 soal · 8 lencana · 14 policy
```

### 5.8 Data awal (seed) yang sudah terpasang

| Data | Jumlah | Contoh |
| :--- | :--- | :--- |
| Soal SD | 4 | hitung campuran, metamorfosis, peribahasa, Pancasila |
| Soal SMP | 4 | Pythagoras, mitokondria, pH asam-basa, Budi Utomo |
| Soal SMA | 4 | turunan kalkulus, Hukum Ohm, inflasi, siklus Calvin |
| Lencana | 8 | Langkah Pertama, Fire Streak, Cendekia SMP, Master Akurasi… |

Menambah soal dari dashboard Supabase (**Table editor → questions**) atau dari menu
*Ruang Guru* (fitur berikutnya):

```sql
insert into public.questions (level, subject, topic, question_text, choices, correct_index, explanation, fun_fact, hint)
values ('smp', 'Matematika', 'Aljabar', 'Nilai x dari 2x + 6 = 18 adalah …',
        '["4","6","8","12"]'::jsonb, 1, '2x = 12 sehingga x = 6.', 'Aljabar berasal dari kata al-jabr.', 'Kurangi dulu kedua ruas dengan 6.');
```

---

## 6. Halaman Login (Autentikasi Awal)

Halaman login adalah **halaman pertama yang muncul** saat aplikasi dibuka
(rute `/` → `/login` bila belum ada sesi).

### 6.1 Alur

```
Buka aplikasi
   │
   ├─ Ada sesi tersimpan? ── ya ──► /dashboard
   │
   └─ tidak
        ▼
   /login  (tab: Masuk | Daftar | Lupa sandi)
        │
        ├─ MASUK   → signInWithPassword → sesi dibuat → onAuthStateChange → /dashboard
        │              └─ gagal → pesan "Email atau kata sandi salah."
        │
        ├─ DAFTAR  → signUp(email, password, metadata{ nama, jenjang, avatar })
        │              ├─ trigger DB membuat baris public.profiles
        │              └─ konfirmasi email nonaktif → langsung masuk
        │
        └─ LUPA SANDI → resetPasswordForEmail → tautan ke /login?mode=reset
```

### 6.2 Elemen antarmuka

| Bagian | Isi |
| :--- | :--- |
| Panel kiri (branding) | Logo, headline, ringkasan 4 mode permainan, indikator koneksi Supabase + project ref, tautan GitHub |
| Panel kanan (form) | Tab **Masuk / Daftar**, input email, kata sandi (dengan tombol 👁), konfirmasi sandi, nama panggilan, pemilih jenjang **SD/SMP/SMA**, pemilih 8 avatar emoji |
| Umpan balik | Validasi klien (format email, sandi ≥ 6, konfirmasi cocok), status *loading* tombol, alert merah/hijau, `role="alert"` untuk pembaca layar |
| Fallback | Jika `.env` belum diisi, tampil peringatan konfigurasi, bukan halaman rusak |

### 6.3 Keamanan autentikasi

- Kata sandi **tidak pernah** disimpan di state global atau localStorage aplikasi;
  Supabase menyimpan hash (bcrypt) di `auth.users.encrypted_password`.
- Sesi berupa JWT disimpan oleh `supabase-js` (kunci `eduquest-auth`) dan di-*refresh* otomatis.
- Rute `/dashboard` dan `/latihan` dilindungi komponen `RequireAuth`; pengalihan dilakukan
  setelah status sesi diketahui agar tidak ada kedipan halaman.
- Logout memanggil `supabase.auth.signOut()` dan menghapus profil dari memori.

---

## 7. Menjalankan Aplikasi

```bash
# Prasyarat: Node.js ≥ 20 (disarankan 22), npm ≥ 10
git clone https://github.com/yovahayuningdyah-bit/funlearn-app.git
cd funlearn-app
npm install
cp .env.example .env      # lalu isi URL + anon key Supabase
npm run dev               # buka http://localhost:5173
```

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Server pengembangan (hot reload) di port 5173 |
| `npm run typecheck` | Cek tipe TypeScript tanpa menghasilkan file |
| `npm run build` | Typecheck + bundel produksi ke `dist/` |
| `npm run preview` | Menjalankan hasil build di port 4173 |

**Uji cepat alur end-to-end**

1. Buka `/login` → tab **Daftar**.
2. Isi nama `Dinda`, email `dinda@sekolah.id`, sandi `rahasia123`, pilih jenjang **SMP**, pilih avatar.
3. Klik **Buat akun & mulai bermain** → masuk ke beranda dengan poin 0.
4. Cek Supabase → **Table editor → profiles** → baris baru dengan `school_level = smp` muncul otomatis.
5. Klik **Mulai latihan cepat** → jawab 8 soal → hasil tersimpan di `game_sessions` dan
   `total_points` profil bertambah.
6. Buka **Papan Peringkat** di beranda → nama pengguna muncul.

---

## 8. Pengujian & Checklist

| No | Skenario | Hasil yang diharapkan | Status |
| :-: | :--- | :--- | :-: |
| 1 | Buka `/` tanpa login | Dialihkan ke halaman login | ✅ |
| 2 | Daftar dengan email baru | Akun dibuat, profil otomatis muncul, masuk ke dashboard | ✅ |
| 3 | Daftar dengan email yang sudah ada | Pesan "Email ini sudah terdaftar." | ✅ |
| 4 | Login sandi salah | Pesan "Email atau kata sandi salah." | ✅ |
| 5 | Login benar | Masuk dashboard, nama & avatar sesuai | ✅ |
| 6 | Refresh di `/dashboard` | Sesi bertahan (tidak ter-logout) | ✅ |
| 7 | Klik Keluar | Kembali ke `/login`, sesi dihapus | ✅ |
| 8 | Lupa sandi | Muncul notifikasi tautan dikirim | ✅ |
| 9 | Latihan kuis | Soal tampil sesuai jenjang dari tabel `questions` | ✅ |
| 10 | Selesai kuis | Baris baru di `game_sessions`, poin profil bertambah | ✅ |
| 11 | Buka `/dashboard` di jendela privat | Tidak bisa masuk tanpa login | ✅ |
| 12 | Akses data pengguna lain via REST + anon key | Ditolak RLS (hanya data sendiri) | ✅ |

---

## 9. Pemecahan Masalah

| Gejala | Penyebab | Solusi |
| :--- | :--- | :--- |
| Layar menampilkan "Supabase belum dikonfigurasi" | `.env` belum ada / nama variabel salah | Buat `.env`, pastikan awalan `VITE_`, restart `npm run dev` |
| `Failed to fetch` saat login | URL project salah, project *paused*, atau offline | Cek `VITE_SUPABASE_URL`, buka dashboard Supabase, pastikan project aktif |
| Login berhasil tetapi profil kosong | Trigger `on_auth_user_created` belum ada | Jalankan ulang migrasi bagian trigger |
| "Email not confirmed" | Konfirmasi email aktif | Masuk dashboard → Authentication → Providers → Email → matikan *Confirm email* |
| Kuis kosong | Belum ada soal untuk jenjang itu | Jalankan seed bagian 10 pada migrasi, atau tambah lewat Table editor |
| Poin tidak bertambah | RLS `profiles_update_own` tidak terpasang | Cek `pg_policies`, jalankan ulang bagian RLS |
| Refresh di `/dashboard` → 404 (produksi) | Hosting belum punya rewrite SPA | Tambahkan rewrite semua path ke `/index.html` |
| Build gagal di GitHub Actions | Secret belum diisi | Tambahkan `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY` di repo secrets |

---

## 10. Peta Jalan Pengembangan

| Tahap | Fitur | Status |
| :--- | :--- | :-- |
| 1 | Skema database + RLS + seed soal | ✅ selesai |
| 2 | Halaman login / daftar / lupa sandi | ✅ selesai |
| 3 | Dashboard, lencana, papan peringkat, latihan kuis | ✅ selesai |
| 4 | Petualangan Ksatria (arcade runner canvas 60 FPS) | ⏳ berikutnya |
| 5 | Duel Papan 1–5 pemain (bot + realtime Supabase) | ⏳ |
| 6 | Survival Kuis Cepat dengan timer & combo Fire Streak | ⏳ |
| 7 | Gerbang Kebangkitan (3 opsi jenjang, shield, 2× skor) | ⏳ |
| 8 | Ruang Guru: tambah soal kustom + moderasi | ⏳ |
| 9 | Audio Web Audio API (SFX + BGM) & animasi partikel | ⏳ |
| 10 | PWA (manifest + service worker) agar bisa di-install di HP | ⏳ |

Kolom `game_mode` dan `session_answers.is_revival_gate` sudah disiapkan sehingga tahap 4–7
tidak memerlukan migrasi besar lagi.

---

## 11. Lampiran — Ringkasan Kredensial & Akses

| Keperluan | Lokasi penyimpanan | Boleh di-commit? |
| :--- | :--- | :-: |
| URL Supabase | `.env` / GitHub Secrets / hosting env | ✅ (bukan rahasia) |
| `anon` / publishable key | `.env` / GitHub Secrets / hosting env | ✅ (memang publik) |
| `service_role` / `secret key` | **Hanya** Supabase Dashboard & server | ❌ **jangan pernah** |
| Password database | Supabase Dashboard (tidak dipakai frontend) | ❌ |
| Token GitHub | tersimpan di kredensial lokal / CLI | ❌ |

**Referensi**

- Dokumentasi Supabase Auth — <https://supabase.com/docs/guides/auth>
- Supabase Row Level Security — <https://supabase.com/docs/guides/database/postgres/row-level-security>
- Vite Environment Variables — <https://vite.dev/guide/env-and-mode>
- Repositori aplikasi — <https://github.com/yovahayuningdyah-bit/funlearn-app>

---

> **EduQuest — Belajar Jadi Petualangan yang Menyenangkan!** 🎮
> Dokumen ini diperbarui setiap kali skema database, variabel lingkungan, atau alur autentikasi berubah.
