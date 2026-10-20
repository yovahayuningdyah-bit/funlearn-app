-- ============================================================
-- EduQuest — Skema Database Supabase
-- File: supabase/migrations/0001_init_eduquest.sql
-- Jalankan di Supabase SQL Editor, atau: supabase db push
-- ============================================================

-- ---------- 0. Ekstensi & helper ----------
create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- 1. Enum tingkatan & peran ----------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'school_level') then
    create type public.school_level as enum ('sd', 'smp', 'sma');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type public.user_role as enum ('student', 'teacher', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'game_mode') then
    create type public.game_mode as enum ('arcade_runner', 'board', 'survival', 'bank_belajar');
  end if;
end
$$;

-- ---------- 2. Profil pengguna ----------
-- Satu baris per auth.users. Dibuat otomatis lewat trigger di bawah.
create table if not exists public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  username      text unique,
  full_name     text,
  avatar_emoji  text not null default '🦊',
  school_level  public.school_level not null default 'sd',
  role          public.user_role   not null default 'student',
  school_name   text,
  total_points  integer not null default 0 check (total_points >= 0),
  best_streak   integer not null default 0 check (best_streak >= 0),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ---------- 3. Bank soal (SD / SMP / SMA) ----------
create table if not exists public.questions (
  id             uuid primary key default gen_random_uuid(),
  level          public.school_level not null,
  subject        text not null,                -- Matematika, IPA, B. Indonesia, ...
  topic          text,                          -- Pythagoras, Metamorfosis, ...
  question_text  text not null,
  choices        jsonb not null,                -- ["opsi A","opsi B","opsi C","opsi D"]
  correct_index  smallint not null check (correct_index between 0 and 3),
  explanation    text,                          -- pembahasan edukatif
  fun_fact       text,                          -- fakta unik
  hint           text,                          -- petunjuk lifeline 50:50
  difficulty     smallint not null default 1 check (difficulty between 1 and 3),
  is_published   boolean not null default true,
  is_custom      boolean not null default false, -- soal buatan guru/siswa
  created_by     uuid references public.profiles (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint choices_are_4 check (jsonb_typeof(choices) = 'array' and jsonb_array_length(choices) = 4)
);

create index if not exists idx_questions_level_subject on public.questions (level, subject);
create index if not exists idx_questions_published on public.questions (is_published);

drop trigger if exists trg_questions_updated_at on public.questions;
create trigger trg_questions_updated_at
before update on public.questions
for each row execute function public.set_updated_at();

-- ---------- 4. Lencana prestasi ----------
create table if not exists public.badges (
  code             text primary key,           -- 'first_win', 'streak_10', ...
  name             text not null,
  description      text,
  icon             text not null default '🏅',
  min_points       integer not null default 0,
  min_accuracy     numeric(5,2) not null default 0,
  created_at       timestamptz not null default now()
);

create table if not exists public.user_badges (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  badge_code text not null references public.badges (code) on delete cascade,
  earned_at  timestamptz not null default now(),
  primary key (user_id, badge_code)
);

-- ---------- 5. Sesi permainan & jawaban ----------
create table if not exists public.game_sessions (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.profiles (id) on delete cascade,
  mode              public.game_mode not null,
  level             public.school_level not null,
  score             integer not null default 0 check (score >= 0),
  correct_answers   integer not null default 0 check (correct_answers >= 0),
  total_questions   integer not null default 0 check (total_questions >= 0),
  lives_lost        integer not null default 0 check (lives_lost >= 0),
  revivals_used     integer not null default 0 check (revivals_used >= 0),
  max_streak        integer not null default 0 check (max_streak >= 0),
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  players_count     smallint not null default 1 check (players_count between 1 and 5),
  finished_at       timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists idx_sessions_user on public.game_sessions (user_id, finished_at desc);
create index if not exists idx_sessions_mode on public.game_sessions (mode);

create table if not exists public.session_answers (
  id              bigserial primary key,
  session_id      uuid not null references public.game_sessions (id) on delete cascade,
  user_id         uuid not null references public.profiles (id) on delete cascade,
  question_id     uuid references public.questions (id) on delete set null,
  level           public.school_level not null,
  chosen_index    smallint,
  is_correct      boolean not null default false,
  points_awarded  integer not null default 0,
  is_revival_gate boolean not null default false,  -- dijawab di Gerbang Kebangkitan
  answered_at     timestamptz not null default now()
);

create index if not exists idx_answers_session on public.session_answers (session_id);
create index if not exists idx_answers_user on public.session_answers (user_id, answered_at desc);

-- ---------- 6. Papan peringkat (view) ----------
create or replace view public.leaderboard as
select
  p.id,
  coalesce(p.username, split_part(p.full_name, ' ', 1), 'Pemain') as display_name,
  p.avatar_emoji,
  p.school_level,
  p.total_points,
  p.best_streak,
  count(distinct ub.badge_code) as badge_count,
  rank() over (order by p.total_points desc) as position
from public.profiles p
left join public.user_badges ub on ub.user_id = p.id
group by p.id;

-- ---------- 7. Trigger: buat profil otomatis saat signup ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, username, full_name, avatar_emoji, school_level, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'username', null),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data ->> 'avatar_emoji', '🦊'),
    coalesce((new.raw_user_meta_data ->> 'school_level')::public.school_level, 'sd'),
    'student'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ---------- 8. Row Level Security ----------
alter table public.profiles       enable row level security;
alter table public.questions      enable row level security;
alter table public.badges         enable row level security;
alter table public.user_badges    enable row level security;
alter table public.game_sessions  enable row level security;
alter table public.session_answers enable row level security;

-- profiles: semua user login boleh melihat (untuk papan peringkat),
-- hanya pemilik yang boleh mengubah datanya sendiri.
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated using (true);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

-- questions: soal publik bisa dibaca semua user login,
-- soal kustom hanya untuk pembuatnya; guru boleh menambah soal.
drop policy if exists "questions_select" on public.questions;
create policy "questions_select"
  on public.questions for select to authenticated
  using (is_published or created_by = auth.uid());

drop policy if exists "questions_insert_creator" on public.questions;
create policy "questions_insert_creator"
  on public.questions for insert to authenticated
  with check (
    created_by = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('teacher', 'admin')
    )
  );

drop policy if exists "questions_update_own" on public.questions;
create policy "questions_update_own"
  on public.questions for update to authenticated
  using (created_by = auth.uid()) with check (created_by = auth.uid());

drop policy if exists "questions_delete_own" on public.questions;
create policy "questions_delete_own"
  on public.questions for delete to authenticated using (created_by = auth.uid());

-- badges: katalog lencana bebas dibaca user login.
drop policy if exists "badges_select" on public.badges;
create policy "badges_select" on public.badges for select to authenticated using (true);

-- user_badges: milik sendiri untuk insert, semua boleh baca.
drop policy if exists "user_badges_select" on public.user_badges;
create policy "user_badges_select" on public.user_badges for select to authenticated using (true);

drop policy if exists "user_badges_insert_own" on public.user_badges;
create policy "user_badges_insert_own"
  on public.user_badges for insert to authenticated with check (auth.uid() = user_id);

-- game_sessions: hanya pemilik yang bisa baca/tulis.
drop policy if exists "sessions_select_own" on public.game_sessions;
create policy "sessions_select_own"
  on public.game_sessions for select to authenticated using (auth.uid() = user_id);

drop policy if exists "sessions_insert_own" on public.game_sessions;
create policy "sessions_insert_own"
  on public.game_sessions for insert to authenticated with check (auth.uid() = user_id);

-- session_answers: hanya pemilik.
drop policy if exists "answers_select_own" on public.session_answers;
create policy "answers_select_own"
  on public.session_answers for select to authenticated using (auth.uid() = user_id);

drop policy if exists "answers_insert_own" on public.session_answers;
create policy "answers_insert_own"
  on public.session_answers for insert to authenticated with check (auth.uid() = user_id);

-- ---------- 9. Seed lencana ----------
insert into public.badges (code, name, description, icon, min_points, min_accuracy) values
  ('first_login',   'Langkah Pertama',   'Berhasil masuk ke EduQuest untuk pertama kali.', '🚪', 0,    0),
  ('first_win',     'Kemenangan Perdana','Menyelesaikan satu sesi permainan.',             '🎉', 0,    0),
  ('revival_gate',  'Bangkit Kembali',   'Lolos Gerbang Kebangkitan Pengetahuan.',         '🔥', 0,    0),
  ('smp_scholar',   'Cendekia SMP',      'Menjawab benar 10 soal tingkat SMP.',            '📚', 500,  0),
  ('sma_scholar',   'Cendekia SMA',      'Menjawab benar 10 soal tingkat SMA.',            '🎓', 1000, 0),
  ('point_hunter',  'Pemburu Poin',      'Mengumpulkan 2.500 poin pengetahuan.',           '💎', 2500, 0),
  ('accuracy_master','Master Akurasi',   'Akurasi jawaban di atas 90%.',                   '🎯', 500,  90),
  ('streak_10',     'Fire Streak',       'Mencapai 10 jawaban benar beruntun.',            '⚡', 0,    0)
on conflict (code) do nothing;

-- ---------- 10. Seed contoh soal ----------
insert into public.questions (level, subject, topic, question_text, choices, correct_index, explanation, fun_fact, hint)
select * from (values
  ('sd'::public.school_level, 'Matematika', 'Operasi Hitung',
   'Hasil dari 125 + 275 - 150 adalah ...',
   '["200","250","300","350"]'::jsonb, 1,
   '125 + 275 = 400, lalu 400 - 150 = 250.',
   'Angka 250 adalah kelipatan 50 yang sering muncul di soal hitung cepat.',
   'Jumlahkan dua angka pertama dulu, baru kurangi.'),

  ('sd', 'IPA', 'Metamorfosis',
   'Urutan metamorfosis sempurna pada kupu-kupu yang benar adalah ...',
   '["Telur - ulat - kepompong - kupu-kupu","Telur - kepompong - ulat - kupu-kupu","Ulat - telur - kupu-kupu - kepompong","Kepompong - ulat - telur - kupu-kupu"]'::jsonb, 0,
   'Metamorfosis sempurna: telur, larva (ulat), pupa (kepompong), imago (kupu-kupu).',
   'Ulat kupu-kupu bisa memakan daun hingga ribuan kali berat tubuhnya sebelum menjadi kepompong.',
   'Diawali telur, diakhiri hewan dewasa bersayap.'),

  ('sd', 'Bahasa Indonesia', 'Peribahasa',
   'Peribahasa "Besar pasak daripada tiang" bermakna ...',
   '["Pengeluaran lebih besar daripada pendapatan","Rumah yang kokoh tiangnya besar","Orang yang sombong akan jatuh","Bekerja keras pasti berhasil"]'::jsonb, 0,
   'Artinya pengeluaran (belanja) lebih besar daripada pendapatan sehingga hidup boros.',
   'Peribahasa ini sering dipakai dalam pelajaran hemat dan literasi keuangan.',
   'Pikirkan soal uang masuk dan uang keluar.'),

  ('sd', 'PPKn', 'Pancasila',
   'Sila kelima Pancasila berbunyi ...',
   '["Persatuan Indonesia","Kemanusiaan yang adil dan beradab","Keadilan sosial bagi seluruh rakyat Indonesia","Ketuhanan Yang Maha Esa"]'::jsonb, 2,
   'Sila kelima: Keadilan sosial bagi seluruh rakyat Indonesia.',
   'Pancasila dirumuskan melalui sidang BPUPKI pada 1945.',
   'Sila terakhir berbicara tentang keadilan.'),

  ('smp', 'Matematika', 'Teorema Pythagoras',
   'Sebuah segitiga siku-siku memiliki sisi tegak 6 cm dan 8 cm. Panjang sisi miringnya adalah ...',
   '["9 cm","10 cm","11 cm","12 cm"]'::jsonb, 1,
   'c^2 = 6^2 + 8^2 = 36 + 64 = 100, maka c = 10 cm.',
   'Tripel 6-8-10 adalah kelipatan tripel Pythagoras 3-4-5.',
   'Gunakan c^2 = a^2 + b^2.'),

  ('smp', 'IPA', 'Biologi Sel',
   'Organel sel yang berfungsi sebagai tempat respirasi sel dan penghasil energi adalah ...',
   '["Ribosom","Mitokondria","Lisosom","Badan Golgi"]'::jsonb, 1,
   'Mitokondria menghasilkan ATP melalui respirasi sel.',
   'DNA mitokondria hanya diturunkan dari ibu sehingga dipakai melacak garis keturunan.',
   'Organel ini dijuluki powerhouse of the cell.'),

  ('smp', 'IPA', 'Asam Basa',
   'Larutan dengan pH 3 bersifat ...',
   '["Basa kuat","Netral","Asam","Garam"]'::jsonb, 2,
   'pH di bawah 7 bersifat asam, pH 7 netral, pH di atas 7 basa.',
   'Lambung manusia memiliki pH sekitar 1,5 sampai 3,5 untuk membunuh bakteri.',
   'Ingat skala pH: di bawah 7 berarti apa?'),

  ('smp', 'IPS', 'Sejarah Nasional',
   'Organisasi pergerakan nasional yang didirikan pada 20 Mei 1908 adalah ...',
   '["Sarekat Islam","Budi Utomo","Indische Partij","Perhimpunan Indonesia"]'::jsonb, 1,
   'Budi Utomo berdiri 20 Mei 1908 dan diperingati sebagai Hari Kebangkitan Nasional.',
   'Tanggal 20 Mei kini diperingati sebagai Hari Kebangkitan Nasional.',
   'Namanya berarti usaha yang mulia.'),

  ('sma', 'Matematika', 'Kalkulus',
   'Turunan pertama dari f(x) = 3x^2 + 5x - 2 adalah ...',
   '["6x + 5","3x + 5","6x - 2","6x^2 + 5"]'::jsonb, 0,
   'Turunkan tiap suku: d/dx(3x^2) = 6x, d/dx(5x) = 5, turunan konstanta = 0.',
   'Konsep turunan dirumuskan Newton dan Leibniz secara terpisah pada abad ke-17.',
   'Gunakan aturan pangkat d/dx(x^n) = n x^(n-1).'),

  ('sma', 'Fisika', 'Listrik',
   'Sebuah hambatan 10 ohm dialiri arus 2 A. Tegangan pada hambatan tersebut adalah ...',
   '["5 V","10 V","20 V","40 V"]'::jsonb, 2,
   'Hukum Ohm: V = I x R = 2 A x 10 ohm = 20 V.',
   'Hukum Ohm dipublikasikan Georg Ohm pada 1827 dan awalnya dianggap kontroversial.',
   'V = I x R.'),

  ('sma', 'Ekonomi', 'Inflasi',
   'Jika inflasi tahunan 6 persen dan tabungan tidak berbunga, daya beli uang setelah satu tahun ...',
   '["Naik 6 persen","Tetap","Turun sekitar 6 persen","Turun 12 persen"]'::jsonb, 2,
   'Harga barang naik 6 persen sehingga jumlah barang yang bisa dibeli dengan nominal yang sama berkurang.',
   'Harga barang kebutuhan pokok beberapa tahun lalu jauh lebih murah dibanding sekarang.',
   'Inflasi mengurangi kemampuan uang membeli barang.'),

  ('sma', 'Biologi', 'Siklus Calvin',
   'Siklus Calvin pada fotosintesis berlangsung di ...',
   '["Stroma kloroplas","Tilakoid","Sitoplasma","Matriks mitokondria"]'::jsonb, 0,
   'Reaksi gelap (siklus Calvin) terjadi di stroma kloroplas, sedangkan reaksi terang di membran tilakoid.',
   'Siklus Calvin tidak membutuhkan cahaya secara langsung, tetapi memakai ATP dan NADPH hasil reaksi terang.',
   'Reaksi terang di tilakoid, reaksi gelap di mana?')
) as v(level, subject, topic, question_text, choices, correct_index, explanation, fun_fact, hint)
where not exists (select 1 from public.questions limit 1);
