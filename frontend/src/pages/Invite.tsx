import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setStatus('error'); setMessage('Lien invalide'); return }

    const handleInvite = async () => {
      // Vérifier la session
      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) {
        // Redirige vers login avec return URL
        navigate(`/login?redirect=/invite/${token}`)
        return
      }
      const userId = sessionData.session.user.id

      // Charger l'invitation
      const { data: invite, error: inviteErr } = await supabase
        .from('project_invitations')
        .select('id, project_id, role, expires_at, used_at')
        .eq('id', token)
        .maybeSingle()

      if (inviteErr || !invite) {
        setStatus('error')
        setMessage('Ce lien d\'invitation est invalide ou a été supprimé.')
        return
      }

      if (invite.used_at) {
        setStatus('error')
        setMessage('Ce lien d\'invitation a déjà été utilisé.')
        return
      }

      if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
        setStatus('error')
        setMessage('Ce lien d\'invitation a expiré.')
        return
      }

      // Vérifier si déjà membre
      const { data: existing } = await supabase
        .from('project_members')
        .select('user_id')
        .eq('project_id', invite.project_id)
        .eq('user_id', userId)
        .maybeSingle()

      if (!existing) {
        // Ajouter comme membre
        const { error: memberErr } = await supabase
          .from('project_members')
          .insert({ project_id: invite.project_id, user_id: userId, role: invite.role })
        if (memberErr) {
          setStatus('error')
          setMessage('Erreur lors de l\'ajout au projet.')
          return
        }
      }

      // Marquer l'invitation comme utilisée
      await supabase
        .from('project_invitations')
        .update({ used_at: new Date().toISOString() })
        .eq('id', token)

      setStatus('ok')
      setMessage('Vous avez rejoint le projet avec succès !')

      setTimeout(() => navigate(`/projects/${invite.project_id}`), 2000)
    }

    handleInvite()
  }, [token, navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-sm rounded-3xl bg-white shadow-2xl p-10 text-center space-y-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl mx-auto">
          {status === 'loading' && <Loader2 className="h-10 w-10 text-indigo-600 animate-spin" />}
          {status === 'ok' && <CheckCircle2 className="h-10 w-10 text-emerald-500" />}
          {status === 'error' && <AlertCircle className="h-10 w-10 text-red-500" />}
        </div>
        <h1 className="text-xl font-bold text-slate-900">
          {status === 'loading' ? 'Vérification en cours…' : status === 'ok' ? 'Bienvenue !' : 'Invitation invalide'}
        </h1>
        <p className="text-sm text-slate-500">{message || 'Traitement de votre invitation…'}</p>
        {status === 'ok' && (
          <p className="text-xs text-slate-400">Redirection vers le projet dans quelques secondes…</p>
        )}
        {status === 'error' && (
          <button
            onClick={() => navigate('/')}
            className="mt-2 rounded-2xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition"
          >
            Retour à l'accueil
          </button>
        )}
      </div>
    </div>
  )
}
