import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, X, Pencil, Check, ChevronRight, ChevronDown, GitBranch } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { DateInput } from '../components/DateInput'
import {
  loadExpensesDb,
  createExpenseDb,
  updateExpenseDb,
  deleteExpenseDb,
  loadBudgetTotalDb,
  saveBudgetTotalDb,
  type DbExpense,
} from '../lib/db'

type ExpenseStatus = 'Prévu' | 'En cours' | 'Validé'
type ExpenseNode = DbExpense & { children: ExpenseNode[] }

// â”€â”€â”€ Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function buildTree(expenses: DbExpense[]): ExpenseNode[] {
  const map = new Map<string, ExpenseNode>(expenses.map((e) => [e.id, { ...e, children: [] }]))
  const roots: ExpenseNode[] = []
  map.forEach((node) => {
    if (node.parent_id) {
      const parent = map.get(node.parent_id)
      if (parent) parent.children.push(node)
      else roots.push(node)
    } else {
      roots.push(node)
    }
  })
  const sortNode = (n: ExpenseNode) => {
    n.children.sort((a, b) => b.date.localeCompare(a.date))
    n.children.forEach(sortNode)
  }
  roots.sort((a, b) => b.date.localeCompare(a.date))
  roots.forEach(sortNode)
  return roots
}

function nodeTotal(node: ExpenseNode): number {
  return node.amount + node.children.reduce((s, c) => s + nodeTotal(c), 0)
}

function collectDescendantIds(expenses: DbExpense[], id: string): string[] {
  const children = expenses.filter((e) => e.parent_id === id)
  return [id, ...children.flatMap((c) => collectDescendantIds(expenses, c.id))]
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

const STATUS_COLORS: Record<ExpenseStatus, string> = {
  'Prévu': 'bg-slate-100 text-slate-600',
  'En cours': 'bg-amber-100 text-amber-700',
  'Validé': 'bg-emerald-100 text-emerald-700',
}

const DEPTH_BORDERS = [
  'border-l-indigo-500',
  'border-l-sky-400',
  'border-l-violet-400',
  'border-l-emerald-400',
  'border-l-amber-400',
]



// â”€â”€â”€ Modale dépense â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface ExpenseModalProps {
  onClose: () => void
  onSave: (e: Omit<DbExpense, 'id'>) => void
  initial?: DbExpense
  parentId?: string | null
  allExpenses: DbExpense[]
}

function ExpenseModal({ onClose, onSave, initial, parentId, allExpenses }: ExpenseModalProps) {
  const [form, setForm] = useState({
    category: initial?.category ?? '',
    amount: initial?.amount.toString() ?? '',
    status: (initial?.status ?? 'Prévu') as ExpenseStatus,
    date: initial?.date ?? new Date().toISOString().slice(0, 10),
    description: initial?.description ?? '',
    parent_id: (initial?.parent_id ?? parentId ?? null) as string | null,
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const amount = parseFloat(form.amount)
    if (!form.category.trim() || isNaN(amount) || amount < 0) return
    onSave({
      category: form.category.trim(),
      amount,
      status: form.status,
      date: form.date,
      description: form.description.trim(),
      parent_id: form.parent_id ?? null,
    })
    onClose()
  }

  const parentName = form.parent_id ? allExpenses.find((e) => e.id === form.parent_id)?.category : null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            {initial ? 'Modifier la ligne' : 'Nouvelle ligne budgétaire'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        {parentName && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-indigo-50 px-3 py-2 text-xs text-indigo-700">
            <GitBranch className="h-3.5 w-3.5 flex-shrink-0" />
            Sous-ligne de :&nbsp;<span className="font-semibold">{parentName}</span>
          </div>
        )}
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Nom / Catégorie
            </label>
            <input
              autoFocus
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              placeholder="ex: Développement frontend"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
              Montant (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Statut</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as ExpenseStatus }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option>Prévu</option>
                <option>En cours</option>
                <option>Validé</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Date</label>
              <DateInput
                value={form.date}
                onChange={(v) => setForm((f) => ({ ...f, date: v }))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none"
              placeholder="Optionnel"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">
              Annuler
            </button>
            <button type="submit" className="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">
              Enregistrer
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// â”€â”€â”€ Modale budget total â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function BudgetEditModal({ current, onClose, onSave }: { current: number; onClose: () => void; onSave: (n: number) => void }) {
  const [value, setValue] = useState(current.toString())
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const n = parseFloat(value)
    if (isNaN(n) || n <= 0) return
    onSave(n)
    onClose()
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl max-h-[90vh] bf-modal-panel overflow-y-auto rounded-3xl bg-white p-8 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">Budget total</h2>
          <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 transition"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">Montant (€)</label>
            <input type="number" min="0" step="1" value={value} onChange={e => setValue(e.target.value)} required autoFocus className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none" />
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition">Annuler</button>
            <button type="submit" className="flex-1 rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 transition">Enregistrer</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// â”€â”€â”€ Ligne budgétaire récursive â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

interface BudgetLineRowProps {
  node: ExpenseNode
  depth: number
  totalBudget: number
  deleteConfirm: string | null
  onEdit: (e: DbExpense) => void
  onDelete: (id: string) => void
  onAddChild: (parentId: string) => void
}

function BudgetLineRow({ node, depth, totalBudget, deleteConfirm, onEdit, onDelete, onAddChild }: BudgetLineRowProps) {
  const [expanded, setExpanded] = useState(true)
  const total = nodeTotal(node)
  const hasChildren = node.children.length > 0
  const pct = totalBudget > 0 ? Math.min(100, (total / totalBudget) * 100) : 0
  const borderClass = DEPTH_BORDERS[Math.min(depth, DEPTH_BORDERS.length - 1)]

  return (
    <div>
      <div className={`group border-l-2 ${borderClass} rounded-r-2xl`} style={{ marginLeft: `${depth * 28}px` }}>
        <div className="flex items-center gap-3 rounded-r-2xl border border-l-0 border-slate-200 px-4 py-3 hover:border-slate-300 hover:shadow-sm transition bg-white">
          <button
            type="button"
            onClick={() => hasChildren && setExpanded((v) => !v)}
            className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded text-slate-400 transition ${
              hasChildren ? 'hover:bg-slate-100 hover:text-slate-700 cursor-pointer' : 'cursor-default'
            }`}
          >
            {hasChildren ? (
              expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-slate-300 block" />
            )}
          </button>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-slate-900">{node.category}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[node.status]}`}>
                {node.status}
              </span>
              {hasChildren && (
                <span className="text-[10px] text-slate-400">
                  {node.children.length} sous-ligne{node.children.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
            {node.description && (
              <p className="mt-0.5 text-xs text-slate-500 truncate max-w-xs">{node.description}</p>
            )}
            <p className="mt-0.5 text-[10px] text-slate-400">
              {new Date(node.date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            {pct > 0 && (
              <div className="mt-2 h-1 w-36 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all ${
                    pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-600 to-sky-500'
                  }`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            )}
          </div>

          <div className="text-right flex-shrink-0">
            {hasChildren && node.amount > 0 && (
              <p className="text-[10px] text-slate-400 line-through">{fmt(node.amount)}</p>
            )}
            <p className="text-sm font-semibold text-slate-900">{hasChildren ? fmt(total) : fmt(node.amount)}</p>
            {hasChildren && <p className="text-[10px] text-slate-400">total</p>}
          </div>

          <div className="hidden group-hover:flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() => onAddChild(node.id)}
              title="Ajouter une sous-ligne"
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onEdit(node)}
              title="Modifier"
              className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => onDelete(node.id)}
              title={deleteConfirm === node.id ? 'Confirmer la suppression' : 'Supprimer'}
              className={`h-7 w-7 flex items-center justify-center rounded-lg transition ${
                deleteConfirm === node.id ? 'bg-red-100 text-red-600' : 'text-slate-400 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              {deleteConfirm === node.id ? <Check className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
      </div>

      {expanded &&
        node.children.map((child) => (
          <BudgetLineRow
            key={child.id}
            node={child}
            depth={depth + 1}
            totalBudget={totalBudget}
            deleteConfirm={deleteConfirm}
            onEdit={onEdit}
            onDelete={onDelete}
            onAddChild={onAddChild}
          />
        ))}
    </div>
  )
}

// â”€â”€â”€ Page principale â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function Budget() {
  const [expenses, setExpenses] = useState<DbExpense[]>([])
  const [totalBudget, setTotalBudget] = useState(0)
  const { user, loading: authLoading } = useAuth()
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [addChildParentId, setAddChildParentId] = useState<string | null>(null)
  const [editExpense, setEditExpense] = useState<DbExpense | null>(null)
  const [showBudgetEdit, setShowBudgetEdit] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (authLoading) return
    if (!user) { setLoading(false); return }
    Promise.all([loadExpensesDb(user.id), loadBudgetTotalDb(user.id)]).then(([dbExpenses, dbTotal]) => {
      setExpenses(dbExpenses)
      setTotalBudget(dbTotal)
      setLoading(false)
    })
  }, [user?.id, authLoading])

  const tree = buildTree(expenses)
  const rootTotal = tree.reduce((s, n) => s + nodeTotal(n), 0)
  const remaining = totalBudget - rootTotal
  const spentPct = Math.min(100, totalBudget > 0 ? (rootTotal / totalBudget) * 100 : 0)

  function handleAdd(data: Omit<DbExpense, 'id'>) {
    if (!user) return
    const tempId = `temp-${Date.now()}`
    setExpenses((prev) => [{ id: tempId, ...data }, ...prev])
    createExpenseDb(data, user.id).then((created) => {
      if (created) setExpenses((prev) => prev.map((e) => (e.id === tempId ? created : e)))
      else setExpenses((prev) => prev.filter((e) => e.id !== tempId))
    })
  }

  function handleUpdate(data: Omit<DbExpense, 'id'>) {
    if (!editExpense) return
    setExpenses((prev) => prev.map((e) => (e.id === editExpense.id ? { ...e, ...data } : e)))
    updateExpenseDb(editExpense.id, data)
  }

  function handleDelete(id: string) {
    if (deleteConfirm === id) {
      const toDelete = collectDescendantIds(expenses, id)
      setExpenses((prev) => prev.filter((e) => !toDelete.includes(e.id)))
      setDeleteConfirm(null)
      if (deleteTimer.current) clearTimeout(deleteTimer.current)
      toDelete.forEach((d) => deleteExpenseDb(d))
    } else {
      setDeleteConfirm(id)
      deleteTimer.current = setTimeout(() => setDeleteConfirm(null), 3000)
    }
  }

  function openAddChild(parentId: string) {
    setAddChildParentId(parentId)
    setShowModal(true)
  }

  function saveBudget(n: number) {
    setTotalBudget(n)
    if (user) saveBudgetTotalDb(user.id, n)
  }

  if (loading) return (
    <div className="space-y-6">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="rounded-3xl bg-white p-8 shadow-lg animate-pulse">
          <div className="h-5 w-1/3 rounded-lg bg-slate-200 mb-4" />
          <div className="h-3 w-2/3 rounded-lg bg-slate-100 mb-2" />
          <div className="h-3 w-1/2 rounded-lg bg-slate-100" />
        </div>
      ))}
    </div>
  )

  return (
    <>
      {(showModal || editExpense) && (
        <ExpenseModal
          initial={editExpense ?? undefined}
          parentId={editExpense ? undefined : addChildParentId}
          allExpenses={expenses}
          onClose={() => { setShowModal(false); setEditExpense(null); setAddChildParentId(null) }}
          onSave={editExpense ? handleUpdate : handleAdd}
        />
      )}
      {showBudgetEdit && (
        <BudgetEditModal current={totalBudget} onClose={() => setShowBudgetEdit(false)} onSave={saveBudget} />
      )}

      <div className="space-y-8">
        <section className="rounded-3xl bg-white p-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Gestion budgétaire</p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">Budget & dépenses</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Organise tes budgets en hiérarchie — crée des sous-lignes imbriquées à l'infini.
              </p>
            </div>
            <button
              onClick={() => { setAddChildParentId(null); setShowModal(true) }}
              className="flex items-center gap-2 rounded-3xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Plus className="h-4 w-4" /> Nouvelle ligne
            </button>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            <div className="group relative rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Budget total</p>
              <p className="mt-4 text-3xl font-semibold text-slate-900">{fmt(totalBudget)}</p>
              <p className="mt-2 text-sm text-slate-500">Alloué pour tous les projets actifs.</p>
              <button
                onClick={() => setShowBudgetEdit(true)}
                title="Modifier"
                className="absolute right-4 top-4 hidden group-hover:flex items-center justify-center h-7 w-7 rounded-xl text-slate-400 hover:bg-indigo-50 hover:text-indigo-600 transition"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Dépensé</p>
              <p
                className={`mt-4 text-3xl font-semibold ${
                  spentPct > 90 ? 'text-red-600' : spentPct > 70 ? 'text-amber-600' : 'text-slate-900'
                }`}
              >
                {fmt(rootTotal)}
              </p>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
                <div
                  className={`h-full rounded-full transition-all ${
                    spentPct > 90 ? 'bg-red-500' : spentPct > 70 ? 'bg-amber-500' : 'bg-gradient-to-r from-indigo-600 to-sky-500'
                  }`}
                  style={{ width: `${spentPct}%` }}
                />
              </div>
              <p className="mt-1.5 text-xs text-slate-400">{spentPct.toFixed(0)}% du budget</p>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6">
              <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Reste</p>
              <p className={`mt-4 text-3xl font-semibold ${remaining < 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {fmt(remaining)}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {remaining < 0 ? 'Budget dépassé !' : 'Budget restant disponible.'}
              </p>
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-white p-8 shadow-lg">
          <div className="flex items-center justify-between gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Lignes budgétaires</h2>
              <p className="mt-1 text-xs text-slate-400">
                {expenses.length} ligne{expenses.length > 1 ? 's' : ''} · hover sur une ligne pour ajouter une sous-ligne
              </p>
            </div>
            <span className="rounded-3xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
              {fmt(rootTotal)}
            </span>
          </div>

          {tree.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="rounded-2xl bg-slate-100 p-4 mb-4">
                <GitBranch className="h-6 w-6 text-slate-400" />
              </div>
              <p className="font-semibold text-slate-700">Aucune ligne budgétaire</p>
              <p className="mt-1 text-sm text-slate-500">
                Crée ta première ligne, puis imbrique des sous-lignes pour organiser ton budget.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tree.map((node) => (
                <BudgetLineRow
                  key={node.id}
                  node={node}
                  depth={0}
                  totalBudget={totalBudget}
                  deleteConfirm={deleteConfirm}
                  onEdit={(e) => setEditExpense(e)}
                  onDelete={handleDelete}
                  onAddChild={openAddChild}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  )
}
