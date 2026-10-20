import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import PracticePage from './pages/PracticePage'

function FullScreenLoader() {
  return (
    <div className="screen-center">
      <div className="loader-orb" />
      <p className="muted">Menyiapkan petualanganmu…</p>
    </div>
  )
}

/** Halaman hanya boleh diakses setelah login. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) return <FullScreenLoader />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <>{children}</>
}

export default function App() {
  const { session, loading } = useAuth()

  return (
    <Routes>
      <Route path="/" element={<Navigate to={session ? '/dashboard' : '/login'} replace />} />
      <Route
        path="/login"
        element={loading ? <FullScreenLoader /> : session ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route
        path="/dashboard"
        element={
          <RequireAuth>
            <DashboardPage />
          </RequireAuth>
        }
      />
      <Route
        path="/latihan"
        element={
          <RequireAuth>
            <PracticePage />
          </RequireAuth>
        }
      />
      <Route
        path="*"
        element={<Navigate to={session ? '/dashboard' : '/login'} replace />}
      />
    </Routes>
  )
}
