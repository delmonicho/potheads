import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  async function handleGoogleSignIn() {
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-surface pt-safe pb-safe px-6">
      <div className="flex flex-col items-center gap-8 w-full max-w-sm">
        {/* Logo / branding */}
        <div className="flex flex-col items-center gap-2">
          <img src="/placeholders/vase.svg" alt="" className="w-20 h-20 opacity-70" />
          <h1 className="font-display italic text-6xl sm:text-7xl text-clay">Potheads.</h1>
          <p className="text-ink-soft text-base text-center tracking-wide">Track your pottery from wheel to kiln</p>
        </div>

        {error && (
          <p className="text-red-600 text-sm text-center">{error}</p>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-surface-raised border border-line rounded-xl px-4 py-3.5 text-ink-soft font-medium shadow-sm active:bg-surface-warm disabled:opacity-50 cursor-pointer hover:bg-surface-warm-hover"
        >
          {/* Google icon */}
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          {loading ? 'Signing in…' : 'Sign in with Google'}
        </button>
      </div>
    </div>
  )
}
