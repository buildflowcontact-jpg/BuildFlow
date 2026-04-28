import React, { useState, useEffect } from 'react'
import { Check, User, Lock, Palette } from 'lucide-react'
import { supabase } from '../lib/supabase'

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-sky-500', 'bg-emerald-500', 'bg-violet-500',
  'bg-pink-500', 'bg-amber-500', 'bg-rose-500', 'bg-teal-500',
  'bg-orange-500', 'bg-cyan-500',
]

export default function Profile() {
  const [userId, setUserId] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState('bg-indigo-500')
  const [loading, setLoading] = useState(true)

  // Password change
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [savingProfile, setSavingProfile] = useState(false)
  const [savedProfile, setSavedProfile] = useState(false)
  const [profileError, setProfileError] = useState('')

  const [savingPassword, setSavingPassword] = useState(false)
  const [savedPassword, setSavedPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user
      if (!user) return
      setUserId(user.id)
      setEmail(user.email ?? '')
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('name, color')
        .eq('id', user.id)
        .maybeSingle()
      setName(profile?.name ?? (user.user_metadata as any)?.name ?? '')
      setColor(profile?.color ?? 'bg-indigo-500')
      setLoading(false)
    })
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSavingProfile(true)
    setProfileError('')
    const { error } = await supabase
      .from('user_profiles')
      .update({ name: name.trim(), color })
      .eq('id', userId)
    // Also update auth metadata for AppShell display
    await supabase.auth.updateUser({ data: { name: name.trim() } })
    setSavingProfile(false)
    if (error) { setProfileError(error.message); return }
    setSavedProfile(true)
    setTimeout(() => setSavedProfile(false), 2500)
  }

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError('')
    if (newPassword.length < 6) { setPasswordError('Le mot de passe doit contenir au moins 6 caractères'); return }
    if (newPassword !== confirmPassword) { setPasswordError('Les mots de passe ne correspondent pas'); return }
    setSavingPassword(true)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) { setPasswordError(error.message); return }
    setSavedPassword(true)
    setNewPassword('')
    setConfirmPassword('')
    setTimeout(() => setSavedPassword(false), 2500)
  }

  const initials = name.trim()
    ? name.trim().split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : email.charAt(0).toUpperCase()

  if (loading) return (
    <div className="space-y-6">
      {[...Array(2)].map((_, i) => (
        <div key={i} className="bf-panel p-8 animate-pulse">
          <div className="h-5 w-1/4 rounded-lg bg-slate-200 mb-4" />
          <div className="h-10 rounded-xl bg-slate-100 mb-3" />
        </div>
      ))}
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="bf-page-header">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Compte</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Mon profil</h1>
      </div>

      {/* Avatar preview */}
      <div className="bf-panel p-8 flex items-center gap-6">
        <div className={`h-20 w-20 rounded-3xl ${color} flex items-center justify-center text-white text-2xl font-bold shadow-lg flex-shrink-0`}>
          {initials}
        </div>
        <div>
          <p className="text-lg font-semibold text-slate-900">{name || 'Votre nom'}</p>
          <p className="text-sm text-slate-500">{email}</p>
        </div>
      </div>

      {/* Informations */}
      <div className="bf-panel overflow-hidden">
        <div className="border-b border-slate-100 px-8 py-5 flex items-center gap-2">
          <User className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Informations personnelles</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-5 p-8">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Nom complet</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Votre nom"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Adresse e-mail</label>
            <input
              value={email}
              readOnly
              className="w-full rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-500 cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-slate-400">L'e-mail ne peut pas être modifié ici.</p>
          </div>

          {/* Couleur d'avatar */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-2 flex items-center gap-1.5">
              <Palette className="h-3.5 w-3.5" /> Couleur d'avatar
            </label>
            <div className="flex flex-wrap gap-2">
              {AVATAR_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-8 w-8 rounded-xl ${c} transition ring-2 ring-offset-2 ${color === c ? 'ring-slate-900' : 'ring-transparent'}`}
                />
              ))}
            </div>
          </div>

          {profileError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{profileError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingProfile}
              className="flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {savedProfile ? <><Check className="h-4 w-4" /> Enregistré</> : savingProfile ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>

      {/* Mot de passe */}
      <div className="bf-panel overflow-hidden">
        <div className="border-b border-slate-100 px-8 py-5 flex items-center gap-2">
          <Lock className="h-4 w-4 text-slate-400" />
          <h2 className="text-base font-semibold text-slate-900">Changer le mot de passe</h2>
        </div>
        <form onSubmit={handleSavePassword} className="space-y-5 p-8">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Nouveau mot de passe</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Au moins 6 caractères"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Confirmer le mot de passe</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          {passwordError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600">{passwordError}</p>}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingPassword || !newPassword}
              className="flex items-center gap-2 rounded-2xl bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition"
            >
              {savedPassword ? <><Check className="h-4 w-4" /> Modifié</> : savingPassword ? 'Enregistrement...' : 'Modifier le mot de passe'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
