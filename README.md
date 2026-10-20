# 🎮 EduQuest — Bermain & Belajar

Aplikasi game edukasi interaktif untuk siswa **SD, SMP, dan SMA** (1–5 pemain) dengan sistem
**Gerbang Kebangkitan Pengetahuan (Revival Gate)**. Dibangun dengan React + Vite di sisi klien,
serta **Supabase** sebagai backend autentikasi dan database PostgreSQL.

## ✨ Status saat ini

| Fitur | Status |
| :--- | :--- |
| Skema database + RLS + 12 soal & 8 lencana awal | ✅ |
| **Halaman login / daftar / lupa kata sandi** | ✅ |
| Dashboard (poin, lencana, papan peringkat, riwayat sesi) | ✅ |
| Latihan kuis dari database + penyimpanan sesi | ✅ |
| Arcade Runner, Duel Papan, Survival, Ruang Guru | ⏳ menyusul |

## 🚀 Menjalankan

```bash
npm install
cp .env.example .env    # isi VITE_SUPABASE_URL & VITE_SUPABASE_ANON_KEY
npm run dev             # http://localhost:5173
```

Tanpa mengisi `.env`, halaman login tetap tampil namun menampilkan peringatan konfigurasi.

## 🗄️ Backend

- Supabase project: `qlqzcznvfudpfiuvvafe` (region `ap-southeast-1`)
- Skema lengkap: [`supabase/migrations/0001_init_eduquest.sql`](supabase/migrations/0001_init_eduquest.sql)
- Tabel: `profiles`, `questions`, `badges`, `user_badges`, `game_sessions`, `session_answers` (+ view `leaderboard`)
- Semua tabel dilindungi **Row Level Security**

## 📚 Dokumentasi

Baca **[KKA APK.md](KKA%20APK.md)** untuk struktur proyek lengkap, koneksi GitHub & Supabase,
skema ERD, alur autentikasi, checklist pengujian, dan panduan deploy.

## 🧱 Tumpukan teknologi

React 19 · TypeScript · Vite · React Router · Supabase JS · CSS kustom (dark modern, responsif)

---

EduQuest — Belajar Jadi Petualangan yang Menyenangkan! 🎓
