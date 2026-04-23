import { useEffect, useMemo, useState } from 'react'
import BaselineComparison from '../components/BaselineComparison'
import TeamCapacityBoard from '../components/TeamCapacityBoard'
import RiskRegisterModal from '../components/RiskRegisterModal'
import DocumentVersionControl from '../components/DocumentVersionControl'
import SLADashboard from '../components/SLADashboard'
import PortfolioOverview from '../components/PortfolioOverview'
import MilestoneTracker from '../components/MilestoneTracker'
import AutomationRuleBuilder from '../components/AutomationRuleBuilder'
import DecisionJournal from '../components/DecisionJournal'
import CriticalPathChart from '../components/CriticalPathChart'
import RiskMatrix from '../components/RiskMatrix'
import DocumentApprovalFlow from '../components/DocumentApprovalFlow'
import MilestoneGantt from '../components/MilestoneGantt'
import {
  createConstructionPhase,
  createEquipmentBooking,
  createProjectSubcontractor,
  createSafetyChecklistItem,
  createSiteIncident,
  createSiteJournalEntry,
  createSiteZone,
  createSupplyOrder,
  createWorkerQualification,
  deleteConstructionPhase,
  deleteEquipmentBooking,
  deleteProjectSubcontractor,
  deleteSafetyChecklistItem,
  deleteSiteIncident,
  deleteSiteJournalEntry,
  deleteSiteZone,
  deleteSupplyOrder,
  deleteWorkerQualification,
  ensureDefaultSafetyChecklist,
  loadConstructionPhaseMetrics,
  loadConstructionSiteData,
  toggleSafetyChecklistItem,
  updateSupplyOrderStatus,
  type ConstructionPhase,
  type ConstructionPhaseMetrics,
  type EquipmentBooking,
  type ProjectSubcontractor,
  type SafetyChecklistItem,
  type SiteIncident,
  type SiteJournalEntry,
  type SiteZone,
  type SupplyOrder,
  type WorkerQualification,
} from '../lib/constructionSite'

type TabType =
  | 'planning'
  | 'capacity'
  | 'risk'
  | 'documents'
  | 'automation'
  | 'portfolio'
  | 'phases'
  | 'phase-budget'
  | 'zones'
  | 'subcontractors'
  | 'qualifications'
  | 'safety'
  | 'supplies'
  | 'equipment'
  | 'journal'
  | 'incidents'
  | 'daily-report'

const tabs: Array<{ id: TabType; label: string }> = [
  { id: 'planning', label: 'Planning avance' },
  { id: 'capacity', label: 'Capacite equipe' },
  { id: 'risk', label: 'Registre risques' },
  { id: 'documents', label: 'Cycle documentaire' },
  { id: 'automation', label: 'Automatisation' },
  { id: 'portfolio', label: 'Vue portefeuille' },
  { id: 'phases', label: 'Phases chantier' },
  { id: 'phase-budget', label: 'Budget par phase' },
  { id: 'zones', label: 'Zones et lots' },
  { id: 'subcontractors', label: 'Sous-traitants' },
  { id: 'qualifications', label: 'Qualifications' },
  { id: 'safety', label: 'Checklist securite' },
  { id: 'supplies', label: 'Approvisionnements' },
  { id: 'equipment', label: 'Allocation engins' },
  { id: 'journal', label: 'Journal photo chantier' },
  { id: 'incidents', label: 'Incidents et reserves' },
  { id: 'daily-report', label: 'Rapport journalier' },
]

const todayIso = new Date().toISOString().slice(0, 10)

function EmptyState({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>
}

function DangerButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50">
      Supprimer
    </button>
  )
}

function formatDateLabel(value: string | null | undefined) {
  return value || 'Non renseignee'
}

function fmt(n: number) {
  return n.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 })
}

function isDateWithinRange(date: string, start?: string | null, end?: string | null) {
  if (start && date < start) return false
  if (end && date > end) return false
  return true
}

function getIncidentSeverityLabel(severity: SiteIncident['severity']) {
  switch (severity) {
    case 'low':
      return 'Faible'
    case 'medium':
      return 'Moyenne'
    case 'high':
      return 'Haute'
    case 'critical':
      return 'Critique'
    default:
      return severity
  }
}

function getIncidentTypeLabel(type: SiteIncident['incident_type']) {
  switch (type) {
    case 'incident':
      return 'Incident'
    case 'non_conformity':
      return 'Non-conformite'
    case 'observation':
      return 'Observation'
    default:
      return type
  }
}

function getIncidentStatusLabel(status: SiteIncident['status']) {
  switch (status) {
    case 'open':
      return 'Ouvert'
    case 'in_progress':
      return 'En cours'
    case 'resolved':
      return 'Resolue'
    case 'closed':
      return 'Cloturee'
    default:
      return status
  }
}

export default function Features() {
  const [activeProject, setActiveProject] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('planning')
  const [weekStart] = useState(new Date())
  const [loadingProjectData, setLoadingProjectData] = useState(false)
  const [feedback, setFeedback] = useState('')

  const [zones, setZones] = useState<SiteZone[]>([])
  const [subcontractors, setSubcontractors] = useState<ProjectSubcontractor[]>([])
  const [phases, setPhases] = useState<ConstructionPhase[]>([])
  const [qualifications, setQualifications] = useState<WorkerQualification[]>([])
  const [safety, setSafety] = useState<SafetyChecklistItem[]>([])
  const [supplies, setSupplies] = useState<SupplyOrder[]>([])
  const [equipment, setEquipment] = useState<EquipmentBooking[]>([])
  const [photos, setPhotos] = useState<SiteJournalEntry[]>([])
  const [incidents, setIncidents] = useState<SiteIncident[]>([])
  const [phaseMetrics, setPhaseMetrics] = useState<Record<string, ConstructionPhaseMetrics>>({})

  const [phaseForm, setPhaseForm] = useState({
    name: '',
    zone_id: '',
    subcontractor_id: '',
    start: '',
    end: '',
    progress: '0',
    allocated: '0',
    spent: '0',
  })
  const [zoneForm, setZoneForm] = useState({ kind: 'zone' as SiteZone['kind'], code: '', name: '', description: '', parent_zone_id: '' })
  const [subcontractorForm, setSubcontractorForm] = useState({
    company_name: '',
    trade_label: '',
    contact_name: '',
    contact_phone: '',
    status: 'active' as ProjectSubcontractor['status'],
    notes: '',
  })
  const [qualificationForm, setQualificationForm] = useState({ worker: '', qualification: '', expiry: '', subcontractor_id: '' })
  const [safetyLabel, setSafetyLabel] = useState('')
  const [supplyForm, setSupplyForm] = useState<{
    material: string
    quantity: string
    eta: string
    status: SupplyOrder['status']
    zone_id: string
    subcontractor_id: string
  }>({
    material: '',
    quantity: '',
    eta: '',
    status: 'draft',
    zone_id: '',
    subcontractor_id: '',
  })
  const [equipmentForm, setEquipmentForm] = useState({ equipment: '', from: '', to: '', assignee: '', zone_id: '', subcontractor_id: '' })
  const [photoForm, setPhotoForm] = useState({ date: '', place: '', note: '', zone_id: '', subcontractor_id: '' })
  const [incidentForm, setIncidentForm] = useState({
    zone_id: '',
    subcontractor_id: '',
    linked_phase_id: '',
    incident_type: 'incident' as SiteIncident['incident_type'],
    severity: 'medium' as SiteIncident['severity'],
    status: 'open' as SiteIncident['status'],
    occurred_on: todayIso,
    title: '',
    description: '',
    corrective_action: '',
    owner_name: '',
    due_date: '',
  })
  const [reportDate, setReportDate] = useState(todayIso)
  const [photoFile, setPhotoFile] = useState<File | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!activeProject.trim()) {
      setZones([])
      setSubcontractors([])
      setPhases([])
      setQualifications([])
      setSafety([])
      setSupplies([])
      setEquipment([])
      setPhotos([])
      setIncidents([])
      setPhaseMetrics({})
      return () => {
        cancelled = true
      }
    }

    const load = async () => {
      try {
        setLoadingProjectData(true)
        setFeedback('')
        const projectId = activeProject.trim()
        const [data, metrics] = await Promise.all([
          loadConstructionSiteData(projectId),
          loadConstructionPhaseMetrics(projectId),
        ])
        const safetyItems = data.safetyItems.length > 0 ? data.safetyItems : await ensureDefaultSafetyChecklist(projectId)
        if (cancelled) return
        setZones(data.zones)
        setSubcontractors(data.subcontractors)
        setPhases(data.phases)
        setQualifications(data.qualifications)
        setSafety(safetyItems)
        setSupplies(data.supplies)
        setEquipment(data.equipmentBookings)
        setPhotos(data.journalEntries)
        setIncidents(data.incidents)
        setPhaseMetrics(metrics)
      } catch (error) {
        if (!cancelled) setFeedback(error instanceof Error ? error.message : 'Erreur de chargement')
      } finally {
        if (!cancelled) setLoadingProjectData(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [activeProject])

  const phaseStats = useMemo(() => {
    const progressTotal = phases.reduce((acc, phase) => acc + phase.progress_percent, 0)
    const allocatedTotal = phases.reduce((acc, phase) => acc + Number(phase.allocated_budget || 0), 0)
    const spentTotal = phases.reduce((acc, phase) => acc + Number(phase.spent_budget || 0), 0)
    return {
      count: phases.length,
      avgProgress: phases.length ? Math.round(progressTotal / phases.length) : 0,
      allocatedTotal,
      spentTotal,
      remaining: allocatedTotal - spentTotal,
    }
  }, [phases])

  const zoneById = useMemo(() => Object.fromEntries(zones.map((zone) => [zone.id, zone])), [zones])
  const subcontractorById = useMemo(() => Object.fromEntries(subcontractors.map((item) => [item.id, item])), [subcontractors])
  const phaseById = useMemo(() => Object.fromEntries(phases.map((phase) => [phase.id, phase])), [phases])
  const parentZoneOptions = useMemo(() => zones.filter((zone) => zone.kind === 'zone'), [zones])
  const activePhasesForReport = useMemo(
    () => phases.filter((phase) => isDateWithinRange(reportDate, phase.start_date, phase.end_date)),
    [phases, reportDate],
  )

  const reportData = useMemo(() => {
    const dailyJournal = photos.filter((entry) => entry.entry_date === reportDate)
    const dailyIncidents = incidents.filter((incident) => incident.occurred_on === reportDate)
    const overdueIncidents = incidents.filter(
      (incident) =>
        incident.status !== 'resolved' &&
        incident.status !== 'closed' &&
        !!incident.due_date &&
        incident.due_date < reportDate,
    )
    const dueSupplies = supplies.filter(
      (item) => item.status !== 'received' && !!item.expected_delivery_date && item.expected_delivery_date <= reportDate,
    )
    const activeEquipment = equipment.filter((item) => isDateWithinRange(reportDate, item.booking_start, item.booking_end))
    const expiringQualifications = qualifications.filter((item) => !!item.expiry_date && item.expiry_date <= reportDate)
    const pendingSafety = safety.filter((item) => !item.done)
    const criticalIncidents = incidents.filter(
      (incident) => incident.severity === 'critical' && incident.status !== 'resolved' && incident.status !== 'closed',
    )

    return {
      dailyJournal,
      dailyIncidents,
      overdueIncidents,
      dueSupplies,
      activeEquipment,
      expiringQualifications,
      pendingSafety,
      criticalIncidents,
    }
  }, [equipment, incidents, photos, qualifications, reportDate, safety, supplies])

  const requireProject = () => {
    const projectId = activeProject.trim()
    if (!projectId) {
      setFeedback('Renseigne un ID de projet pour utiliser ces modules.')
      return null
    }
    return projectId
  }

  const handleCreatePhase = async () => {
    const projectId = requireProject()
    if (!projectId || !phaseForm.name.trim()) return
    const created = await createConstructionPhase(projectId, {
      name: phaseForm.name.trim(),
      zone_id: phaseForm.zone_id || undefined,
      subcontractor_id: phaseForm.subcontractor_id || undefined,
      start_date: phaseForm.start,
      end_date: phaseForm.end,
      progress_percent: Math.max(0, Math.min(100, Number(phaseForm.progress) || 0)),
      allocated_budget: Number(phaseForm.allocated) || 0,
      spent_budget: Number(phaseForm.spent) || 0,
    })
    if (!created) return setFeedback('Creation de phase impossible')
    setPhases((prev) => [...prev, created])
    setPhaseForm({ name: '', zone_id: '', subcontractor_id: '', start: '', end: '', progress: '0', allocated: '0', spent: '0' })
    setFeedback('Phase chantier ajoutee')
  }

  const handleCreateZone = async () => {
    const projectId = requireProject()
    if (!projectId || !zoneForm.name.trim()) return
    const created = await createSiteZone(projectId, {
      kind: zoneForm.kind,
      code: zoneForm.code.trim(),
      name: zoneForm.name.trim(),
      description: zoneForm.description.trim(),
      parent_zone_id: zoneForm.parent_zone_id || undefined,
    })
    if (!created) return setFeedback('Creation de zone impossible')
    setZones((prev) => [...prev, created])
    setZoneForm({ kind: 'zone', code: '', name: '', description: '', parent_zone_id: '' })
    setFeedback('Zone chantier ajoutee')
  }

  const handleCreateSubcontractor = async () => {
    const projectId = requireProject()
    if (!projectId || !subcontractorForm.company_name.trim()) return
    const created = await createProjectSubcontractor(projectId, {
      company_name: subcontractorForm.company_name.trim(),
      trade_label: subcontractorForm.trade_label.trim(),
      contact_name: subcontractorForm.contact_name.trim(),
      contact_phone: subcontractorForm.contact_phone.trim(),
      status: subcontractorForm.status,
      notes: subcontractorForm.notes.trim(),
    })
    if (!created) return setFeedback('Creation du sous-traitant impossible')
    setSubcontractors((prev) => [...prev, created])
    setSubcontractorForm({ company_name: '', trade_label: '', contact_name: '', contact_phone: '', status: 'active', notes: '' })
    setFeedback('Sous-traitant ajoute')
  }

  const handleCreateQualification = async () => {
    const projectId = requireProject()
    if (!projectId || !qualificationForm.worker.trim() || !qualificationForm.qualification.trim()) return
    const created = await createWorkerQualification(projectId, {
      worker_name: qualificationForm.worker.trim(),
      qualification_name: qualificationForm.qualification.trim(),
      expiry_date: qualificationForm.expiry,
      subcontractor_id: qualificationForm.subcontractor_id || undefined,
    })
    if (!created) return setFeedback('Creation de qualification impossible')
    setQualifications((prev) => [...prev, created])
    setQualificationForm({ worker: '', qualification: '', expiry: '', subcontractor_id: '' })
    setFeedback('Qualification ajoutee')
  }

  const handleCreateSafetyItem = async () => {
    const projectId = requireProject()
    if (!projectId || !safetyLabel.trim()) return
    const created = await createSafetyChecklistItem(projectId, safetyLabel.trim(), safety.length + 1)
    if (!created) return setFeedback('Creation de point securite impossible')
    setSafety((prev) => [...prev, created])
    setSafetyLabel('')
    setFeedback('Point securite ajoute')
  }

  const handleCreateSupply = async () => {
    const projectId = requireProject()
    if (!projectId || !supplyForm.material.trim()) return
    const created = await createSupplyOrder(projectId, {
      material_name: supplyForm.material.trim(),
      quantity_label: supplyForm.quantity,
      expected_delivery_date: supplyForm.eta,
      status: supplyForm.status,
      zone_id: supplyForm.zone_id || undefined,
      subcontractor_id: supplyForm.subcontractor_id || undefined,
    })
    if (!created) return setFeedback('Creation de commande impossible')
    setSupplies((prev) => [...prev, created])
    setSupplyForm({ material: '', quantity: '', eta: '', status: 'draft', zone_id: '', subcontractor_id: '' })
    setFeedback('Approvisionnement ajoute')
  }

  const handleCreateEquipment = async () => {
    const projectId = requireProject()
    if (!projectId || !equipmentForm.equipment.trim()) return
    const created = await createEquipmentBooking(projectId, {
      equipment_name: equipmentForm.equipment.trim(),
      assigned_to_name: equipmentForm.assignee,
      booking_start: equipmentForm.from,
      booking_end: equipmentForm.to,
      zone_id: equipmentForm.zone_id || undefined,
      subcontractor_id: equipmentForm.subcontractor_id || undefined,
    })
    if (!created) return setFeedback('Creation de reservation impossible')
    setEquipment((prev) => [...prev, created])
    setEquipmentForm({ equipment: '', from: '', to: '', assignee: '', zone_id: '', subcontractor_id: '' })
    setFeedback('Reservation engin ajoutee')
  }

  const handleCreateJournalEntry = async () => {
    const projectId = requireProject()
    if (!projectId || !photoForm.date) return
    const created = await createSiteJournalEntry(projectId, {
      entry_date: photoForm.date,
      zone_id: photoForm.zone_id || undefined,
      subcontractor_id: photoForm.subcontractor_id || undefined,
      location_label: photoForm.place,
      note: photoForm.note,
      photo_file: photoFile,
    })
    if (!created) return setFeedback('Creation de l entree chantier impossible')
    setPhotos((prev) => [created, ...prev])
    setPhotoForm({ date: '', place: '', note: '', zone_id: '', subcontractor_id: '' })
    setPhotoFile(null)
    setFeedback('Entree chantier ajoutee')
  }

  const handleCreateIncident = async () => {
    const projectId = requireProject()
    if (!projectId || !incidentForm.title.trim() || !incidentForm.occurred_on) return
    const created = await createSiteIncident(projectId, {
      zone_id: incidentForm.zone_id || undefined,
      subcontractor_id: incidentForm.subcontractor_id || undefined,
      linked_phase_id: incidentForm.linked_phase_id || undefined,
      incident_type: incidentForm.incident_type,
      severity: incidentForm.severity,
      status: incidentForm.status,
      occurred_on: incidentForm.occurred_on,
      title: incidentForm.title.trim(),
      description: incidentForm.description.trim(),
      corrective_action: incidentForm.corrective_action.trim(),
      owner_name: incidentForm.owner_name.trim(),
      due_date: incidentForm.due_date,
    })
    if (!created) return setFeedback('Creation de l incident impossible')
    setIncidents((prev) => [created, ...prev])
    setIncidentForm({
      zone_id: '',
      subcontractor_id: '',
      linked_phase_id: '',
      incident_type: 'incident',
      severity: 'medium',
      status: 'open',
      occurred_on: todayIso,
      title: '',
      description: '',
      corrective_action: '',
      owner_name: '',
      due_date: '',
    })
    setFeedback('Incident chantier ajoute')
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white px-8 py-6 shadow-lg">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Modules avances</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-900">Fonctionnalites avancees BuildFlow</h1>
        <p className="mt-2 text-sm text-slate-600">
          Suite chantier persistante: planning, budget par phase, structuration zones/lots, pilotage sous-traitants,
          securite, approvisionnements, engins, incidents et rapport journalier.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">Projet actif</label>
        <input
          type="text"
          placeholder="ID du projet"
          value={activeProject}
          onChange={(e) => setActiveProject(e.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-800 focus:border-indigo-500 focus:outline-none"
        />
      </div>

      {feedback && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
          {feedback}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-2xl px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loadingProjectData && activeProject && (
        <div className="rounded-3xl border border-slate-200 bg-white p-4 text-sm text-slate-500 shadow-sm">
          Chargement des modules chantier...
        </div>
      )}

      {activeTab === 'planning' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <BaselineComparison projectId={activeProject.trim()} />
          <CriticalPathChart />
          <MilestoneTracker projectId={activeProject.trim()} />
          <MilestoneGantt />
        </div>
      )}

      {activeTab === 'capacity' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <TeamCapacityBoard projectId={activeProject.trim()} weekStart={weekStart} />
        </div>
      )}

      {activeTab === 'risk' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <RiskRegisterModal projectId={activeProject.trim()} />
          <RiskMatrix />
        </div>
      )}

      {activeTab === 'documents' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <DocumentVersionControl documentId={activeProject.trim()} />
          <DocumentApprovalFlow />
        </div>
      )}

      {activeTab === 'automation' && (
        <div className="space-y-4">
          <AutomationRuleBuilder projectId={activeProject.trim()} />
          <DecisionJournal projectId={activeProject.trim()} />
        </div>
      )}

      {activeTab === 'portfolio' && (
        <div className="space-y-4">
          <PortfolioOverview />
          <SLADashboard projectId={activeProject.trim()} />
        </div>
      )}

      {activeTab === 'phases' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Nouvelle phase chantier</h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Nom"
                value={phaseForm.name}
                onChange={(e) => setPhaseForm((v) => ({ ...v, name: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="date"
                  value={phaseForm.start}
                  onChange={(e) => setPhaseForm((v) => ({ ...v, start: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="date"
                  value={phaseForm.end}
                  onChange={(e) => setPhaseForm((v) => ({ ...v, end: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-3 gap-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="number"
                  min={0}
                  max={100}
                  placeholder="Progression %"
                  value={phaseForm.progress}
                  onChange={(e) => setPhaseForm((v) => ({ ...v, progress: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="number"
                  min={0}
                  placeholder="Budget"
                  value={phaseForm.allocated}
                  onChange={(e) => setPhaseForm((v) => ({ ...v, allocated: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="number"
                  min={0}
                  placeholder="Consomme"
                  value={phaseForm.spent}
                  onChange={(e) => setPhaseForm((v) => ({ ...v, spent: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={phaseForm.zone_id}
                  onChange={(e) => setPhaseForm((v) => ({ ...v, zone_id: e.target.value }))}
                >
                  <option value="">Zone / lot</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code ? `${zone.code} - ` : ''}
                      {zone.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={phaseForm.subcontractor_id}
                  onChange={(e) => setPhaseForm((v) => ({ ...v, subcontractor_id: e.target.value }))}
                >
                  <option value="">Sous-traitant</option>
                  {subcontractors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleCreatePhase} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                Ajouter la phase
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Plan de phases</h2>
              <span className="text-xs text-slate-500">{phaseStats.count} phases</span>
            </div>
            <div className="space-y-2">
              {phases.map((phase) => (
                <div key={phase.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{phase.name}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDateLabel(phase.start_date)} - {formatDateLabel(phase.end_date)}
                      </p>
                      {(phase.zone_id || phase.subcontractor_id) && (
                        <p className="mt-1 text-xs text-slate-500">
                          {phase.zone_id ? `Zone: ${zoneById[phase.zone_id]?.name || 'Inconnue'}` : 'Sans zone'}
                          {phase.subcontractor_id ? ` · Sous-traitant: ${subcontractorById[phase.subcontractor_id]?.company_name || 'Inconnu'}` : ''}
                        </p>
                      )}
                    </div>
                    <DangerButton
                      onClick={async () => {
                        if (await deleteConstructionPhase(phase.id)) {
                          setPhases((prev) => prev.filter((item) => item.id !== phase.id))
                        }
                      }}
                    />
                  </div>
                  <div className="mt-3 h-1.5 w-full rounded-full bg-slate-200">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${phase.progress_percent}%` }} />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500 md:grid-cols-3">
                    <p>Progression: {phase.progress_percent}%</p>
                    <p>Budget: {fmt(Number(phase.allocated_budget))}</p>
                    <p>Consomme: {fmt(Number(phase.spent_budget))}</p>
                    <p>Taches liees: {phaseMetrics[phase.id]?.linked_tasks || 0}</p>
                    <p>Depenses liees: {phaseMetrics[phase.id]?.linked_expenses || 0}</p>
                    <p>Valide: {fmt(phaseMetrics[phase.id]?.validated_expenses_total || 0)}</p>
                  </div>
                </div>
              ))}
              {phases.length === 0 && <EmptyState text="Aucune phase pour le moment." />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'phase-budget' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">Phases</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{phaseStats.count}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">Progression moyenne</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{phaseStats.avgProgress}%</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">Budget alloue</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{phaseStats.allocatedTotal.toLocaleString('fr-FR')} EUR</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-slate-500">Reste</p>
              <p className="mt-1 text-xl font-semibold text-slate-900">{phaseStats.remaining.toLocaleString('fr-FR')} EUR</p>
            </div>
          </div>
          <div className="space-y-2">
            {phases.map((phase) => (
              <div key={phase.id} className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 p-3 text-sm md:grid-cols-5">
                <p className="font-semibold text-slate-800">{phase.name}</p>
                <p>Alloue: {fmt(Number(phase.allocated_budget))}</p>
                <p>Consomme: {fmt(Number(phase.spent_budget))}</p>
                <p>Reste: {fmt(Number(phase.allocated_budget) - Number(phase.spent_budget))}</p>
                <p className="text-slate-500">
                  Progression: {phase.progress_percent}% · Taches: {phaseMetrics[phase.id]?.linked_tasks || 0} · Depenses: {phaseMetrics[phase.id]?.linked_expenses || 0}
                </p>
              </div>
            ))}
            {phases.length === 0 && <EmptyState text="Ajoute des phases pour calculer ce budget." />}
          </div>
        </div>
      )}

      {activeTab === 'zones' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Structurer le chantier</h2>
            <div className="mt-3 space-y-2">
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={zoneForm.kind}
                onChange={(e) =>
                  setZoneForm((v) => ({
                    ...v,
                    kind: e.target.value as SiteZone['kind'],
                    parent_zone_id: e.target.value === 'zone' ? '' : v.parent_zone_id,
                  }))
                }
              >
                <option value="zone">Zone</option>
                <option value="lot">Lot</option>
              </select>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Code"
                value={zoneForm.code}
                onChange={(e) => setZoneForm((v) => ({ ...v, code: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Nom"
                value={zoneForm.name}
                onChange={(e) => setZoneForm((v) => ({ ...v, name: e.target.value }))}
              />
              {zoneForm.kind === 'lot' && (
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={zoneForm.parent_zone_id}
                  onChange={(e) => setZoneForm((v) => ({ ...v, parent_zone_id: e.target.value }))}
                >
                  <option value="">Zone parente</option>
                  {parentZoneOptions.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code ? `${zone.code} - ` : ''}
                      {zone.name}
                    </option>
                  ))}
                </select>
              )}
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Description"
                value={zoneForm.description}
                onChange={(e) => setZoneForm((v) => ({ ...v, description: e.target.value }))}
              />
              <button onClick={handleCreateZone} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                Ajouter
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Cartographie chantier</h2>
              <span className="text-xs text-slate-500">{zones.length} elements</span>
            </div>
            <div className="space-y-2">
              {zones.map((zone) => (
                <div key={zone.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {zone.code ? `${zone.code} · ` : ''}
                        {zone.name}
                      </p>
                      <p className="text-xs uppercase tracking-wide text-slate-500">{zone.kind === 'zone' ? 'Zone' : 'Lot'}</p>
                      {zone.parent_zone_id && (
                        <p className="mt-1 text-xs text-slate-500">
                          Rattache a: {zoneById[zone.parent_zone_id]?.name || 'Zone inconnue'}
                        </p>
                      )}
                      {zone.description && <p className="mt-1 text-slate-600">{zone.description}</p>}
                    </div>
                    <DangerButton
                      onClick={async () => {
                        if (await deleteSiteZone(zone.id)) {
                          setZones((prev) => prev.filter((entry) => entry.id !== zone.id))
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
              {zones.length === 0 && <EmptyState text="Aucune zone ou lot defini." />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'subcontractors' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Nouveau sous-traitant</h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Societe"
                value={subcontractorForm.company_name}
                onChange={(e) => setSubcontractorForm((v) => ({ ...v, company_name: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Corps d'etat"
                value={subcontractorForm.trade_label}
                onChange={(e) => setSubcontractorForm((v) => ({ ...v, trade_label: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Contact"
                  value={subcontractorForm.contact_name}
                  onChange={(e) => setSubcontractorForm((v) => ({ ...v, contact_name: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Telephone"
                  value={subcontractorForm.contact_phone}
                  onChange={(e) => setSubcontractorForm((v) => ({ ...v, contact_phone: e.target.value }))}
                />
              </div>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={subcontractorForm.status}
                onChange={(e) => setSubcontractorForm((v) => ({ ...v, status: e.target.value as ProjectSubcontractor['status'] }))}
              >
                <option value="active">Actif</option>
                <option value="on_hold">En attente</option>
                <option value="inactive">Inactif</option>
              </select>
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Notes"
                value={subcontractorForm.notes}
                onChange={(e) => setSubcontractorForm((v) => ({ ...v, notes: e.target.value }))}
              />
              <button onClick={handleCreateSubcontractor} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                Ajouter
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900">Pilotage sous-traitants</h2>
              <span className="text-xs text-slate-500">{subcontractors.length} entreprises</span>
            </div>
            <div className="space-y-2">
              {subcontractors.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">{item.company_name}</p>
                      <p className="text-slate-600">{item.trade_label || 'Corps d etat non renseigne'}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        Contact: {item.contact_name || 'N/A'} · {item.contact_phone || 'N/A'}
                      </p>
                      {item.notes && <p className="mt-1 text-slate-600">{item.notes}</p>}
                    </div>
                    <DangerButton
                      onClick={async () => {
                        if (await deleteProjectSubcontractor(item.id)) {
                          setSubcontractors((prev) => prev.filter((entry) => entry.id !== item.id))
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
              {subcontractors.length === 0 && <EmptyState text="Aucun sous-traitant enregistre." />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'qualifications' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Ajouter une qualification</h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Collaborateur"
                value={qualificationForm.worker}
                onChange={(e) => setQualificationForm((v) => ({ ...v, worker: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Qualification"
                value={qualificationForm.qualification}
                onChange={(e) => setQualificationForm((v) => ({ ...v, qualification: e.target.value }))}
              />
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={qualificationForm.subcontractor_id}
                onChange={(e) => setQualificationForm((v) => ({ ...v, subcontractor_id: e.target.value }))}
              >
                <option value="">Sous-traitant</option>
                {subcontractors.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.company_name}
                  </option>
                ))}
              </select>
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                type="date"
                value={qualificationForm.expiry}
                onChange={(e) => setQualificationForm((v) => ({ ...v, expiry: e.target.value }))}
              />
              <button onClick={handleCreateQualification} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                Ajouter
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Registre des habilitations</h2>
            <div className="mt-3 space-y-2">
              {qualifications.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{item.worker_name}</p>
                    <p className="text-slate-600">{item.qualification_name}</p>
                    {item.subcontractor_id && (
                      <p className="text-xs text-slate-500">
                        Sous-traitant: {subcontractorById[item.subcontractor_id]?.company_name || 'Inconnu'}
                      </p>
                    )}
                    <p className="text-xs text-slate-500">Expiration: {formatDateLabel(item.expiry_date)}</p>
                  </div>
                  <DangerButton
                    onClick={async () => {
                      if (await deleteWorkerQualification(item.id)) {
                        setQualifications((prev) => prev.filter((entry) => entry.id !== item.id))
                      }
                    }}
                  />
                </div>
              ))}
              {qualifications.length === 0 && <EmptyState text="Aucune qualification enregistree." />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'safety' && (
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-4 flex flex-col gap-2 md:flex-row">
            <input
              className="flex-1 rounded-lg border px-3 py-2 text-sm"
              placeholder="Ajouter un point de securite"
              value={safetyLabel}
              onChange={(e) => setSafetyLabel(e.target.value)}
            />
            <button onClick={handleCreateSafetyItem} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
              Ajouter
            </button>
          </div>
          <div className="space-y-2">
            {safety.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                <label className="flex flex-1 items-center gap-3">
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={async (e) => {
                      const nextDone = e.target.checked
                      setSafety((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, done: nextDone } : entry)))
                      const ok = await toggleSafetyChecklistItem(item.id, nextDone)
                      if (!ok) {
                        setSafety((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, done: item.done } : entry)))
                      }
                    }}
                  />
                  <span className={item.done ? 'text-emerald-700 line-through' : 'text-slate-700'}>{item.label}</span>
                </label>
                <DangerButton
                  onClick={async () => {
                    if (await deleteSafetyChecklistItem(item.id)) {
                      setSafety((prev) => prev.filter((entry) => entry.id !== item.id))
                    }
                  }}
                />
              </div>
            ))}
            {safety.length === 0 && <EmptyState text="Aucun point de securite." />}
          </div>
        </div>
      )}

      {activeTab === 'supplies' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Nouvel approvisionnement</h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Materiau"
                value={supplyForm.material}
                onChange={(e) => setSupplyForm((v) => ({ ...v, material: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Quantite"
                value={supplyForm.quantity}
                onChange={(e) => setSupplyForm((v) => ({ ...v, quantity: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                type="date"
                value={supplyForm.eta}
                onChange={(e) => setSupplyForm((v) => ({ ...v, eta: e.target.value }))}
              />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={supplyForm.zone_id}
                  onChange={(e) => setSupplyForm((v) => ({ ...v, zone_id: e.target.value }))}
                >
                  <option value="">Zone / lot</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code ? `${zone.code} - ` : ''}
                      {zone.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={supplyForm.subcontractor_id}
                  onChange={(e) => setSupplyForm((v) => ({ ...v, subcontractor_id: e.target.value }))}
                >
                  <option value="">Sous-traitant</option>
                  {subcontractors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <select
                className="w-full rounded-lg border px-3 py-2 text-sm"
                value={supplyForm.status}
                onChange={(e) => setSupplyForm((v) => ({ ...v, status: e.target.value as SupplyOrder['status'] }))}
              >
                <option value="draft">Brouillon</option>
                <option value="ordered">Commande</option>
                <option value="received">Recu</option>
              </select>
              <button onClick={handleCreateSupply} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                Ajouter
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Suivi des livraisons</h2>
            <div className="mt-3 space-y-2">
              {supplies.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-slate-800">
                        {item.material_name} - {item.quantity_label || 'N/A'}
                      </p>
                      <p className="text-slate-600">ETA: {formatDateLabel(item.expected_delivery_date)}</p>
                      {(item.zone_id || item.subcontractor_id) && (
                        <p className="text-xs text-slate-500">
                          {item.zone_id ? `Zone: ${zoneById[item.zone_id]?.name || 'Inconnue'}` : 'Sans zone'}
                          {item.subcontractor_id ? ` · Sous-traitant: ${subcontractorById[item.subcontractor_id]?.company_name || 'Inconnu'}` : ''}
                        </p>
                      )}
                    </div>
                    <DangerButton
                      onClick={async () => {
                        if (await deleteSupplyOrder(item.id)) {
                          setSupplies((prev) => prev.filter((entry) => entry.id !== item.id))
                        }
                      }}
                    />
                  </div>
                  <select
                    className="mt-3 rounded-lg border px-2 py-1 text-xs"
                    value={item.status}
                    onChange={async (e) => {
                      const nextStatus = e.target.value as SupplyOrder['status']
                      setSupplies((prev) => prev.map((entry) => (entry.id === item.id ? { ...entry, status: nextStatus } : entry)))
                      const ok = await updateSupplyOrderStatus(item.id, nextStatus)
                      if (!ok) setFeedback('Mise a jour du statut impossible')
                    }}
                  >
                    <option value="draft">Brouillon</option>
                    <option value="ordered">Commande</option>
                    <option value="received">Recu</option>
                  </select>
                </div>
              ))}
              {supplies.length === 0 && <EmptyState text="Aucun approvisionnement." />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'equipment' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Planifier un engin</h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Engin"
                value={equipmentForm.equipment}
                onChange={(e) => setEquipmentForm((v) => ({ ...v, equipment: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Affecte a"
                value={equipmentForm.assignee}
                onChange={(e) => setEquipmentForm((v) => ({ ...v, assignee: e.target.value }))}
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="date"
                  value={equipmentForm.from}
                  onChange={(e) => setEquipmentForm((v) => ({ ...v, from: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="date"
                  value={equipmentForm.to}
                  onChange={(e) => setEquipmentForm((v) => ({ ...v, to: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={equipmentForm.zone_id}
                  onChange={(e) => setEquipmentForm((v) => ({ ...v, zone_id: e.target.value }))}
                >
                  <option value="">Zone / lot</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code ? `${zone.code} - ` : ''}
                      {zone.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={equipmentForm.subcontractor_id}
                  onChange={(e) => setEquipmentForm((v) => ({ ...v, subcontractor_id: e.target.value }))}
                >
                  <option value="">Sous-traitant</option>
                  {subcontractors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <button onClick={handleCreateEquipment} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                Planifier
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Planning materiel</h2>
            <div className="mt-3 space-y-2">
              {equipment.map((item) => (
                <div key={item.id} className="flex items-start justify-between gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-800">{item.equipment_name}</p>
                    <p className="text-slate-600">
                      {formatDateLabel(item.booking_start)} - {formatDateLabel(item.booking_end)}
                    </p>
                    <p className="text-xs text-slate-500">Affecte a: {item.assigned_to_name || 'Non attribue'}</p>
                    {(item.zone_id || item.subcontractor_id) && (
                      <p className="text-xs text-slate-500">
                        {item.zone_id ? `Zone: ${zoneById[item.zone_id]?.name || 'Inconnue'}` : 'Sans zone'}
                        {item.subcontractor_id ? ` · Sous-traitant: ${subcontractorById[item.subcontractor_id]?.company_name || 'Inconnu'}` : ''}
                      </p>
                    )}
                  </div>
                  <DangerButton
                    onClick={async () => {
                      if (await deleteEquipmentBooking(item.id)) {
                        setEquipment((prev) => prev.filter((entry) => entry.id !== item.id))
                      }
                    }}
                  />
                </div>
              ))}
              {equipment.length === 0 && <EmptyState text="Aucun engin planifie." />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'journal' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Nouvelle entree journal photo</h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                type="date"
                value={photoForm.date}
                onChange={(e) => setPhotoForm((v) => ({ ...v, date: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Lieu / GPS"
                value={photoForm.place}
                onChange={(e) => setPhotoForm((v) => ({ ...v, place: e.target.value }))}
              />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={photoForm.zone_id}
                  onChange={(e) => setPhotoForm((v) => ({ ...v, zone_id: e.target.value }))}
                >
                  <option value="">Zone / lot</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code ? `${zone.code} - ` : ''}
                      {zone.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={photoForm.subcontractor_id}
                  onChange={(e) => setPhotoForm((v) => ({ ...v, subcontractor_id: e.target.value }))}
                >
                  <option value="">Sous-traitant</option>
                  {subcontractors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.company_name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setPhotoFile(e.target.files?.[0] || null)}
                />
                {photoFile && <p className="text-xs text-slate-500">{photoFile.name}</p>}
              </div>
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Note"
                value={photoForm.note}
                onChange={(e) => setPhotoForm((v) => ({ ...v, note: e.target.value }))}
              />
              <button onClick={handleCreateJournalEntry} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                Ajouter au journal
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Historique chantier</h2>
            <div className="mt-3 space-y-3">
              {photos.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-800">
                        {item.entry_date} - {item.location_label || 'Sans lieu'}
                      </p>
                      {(item.zone_id || item.subcontractor_id) && (
                        <p className="text-xs text-slate-500">
                          {item.zone_id ? `Zone: ${zoneById[item.zone_id]?.name || 'Inconnue'}` : 'Sans zone'}
                          {item.subcontractor_id ? ` · Sous-traitant: ${subcontractorById[item.subcontractor_id]?.company_name || 'Inconnu'}` : ''}
                        </p>
                      )}
                      {item.photo_url && (
                        <a className="mt-1 block text-xs text-indigo-600 underline" href={item.photo_url} target="_blank" rel="noreferrer">
                          Voir la photo
                        </a>
                      )}
                      {item.note && <p className="mt-1 text-sm text-slate-600">{item.note}</p>}
                    </div>
                    <DangerButton
                      onClick={async () => {
                        if (await deleteSiteJournalEntry(item.id, item.photo_path)) {
                          setPhotos((prev) => prev.filter((entry) => entry.id !== item.id))
                        }
                      }}
                    />
                  </div>
                </div>
              ))}
              {photos.length === 0 && <EmptyState text="Aucune entree." />}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'incidents' && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1fr_1.3fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h2 className="text-lg font-semibold text-slate-900">Declarer un incident ou une reserve</h2>
            <div className="mt-3 space-y-2">
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                type="date"
                value={incidentForm.occurred_on}
                onChange={(e) => setIncidentForm((v) => ({ ...v, occurred_on: e.target.value }))}
              />
              <input
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Titre"
                value={incidentForm.title}
                onChange={(e) => setIncidentForm((v) => ({ ...v, title: e.target.value }))}
              />
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={incidentForm.incident_type}
                  onChange={(e) => setIncidentForm((v) => ({ ...v, incident_type: e.target.value as SiteIncident['incident_type'] }))}
                >
                  <option value="incident">Incident</option>
                  <option value="non_conformity">Non-conformite</option>
                  <option value="observation">Observation</option>
                </select>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={incidentForm.severity}
                  onChange={(e) => setIncidentForm((v) => ({ ...v, severity: e.target.value as SiteIncident['severity'] }))}
                >
                  <option value="low">Faible</option>
                  <option value="medium">Moyenne</option>
                  <option value="high">Haute</option>
                  <option value="critical">Critique</option>
                </select>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={incidentForm.status}
                  onChange={(e) => setIncidentForm((v) => ({ ...v, status: e.target.value as SiteIncident['status'] }))}
                >
                  <option value="open">Ouvert</option>
                  <option value="in_progress">En cours</option>
                  <option value="resolved">Resolue</option>
                  <option value="closed">Cloturee</option>
                </select>
              </div>
              <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={incidentForm.zone_id}
                  onChange={(e) => setIncidentForm((v) => ({ ...v, zone_id: e.target.value }))}
                >
                  <option value="">Zone / lot</option>
                  {zones.map((zone) => (
                    <option key={zone.id} value={zone.id}>
                      {zone.code ? `${zone.code} - ` : ''}
                      {zone.name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={incidentForm.subcontractor_id}
                  onChange={(e) => setIncidentForm((v) => ({ ...v, subcontractor_id: e.target.value }))}
                >
                  <option value="">Sous-traitant</option>
                  {subcontractors.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.company_name}
                    </option>
                  ))}
                </select>
                <select
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  value={incidentForm.linked_phase_id}
                  onChange={(e) => setIncidentForm((v) => ({ ...v, linked_phase_id: e.target.value }))}
                >
                  <option value="">Phase liee</option>
                  {phases.map((phase) => (
                    <option key={phase.id} value={phase.id}>
                      {phase.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  placeholder="Responsable"
                  value={incidentForm.owner_name}
                  onChange={(e) => setIncidentForm((v) => ({ ...v, owner_name: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  type="date"
                  value={incidentForm.due_date}
                  onChange={(e) => setIncidentForm((v) => ({ ...v, due_date: e.target.value }))}
                />
              </div>
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Description"
                value={incidentForm.description}
                onChange={(e) => setIncidentForm((v) => ({ ...v, description: e.target.value }))}
              />
              <textarea
                className="w-full rounded-lg border px-3 py-2 text-sm"
                placeholder="Action corrective"
                value={incidentForm.corrective_action}
                onChange={(e) => setIncidentForm((v) => ({ ...v, corrective_action: e.target.value }))}
              />
              <button onClick={handleCreateIncident} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                Ajouter
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <p className="text-slate-500">Incidents ouverts</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {incidents.filter((item) => item.status === 'open' || item.status === 'in_progress').length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <p className="text-slate-500">Critiques</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {incidents.filter((item) => item.severity === 'critical' && item.status !== 'resolved' && item.status !== 'closed').length}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <p className="text-slate-500">Echeances depassees</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {incidents.filter((item) => item.due_date && item.due_date < todayIso && item.status !== 'resolved' && item.status !== 'closed').length}
                </p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h2 className="text-lg font-semibold text-slate-900">Registre des incidents</h2>
              <div className="mt-3 space-y-2">
                {incidents.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-800">{item.title}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {getIncidentTypeLabel(item.incident_type)}
                          </span>
                          <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] text-amber-700">
                            {getIncidentSeverityLabel(item.severity)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
                            {getIncidentStatusLabel(item.status)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          Date: {formatDateLabel(item.occurred_on)} · Zone: {item.zone_id ? zoneById[item.zone_id]?.name || 'Inconnue' : 'Non renseignee'} · Sous-traitant: {item.subcontractor_id ? subcontractorById[item.subcontractor_id]?.company_name || 'Inconnu' : 'Non renseigne'}
                        </p>
                        {item.linked_phase_id && <p className="mt-1 text-xs text-slate-500">Phase: {phaseById[item.linked_phase_id]?.name || 'Inconnue'}</p>}
                        {item.description && <p className="mt-2 text-slate-600">{item.description}</p>}
                        {item.corrective_action && <p className="mt-1 text-slate-600">Action corrective: {item.corrective_action}</p>}
                        <p className="mt-1 text-xs text-slate-500">
                          Responsable: {item.owner_name || 'Non attribue'} · Echeance: {formatDateLabel(item.due_date)}
                        </p>
                      </div>
                      <DangerButton
                        onClick={async () => {
                          if (await deleteSiteIncident(item.id)) {
                            setIncidents((prev) => prev.filter((entry) => entry.id !== item.id))
                          }
                        }}
                      />
                    </div>
                  </div>
                ))}
                {incidents.length === 0 && <EmptyState text="Aucun incident ou reserve enregistree." />}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'daily-report' && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Rapport journalier chantier</h2>
                <p className="text-sm text-slate-500">Synthese exploitable pour conducteur de travaux et reunion de pilotage.</p>
              </div>
              <input
                className="rounded-lg border px-3 py-2 text-sm"
                type="date"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <p className="text-slate-500">Photos / entrees</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{reportData.dailyJournal.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <p className="text-slate-500">Incidents du jour</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{reportData.dailyIncidents.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <p className="text-slate-500">Appros a traiter</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{reportData.dueSupplies.length}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <p className="text-slate-500">Engins mobilises</p>
              <p className="mt-1 text-2xl font-semibold text-slate-900">{reportData.activeEquipment.length}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-900">Points de vigilance</h3>
              <div className="mt-3 space-y-2 text-sm">
                <div className="rounded-lg border border-slate-200 p-3">
                  Incidents critiques ouverts: <span className="font-semibold text-slate-900">{reportData.criticalIncidents.length}</span>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  Incidents en retard de traitement: <span className="font-semibold text-slate-900">{reportData.overdueIncidents.length}</span>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  Checks securite en attente: <span className="font-semibold text-slate-900">{reportData.pendingSafety.length}</span>
                </div>
                <div className="rounded-lg border border-slate-200 p-3">
                  Qualifications echues a la date: <span className="font-semibold text-slate-900">{reportData.expiringQualifications.length}</span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-900">Phases actives</h3>
              <div className="mt-3 space-y-2 text-sm">
                {activePhasesForReport.map((phase) => (
                  <div key={phase.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-800">{phase.name}</p>
                    <p className="mt-1 text-slate-500">
                      Progression {phase.progress_percent}% · Zone {phase.zone_id ? zoneById[phase.zone_id]?.name || 'Inconnue' : 'Non renseignee'}
                    </p>
                  </div>
                ))}
                {activePhasesForReport.length === 0 && <EmptyState text="Aucune phase active sur cette date." />}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-900">Journal terrain</h3>
              <div className="mt-3 space-y-2 text-sm">
                {reportData.dailyJournal.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-800">{item.location_label || 'Sans lieu'}</p>
                    <p className="mt-1 text-slate-600">{item.note || 'Aucune note'}</p>
                  </div>
                ))}
                {reportData.dailyJournal.length === 0 && <EmptyState text="Aucune entree journal pour cette date." />}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="text-base font-semibold text-slate-900">Incidents et reserves du jour</h3>
              <div className="mt-3 space-y-2 text-sm">
                {reportData.dailyIncidents.map((item) => (
                  <div key={item.id} className="rounded-lg border border-slate-200 p-3">
                    <p className="font-semibold text-slate-800">{item.title}</p>
                    <p className="mt-1 text-slate-500">
                      {getIncidentTypeLabel(item.incident_type)} · {getIncidentSeverityLabel(item.severity)} · {getIncidentStatusLabel(item.status)}
                    </p>
                  </div>
                ))}
                {reportData.dailyIncidents.length === 0 && <EmptyState text="Aucun incident releve sur cette date." />}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
