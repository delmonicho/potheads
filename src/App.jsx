import { useState, useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import Login from './pages/Login.jsx'
import Board from './pages/Board.jsx'
import PieceDetail from './pages/PieceDetail.jsx'
import Graveyard from './pages/Graveyard.jsx'
import Catalog from './pages/Catalog.jsx'

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Login />
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/board" replace />} />
      <Route path="/board" element={<Board user={user} />} />
      <Route path="/piece/:id" element={<PieceDetail user={user} />} />
      <Route path="/graveyard" element={<Graveyard user={user} />} />
      <Route path="/catalog" element={<Navigate to="/catalog/clay" replace />} />
      <Route path="/catalog/:tab" element={<Catalog user={user} />} />
    </Routes>
  )
}
