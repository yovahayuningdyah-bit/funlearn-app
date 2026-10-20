import { useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { describeAuthError, supabaseConfig } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import type { SchoolLevel } from '../types/db'

type Mode = 'login' | 'register' | 'reset'

const AVATARS = ['🦊', '🐯', '🐼', '🦉', '🐙', '🦄', '🐝', '🐢']

const LEVEL_OPTIONS: { value: SchoolLevel; label: string; desc: string }[] = [
  { value: 'sd', label: 'SD', desc: 'Dasar • Full Revive' },
  { value: 'smp', label: 'SMP', desc: 'Menengah • Shield +150' },
  { value: 'sma', label: 'SMA', desc: 'Atas / SNBT • 2x Skor' },
]

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 12s3.5-6.5 9-6.5S21 12 21 12s-3.5 6.5-9 6.5S3 12 3 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 3l18 18" />
      <path d="M10.6 6.1A9.7 9.7 0 0 1 12 6c5.5 0 9 6 9 6a17 17 0 0 1-2.4 3.2M6.5 8.3A17 17 0 0 0 3 12s3.5 6 9 6a9.6 9.6 0 0 0 3.4-.6" />
    </svg>
  )
}

export default function LoginPage() {
  const [searchParams] = useSearchParams()
  const { signIn, signUp, resetPassword } = useAuth()

  const [mode, setMode] = useState<Mode>(searchParams.get('mode') === 'reset' ? 'reset' : 'login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [schoolLevel, setSchoolLevel] = useState<SchoolLevel>('sd')
  const [avatarEmoji, setAvatarEmoji] = useState(AVATARS[0])
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const title = useMemo(() => {
    if (mode === 'register') return 'Buat Akun Petualang'
    if (mode === 'reset') return 'Pulihkan Akun'
    return 'Masuk ke EduQuest'
  }, [mode])

  function switchMode(next: Mode) {
    setMode(next)
    setError('')
    setNotice('')
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setNotice('')

    if (!supabaseConfig.isConfigured) {
      setError(
        'Supabase belum terkonfigurasi. Isi VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY pada file .env, lalu jalankan ulang dev server.',
      )
      return
    }

    if (mode !== 'reset' && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setError('Masukkan alamat email yang valid, contoh: siswa@sekolah.id')
      return
    }

    if (mode === 'reset') {
      setBusy(true)
      try {
        await resetPassword(email)
        setNotice('Tautan pemulihan sudah dikirim. Silakan periksa kotak masuk email kamu.')
      } catch (err) {
        setError(describeAuthError(err instanceof Error ? err.message : 'Terjadi kesalahan.'))
      } finally {
        setBusy(false)
      }
      return
    }

    if (password.length < 6) {
      setError('Kata sandi minimal 6 karakter.')
      return
    }

    if (mode === 'register') {
      if (fullName.trim().length < 2) {
        setError('Nama panggilan minimal 2 karakter.')
        return
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi kata sandi belum sama.')
        return
      }
    }

    setBusy(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        // Pengalihan ditangani otomatis oleh <App /> setelah sesi terbentuk.
      } else {
        const { needsConfirmation } = await signUp({
          email,
          password,
          fullName,
          username: email.split('@')[0] ?? '',
          schoolLevel,
          avatarEmoji,
        })
        if (needsConfirmation) {
          setNotice(
            'Akun berhasil dibuat! Cek email untuk konfirmasi, lalu kembali ke halaman ini untuk masuk.',
          )
          setMode('login')
          setPassword('')
          setConfirmPassword('')
        }
      }
    } catch (err) {
      setError(describeAuthError(err instanceof Error ? err.message : 'Terjadi kesalahan.'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-shell">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />
      <div className="aurora aurora-c" />

      <section className="auth-showcase">
        <div className="brand-row">
          <span className="brand-mark">🎮</span>
          <div>
            <p className="brand-name">EduQuest</p>
            <p className="brand-sub">Bermain &amp; Belajar</p>
          </div>
        </div>

        <h1 className="showcase-title">
          Belajar jadi
          <br />
          <span className="grad-text">petualangan</span> yang
          <br />
          menyenangkan.
        </h1>
        <p className="showcase-lead">
          Game edukasi interaktif untuk siswa SD, SMP, dan SMA. Kalah bukan akhir —
          hadapi <strong>Gerbang Kebangkitan Pengetahuan</strong> dan bangkit dengan
          ilmu baru.
        </p>

        <ul className="feature-list">
          <li>
            <span className="feature-icon">🏃</span>
            <div>
              <strong>Petualangan Ksatria</strong>
              <p>Arcade runner 2D, kumpulkan buku &amp; koin pengetahuan.</p>
            </div>
          </li>
          <li>
            <span className="feature-icon">🎲</span>
            <div>
              <strong>Duel Papan 1–5 Pemain</strong>
              <p>Lawan bot pintar atau teman sekelas lintas jenjang.</p>
            </div>
          </li>
          <li>
            <span className="feature-icon">⚡</span>
            <div>
              <strong>Survival Kuis Cepat</strong>
              <p>Kejar combo Fire Streak dan lipatgandakan poin.</p>
            </div>
          </li>
          <li>
            <span className="feature-icon">📖</span>
            <div>
              <strong>Pembahasan &amp; Fakta Unik</strong>
              <p>Setiap soal punya kunci, rumus, dan penjelasan.</p>
            </div>
          </li>
        </ul>

        <div className="status-strip">
          <span className={`status-dot ${supabaseConfig.isConfigured ? 'ok' : 'warn'}`} />
          <span>
            {supabaseConfig.isConfigured
              ? 'Terhubung ke Supabase'
              : 'Supabase belum dikonfigurasi'}
          </span>
          {supabaseConfig.projectRef && <code>{supabaseConfig.projectRef}</code>}
        </div>
      </section>

      <section className="auth-panel">
        <div className="auth-card">
          <div className="auth-card-head">
            <p className="eyebrow">
              {mode === 'register' ? 'Baru di sini?' : mode === 'reset' ? 'Lupa kata sandi?' : 'Selamat datang kembali'}
            </p>
            <h2>{title}</h2>
            <p className="muted small">
              {mode === 'reset'
                ? 'Masukkan email terdaftar, kami kirim tautan untuk membuat kata sandi baru.'
                : 'Masuk untuk melanjutkan progres, lencana, dan papan peringkatmu.'}
            </p>
          </div>

          {mode !== 'reset' && (
            <div className="tabs" role="tablist" aria-label="Pilih mode autentikasi">
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'login'}
                className={`tab ${mode === 'login' ? 'active' : ''}`}
                onClick={() => switchMode('login')}
              >
                Masuk
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === 'register'}
                className={`tab ${mode === 'register' ? 'active' : ''}`}
                onClick={() => switchMode('register')}
              >
                Daftar
              </button>
            </div>
          )}

          <form className="auth-form" onSubmit={handleSubmit} noValidate>
            {mode === 'register' && (
              <>
                <label className="field">
                  <span>Nama panggilan</span>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Dinda"
                    autoComplete="nickname"
                    required
                  />
                </label>

                <div className="field">
                  <span>Pilih jenjang</span>
                  <div className="level-grid">
                    {LEVEL_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        className={`level-card ${schoolLevel === option.value ? 'active' : ''}`}
                        onClick={() => setSchoolLevel(option.value)}
                        aria-pressed={schoolLevel === option.value}
                      >
                        <strong>{option.label}</strong>
                        <small>{option.desc}</small>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <span>Avatar petualang</span>
                  <div className="avatar-row">
                    {AVATARS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className={`avatar-chip ${avatarEmoji === emoji ? 'active' : ''}`}
                        onClick={() => setAvatarEmoji(emoji)}
                        aria-label={`Pilih avatar ${emoji}`}
                        aria-pressed={avatarEmoji === emoji}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            <label className="field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="siswa@sekolah.id"
                autoComplete="email"
                inputMode="email"
                required
              />
            </label>

            {mode !== 'reset' && (
              <label className="field">
                <span>Kata sandi</span>
                <div className="input-with-action">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimal 6 karakter"
                    autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                    required
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                  >
                    <EyeIcon open={showPassword} />
                  </button>
                </div>
              </label>
            )}

            {mode === 'register' && (
              <label className="field">
                <span>Ulangi kata sandi</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang kata sandi"
                  autoComplete="new-password"
                  required
                />
              </label>
            )}

            {mode === 'login' && (
              <div className="form-row-between">
                <label className="checkbox">
                  <input type="checkbox" defaultChecked />
                  <span>Ingat saya</span>
                </label>
                <button type="button" className="link-button" onClick={() => switchMode('reset')}>
                  Lupa kata sandi?
                </button>
              </div>
            )}

            {error && (
              <div className="alert alert-error" role="alert">
                <span>⚠️</span>
                <p>{error}</p>
              </div>
            )}
            {notice && (
              <div className="alert alert-ok" role="status">
                <span>✅</span>
                <p>{notice}</p>
              </div>
            )}

            <button type="submit" className="primary-button" disabled={busy}>
              {busy ? (
                <>
                  <span className="spinner" /> Memproses…
                </>
              ) : mode === 'register' ? (
                'Buat akun & mulai bermain'
              ) : mode === 'reset' ? (
                'Kirim tautan pemulihan'
              ) : (
                'Masuk'
              )}
            </button>

            {mode === 'reset' && (
              <button type="button" className="ghost-button" onClick={() => switchMode('login')}>
                ← Kembali ke halaman masuk
              </button>
            )}
          </form>

          <p className="auth-footnote">
            {mode === 'register' ? 'Sudah punya akun? ' : 'Belum punya akun? '}
            <button
              type="button"
              className="link-button"
              onClick={() => switchMode(mode === 'register' ? 'login' : 'register')}
            >
              {mode === 'register' ? 'Masuk di sini' : 'Daftar gratis'}
            </button>
          </p>

          <div className="tech-footer">
            <span>
              Backend &amp; database oleh <strong>Supabase</strong>
            </span>
            <span className="dot-sep">•</span>
            <a href={supabaseConfig.githubRepo || 'https://github.com/yovahayuningdyah-bit/funlearn-app'} target="_blank" rel="noreferrer">
              Repositori GitHub ↗
            </a>
          </div>
        </div>
      </section>
    </main>
  )
}
