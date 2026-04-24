import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Construction,
  HardHat,
  Truck,
  Wrench,
  Plus,
  Trash2,
  X,
  Pencil,
  Image as ImageIcon,
  Users,
} from 'lucide-react'
import {
  loadConstructionPhaseMetrics,
  loadConstructionSiteData,
  createConstructionPhase,
  updateConstructionPhase,
  deleteConstructionPhase,
  createWorkerQualification,
  deleteWorkerQualification,
  createSafetyChecklistItem,
  toggleSafetyChecklistItem,
  deleteSafetyChecklistItem,
  createSupplyOrder,
  updateSupplyOrderStatus,
  deleteSupplyOrder,
  createEquipmentBooking,
  deleteEquipmentBooking,
  createSiteJournalEntry,
  deleteSiteJournalEntry,
  createProjectSubcontractor,
  deleteProjectSubcontractor,
  type ConstructionPhase,
  type ConstructionPhaseMetrics,
  type EquipmentBooking,
  type ProjectSubcontractor,
  type SafetyChecklistItem,
  type SiteIncident,
  type SiteJournalEntry,
  type SupplyOrder,
  type WorkerQualification,
} from '../../lib/constructionSite'
import { syncSiteAlertsNotifications, type SiteAlertNotification } from '../../lib/siteNotifications'

// â”€â”€â”€ Types locaux â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type SiteData = {
  phases: ConstructionPhase[]
  qualifications: WorkerQualification[]
  safetyItems: SafetyChecklistItem[]
  supplies: SupplyOrder[]
  equipmentBookings: EquipmentBooking[]
  journalEntries: SiteJournalEntry[]
  incidents: SiteIncident[]
  subcontractors: ProjectSubcontractor[]
}

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function fmtDate(value: string | null | undefined): string {
  if (!value) return 'Non renseigné'
  return new Date(value).toLocaleDateString('fr-FR')
}

function SectionHeader({ title, onAdd }: { title: string; onAdd: () => void }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <button
        onClick={onAdd}
        className="flex items-center gap-1.5 rounded-xl bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
      >
        <Plus className="h-3.5 w-3.5" /> Ajouter
      </button>
    </div>
  )
}

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] bf-modal-panel overflow-y-auto">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900">{title}</h3>
          <button onClick={onClose} className="bf-button-secondary"><X className="h-4 w-4" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none'
const btnPrimary = 'rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 transition'
const btnSecondary = 'rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition'

function sectionCard(id: string, title: string, subtitle: string, icon: React.ReactNode) {
  return (
    <a href={`#${id}`} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow">
      <div className="mb-2 inline-flex rounded-xl bg-slate-100 p-2 text-slate-700">{icon}</div>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
    </a>
  )
}

// â”€â”€â”€ Modal Phases â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PhaseModal({ projectId, phase, onClose, onSaved }: { projectId: string; phase?: ConstructionPhase | null; onClose: () => void; onSaved: (p: ConstructionPhase) => void }) {
  const [form, setForm] = useState({
    name: phase?.name ?? '',
    start_date: phase?.start_date ?? '',
    end_date: phase?.end_date ?? '',
    progress_percent: phase?.progress_percent ?? 0,
    allocated_budget: phase?.allocated_budget ?? 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Le nom est requis'); return }
    setSaving(true)
    let result: ConstructionPhase | null
    if (phase) {
      result = await updateConstructionPhase(phase.id, {
        name: form.name.trim(),
        start_date: form.start_date || null,
        end_date: form.end_date || null,
        progress_percent: Number(form.progress_percent),
        allocated_budget: Number(form.allocated_budget),
      })
    } else {
      result = await createConstructionPhase(projectId, {
        name: form.name.trim(),
        start_date: form.start_date || undefined,
        end_date: form.end_date || undefined,
        progress_percent: Number(form.progress_percent),
        allocated_budget: Number(form.allocated_budget),
      })
    }
    setSaving(false)
    if (!result) { setError('Erreur lors de la sauvegarde'); return }
    onSaved(result)
    onClose()
  }

  return (
    <ModalWrapper title={phase ? 'Modifier la phase' : 'Nouvelle phase'} onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nom *"><input className={inputCls} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début"><input type="date" className={inputCls} value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} /></Field>
          <Field label="Fin"><input type="date" className={inputCls} value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} /></Field>
        </div>
        <Field label="Avancement (%)"><input type="number" min={0} max={100} className={inputCls} value={form.progress_percent} onChange={e => setForm(f => ({ ...f, progress_percent: Number(e.target.value) }))} /></Field>
        <Field label="Budget alloué (€)"><input type="number" min={0} className={inputCls} value={form.allocated_budget} onChange={e => setForm(f => ({ ...f, allocated_budget: Number(e.target.value) }))} /></Field>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Sauvegarde...' : 'Enregistrer'}</button>
        </div>
      </form>
    </ModalWrapper>
  )
}

// â”€â”€â”€ Modal Qualifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function QualifModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: (q: WorkerQualification) => void }) {
  const [form, setForm] = useState({ worker_name: '', qualification_name: '', expiry_date: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.worker_name.trim() || !form.qualification_name.trim()) { setError('Ouvrier et qualification requis'); return }
    setSaving(true)
    const result = await createWorkerQualification(projectId, {
      worker_name: form.worker_name.trim(),
      qualification_name: form.qualification_name.trim(),
      expiry_date: form.expiry_date || undefined,
    })
    setSaving(false)
    if (!result) { setError('Erreur lors de la création'); return }
    onSaved(result)
    onClose()
  }

  return (
    <ModalWrapper title="Nouvelle qualification" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Nom de l'ouvrier *"><input className={inputCls} value={form.worker_name} onChange={e => setForm(f => ({ ...f, worker_name: e.target.value }))} /></Field>
        <Field label="Qualification *"><input className={inputCls} value={form.qualification_name} onChange={e => setForm(f => ({ ...f, qualification_name: e.target.value }))} /></Field>
        <Field label="Date d'expiration"><input type="date" className={inputCls} value={form.expiry_date} onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))} /></Field>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Ajout...' : 'Ajouter'}</button>
        </div>
      </form>
    </ModalWrapper>
  )
}

// â”€â”€â”€ Modal Supply Orders â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SupplyModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: (s: SupplyOrder) => void }) {
  const [form, setForm] = useState({ material_name: '', quantity_label: '', expected_delivery_date: '', status: 'draft' as SupplyOrder['status'] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.material_name.trim()) { setError('Le matériau est requis'); return }
    setSaving(true)
    const result = await createSupplyOrder(projectId, {
      material_name: form.material_name.trim(),
      quantity_label: form.quantity_label.trim() || undefined,
      expected_delivery_date: form.expected_delivery_date || undefined,
      status: form.status,
    })
    setSaving(false)
    if (!result) { setError('Erreur lors de la création'); return }
    onSaved(result)
    onClose()
  }

  return (
    <ModalWrapper title="Nouvelle commande" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Matériau *"><input className={inputCls} value={form.material_name} onChange={e => setForm(f => ({ ...f, material_name: e.target.value }))} /></Field>
        <Field label="Quantité"><input className={inputCls} value={form.quantity_label} placeholder="ex: 50 m³" onChange={e => setForm(f => ({ ...f, quantity_label: e.target.value }))} /></Field>
        <Field label="Livraison prévue"><input type="date" className={inputCls} value={form.expected_delivery_date} onChange={e => setForm(f => ({ ...f, expected_delivery_date: e.target.value }))} /></Field>
        <Field label="Statut">
          <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as SupplyOrder['status'] }))}>
            <option value="draft">Brouillon</option>
            <option value="ordered">Commandé</option>
            <option value="received">Reçu</option>
          </select>
        </Field>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Ajout...' : 'Ajouter'}</button>
        </div>
      </form>
    </ModalWrapper>
  )
}

// â”€â”€â”€ Modal Equipment Bookings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EquipmentModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: (e: EquipmentBooking) => void }) {
  const [form, setForm] = useState({ equipment_name: '', assigned_to_name: '', booking_start: '', booking_end: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.equipment_name.trim()) { setError('Le nom de l\'engin est requis'); return }
    setSaving(true)
    const result = await createEquipmentBooking(projectId, {
      equipment_name: form.equipment_name.trim(),
      assigned_to_name: form.assigned_to_name.trim() || undefined,
      booking_start: form.booking_start || undefined,
      booking_end: form.booking_end || undefined,
    })
    setSaving(false)
    if (!result) { setError('Erreur lors de la création'); return }
    onSaved(result)
    onClose()
  }

  return (
    <ModalWrapper title="Réservation d'engin" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Engin *"><input className={inputCls} value={form.equipment_name} placeholder="ex: Grue mobile" onChange={e => setForm(f => ({ ...f, equipment_name: e.target.value }))} /></Field>
        <Field label="Assigné à"><input className={inputCls} value={form.assigned_to_name} placeholder="Nom du conducteur" onChange={e => setForm(f => ({ ...f, assigned_to_name: e.target.value }))} /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Début"><input type="date" className={inputCls} value={form.booking_start} onChange={e => setForm(f => ({ ...f, booking_start: e.target.value }))} /></Field>
          <Field label="Fin"><input type="date" className={inputCls} value={form.booking_end} onChange={e => setForm(f => ({ ...f, booking_end: e.target.value }))} /></Field>
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Ajout...' : 'Réserver'}</button>
        </div>
      </form>
    </ModalWrapper>
  )
}

// â”€â”€â”€ Modal Journal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function JournalModal({ projectId, onClose, onSaved }: { projectId: string; onClose: () => void; onSaved: (j: SiteJournalEntry) => void }) {
  const [form, setForm] = useState({ entry_date: new Date().toISOString().split('T')[0], location_label: '', note: '' })
  const [photo, setPhoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.entry_date) { setError('La date est requise'); return }
    setSaving(true)
    const result = await createSiteJournalEntry(projectId, {
      entry_date: form.entry_date,
      location_label: form.location_label.trim() || undefined,
      note: form.note.trim() || undefined,
      photo_file: photo,
    })
    setSaving(false)
    if (!result) { setError('Erreur lors de la création'); return }
    onSaved(result)
    onClose()
  }

  return (
    <ModalWrapper title="Nouvelle entrée journal" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Date *"><input type="date" className={inputCls} value={form.entry_date} onChange={e => setForm(f => ({ ...f, entry_date: e.target.value }))} /></Field>
        <Field label="Lieu"><input className={inputCls} value={form.location_label} placeholder="ex: Zone A - Fondations" onChange={e => setForm(f => ({ ...f, location_label: e.target.value }))} /></Field>
        <Field label="Note">
          <textarea rows={3} className={inputCls} value={form.note} placeholder="Observations, travaux réalisés..." onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
        </Field>
        <Field label="Photo (optionnel)">
          <label className={`flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-600 hover:border-indigo-400 transition ${photo ? 'border-indigo-400 bg-indigo-50' : ''}`}>
            <ImageIcon className="h-4 w-4" />
            {photo ? photo.name : 'Cliquer pour sélectionner'}
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={e => setPhoto(e.target.files?.[0] ?? null)} />
          </label>
          {photo && <button type="button" onClick={() => { setPhoto(null); if (fileRef.current) fileRef.current.value = '' }} className="mt-1 text-xs text-red-500 hover:underline">Supprimer la photo</button>}
        </Field>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
        </div>
      </form>
    </ModalWrapper>
  )
}

// â”€â”€â”€ Modal Safety Item â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SafetyItemModal({ projectId, currentCount, onClose, onSaved }: { projectId: string; currentCount: number; onClose: () => void; onSaved: (i: SafetyChecklistItem) => void }) {
  const [label, setLabel] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim()) { setError('Le libellé est requis'); return }
    setSaving(true)
    const result = await createSafetyChecklistItem(projectId, label.trim(), currentCount + 1)
    setSaving(false)
    if (!result) { setError('Erreur lors de la création'); return }
    onSaved(result)
    onClose()
  }

  return (
    <ModalWrapper title="Nouveau point sécurité" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Libellé *"><input className={inputCls} value={label} placeholder="ex: Vérification EPI" onChange={e => setLabel(e.target.value)} autoFocus /></Field>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Ajout...' : 'Ajouter'}</button>
        </div>
      </form>
    </ModalWrapper>
  )
}

// --- Modal Sous-traitants ---

function SubcontractorModal({
  projectId,
  onClose,
  onSaved,
}: {
  projectId: string
  onClose: () => void
  onSaved: (s: ProjectSubcontractor) => void
}) {
  const [form, setForm] = useState({
    company_name: '',
    trade_label: '',
    contact_name: '',
    contact_phone: '',
    notes: '',
    status: 'active' as ProjectSubcontractor['status'],
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company_name.trim()) { setError('Le nom de la soci\u00e9t\u00e9 est requis'); return }
    setSaving(true)
    const result = await createProjectSubcontractor(projectId, {
      company_name: form.company_name.trim(),
      trade_label: form.trade_label.trim() || undefined,
      contact_name: form.contact_name.trim() || undefined,
      contact_phone: form.contact_phone.trim() || undefined,
      notes: form.notes.trim() || undefined,
      status: form.status,
    })
    setSaving(false)
    if (!result) { setError('Erreur lors de la cr\u00e9ation'); return }
    onSaved(result)
    onClose()
  }

  return (
    <ModalWrapper title="Nouveau sous-traitant" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-3">
        <Field label="Soci\u00e9t\u00e9 *">
          <input className={inputCls} value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} />
        </Field>
        <Field label="Corps de m\u00e9tier">
          <input className={inputCls} value={form.trade_label} placeholder="ex: \u00c9lectricit\u00e9, Plomberie\u2026" onChange={e => setForm(f => ({ ...f, trade_label: e.target.value }))} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Contact">
            <input className={inputCls} value={form.contact_name} placeholder="Nom du contact" onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))} />
          </Field>
          <Field label="T\u00e9l\u00e9phone">
            <input className={inputCls} value={form.contact_phone} placeholder="+33 6\u2026" onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))} />
          </Field>
        </div>
        <Field label="Statut">
          <select className={inputCls} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ProjectSubcontractor['status'] }))}>
            <option value="active">Actif</option>
            <option value="on_hold">En attente</option>
            <option value="inactive">Inactif</option>
          </select>
        </Field>
        <Field label="Notes">
          <textarea rows={2} className={inputCls} value={form.notes} placeholder="Remarques, conditions\u2026" onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
        </Field>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className={btnSecondary}>Annuler</button>
          <button type="submit" disabled={saving} className={btnPrimary}>{saving ? 'Ajout…' : 'Ajouter'}</button>
        </div>
      </form>
    </ModalWrapper>
  )
}


// â”€â”€â”€ Page principale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function ProjectSite() {
  const { id: projectId } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [data, setData] = useState<SiteData>({
    phases: [],
    qualifications: [],
    safetyItems: [],
    supplies: [],
    equipmentBookings: [],
    journalEntries: [],
    incidents: [],
    subcontractors: [],
  })
  const [phaseMetrics, setPhaseMetrics] = useState<Record<string, ConstructionPhaseMetrics>>({})
  const [deleteConfirmKey, setDeleteConfirmKey] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState('')

  // Modals
  const [modal, setModal] = useState<
    'phase' | 'phase-edit' | 'qualif' | 'safety' | 'supply' | 'equipment' | 'journal' | 'subcontractor' | null
  >(null)
  const [editingPhase, setEditingPhase] = useState<ConstructionPhase | null>(null)

  useEffect(() => {
    if (!projectId) return
    let active = true
    const load = async () => {
      setLoading(true)
      setError('')
      try {
        const [siteData, metrics] = await Promise.all([
          loadConstructionSiteData(projectId),
          loadConstructionPhaseMetrics(projectId),
        ])
        if (!active) return
        setData({
          phases: siteData.phases,
          qualifications: siteData.qualifications,
          safetyItems: siteData.safetyItems,
          supplies: siteData.supplies,
          equipmentBookings: siteData.equipmentBookings,
          journalEntries: siteData.journalEntries,
          incidents: siteData.incidents,
          subcontractors: siteData.subcontractors,
        })
        setPhaseMetrics(metrics)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Erreur de chargement du chantier')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => { active = false }
  }, [projectId])

  const alerts = useMemo<SiteAlertNotification[]>(() => {
    const now = new Date().toISOString().slice(0, 10)
    const overdueSupplies = data.supplies.filter((s) => s.status !== 'received' && !!s.expected_delivery_date && s.expected_delivery_date < now)
    const expiredQualifs = data.qualifications.filter((q) => !!q.expiry_date && q.expiry_date < now)
    const soonQualifs = data.qualifications.filter((q) => !!q.expiry_date && q.expiry_date >= now).filter((q) => {
      const exp = new Date(q.expiry_date as string)
      const in30 = new Date()
      in30.setDate(in30.getDate() + 30)
      return exp <= in30
    })
    const pendingSafety = data.safetyItems.filter((i) => !i.done)
    const criticalIncidents = data.incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved' && i.status !== 'closed')
    const phaseOverruns = data.phases.filter((p) => {
      const m = phaseMetrics[p.id]
      const consumed = (m?.committed_expenses_total ?? 0) + (m?.validated_expenses_total ?? 0)
      return Number(p.allocated_budget || 0) > 0 && consumed > Number(p.allocated_budget || 0)
    })
    const list: SiteAlertNotification[] = []
    if (overdueSupplies.length > 0) list.push({ code: 'overdue_supplies', level: 'critical', title: 'Approvisionnements en retard', detail: `${overdueSupplies.length} livraison(s) en retard` })
    if (expiredQualifs.length > 0) list.push({ code: 'expired_qualifications', level: 'critical', title: 'Qualifications expirées', detail: `${expiredQualifs.length} qualification(s) dépassée(s)` })
    if (soonQualifs.length > 0) list.push({ code: 'qualifications_expiring_soon', level: 'warning', title: 'Qualifications à renouveler', detail: `${soonQualifs.length} échéance(s) sous 30 jours` })
    if (pendingSafety.length > 0) list.push({ code: 'safety_checklist_pending', level: 'warning', title: 'Checklist sécurité incomplète', detail: `${pendingSafety.length} point(s) non traité(s)` })
    if (criticalIncidents.length > 0) list.push({ code: 'critical_incidents', level: 'critical', title: 'Incidents critiques ouverts', detail: `${criticalIncidents.length} incident(s) critique(s)` })
    if (phaseOverruns.length > 0) list.push({ code: 'phase_budget_overrun', level: 'warning', title: 'Dépassement budget phase', detail: `${phaseOverruns.length} phase(s) au-dessus du budget` })
    return list
  }, [data, phaseMetrics])

  useEffect(() => {
    if (!projectId || loading) return
    void syncSiteAlertsNotifications(projectId, alerts)
  }, [projectId, loading, alerts])

  useEffect(() => {
    const section = searchParams.get('section')
    if (!section) return
    const el = document.getElementById(section)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [searchParams, loading])

  // â”€â”€â”€ Handlers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const askDeleteConfirmation = (key: string, label: string): boolean => {
    if (deleteConfirmKey !== key) {
      setDeleteConfirmKey(key)
      setPageNotice(`Confirme la suppression de ${label} en cliquant à nouveau.`)
      return false
    }
    return true
  }

  const handleDeletePhase = async (id: string) => {
    if (!askDeleteConfirmation(`phase:${id}`, 'cette phase')) return
    await deleteConstructionPhase(id)
    setData(d => ({ ...d, phases: d.phases.filter(p => p.id !== id) }))
    setDeleteConfirmKey(null)
    setPageNotice('')
  }

  const handleDeleteQualif = async (id: string) => {
    if (!askDeleteConfirmation(`qualif:${id}`, 'cette qualification')) return
    await deleteWorkerQualification(id)
    setData(d => ({ ...d, qualifications: d.qualifications.filter(q => q.id !== id) }))
    setDeleteConfirmKey(null)
    setPageNotice('')
  }

  const handleToggleSafety = async (id: string, done: boolean) => {
    await toggleSafetyChecklistItem(id, done)
    setData(d => ({ ...d, safetyItems: d.safetyItems.map(i => i.id === id ? { ...i, done } : i) }))
  }

  const handleDeleteSafety = async (id: string) => {
    if (!askDeleteConfirmation(`safety:${id}`, 'ce point')) return
    await deleteSafetyChecklistItem(id)
    setData(d => ({ ...d, safetyItems: d.safetyItems.filter(i => i.id !== id) }))
    setDeleteConfirmKey(null)
    setPageNotice('')
  }

  const handleUpdateSupplyStatus = async (id: string, status: SupplyOrder['status']) => {
    await updateSupplyOrderStatus(id, status)
    setData(d => ({ ...d, supplies: d.supplies.map(s => s.id === id ? { ...s, status } : s) }))
  }

  const handleDeleteSupply = async (id: string) => {
    if (!askDeleteConfirmation(`supply:${id}`, 'cette commande')) return
    await deleteSupplyOrder(id)
    setData(d => ({ ...d, supplies: d.supplies.filter(s => s.id !== id) }))
    setDeleteConfirmKey(null)
    setPageNotice('')
  }

  const handleDeleteEquipment = async (id: string) => {
    if (!askDeleteConfirmation(`equipment:${id}`, 'cette réservation')) return
    await deleteEquipmentBooking(id)
    setData(d => ({ ...d, equipmentBookings: d.equipmentBookings.filter(e => e.id !== id) }))
    setDeleteConfirmKey(null)
    setPageNotice('')
  }

  const handleDeleteJournal = async (id: string, photoPath?: string) => {
    if (!askDeleteConfirmation(`journal:${id}`, 'cette entrée')) return
    await deleteSiteJournalEntry(id, photoPath)
    setData(d => ({ ...d, journalEntries: d.journalEntries.filter(j => j.id !== id) }))
    setDeleteConfirmKey(null)
    setPageNotice('')
  }

  const handleDeleteSubcontractor = async (id: string) => {
    if (!askDeleteConfirmation(`subcontractor:${id}`, 'ce sous-traitant')) return
    await deleteProjectSubcontractor(id)
    setData(d => ({ ...d, subcontractors: d.subcontractors.filter(s => s.id !== id) }))
    setDeleteConfirmKey(null)
    setPageNotice('')
  }

  // â”€â”€â”€ Status labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const supplyStatusLabel: Record<SupplyOrder['status'], string> = { draft: 'Brouillon', ordered: 'Commandé', received: 'Reçu' }
  const supplyStatusCls: Record<SupplyOrder['status'], string> = {
    draft: 'bg-slate-100 text-slate-600',
    ordered: 'bg-amber-100 text-amber-700',
    received: 'bg-emerald-100 text-emerald-700',
  }

  if (loading) return (
    <div className="space-y-4">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="bf-panel p-6 animate-pulse">
          <div className="h-4 w-48 bg-slate-200 rounded mb-4" />
          <div className="space-y-2">
            <div className="h-3 w-full bg-slate-100 rounded" />
            <div className="h-3 w-3/4 bg-slate-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
  if (error) return <div className="bf-surface p-8 text-red-600">{error}</div>
  if (!projectId) return null

  return (
    <div className="space-y-6">
      {/* Modals */}
      {(modal === 'phase') && (
        <PhaseModal
          projectId={projectId}
          onClose={() => setModal(null)}
          onSaved={p => setData(d => ({ ...d, phases: [...d.phases, p] }))}
        />
      )}
      {(modal === 'phase-edit' && editingPhase) && (
        <PhaseModal
          projectId={projectId}
          phase={editingPhase}
          onClose={() => { setModal(null); setEditingPhase(null) }}
          onSaved={p => setData(d => ({ ...d, phases: d.phases.map(x => x.id === p.id ? p : x) }))}
        />
      )}
      {modal === 'qualif' && (
        <QualifModal
          projectId={projectId}
          onClose={() => setModal(null)}
          onSaved={q => setData(d => ({ ...d, qualifications: [...d.qualifications, q] }))}
        />
      )}
      {modal === 'safety' && (
        <SafetyItemModal
          projectId={projectId}
          currentCount={data.safetyItems.length}
          onClose={() => setModal(null)}
          onSaved={i => setData(d => ({ ...d, safetyItems: [...d.safetyItems, i] }))}
        />
      )}
      {modal === 'supply' && (
        <SupplyModal
          projectId={projectId}
          onClose={() => setModal(null)}
          onSaved={s => setData(d => ({ ...d, supplies: [...d.supplies, s] }))}
        />
      )}
      {modal === 'equipment' && (
        <EquipmentModal
          projectId={projectId}
          onClose={() => setModal(null)}
          onSaved={e => setData(d => ({ ...d, equipmentBookings: [...d.equipmentBookings, e] }))}
        />
      )}
      {modal === 'journal' && (
        <JournalModal
          projectId={projectId}
          onClose={() => setModal(null)}
          onSaved={j => setData(d => ({ ...d, journalEntries: [j, ...d.journalEntries] }))}
        />
      )}
      {modal === 'subcontractor' && (
        <SubcontractorModal
          projectId={projectId}
          onClose={() => setModal(null)}
          onSaved={s => setData(d => ({ ...d, subcontractors: [...d.subcontractors, s] }))}
        />
      )}

      <div className="bf-page-header">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Chantier</h1>
      </div>

      {pageNotice && (
        <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{pageNotice}</span>
          <button
            type="button"
            onClick={() => { setPageNotice(''); setDeleteConfirmKey(null) }}
            className="rounded-md px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
          >
            Fermer
          </button>
        </div>
      )}

      {alerts.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
          <p className="mb-2 text-sm font-semibold text-amber-800">Alertes chantier</p>
          <div className="space-y-1 text-sm text-amber-700">
            {alerts.map((alert) => (
              <p key={alert.code} className={`flex items-center gap-2 ${alert.level === 'critical' ? 'text-red-700' : ''}`}>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                {alert.title}: {alert.detail}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Nav rapide */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4">
        {sectionCard('phases', 'Phases', `${data.phases.length} phase(s)`, <Construction className="h-4 w-4" />)}
        {sectionCard('qualifications', 'Qualifications', `${data.qualifications.length} enregistrée(s)`, <HardHat className="h-4 w-4" />)}
        {sectionCard('safety', 'Sécurité', `${data.safetyItems.filter(i => !i.done).length} point(s) à traiter`, <ClipboardList className="h-4 w-4" />)}
        {sectionCard('supplies', 'Approvisionnements', `${data.supplies.length} commande(s)`, <Truck className="h-4 w-4" />)}
        {sectionCard('equipment', 'Engins', `${data.equipmentBookings.length} réservation(s)`, <Wrench className="h-4 w-4" />)}
        {sectionCard('subcontractors', 'Sous-traitants', `${data.subcontractors.length} enregistré(s)`, <Users className="h-4 w-4" />)}
        {sectionCard('incidents', 'Incidents', `${data.incidents.length} événement(s)`, <AlertTriangle className="h-4 w-4" />)}
      </div>

      {/* â”€â”€ Phases â”€â”€ */}
      <section id="phases" className="bf-panel p-6">
        <SectionHeader title="Phases chantier" onAdd={() => setModal('phase')} />
        {data.phases.length === 0 && <p className="text-sm text-slate-500">Aucune phase définie.</p>}
        <div className="space-y-3">
          {data.phases.map((phase) => {
            const metrics = phaseMetrics[phase.id]
            const consumed = (metrics?.committed_expenses_total ?? 0) + (metrics?.validated_expenses_total ?? 0)
            const budget = Number(phase.allocated_budget || 0)
            const pct = budget > 0 ? Math.min(Math.round((consumed / budget) * 100), 100) : 0
            const overrun = budget > 0 && consumed > budget
            return (
              <div key={phase.id} className={`rounded-xl border p-4 ${overrun ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900">{phase.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{fmtDate(phase.start_date)} – {fmtDate(phase.end_date)}</p>
                    <p className="mt-1 text-xs text-slate-600">Budget : {budget.toLocaleString('fr-FR')} € · Consommé : <span className={overrun ? 'text-red-600 font-semibold' : ''}>{consumed.toLocaleString('fr-FR')} €</span></p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="h-1.5 flex-1 rounded-full bg-slate-200">
                        <div className={`h-1.5 rounded-full transition-all ${overrun ? 'bg-red-500' : 'bg-indigo-500'}`} style={{ width: `${phase.progress_percent}%` }} />
                      </div>
                      <span className="text-xs text-slate-500 shrink-0">{phase.progress_percent}%</span>
                    </div>
                    {budget > 0 && (
                      <div className="mt-1 flex items-center gap-2">
                        <div className="h-1 flex-1 rounded-full bg-slate-200">
                          <div className={`h-1 rounded-full transition-all ${overrun ? 'bg-red-400' : 'bg-emerald-400'}`} style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 shrink-0">{pct}% budg.</span>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => { setEditingPhase(phase); setModal('phase-edit') }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 transition"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => handleDeletePhase(phase.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* â”€â”€ Qualifications â”€â”€ */}
      <section id="qualifications" className="bf-panel p-6">
        <SectionHeader title="Qualifications" onAdd={() => setModal('qualif')} />
        {data.qualifications.length === 0 && <p className="text-sm text-slate-500">Aucune qualification.</p>}
        <div className="space-y-2">
          {data.qualifications.map((q) => {
            const today = new Date().toISOString().slice(0, 10)
            const expired = q.expiry_date && q.expiry_date < today
            return (
              <div key={q.id} className={`flex items-center justify-between rounded-xl border p-3 ${expired ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <div>
                  <p className="text-sm font-medium text-slate-900">{q.worker_name}</p>
                  <p className="text-xs text-slate-500">{q.qualification_name} · exp. {fmtDate(q.expiry_date)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {expired && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Expirée</span>}
                  <button onClick={() => handleDeleteQualif(q.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* â”€â”€ Sécurité â”€â”€ */}
      <section id="safety" className="bf-panel p-6">
        <SectionHeader title="Checklist sécurité" onAdd={() => setModal('safety')} />
        {data.safetyItems.length === 0 && <p className="text-sm text-slate-500">Aucun point sécurité.</p>}
        <div className="space-y-2">
          {data.safetyItems.map((item) => (
            <div key={item.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
              <input
                type="checkbox"
                checked={item.done}
                onChange={e => handleToggleSafety(item.id, e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
              />
              {item.done
                ? <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                : <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
              }
              <span className={`flex-1 text-sm ${item.done ? 'text-slate-400 line-through' : 'text-slate-700'}`}>{item.label}</span>
              <button onClick={() => handleDeleteSafety(item.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
        {data.safetyItems.length > 0 && (
          <p className="mt-3 text-xs text-slate-500">{data.safetyItems.filter(i => i.done).length} / {data.safetyItems.length} validés</p>
        )}
      </section>

      {/* â”€â”€ Approvisionnements â”€â”€ */}
      <section id="supplies" className="bf-panel p-6">
        <SectionHeader title="Approvisionnements" onAdd={() => setModal('supply')} />
        {data.supplies.length === 0 && <p className="text-sm text-slate-500">Aucune commande.</p>}
        <div className="space-y-2">
          {data.supplies.map((s) => {
            const today = new Date().toISOString().slice(0, 10)
            const overdue = s.status !== 'received' && s.expected_delivery_date && s.expected_delivery_date < today
            return (
              <div key={s.id} className={`flex items-center gap-3 rounded-xl border p-3 ${overdue ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{s.material_name}</p>
                  <p className="text-xs text-slate-500">{s.quantity_label || '–'} · livraison : {fmtDate(s.expected_delivery_date)}</p>
                </div>
                <select
                  value={s.status}
                  onChange={e => handleUpdateSupplyStatus(s.id, e.target.value as SupplyOrder['status'])}
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold border-0 cursor-pointer focus:outline-none ${supplyStatusCls[s.status]}`}
                >
                  <option value="draft">{supplyStatusLabel.draft}</option>
                  <option value="ordered">{supplyStatusLabel.ordered}</option>
                  <option value="received">{supplyStatusLabel.received}</option>
                </select>
                <button onClick={() => handleDeleteSupply(s.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            )
          })}
        </div>
      </section>

      {/* â”€â”€ Engins â”€â”€ */}
      <section id="equipment" className="bf-panel p-6">
        <SectionHeader title="Allocation engins" onAdd={() => setModal('equipment')} />
        {data.equipmentBookings.length === 0 && <p className="text-sm text-slate-500">Aucune réservation.</p>}
        <div className="space-y-2">
          {data.equipmentBookings.map((e) => (
            <div key={e.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3">
              <div>
                <p className="text-sm font-medium text-slate-900">{e.equipment_name}</p>
                <p className="text-xs text-slate-500">{e.assigned_to_name || 'Non assigné'} · {fmtDate(e.booking_start)} – {fmtDate(e.booking_end)}</p>
              </div>
              <button onClick={() => handleDeleteEquipment(e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ Journal â”€â”€ */}
      <section id="journal" className="bf-panel p-6">
        <SectionHeader title="Journal chantier" onAdd={() => setModal('journal')} />
        {data.journalEntries.length === 0 && <p className="text-sm text-slate-500">Aucune entrée journal.</p>}
        <div className="space-y-3">
          {data.journalEntries.map((j) => (
            <div key={j.id} className="rounded-xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500">{fmtDate(j.entry_date)}</span>
                    {j.location_label && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{j.location_label}</span>}
                  </div>
                  {j.note && <p className="mt-1 text-sm text-slate-700">{j.note}</p>}
                  {j.photo_url && (
                    <img src={j.photo_url} alt="Photo chantier" className="mt-2 h-32 w-auto rounded-lg object-cover border border-slate-200" />
                  )}
                </div>
                <button onClick={() => handleDeleteJournal(j.id, j.photo_path)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition shrink-0"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* â”€â”€ Sous-traitants â”€â”€ */}
      <section id="subcontractors" className="bf-panel p-6">
        <SectionHeader title="Sous-traitants" onAdd={() => setModal('subcontractor')} />
        {data.subcontractors.length === 0 && <p className="text-sm text-slate-500">Aucun sous-traitant enregistré.</p>}
        <div className="space-y-2">
          {data.subcontractors.map((s) => {
            const statusCls: Record<ProjectSubcontractor['status'], string> = {
              active: 'bg-emerald-100 text-emerald-700',
              on_hold: 'bg-amber-100 text-amber-700',
              inactive: 'bg-slate-100 text-slate-500',
            }
            const statusLabel: Record<ProjectSubcontractor['status'], string> = {
              active: 'Actif',
              on_hold: 'En attente',
              inactive: 'Inactif',
            }
            return (
              <div key={s.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">{s.company_name}</p>
                  <p className="text-xs text-slate-500">{s.trade_label || '–'}{s.contact_name ? ` · ${s.contact_name}` : ''}{s.contact_phone ? ` · ${s.contact_phone}` : ''}</p>
                  {s.notes && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{s.notes}</p>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[s.status]}`}>{statusLabel[s.status]}</span>
                  <button onClick={() => handleDeleteSubcontractor(s.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* â”€â”€ Incidents â”€â”€ */}
      <section id="incidents" className="bf-panel p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Incidents et réserves</h2>
        {data.incidents.length === 0 && <p className="text-sm text-slate-500">Aucun incident.</p>}
        <div className="space-y-2">
          {data.incidents.map((incident) => {
            const severityCls: Record<string, string> = {
              low: 'bg-slate-100 text-slate-600',
              medium: 'bg-amber-100 text-amber-700',
              high: 'bg-orange-100 text-orange-700',
              critical: 'bg-red-100 text-red-700',
            }
            const statusCls: Record<string, string> = {
              open: 'bg-red-50 text-red-600',
              in_progress: 'bg-amber-50 text-amber-700',
              resolved: 'bg-emerald-50 text-emerald-700',
              closed: 'bg-slate-100 text-slate-500',
            }
            return (
              <div key={incident.id} className="rounded-xl border border-slate-200 p-3">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{incident.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{fmtDate(incident.occurred_on)}</p>
                    {incident.description && <p className="text-xs text-slate-600 mt-1 line-clamp-2">{incident.description}</p>}
                  </div>
                  <div className="flex flex-col gap-1 items-end shrink-0">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${severityCls[incident.severity] ?? ''}`}>{incident.severity}</span>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusCls[incident.status] ?? ''}`}>{incident.status}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}

