import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const anonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? ''

/**
 * Konfigurasi Supabase.
 * Frontend HANYA boleh memakai anon / publishable key.
 * service_role / secret key tidak boleh pernah dikirim ke browser.
 */
export const supabaseConfig = {
  url,
  projectRef: (import.meta.env.VITE_SUPABASE_PROJECT_REF as string | undefined)?.trim() ?? '',
  githubRepo: (import.meta.env.VITE_GITHUB_REPO as string | undefined)?.trim() ?? '',
  isConfigured:
    url.startsWith('https://') &&
    !url.includes('PROJECT_REF') &&
    anonKey.length > 20 &&
    !anonKey.includes('ISI_'),
}

// Klien tetap dibuat walau env belum diisi supaya aplikasi tidak crash;
// halaman login akan menampilkan peringatan konfigurasi.
export const supabase: SupabaseClient = createClient(
  supabaseConfig.isConfigured ? url : 'https://placeholder.supabase.co',
  supabaseConfig.isConfigured ? anonKey : 'public-anon-key-placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      storageKey: 'eduquest-auth',
    },
  },
)

/** Ambil pesan error yang ramah untuk ditampilkan ke pengguna. */
export function describeAuthError(message: string): string {
  const map: Record<string, string> = {
    'Invalid login credentials': 'Email atau kata sandi salah. Periksa kembali ya.',
    'Email not confirmed': 'Email belum dikonfirmasi. Cek kotak masuk kamu.',
    'User already registered': 'Email ini sudah terdaftar. Silakan masuk.',
    'Password should be at least 6 characters':
      'Kata sandi minimal 6 karakter.',
    'Unable to validate email address: invalid format':
      'Format email tidak valid.',
    'Email rate limit exceeded':
      'Terlalu banyak percobaan email. Tunggu beberapa menit lalu coba lagi.',
    'Failed to fetch':
      'Tidak dapat menghubungi server Supabase. Periksa koneksi internet atau konfigurasi .env.',
  }
  for (const [key, value] of Object.entries(map)) {
    if (message.toLowerCase().includes(key.toLowerCase())) return value
  }
  return message
}
