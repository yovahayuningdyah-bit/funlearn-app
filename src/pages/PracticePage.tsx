import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { LEVEL_LABEL, type Question, type SchoolLevel } from '../types/db'

const QUESTIONS_PER_ROUND = 8

interface AnswerLog {
  question_id: string
  chosen_index: number
  is_correct: boolean
  points_awarded: number
}

type Phase = 'pick' | 'playing' | 'saving' | 'done'

function shuffle<T>(items: T[]): T[] {
  const copy = [...items]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

export default function PracticePage() {
  const { profile, session, refreshProfile } = useAuth()
  const [phase, setPhase] = useState<Phase>('pick')
  const [level, setLevel] = useState<SchoolLevel>(profile?.school_level ?? 'sd')
  const [questions, setQuestions] = useState<Question[]>([])
  const [index, setIndex] = useState(0)
  const [selected, setSelected] = useState<number | null>(null)
  const [answers, setAnswers] = useState<AnswerLog[]>([])
  const [streak, setStreak] = useState(0)
  const [maxStreak, setMaxStreak] = useState(0)
  const [score, setScore] = useState(0)
  const [error, setError] = useState('')
  const [loadingQuestions, setLoadingQuestions] = useState(false)
  const startedAt = useRef<number>(Date.now())

  const current = questions[index]
  const isAnswered = selected !== null
  const correctCount = answers.filter((a) => a.is_correct).length

  const startRound = useCallback(
    async (chosenLevel: SchoolLevel) => {
      setError('')
      setLoadingQuestions(true)
      setLevel(chosenLevel)
      try {
        const { data, error: fetchError } = await supabase
          .from('questions')
          .select('*')
          .eq('level', chosenLevel)
          .eq('is_published', true)
          .limit(40)

        if (fetchError) throw fetchError

        const pool = (data as Question[] | null) ?? []
        if (pool.length === 0) {
          setError('Belum ada soal untuk jenjang ini. Tambahkan soal lewat Supabase atau menu Ruang Guru.')
          return
        }

        setQuestions(shuffle(pool).slice(0, QUESTIONS_PER_ROUND))
        setIndex(0)
        setSelected(null)
        setAnswers([])
        setStreak(0)
        setMaxStreak(0)
        setScore(0)
        startedAt.current = Date.now()
        setPhase('playing')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Gagal memuat soal.')
      } finally {
        setLoadingQuestions(false)
      }
    },
    [],
  )

  async function finishRound(finalScore: number, finalMaxStreak: number, log: AnswerLog[]) {
    if (!session?.user?.id) return
    setPhase('saving')
    setError('')
    try {
      const durationSeconds = Math.max(1, Math.round((Date.now() - startedAt.current) / 1000))
      const { data: created, error: sessionError } = await supabase
        .from('game_sessions')
        .insert({
          user_id: session.user.id,
          mode: 'survival',
          level,
          score: finalScore,
          correct_answers: log.filter((a) => a.is_correct).length,
          total_questions: log.length,
          lives_lost: 0,
          revivals_used: 0,
          max_streak: finalMaxStreak,
          duration_seconds: durationSeconds,
          players_count: 1,
        })
        .select('id')
        .single()

      if (sessionError) throw sessionError

      const sessionId = (created as { id: string }).id

      if (log.length > 0) {
        const { error: answersError } = await supabase.from('session_answers').insert(
          log.map((entry) => ({
            session_id: sessionId,
            user_id: session.user.id,
            question_id: entry.question_id,
            level,
            chosen_index: entry.chosen_index,
            is_correct: entry.is_correct,
            points_awarded: entry.points_awarded,
            is_revival_gate: false,
          })),
        )
        if (answersError) throw answersError
      }

      const nextPoints = (profile?.total_points ?? 0) + finalScore
      const nextStreak = Math.max(profile?.best_streak ?? 0, finalMaxStreak)
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ total_points: nextPoints, best_streak: nextStreak })
        .eq('id', session.user.id)
      if (profileError) throw profileError

      await refreshProfile()
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan hasil permainan.')
      setPhase('done')
    }
  }

  function handleAnswer(optionIndex: number) {
    if (!current || isAnswered) return
    const isCorrect = optionIndex === current.correct_index
    const basePoints = 100
    const difficultyBonus = (current.difficulty - 1) * 25
    const streakBonus = isCorrect ? Math.min(streak, 5) * 20 : 0
    const points = isCorrect ? basePoints + difficultyBonus + streakBonus : 0

    const nextStreak = isCorrect ? streak + 1 : 0
    const nextScore = score + points
    const log = [
      ...answers,
      {
        question_id: current.id,
        chosen_index: optionIndex,
        is_correct: isCorrect,
        points_awarded: points,
      },
    ]

    setSelected(optionIndex)
    setScore(nextScore)
    setStreak(nextStreak)
    setMaxStreak((prev) => Math.max(prev, nextStreak))
    setAnswers(log)
  }

  function handleNext() {
    if (!isAnswered) return
    if (index + 1 < questions.length) {
      setIndex((prev) => prev + 1)
      setSelected(null)
      return
    }
    void finishRound(score, maxStreak, answers)
  }

  // Muat soal otomatis bila pengguna sudah memilih jenjang dan menekan mulai.
  useEffect(() => {
    if (phase === 'playing' && questions.length === 0) {
      void startRound(level)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="app-shell">
      <div className="aurora aurora-a" />
      <div className="aurora aurora-b" />

      <header className="app-header">
        <Link to="/dashboard" className="brand-row compact">
          <span className="brand-mark">🎮</span>
          <div>
            <p className="brand-name">EduQuest</p>
            <p className="brand-sub">Latihan Cepat</p>
          </div>
        </Link>
        <div className="header-user">
          <Link to="/dashboard" className="ghost-button small">
            ← Beranda
          </Link>
          <span className="avatar-big">{profile?.avatar_emoji ?? '🦊'}</span>
        </div>
      </header>

      <main className="app-main narrow">
        {phase === 'pick' && (
          <section className="panel quiz-pick">
            <p className="eyebrow">Latihan Cepat</p>
            <h1>Pilih jenjang soalmu</h1>
            <p className="muted">
              Soal diambil langsung dari tabel <code>questions</code> di Supabase. Setiap jawaban
              benar memberi poin, dan hasil sesi otomatis tersimpan ke database.
            </p>
            <div className="level-grid wide">
              {(['sd', 'smp', 'sma'] as SchoolLevel[]).map((option) => (
                <button
                  key={option}
                  type="button"
                  className="level-card"
                  onClick={() => void startRound(option)}
                  disabled={loadingQuestions}
                >
                  <strong>Tingkat {LEVEL_LABEL[option]}</strong>
                  <small>
                    {option === 'sd'
                      ? 'Full Revive • materi dasar'
                      : option === 'smp'
                        ? 'Shield + 150 poin • menengah'
                        : '2x skor • level SNBT'}
                  </small>
                </button>
              ))}
            </div>
            {loadingQuestions && <p className="muted small">Memuat soal…</p>}
            {error && (
              <div className="alert alert-error" role="alert">
                <span>⚠️</span>
                <p>{error}</p>
              </div>
            )}
          </section>
        )}

        {phase === 'playing' && current && (
          <section className="panel quiz-panel">
            <div className="quiz-topbar">
              <span className="pill">
                Soal {index + 1}/{questions.length}
              </span>
              <span className="pill">Tingkat {LEVEL_LABEL[level]}</span>
              <span className="pill hot">🔥 Streak {streak}</span>
              <span className="pill">{score.toLocaleString('id-ID')} poin</span>
            </div>

            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${((index + (isAnswered ? 1 : 0)) / questions.length) * 100}%` }}
              />
            </div>

            <p className="muted small quiz-subject">
              {current.subject}
              {current.topic ? ` • ${current.topic}` : ''}
            </p>
            <h2 className="quiz-question">{current.question_text}</h2>

            <div className="option-list">
              {current.choices.map((choice, optionIndex) => {
                let state = ''
                if (isAnswered) {
                  if (optionIndex === current.correct_index) state = 'correct'
                  else if (optionIndex === selected) state = 'wrong'
                  else state = 'dim'
                }
                return (
                  <button
                    key={`${current.id}-${optionIndex}`}
                    type="button"
                    className={`option ${state}`}
                    onClick={() => handleAnswer(optionIndex)}
                    disabled={isAnswered}
                  >
                    <span className="option-letter">{String.fromCharCode(65 + optionIndex)}</span>
                    <span>{choice}</span>
                    {isAnswered && optionIndex === current.correct_index && <span>✓</span>}
                    {isAnswered && optionIndex === selected && optionIndex !== current.correct_index && (
                      <span>✕</span>
                    )}
                  </button>
                )
              })}
            </div>

            {isAnswered && (
              <div className={`feedback ${selected === current.correct_index ? 'ok' : 'bad'}`}>
                <strong>
                  {selected === current.correct_index ? 'Benar! +' : 'Belum tepat. '}
                  {selected === current.correct_index &&
                    `${answers[answers.length - 1]?.points_awarded ?? 0} poin`}
                </strong>
                {current.explanation && <p>{current.explanation}</p>}
                {current.fun_fact && (
                  <p className="fun-fact">
                    <span>💡 Fakta unik:</span> {current.fun_fact}
                  </p>
                )}
              </div>
            )}

            <button
              type="button"
              className="primary-button"
              onClick={handleNext}
              disabled={!isAnswered}
            >
              {index + 1 < questions.length ? 'Soal berikutnya →' : 'Lihat hasil'}
            </button>

            {error && (
              <div className="alert alert-error" role="alert">
                <span>⚠️</span>
                <p>{error}</p>
              </div>
            )}
          </section>
        )}

        {phase === 'saving' && (
          <section className="panel screen-center">
            <div className="loader-orb" />
            <p className="muted">Menyimpan hasil ke Supabase…</p>
          </section>
        )}

        {phase === 'done' && (
          <section className="panel result-panel">
            <p className="eyebrow">Sesi selesai</p>
            <h1>
              {correctCount === answers.length && answers.length > 0
                ? 'Sempurna! 🏆'
                : correctCount >= answers.length / 2
                  ? 'Kerja bagus! 🎉'
                  : 'Terus berlatih! 💪'}
            </h1>
            <div className="result-grid">
              <div>
                <strong>{score.toLocaleString('id-ID')}</strong>
                <span>Poin diperoleh</span>
              </div>
              <div>
                <strong>
                  {correctCount}/{answers.length}
                </strong>
                <span>Jawaban benar</span>
              </div>
              <div>
                <strong>{maxStreak}</strong>
                <span>Streak terbaik</span>
              </div>
            </div>
            {error && (
              <div className="alert alert-error" role="alert">
                <span>⚠️</span>
                <p>{error}</p>
              </div>
            )}
            <div className="hero-actions">
              <button type="button" className="primary-button inline" onClick={() => setPhase('pick')}>
                Main lagi
              </button>
              <Link to="/dashboard" className="ghost-button inline">
                Kembali ke beranda
              </Link>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
