import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

type AuthUser = {
  id: string
  email?: string
  name?: string
  role?: string
}

type AuthContextValue = {
  user: AuthUser | null
  loading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function mapUser(userData: any): AuthUser {
  return {
    id: userData.id,
    email: userData.email || undefined,
    name: (userData.user_metadata as Record<string, string>)?.name || userData.email || 'Utilisateur',
    role: ((userData.user_metadata as Record<string, string>)?.role) || 'Chef de projet',
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function loadSession() {
      const { data } = await supabase.auth.getSession()
      if (cancelled) return
      const userData = data.session?.user
      setUser(userData ? mapUser(userData) : null)
      setLoading(false)
    }

    loadSession()

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const userData = session?.user
      setUser(userData ? mapUser(userData) : null)
      setLoading(false)
    })

    return () => {
      cancelled = true
      listener.subscription?.unsubscribe()
    }
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }), [user, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
