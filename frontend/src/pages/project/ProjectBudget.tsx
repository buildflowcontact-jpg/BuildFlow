import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Trash2, X, Pencil, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { DateInput } from '../../components/DateInput'
import { FileUpload } from '../../components/FileUpload'

type ExpenseStatus = 'Prévu' | 'En cours' | 'Validé'

interface Expense {
  id: string
  category: string
  amount: number
  status: ExpenseStatus
  date: string
  description: string
  phase_id: string | null
}

interface HourlyVendor {
  id: string
  company_name: string
  contact_name: string
  hourly_rate: number
  planned_hours: number
  actual_hours: number
}

interface DepositEntry {
  id: string
  label: string
  amount: number
  date: string
  status: ExpenseStatus
  reference: string
  description: string
}

type ConstructionPhaseOption = {
  id: string
  name: string
  allocated_budget: number
  progress_percent: number
}

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  'Prévu': 'bg-slate-100 text-slate-600',
  'En cours': 'bg-amber-100 text-amber-700',
  'Validé': 'bg-emerald-100 text-emerald-700',
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

const ACOMPTE_PREFIX = '[ACOMPTE] '

function isDepositExpense(e: Expense): boolean {
  return e.category.startsWith(ACOMPTE_PREFIX)
}

function parseDepositDescription(raw: string): { reference: string; description: string } {
  if (!raw) return { reference: '', description: '' }
  const [first, ...rest] = raw.split('\n')
  if (first.startsWith('Ref: ')) {
    return { reference: first.replace('Ref: ', '').trim(), description: rest.join('\n').trim() }
  }
  return { reference: '', description: raw }
}

function extractHourlyFromNotes(notes: string | null): { hourly_rate: number; planned_hours: number; actual_hours: number } {
  if (!notes) return { hourly_rate: 0, planned_hours: 0, actual_hours: 0 }
  try {
    const parsed = JSON.parse(notes)
    return {
      hourly_rate: Number(parsed.hourly_rate ?? 0),
      planned_hours: Number(parsed.planned_hours ?? 0),
      actual_hours: Number(parsed.actual_hours ?? 0),
    }
  } catch {
    return { hourly_rate: 0, planned_hours: 0, actual_hours: 0 }
  }
}

function ExpenseModal({
  onClose,
  onSave,
  initial,
  phases,
}: {
  onClose: () => void
  onSave: (e: Omit<Expense, 'id'>) => void
  initial?: Expense
  phases: ConstructionPhaseOption[]
}) {
  const [form, setForm] = useState({
    category: initial?.category ?? '',
    amount: initial?.amount.toString() ?? '',
    status: (initial?.status ?? 'Prévu') as ExpenseStatus,
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    description: initial?.description ?? '',
    phase_id: initial?.phase_id ?? '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.category.trim() || isNaN(amount) || amount <= 0) return
    onSave({ category: form.category.trim(), amount, status: form.status, date: form.date, description: form.description.trim(), phase_id: form.phase_id || null })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{initial ? 'Modifier la dépense' : 'Nouvelle dépense'}</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Catégorie</label>
            <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" placeholder="ex: Développement" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Montant (€)</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Statut</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ExpenseStatus }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none">
              <option>Prévu</option>
              <option>En cours</option>
              <option>Validé</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date</label>
            <DateInput
              value={form.date}
              onChange={value => setForm(f => ({ ...f, date: value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" placeholder="Optionnelle" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Phase chantier</label>
            <select value={form.phase_id} onChange={e => setForm(f => ({ ...f, phase_id: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none">
              <option value="">Aucune phase</option>
              {phases.map(phase => (
                <option key={phase.id} value={phase.id}>{phase.name}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function HourlyVendorModal({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void
  onSave: (v: Omit<HourlyVendor, 'id'>) => void
  initial?: HourlyVendor
}) {
  const [form, setForm] = useState({
    company_name: initial?.company_name ?? '',
    contact_name: initial?.contact_name ?? '',
    hourly_rate: initial?.hourly_rate?.toString() ?? '',
    planned_hours: initial?.planned_hours?.toString() ?? '',
    actual_hours: initial?.actual_hours?.toString() ?? '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const payload = {
      company_name: form.company_name.trim(),
      contact_name: form.contact_name.trim(),
      hourly_rate: Number(form.hourly_rate || 0),
      planned_hours: Number(form.planned_hours || 0),
      actual_hours: Number(form.actual_hours || 0),
    }
    if (!payload.company_name || payload.hourly_rate < 0 || payload.planned_hours < 0 || payload.actual_hours < 0) return
    onSave(payload)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{initial ? 'Modifier prestataire' : 'Nouveau prestataire horaire'}</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Prestataire</label>
            <input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))} required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Contact</label>
            <input value={form.contact_name} onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Taux/h (€)</label>
              <input type="number" min="0" step="0.01" value={form.hourly_rate} onChange={e => setForm(f => ({ ...f, hourly_rate: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Heures prévues</label>
              <input type="number" min="0" step="0.5" value={form.planned_hours} onChange={e => setForm(f => ({ ...f, planned_hours: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Heures effectuées</label>
              <input type="number" min="0" step="0.5" value={form.actual_hours} onChange={e => setForm(f => ({ ...f, actual_hours: e.target.value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function DepositModal({
  onClose,
  onSave,
  initial,
}: {
  onClose: () => void
  onSave: (d: Omit<DepositEntry, 'id'>) => void
  initial?: DepositEntry
}) {
  const [form, setForm] = useState({
    label: initial?.label ?? '',
    amount: initial?.amount?.toString() ?? '',
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    status: (initial?.status ?? 'Validé') as ExpenseStatus,
    reference: initial?.reference ?? '',
    description: initial?.description ?? '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = Number(form.amount || 0)
    if (!form.label.trim() || amount <= 0) return
    onSave({
      label: form.label.trim(),
      amount,
      date: form.date,
      status: form.status,
      reference: form.reference.trim(),
      description: form.description.trim(),
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">{initial ? 'Modifier acompte' : 'Nouvel acompte'}</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Libellé</label>
            <input value={form.label} onChange={e => setForm(f => ({ ...f, label: e.target.value }))} required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Montant (€)</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date</label>
              <DateInput
                value={form.date}
                onChange={value => setForm(f => ({ ...f, date: value }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Statut</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as ExpenseStatus }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none">
              <option>Prévu</option>
              <option>En cours</option>
              <option>Validé</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Référence</label>
            <input value={form.reference} onChange={e => setForm(f => ({ ...f, reference: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" placeholder="Ex: Virement #AC-2026-04" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</label>
            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Annuler</button>
            <button type="submit" className="flex-1 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function ExpenseAttachmentModal({ expenseId, onClose }: { expenseId: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Pièces jointes de la dépense</h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button>
        </div>
        <FileUpload relatedTable="expenses" relatedId={expenseId} />
      </div>
    </div>
  )
}

export default function ProjectBudget() {
  const { id: projectId } = useParams<{ id: string }>()
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [vendors, setVendors] = useState<HourlyVendor[]>([])
  const [phases, setPhases] = useState<ConstructionPhaseOption[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetInput, setBudgetInput] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<Expense | undefined>(undefined)
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [editVendor, setEditVendor] = useState<HourlyVendor | undefined>(undefined)
  const [showDepositModal, setShowDepositModal] = useState(false)
  const [editDeposit, setEditDeposit] = useState<DepositEntry | undefined>(undefined)
  const [attachmentExpenseId, setAttachmentExpenseId] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId) return
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id
      if (!uid) { setLoading(false); return }
      setUserId(uid)

      const [{ data: expData }, { data: projData }, { data: vendorData }] = await Promise.all([
        supabase.from('expenses').select('id,category,amount,status,date,description,phase_id').eq('project_id', projectId).order('date', { ascending: false }),
        supabase.from('projects').select('budget').eq('id', projectId).maybeSingle(),
        supabase.from('project_subcontractors').select('id, company_name, contact_name, notes').eq('project_id', projectId).order('created_at', { ascending: false }),
      ])
      setExpenses((expData ?? []) as Expense[])
      setTotalBudget(projData?.budget ?? 0)

      const mappedVendors: HourlyVendor[] = (vendorData ?? []).map((row: any) => {
        const parsed = extractHourlyFromNotes(row.notes)
        return {
          id: row.id,
          company_name: row.company_name,
          contact_name: row.contact_name ?? '',
          hourly_rate: parsed.hourly_rate,
          planned_hours: parsed.planned_hours,
          actual_hours: parsed.actual_hours,
        }
      })
      setVendors(mappedVendors.filter((v) => v.hourly_rate > 0 || v.planned_hours > 0 || v.actual_hours > 0))

      const { data: phaseData } = await supabase
        .from('construction_phases')
        .select('id, name, allocated_budget, progress_percent')
        .eq('project_id', projectId)
        .order('start_date', { ascending: true })
      setPhases((phaseData ?? []) as ConstructionPhaseOption[])
      setLoading(false)
    }).catch((err: any) => {
      setLoadError(err?.message ?? 'Erreur de chargement')
      setLoading(false)
    })
  }, [projectId])

  const regularExpenses = useMemo(() => expenses.filter((e) => !isDepositExpense(e)), [expenses])

  const deposits = useMemo<DepositEntry[]>(() =>
    expenses
      .filter(isDepositExpense)
      .map((e) => {
        const parsed = parseDepositDescription(e.description)
        return {
          id: e.id,
          label: e.category.replace(ACOMPTE_PREFIX, ''),
          amount: e.amount,
          date: e.date,
          status: e.status,
          reference: parsed.reference,
          description: parsed.description,
        }
      }),
    [expenses]
  )

  const phaseNameById = Object.fromEntries(phases.map((phase) => [phase.id, phase.name])) as Record<string, string>

  const phaseBudgetRows = useMemo(() => phases.map((phase) => {
    const phaseExpenses = regularExpenses.filter((expense) => expense.phase_id === phase.id)
    const planned = phaseExpenses.filter((expense) => expense.status === 'Prévu').reduce((sum, expense) => sum + expense.amount, 0)
    const committedAmount = phaseExpenses.filter((expense) => expense.status === 'En cours').reduce((sum, expense) => sum + expense.amount, 0)
    const validated = phaseExpenses.filter((expense) => expense.status === 'Validé').reduce((sum, expense) => sum + expense.amount, 0)
    const total = phaseExpenses.reduce((sum, expense) => sum + expense.amount, 0)

    return {
      ...phase,
      planned,
      committedAmount,
      validated,
      total,
      remainingAmount: Number(phase.allocated_budget || 0) - committedAmount - validated,
      expenseCount: phaseExpenses.length,
    }
  }), [regularExpenses, phases])

  const unassignedExpenses = useMemo(() => {
    const rows = regularExpenses.filter((expense) => !expense.phase_id)
    return {
      count: rows.length,
      total: rows.reduce((sum, expense) => sum + expense.amount, 0),
      validated: rows.filter((expense) => expense.status === 'Validé').reduce((sum, expense) => sum + expense.amount, 0),
      committed: rows.filter((expense) => expense.status === 'En cours').reduce((sum, expense) => sum + expense.amount, 0),
      planned: rows.filter((expense) => expense.status === 'Prévu').reduce((sum, expense) => sum + expense.amount, 0),
    }
  }, [regularExpenses])

  const phaseBudgetSummary = useMemo(() => {
    const overruns = phaseBudgetRows.filter((phase) => phase.remainingAmount < 0).length
    const atRisk = phaseBudgetRows.filter((phase) => phase.allocated_budget > 0 && ((phase.committedAmount + phase.validated) / phase.allocated_budget) >= 0.8 && phase.remainingAmount >= 0).length
    const healthy = phaseBudgetRows.length - overruns - atRisk
    return {
      overruns,
      atRisk,
      healthy,
    }
  }, [phaseBudgetRows])

  const spent = regularExpenses.filter(e => e.status === 'Validé').reduce((s, e) => s + e.amount, 0)
  const committed = regularExpenses.filter(e => e.status === 'En cours').reduce((s, e) => s + e.amount, 0)
  const depositsTotal = deposits.filter((d) => d.status === 'Validé').reduce((s, d) => s + d.amount, 0)
  const remaining = totalBudget - spent - committed
  const netCash = depositsTotal - spent - committed
  const vendorPlannedCost = vendors.reduce((s, v) => s + (v.hourly_rate * v.planned_hours), 0)
  const vendorActualCost = vendors.reduce((s, v) => s + (v.hourly_rate * v.actual_hours), 0)

  const saveBudget = async (val: number) => {
    if (!projectId || !userId) return
    await supabase.from('projects').update({ budget: val }).eq('id', projectId).eq('created_by', userId)
    setTotalBudget(val)
  }

  const addExpense = async (values: Omit<Expense, 'id'>) => {
    if (!userId || !projectId) return
    const { data, error } = await supabase.from('expenses')
      .insert({ ...values, created_by: userId, project_id: projectId })
      .select().single()
    if (!error && data) setExpenses(prev => [data as Expense, ...prev])
  }

  const saveVendor = async (values: Omit<HourlyVendor, 'id'>) => {
    if (!projectId || !userId) return
    const payload = {
      company_name: values.company_name,
      contact_name: values.contact_name,
      trade_label: 'Prestation horaire',
      notes: JSON.stringify({
        hourly_rate: values.hourly_rate,
        planned_hours: values.planned_hours,
        actual_hours: values.actual_hours,
      }),
      project_id: projectId,
      created_by: userId,
      status: 'active',
    }

    if (editVendor) {
      const { error } = await supabase.from('project_subcontractors').update(payload).eq('id', editVendor.id)
      if (!error) {
        setVendors((prev) => prev.map((v) => (v.id === editVendor.id ? { ...v, ...values } : v)))
      }
      return
    }

    const { data, error } = await supabase.from('project_subcontractors').insert(payload).select('id').single()
    if (!error && data) {
      setVendors((prev) => [{ id: data.id, ...values }, ...prev])
    }
  }

  const deleteVendor = async (id: string) => {
    await supabase.from('project_subcontractors').delete().eq('id', id)
    setVendors((prev) => prev.filter((v) => v.id !== id))
  }

  const saveDeposit = async (values: Omit<DepositEntry, 'id'>) => {
    if (!userId || !projectId) return
    const payload: Omit<Expense, 'id'> = {
      category: `${ACOMPTE_PREFIX}${values.label}`,
      amount: values.amount,
      status: values.status,
      date: values.date,
      description: [values.reference ? `Ref: ${values.reference}` : '', values.description].filter(Boolean).join('\n'),
      phase_id: null,
    }

    if (editDeposit) {
      await updateExpense(editDeposit.id, payload)
      return
    }

    await addExpense(payload)
  }

  const updateExpense = async (id: string, values: Omit<Expense, 'id'>) => {
    const { error } = await supabase.from('expenses').update(values).eq('id', id)
    if (!error) setExpenses(prev => prev.map(e => e.id === id ? { ...e, ...values } : e))
  }

  const deleteExpense = async (id: string) => {
    await supabase.from('expenses').delete().eq('id', id)
    setExpenses(prev => prev.filter(e => e.id !== id))
  }

  if (loading) return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="bf-surface p-8 animate-pulse">
          <div className="h-5 w-1/3 rounded-lg bg-slate-200 mb-4" />
          <div className="h-3 w-2/3 rounded-lg bg-slate-100 mb-2" />
          <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  )
  if (loadError) return <div className="bf-surface p-8 text-red-600">Erreur : {loadError}</div>
  if (!projectId) return null

  const pct = totalBudget > 0 ? Math.min(100, ((spent + committed) / totalBudget) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bf-page-header">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Espace de travail</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Budget du projet</h1>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {/* Budget total */}
        <div className="bf-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Budget total</p>
          {editingBudget ? (
            <div className="mt-2 flex items-center gap-2">
              <input autoFocus type="number" value={budgetInput} onChange={e => setBudgetInput(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm focus:border-indigo-500 focus:outline-none" />
              <button onClick={() => { saveBudget(parseFloat(budgetInput) || 0); setEditingBudget(false) }}
                className="rounded-xl bg-slate-950 p-1.5 text-white"><Check className="h-4 w-4" /></button>
            </div>
          ) : (
            <button onClick={() => { setBudgetInput(totalBudget.toString()); setEditingBudget(true) }}
              className="mt-2 text-left group">
              <p className="text-2xl font-bold text-slate-900 group-hover:text-indigo-600 transition">{fmt(totalBudget)}</p>
              <p className="text-xs text-slate-400 mt-0.5">Cliquer pour modifier</p>
            </button>
          )}
        </div>
        <div className="bf-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Dépensé</p>
          <p className="mt-2 text-2xl font-bold text-emerald-600">{fmt(spent)}</p>
        </div>
        <div className="bf-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Engagé</p>
          <p className="mt-2 text-2xl font-bold text-amber-600">{fmt(committed)}</p>
        </div>
        <div className="bf-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Restant</p>
          <p className={`mt-2 text-2xl font-bold ${remaining < 0 ? 'text-red-600' : 'text-slate-900'}`}>{fmt(remaining)}</p>
        </div>
        <div className="bf-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Acomptes reçus</p>
          <p className="mt-2 text-2xl font-bold text-indigo-600">{fmt(depositsTotal)}</p>
        </div>
        <div className="bf-surface p-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Trésorerie nette</p>
          <p className={`mt-2 text-2xl font-bold ${netCash < 0 ? 'text-red-600' : 'text-emerald-600'}`}>{fmt(netCash)}</p>
        </div>
      </div>

      {/* Prestataires horaires */}
      <div className="bf-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">Prestataires payés à l'heure ({vendors.length})</h2>
          <button onClick={() => { setEditVendor(undefined); setShowVendorModal(true) }} className="bf-button-primary">
            <Plus className="h-4 w-4" />Ajouter
          </button>
        </div>
        {vendors.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Aucun prestataire horaire.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100 text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-3 font-semibold">Prestataire</th>
                  <th className="px-4 py-3 font-semibold">Taux horaire</th>
                  <th className="px-4 py-3 font-semibold">Heures prévues</th>
                  <th className="px-4 py-3 font-semibold">Heures effectuées</th>
                  <th className="px-4 py-3 font-semibold">Coût prévu</th>
                  <th className="px-4 py-3 font-semibold">Coût réel</th>
                  <th className="px-4 py-3 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {vendors.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{v.company_name}</p>
                      {v.contact_name && <p className="mt-1 text-xs text-slate-400">{v.contact_name}</p>}
                    </td>
                    <td className="px-4 py-4 text-slate-900">{fmt(v.hourly_rate)}</td>
                    <td className="px-4 py-4 text-slate-700">{v.planned_hours} h</td>
                    <td className="px-4 py-4 text-slate-700">{v.actual_hours} h</td>
                    <td className="px-4 py-4 text-slate-900">{fmt(v.hourly_rate * v.planned_hours)}</td>
                    <td className="px-4 py-4 text-slate-900">{fmt(v.hourly_rate * v.actual_hours)}</td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1">
                        <button onClick={() => { setEditVendor(v); setShowVendorModal(true) }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                        <button onClick={() => deleteVendor(v.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 text-sm">
                <tr>
                  <td className="px-6 py-3 font-semibold text-slate-700" colSpan={4}>Total</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{fmt(vendorPlannedCost)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{fmt(vendorActualCost)}</td>
                  <td className="px-4 py-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Acomptes */}
      <div className="bf-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">Acomptes ({deposits.length})</h2>
          <button onClick={() => { setEditDeposit(undefined); setShowDepositModal(true) }} className="bf-button-primary">
            <Plus className="h-4 w-4" />Ajouter
          </button>
        </div>
        {deposits.length === 0 ? (
          <div className="p-12 text-center text-slate-400">Aucun acompte enregistré.</div>
        ) : (
          <div className="divide-y divide-slate-50">
            {deposits.map((d) => (
              <div key={d.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{d.label}</p>
                  {(d.reference || d.description) && <p className="text-xs text-slate-400 truncate">{d.reference}{d.reference && d.description ? ' - ' : ''}{d.description}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[d.status]}`}>{d.status}</span>
                <p className="text-sm font-semibold text-indigo-700 w-24 text-right">{fmt(d.amount)}</p>
                <p className="text-xs text-slate-400 w-20 text-right">{new Date(d.date).toLocaleDateString('fr-FR')}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => { setEditDeposit(d); setShowDepositModal(true) }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteExpense(d.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Barre de progression */}
      {totalBudget > 0 && (
        <div className="bf-surface px-8 py-5">
          <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
            <span>Utilisation du budget</span>
            <span className="font-semibold">{pct.toFixed(0)} %</span>
          </div>
          <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden">
            <div className={`h-full rounded-full transition-all ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {(phaseBudgetRows.length > 0 || unassignedExpenses.count > 0) && (
        <div className="bf-panel overflow-hidden">
          <div className="border-b border-slate-100 px-6 py-5">
            <h2 className="text-base font-semibold text-slate-900">Budget par phase chantier</h2>
            <p className="mt-1 text-sm text-slate-500">Detail des montants alloues, engages et valides par phase chantier.</p>
            {phaseBudgetRows.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="rounded-full bg-emerald-100 px-3 py-1 font-semibold text-emerald-700">Saines {phaseBudgetSummary.healthy}</span>
                <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-700">A risque {phaseBudgetSummary.atRisk}</span>
                <span className="rounded-full bg-red-100 px-3 py-1 font-semibold text-red-700">En depassement {phaseBudgetSummary.overruns}</span>
              </div>
            )}
          </div>

          {phaseBudgetRows.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100 text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-6 py-3 font-semibold">Phase</th>
                    <th className="px-4 py-3 font-semibold">Conso</th>
                    <th className="px-4 py-3 font-semibold">Avancement</th>
                    <th className="px-4 py-3 font-semibold">Alloue</th>
                    <th className="px-4 py-3 font-semibold">Prevu</th>
                    <th className="px-4 py-3 font-semibold">Engage</th>
                    <th className="px-4 py-3 font-semibold">Valide</th>
                    <th className="px-4 py-3 font-semibold">Total impute</th>
                    <th className="px-4 py-3 font-semibold">Ecart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {phaseBudgetRows.map((phase) => (
                    <tr key={phase.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-slate-900">{phase.name}</p>
                        <p className="mt-1 text-xs text-slate-400">{phase.expenseCount} depense(s) affectee(s)</p>
                      </td>
                      <td className="px-4 py-4">
                        {(() => {
                          const usage = phase.allocated_budget > 0
                            ? ((phase.committedAmount + phase.validated) / phase.allocated_budget) * 100
                            : 0
                          const barClass = usage > 100 ? 'bg-red-500' : usage >= 80 ? 'bg-amber-500' : 'bg-emerald-500'
                          return (
                            <div className="w-28">
                              <p className="text-xs font-medium text-slate-600">{usage.toFixed(0)}%</p>
                              <div className="mt-1 h-2 rounded-full bg-slate-100">
                                <div className={`h-full rounded-full ${barClass}`} style={{ width: `${Math.min(100, usage)}%` }} />
                              </div>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-4 py-4">
                        <div className="w-28">
                          <div className="flex items-center justify-between text-xs text-slate-500">
                            <span>{phase.progress_percent}%</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-slate-100">
                            <div className="h-full rounded-full bg-indigo-500" style={{ width: `${phase.progress_percent}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 font-medium text-slate-900">{fmt(Number(phase.allocated_budget || 0))}</td>
                      <td className="px-4 py-4 text-slate-600">{fmt(phase.planned)}</td>
                      <td className="px-4 py-4 text-amber-700">{fmt(phase.committedAmount)}</td>
                      <td className="px-4 py-4 text-emerald-700">{fmt(phase.validated)}</td>
                      <td className="px-4 py-4 text-slate-900">{fmt(phase.total)}</td>
                      <td className="px-4 py-4">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${phase.remainingAmount < 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {fmt(phase.remainingAmount)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {unassignedExpenses.count > 0 && (
            <div className="border-t border-slate-100 bg-slate-50/70 px-6 py-5">
              <div className="flex flex-wrap items-center gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Depenses non affectees</p>
                  <p className="mt-1 text-xs text-slate-500">{unassignedExpenses.count} depense(s) sans phase chantier</p>
                </div>
                <div className="ml-auto flex flex-wrap gap-3 text-xs">
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-slate-600">Prevu {fmt(unassignedExpenses.planned)}</span>
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-amber-700">Engage {fmt(unassignedExpenses.committed)}</span>
                  <span className="rounded-full bg-white px-3 py-1 font-medium text-emerald-700">Valide {fmt(unassignedExpenses.validated)}</span>
                  <span className="rounded-full bg-white px-3 py-1 font-semibold text-slate-900">Total {fmt(unassignedExpenses.total)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Liste des dépenses */}
      <div className="bf-panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h2 className="text-base font-semibold text-slate-900">Dépenses ({regularExpenses.length})</h2>
          <button onClick={() => { setEditTarget(undefined); setShowModal(true) }}
            className="bf-button-primary">
            <Plus className="h-4 w-4" />Ajouter
          </button>
        </div>
        {regularExpenses.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-slate-400">Aucune dépense enregistrée pour ce projet.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {regularExpenses.map(e => (
              <div key={e.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{e.category}</p>
                  {e.description && <p className="text-xs text-slate-400 truncate">{e.description}</p>}
                  {e.phase_id && phaseNameById[e.phase_id] && <p className="mt-1 text-[11px] font-medium text-indigo-600">{phaseNameById[e.phase_id]}</p>}
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_COLORS[e.status]}`}>{e.status}</span>
                <p className="text-sm font-semibold text-slate-900 w-24 text-right">{fmt(e.amount)}</p>
                <p className="text-xs text-slate-400 w-20 text-right">{new Date(e.date).toLocaleDateString('fr-FR')}</p>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                  <button onClick={() => setAttachmentExpenseId(e.id)} className="rounded-lg px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 hover:text-slate-800">Pièces</button>
                  <button onClick={() => { setEditTarget(e); setShowModal(true) }} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => deleteExpense(e.id)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <ExpenseModal
          initial={editTarget}
          phases={phases}
          onClose={() => setShowModal(false)}
          onSave={vals => editTarget ? updateExpense(editTarget.id, vals) : addExpense(vals)}
        />
      )}

      {showVendorModal && (
        <HourlyVendorModal
          initial={editVendor}
          onClose={() => setShowVendorModal(false)}
          onSave={saveVendor}
        />
      )}

      {showDepositModal && (
        <DepositModal
          initial={editDeposit}
          onClose={() => setShowDepositModal(false)}
          onSave={saveDeposit}
        />
      )}

      {attachmentExpenseId && (
        <ExpenseAttachmentModal
          expenseId={attachmentExpenseId}
          onClose={() => setAttachmentExpenseId(null)}
        />
      )}
    </div>
  )
}

