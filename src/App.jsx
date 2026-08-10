import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import Board from './pages/Board.jsx'
import PieceDetail from './pages/PieceDetail.jsx'
import Graveyard from './pages/Graveyard.jsx'
import Catalog from './pages/Catalog.jsx'
import Calendar from './pages/Calendar.jsx'
import Dev from './pages/Dev.jsx'
import PortfolioCurate from './pages/PortfolioCurate.jsx'
import PublicPortfolio from './pages/PublicPortfolio.jsx'
import RequireAuth from './components/RequireAuth.jsx'
import { isDevOwner } from './lib/diagnostics.js'

export default function App() {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Private routes are wrapped in RequireAuth (spinner → Login → page). The
  // public portfolio route is intentionally OUTSIDE the gate so anonymous
  // visitors can open /p/:slug without a session.
  const gated = (el) => <RequireAuth user={user} loading={loading}>{el}</RequireAuth>

  return (
    <Routes>
      {/* Public, no-auth */}
      <Route path="/p/:slug" element={<PublicPortfolio />} />

      {/* Private */}
      <Route path="/" element={gated(<Navigate to="/board" replace />)} />
      <Route path="/board" element={gated(<Board user={user} />)} />
      <Route path="/piece/:id" element={gated(<PieceDetail user={user} />)} />
      <Route path="/graveyard" element={gated(<Graveyard user={user} />)} />
      <Route path="/calendar" element={gated(<Calendar user={user} />)} />
      <Route path="/catalog" element={gated(<Navigate to="/catalog/clay" replace />)} />
      <Route path="/catalog/:tab" element={gated(<Catalog user={user} />)} />
      <Route path="/portfolio" element={gated(<PortfolioCurate user={user} />)} />
      <Route
        path="/dev"
        element={gated(isDevOwner(user?.email) ? <Dev user={user} /> : <Navigate to="/board" replace />)}
      />
    </Routes>
  )
}
