import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { Profile, SchoolLevel } from '../types/db'

interface SignUpPayload {
  email: string
  password: string
  fullName: string
  username: string
  schoolLevel: SchoolLevel
  avatarEmoji: string
}

interface AuthContextValue {
  session: Session | null
  profile: Profile | null
  loading: boolean
  profileLoading: boolean
  signIn: (email: string, password: string) => Promise<void>
  signUp: (payload: SignUpPayload) => Promise<{ needsConfirmation: boolean }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

async function loadProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    console.error('[EduQuest] gagal memuat profil:', error.message)
    return null
  }
  return (data as Profile | null) ?? null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    let active = true

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!active) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => {
        if (active) setLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setLoading(false)
    })

    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    const userId = session?.user?.id
    if (!userId) {
      setProfile(null)
      return
    }
    let active = true
    setProfileLoading(true)
    loadProfile(userId)
      .then((nextProfile) => {
        if (active) setProfile(nextProfile)
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })
    return () => {
      active = false
    }
  }, [session?.user?.id])

  const value = useMemo<AuthContextValue>(() => {
    const refreshProfile = async () => {
      const userId = session?.user?.id
      if (!userId) return
      setProfile(await loadProfile(userId))
    }

    return {
      session,
      profile,
      loading,
      profileLoading,
      refreshProfile,

      async signIn(email, password) {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        })
        if (error) throw error
      },

      async signUp({ email, password, fullName, username, schoolLevel, avatarEmoji }) {
        const cleanEmail = email.trim().toLowerCase()
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              username: username.trim() || cleanEmail.split('@')[0],
              school_level: schoolLevel,
              avatar_emoji: avatarEmoji,
            },
          },
        })
        if (error) throw error
        // Jika konfirmasi email dimatikan, Supabase langsung mengembalikan session.
        return { needsConfirmation: !data.session }
      },

      async signOut() {
        const { error } = await supabase.auth.signOut()
        if (error) throw error
        setProfile(null)
      },

      async resetPassword(email) {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
          redirectTo: `${window.location.origin}/login?mode=reset`,
        })
        if (error) throw error
      },
    }
  }, [session, profile, loading, profileLoading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return context
}
