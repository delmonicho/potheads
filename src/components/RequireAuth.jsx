import Login from '../pages/Login.jsx'

// Gate for private routes. Public routes (e.g. /p/:slug) render outside this
// wrapper so anonymous visitors never hit the Login screen. Reproduces the
// pre-portfolio App.jsx behavior: spinner while the session resolves, Login when
// there's no user, otherwise the page.
export default function RequireAuth({ user, loading, children }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-surface">
        <div className="w-8 h-8 border-4 border-amber-800 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }
  if (!user) return <Login />
  return children
}
