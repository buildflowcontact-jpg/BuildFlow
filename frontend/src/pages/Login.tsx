import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

export default function Login() {
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignUp, setIsSignUp] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authError, setAuthError] = useState('')
  const [signUpSuccess, setSignUpSuccess] = useState(false)
  const navigate = useNavigate()

  // Redirection si déjà connecté
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/')
    }
  }, [authLoading, user, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setAuthError('')

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setSignUpSuccess(true)
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        navigate('/')
      }
    } catch (error: unknown) {
      setAuthError(error instanceof Error ? error.message : 'Une erreur est survenue')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 rounded-[40px] bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:grid-cols-2 sm:p-12">
          <div className="space-y-8">
            <div>
              <p className="inline-flex rounded-full bg-slate-800 px-4 py-1 text-sm uppercase tracking-[0.3em] text-slate-300">
                BuildFlow
              </p>
              <h1 className="mt-6 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                Gestion de projet moderne et collaborative.
              </h1>
              <p className="mt-4 max-w-xl text-slate-300">
                Commencez gratuitement, centralisez vos tâches, documents, budget et communication d'équipe dans une interface agréable.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-slate-900/70 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Temps réel</p>
                <p className="mt-3 text-sm text-slate-300">Synchronisation instantanée des modifications et commentaires.</p>
              </div>
              <div className="rounded-3xl bg-slate-900/70 p-6">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Multi-utilisateur</p>
                <p className="mt-3 text-sm text-slate-300">Admin, chef de projet, membre : chaque rôle a son espace.</p>
              </div>
            </div>
          </div>

          <div className="rounded-[32px] bg-slate-950/95 p-8 shadow-xl shadow-slate-950/40">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold text-white">{isSignUp ? 'Création de compte' : 'Connexion'}</h2>
                <p className="mt-1 text-sm text-slate-400">Accédez à votre application de gestion en quelques secondes.</p>
              </div>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {signUpSuccess ? (
                <div className="rounded-2xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-4 text-sm text-emerald-300">
                  ✓ Vérifie ton email pour confirmer ton compte.
                </div>
              ) : (
                <>
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-slate-200">
                  Adresse email
                </label>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="vous@email.com"
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-slate-200">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-3xl border border-slate-800 bg-slate-900/80 px-4 py-3 text-white outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
                  placeholder="••••••••"
                />
              </div>
              {authError && (
                <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-400">
                  {authError}
                </div>
              )}
              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center rounded-3xl bg-gradient-to-r from-indigo-500 to-sky-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Patiente...' : isSignUp ? 'Créer un compte' : 'Se connecter'}
              </button>
                </>
              )}
            </form>

            <div className="mt-6 flex items-center justify-between text-sm text-slate-400">
              <button type="button" onClick={() => { setIsSignUp(!isSignUp); setAuthError(''); setSignUpSuccess(false) }} className="font-medium text-slate-100 hover:text-white">
                {isSignUp ? 'Déjà un compte ? Connectez-vous' : 'Pas encore de compte ? Inscrivez-vous'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}