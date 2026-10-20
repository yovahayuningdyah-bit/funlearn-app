export type SchoolLevel = 'sd' | 'smp' | 'sma'
export type UserRole = 'student' | 'teacher' | 'admin'
export type GameMode = 'arcade_runner' | 'board' | 'survival' | 'bank_belajar'

export interface Profile {
  id: string
  username: string | null
  full_name: string | null
  avatar_emoji: string
  school_level: SchoolLevel
  role: UserRole
  school_name: string | null
  total_points: number
  best_streak: number
  created_at: string
  updated_at: string
}

export interface Question {
  id: string
  level: SchoolLevel
  subject: string
  topic: string | null
  question_text: string
  choices: string[]
  correct_index: number
  explanation: string | null
  fun_fact: string | null
  hint: string | null
  difficulty: number
  is_published: boolean
  is_custom: boolean
  created_by: string | null
  created_at: string
}

export interface Badge {
  code: string
  name: string
  description: string | null
  icon: string
  min_points: number
  min_accuracy: number
}

export interface LeaderboardRow {
  id: string
  display_name: string
  avatar_emoji: string
  school_level: SchoolLevel
  total_points: number
  best_streak: number
  badge_count: number
  position: number
}

export interface GameSession {
  id: string
  user_id: string
  mode: GameMode
  level: SchoolLevel
  score: number
  correct_answers: number
  total_questions: number
  lives_lost: number
  revivals_used: number
  max_streak: number
  duration_seconds: number
  players_count: number
  finished_at: string
}

export const LEVEL_LABEL: Record<SchoolLevel, string> = {
  sd: 'SD',
  smp: 'SMP',
  sma: 'SMA',
}

export const MODE_LABEL: Record<GameMode, string> = {
  arcade_runner: 'Petualangan Ksatria',
  board: 'Jelajah Nusantara',
  survival: 'Survival Kuis Cepat',
  bank_belajar: 'Bank Belajar',
}
