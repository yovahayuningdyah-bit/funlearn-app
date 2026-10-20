import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import {
  LEVEL_LABEL,
  MODE_LABEL,
  type Badge,
  type GameSession,
  type LeaderboardRow,
} from '../types/db'

interface BadgeOwned {
  badge_code: string
  earned_at: string
}

export default function DashboardPage() {
  const { profile, session, signOut, profileLoading } = useAuth()
  const [badges, setBadges] = useState<Badge[]>([])
  const [owned, setOwned] = useState<BadgeOwned[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([])
  const [sessions, setSessions] = useState<GameSession[]>([])
  const [questionCount, setQuestionCount] = useState<number | null>(null)
  const [error, setError] = useState('')

  const userId = session?.user?.id

  const loadDashboard = useCallback(async () => {
    setError('')
    const [badgeRes, ownedRes, boardRes, sessionRes, countRes] = await Promise.all([
      supabase.from('badges').select('*').order('min_points'),
      userId
        ? supabase.from('user_badges').select('badge_code, earned_at').eq('user_id', userId)
        : Promise.resolve({ data: [], error: null }),
      supabase.from('leaderboard').select('*').order('position').limit(8),
      userId
        ? supabase
            .from('game_sessions')
            .select('*')
            .eq('user_id', userId)
            .order('finished_at', { ascending: false })
            .limit(5)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('questions')
        .select('id', { count: 'exact', head: true })
        .eq('is_published', true),
    ])

    const firstError =
      badgeRes.error || boardRes.error || ('error' in ownedRes ? ownedRes.error : null)
    if (firstError) setError(firstError.message)

    setBadges((badgeRes.data as Badge[] | null) ?? [])
    setOwned((ownedRes.data as BadgeOwned[] | null) ?? [])
    setLeaderboard((boardRes.data as LeaderboardRow[] | null) ?? [])
    setSessions((sessionRes.data as GameSession[] | null) ?? [])
    setQuestionCount(countRes.count ?? 0)
  }, [userId])

  useEffect(() => {
    if (userId) void loadDashboard()
  }, [loadDashboard, userId])

  const ownedCodes = new Set(owned.map((b) => b.badge_code))
  const displayName = profile?.full_name || profile?.username || session?.user.email?.split('@')[0]
  const accuracySessions = sessions.reduce(
    (acc, s) => {
      acc.correct += s.correct_answers
      acc.total += s.total_questions
      return acc
    },
    { correct: 0, total: 0 },
  )
  const accuracy =
    accuracySessions.total > 0
      ? Math.round((accuracySessions.correct / accuracySessions.total) * 100)
      : 0

  return (
    <div className="app-shell">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />

      <header className="app-header">
        <Link to="/dashboard" className="brand-row compact">
          <span className="brand-mark">🎮</span>
          <div>
            <p className="brand-name">EduQuest</p>
            <p className="brand-sub">Bermain &amp; Belajar</p>
          </div>
        </Link>

        <div className="header-user">
          <span className="avatar-big">{profile?.avatar_emoji ?? '🦊'}</span>
          <div className="header-user-text">
            <strong>{displayName ?? 'Petualang'}</strong>
            <span className="muted small">
              {profile ? `Jenjang ${LEVEL_LABEL[profile.school_level]}` : profileLoading ? 'Memuat profil…' : 'Profil belum siap'}
            </span>
          </div>
          <button type="button" className="ghost-button small" onClick={() => void signOut()}>
            Keluar
          </button>
        </div>
      </header>

      <main className="app-main">
        <section className="hero-card">
          <div>
            <p className="eyebrow">Beranda Petualang</p>
            <h1>
              Halo, <span className="grad-text">{displayName?.split(' ')[0] ?? 'Petualang'}</span> 👋
            </h1>
            <p className="muted">
              Siap menambah wawasan hari ini? Setiap jawaban benar membuka lencana baru.
            </p>
            <div className="hero-actions">
              <Link to="/latihan" className="primary-button inline">
                ⚡ Mulai latihan cepat
              </Link>
              <a
                className="ghost-button inline"
                href="#leaderboard"
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById('leaderboard')?.scrollIntoView({ behavior: 'smooth' })
                }}
              >
                🏆 Lihat papan peringkat
              </a>
            </div>
          </div>
          <div className="hero-stats">
            <div>
              <strong>{(profile?.total_points ?? 0).toLocaleString('id-ID')}</strong>
              <span>Poin pengetahuan</span>
            </div>
            <div>
              <strong>{profile?.best_streak ?? 0}</strong>
              <span>Streak terbaik</span>
            </div>
            <div>
              <strong>{accuracy}%</strong>
              <span>Akurasi 5 sesi</span>
            </div>
            <div>
              <strong>{questionCount ?? '—'}</strong>
              <span>Soal tersedia</span>
            </div>
          </div>
        </section>

        {error && (
          <div className="alert alert-error" role="alert">
            <span>⚠️</span>
            <p>Gagal memuat sebagian data: {error}</p>
          </div>
        )}

        <section className="section-block">
          <div className="section-head">
            <h2>Mode Permainan</h2>
            <span className="muted small">1–5 pemain • lintas jenjang</span>
          </div>
          <div className="mode-grid">
            <Link to="/latihan" className="mode-card live">
              <span className="mode-emoji">⚡</span>
              <h3>Bank Soal &amp; Latihan</h3>
              <p>Latihan langsung dari database Supabase, lengkap dengan pembahasan.</p>
              <span className="mode-tag">Siap dimainkan</span>
            </Link>
            <div className="mode-card">
              <span className="mode-emoji">🏃</span>
              <h3>{MODE_LABEL.arcade_runner}</h3>
              <p>Arcade 2D 60 FPS, hindari rintangan dan kumpulkan buku pengetahuan.</p>
              <span className="mode-tag soon">Segera hadir</span>
            </div>
            <div className="mode-card">
              <span className="mode-emoji">🎲</span>
              <h3>{MODE_LABEL.board}</h3>
              <p>Papan 28 kotak, lawan bot atau 4 teman dengan jenjang berbeda.</p>
              <span className="mode-tag soon">Segera hadir</span>
            </div>
            <div className="mode-card">
              <span className="mode-emoji">📖</span>
              <h3>{MODE_LABEL.bank_belajar}</h3>
              <p>Baca ensiklopedia soal, rumus, dan pembahasan tanpa tekanan waktu.</p>
              <span className="mode-tag soon">Segera hadir</span>
            </div>
          </div>
        </section>

        <div className="two-col">
          <section className="panel" id="leaderboard">
            <div className="section-head">
              <h2>Papan Peringkat</h2>
              <span className="muted small">global</span>
            </div>
            {leaderboard.length === 0 ? (
              <p className="muted small">Belum ada pemain. Jadilah yang pertama! 🚀</p>
            ) : (
              <ol className="leader-list">
                {leaderboard.map((row) => (
                  <li key={row.id} className={row.id === userId ? 'me' : ''}>
                    <span className="rank">#{row.position}</span>
                    <span className="avatar-chip static">{row.avatar_emoji}</span>
                    <span className="leader-name">
                      {row.display_name}
                      <small className="muted"> • {LEVEL_LABEL[row.school_level]}</small>
                    </span>
                    <span className="leader-points">{row.total_points.toLocaleString('id-ID')}</span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="panel">
            <div className="section-head">
              <h2>Lencana</h2>
              <span className="muted small">
                {ownedCodes.size}/{badges.length} diraih
              </span>
            </div>
            <div className="badge-grid">
              {badges.map((badge) => {
                const has = ownedCodes.has(badge.code)
                return (
                  <div
                    key={badge.code}
                    className={`badge-item ${has ? 'earned' : ''}`}
                    title={badge.description ?? badge.name}
                  >
                    <span className="badge-icon">{badge.icon}</span>
                    <div>
                      <strong>{badge.name}</strong>
                      <p className="muted small">
                        {has ? 'Diraih' : badge.min_points > 0 ? `${badge.min_points} poin` : 'Belum'}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        </div>

        <section className="panel">
          <div className="section-head">
            <h2>Riwayat Sesi</h2>
            <Link to="/latihan" className="link-button">
              Main lagi →
            </Link>
          </div>
          {sessions.length === 0 ? (
            <p className="muted small">
              Belum ada sesi tercatat. Coba latihan cepat dan hasilnya akan otomatis tersimpan.
            </p>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Mode</th>
                    <th>Jenjang</th>
                    <th>Skor</th>
                    <th>Benar</th>
                    <th>Streak</th>
                    <th>Tanggal</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id}>
                      <td>{MODE_LABEL[s.mode]}</td>
                      <td>{LEVEL_LABEL[s.level]}</td>
                      <td>{s.score.toLocaleString('id-ID')}</td>
                      <td>
                        {s.correct_answers}/{s.total_questions}
                      </td>
                      <td>{s.max_streak}</td>
                      <td>{new Date(s.finished_at).toLocaleDateString('id-ID')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="app-footer">
          <span>EduQuest • React + Vite + Supabase</span>
          <span className="dot-sep">•</span>
          <span>Dokumentasi: KKA APK.md</span>
        </footer>
      </main>
    </div>
  )
}
