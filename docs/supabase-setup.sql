-- ===========================================
-- BUILDFLOW - RÉINITIALISATION COMPLÈTE + SETUP
-- ===========================================
-- Ce script réinitialise complètement la BD et la recrée du zéro
-- ⚠️ ATTENTION: Exécutez sur une BD de développement uniquement

-- Extensions nécessaires
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =================================================================================
-- ÉTAPE 1: NETTOYAGE COMPLET
-- =================================================================================
-- Note: DROP TABLE ... CASCADE supprime automatiquement toutes les policies,
-- triggers et indexes associés. On supprime d'abord les triggers/fonctions
-- explicitement pour éviter les erreurs de dépendance circulaire.

DO $$ BEGIN
  DROP TRIGGER IF EXISTS add_creator_as_owner_trigger ON projects;
  DROP TRIGGER IF EXISTS audit_projects ON projects;
  DROP TRIGGER IF EXISTS audit_tasks ON tasks;
  DROP TRIGGER IF EXISTS audit_documents ON documents;
  DROP TRIGGER IF EXISTS update_actual_hours_on_entry ON time_entries;
  DROP TRIGGER IF EXISTS enforce_task_status_transition_trigger ON tasks;
  DROP TRIGGER IF EXISTS enforce_task_delete_guard_trigger ON tasks;
  DROP TRIGGER IF EXISTS enforce_task_dependency_no_cycles_trigger ON task_dependencies;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DROP FUNCTION IF EXISTS add_project_creator_as_owner() CASCADE;
DROP FUNCTION IF EXISTS audit_trigger_function() CASCADE;
DROP FUNCTION IF EXISTS update_task_actual_hours() CASCADE;
DROP FUNCTION IF EXISTS enforce_task_status_transition() CASCADE;
DROP FUNCTION IF EXISTS enforce_task_delete_guard() CASCADE;
DROP FUNCTION IF EXISTS enforce_task_dependency_no_cycles() CASCADE;
DROP FUNCTION IF EXISTS auth_is_project_member(UUID) CASCADE;
DROP FUNCTION IF EXISTS auth_is_project_owner(UUID) CASCADE;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM storage.buckets
    WHERE id = 'documents'
  ) THEN
    -- Use Supabase Storage API functions (direct DELETE is blocked)
    PERFORM storage.empty_bucket('documents');
    PERFORM storage.delete_bucket('documents');
  END IF;
EXCEPTION
  WHEN undefined_table OR undefined_function THEN
    NULL;
END
$$;

DROP TABLE IF EXISTS decision_journal CASCADE;
DROP TABLE IF EXISTS automation_rules CASCADE;
DROP TABLE IF EXISTS task_milestone_mapping CASCADE;
DROP TABLE IF EXISTS milestones CASCADE;
DROP TABLE IF EXISTS portfolio_dashboards CASCADE;
DROP TABLE IF EXISTS sla_violations CASCADE;
DROP TABLE IF EXISTS sla_rules CASCADE;
DROP TABLE IF EXISTS document_versions CASCADE;
DROP TABLE IF EXISTS task_dependencies CASCADE;
DROP TABLE IF EXISTS team_capacity CASCADE;
DROP TABLE IF EXISTS risk_register CASCADE;
DROP TABLE IF EXISTS project_baselines CASCADE;
DROP TABLE IF EXISTS task_templates CASCADE;
DROP TABLE IF EXISTS recurrent_tasks CASCADE;
DROP TABLE IF EXISTS time_entries CASCADE;
DROP TABLE IF EXISTS task_estimations CASCADE;
DROP TABLE IF EXISTS comment_reactions CASCADE;
DROP TABLE IF EXISTS comments CASCADE;
DROP TABLE IF EXISTS resource_permissions CASCADE;
DROP TABLE IF EXISTS attachments CASCADE;
DROP TABLE IF EXISTS activity_logs CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS budget_settings CASCADE;
DROP TABLE IF EXISTS saved_filters CASCADE;
DROP TABLE IF EXISTS site_incidents CASCADE;
DROP TABLE IF EXISTS project_subcontractors CASCADE;
DROP TABLE IF EXISTS site_zones CASCADE;
DROP TABLE IF EXISTS site_journal_entries CASCADE;
DROP TABLE IF EXISTS equipment_bookings CASCADE;
DROP TABLE IF EXISTS supply_orders CASCADE;
DROP TABLE IF EXISTS safety_checklist_items CASCADE;
DROP TABLE IF EXISTS worker_qualifications CASCADE;
DROP TABLE IF EXISTS construction_phases CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS virtual_members CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS subtasks CASCADE;
DROP TABLE IF EXISTS tasks CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;

-- =================================================================================
-- ÉTAPE 2: CRÉATION DES TABLES
-- =================================================================================

-- Projects
CREATE TABLE projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'on-hold', 'cancelled')),
  start_date DATE,
  end_date DATE,
  budget DECIMAL(10,2),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tasks
CREATE TABLE tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'review', 'done')),
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assignee_ids TEXT[] DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  start_date DATE,
  end_date DATE,
  due_date DATE,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT date_range_check CHECK (start_date IS NULL OR end_date IS NULL OR start_date <= end_date)
);

-- Subtasks
CREATE TABLE subtasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'todo' CHECK (status IN ('todo', 'in-progress', 'done')),
  assignee_ids TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents
CREATE TABLE documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_name TEXT DEFAULT '',
  name TEXT NOT NULL,
  title TEXT,
  description TEXT,
  url TEXT NOT NULL,
  type TEXT NOT NULL,
  size TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  uploaded_by_name TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- User profiles
CREATE TABLE user_profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  name TEXT,
  color TEXT DEFAULT 'bg-indigo-500',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Virtual members
CREATE TABLE virtual_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  position TEXT DEFAULT '',
  company TEXT DEFAULT '',
  email TEXT DEFAULT '',
  color TEXT DEFAULT 'bg-indigo-500',
  linked_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
  source_favorite_id UUID REFERENCES virtual_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Expenses
CREATE TABLE expenses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  parent_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status TEXT DEFAULT 'Prévu' CHECK (status IN ('Prévu', 'En cours', 'Validé')),
  date DATE NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Budget settings
CREATE TABLE budget_settings (
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  total_budget DECIMAL(10,2) DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Site zones / lots
CREATE TABLE site_zones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_zone_id UUID REFERENCES site_zones(id) ON DELETE SET NULL,
  kind TEXT NOT NULL DEFAULT 'zone' CHECK (kind IN ('zone', 'lot')),
  code TEXT DEFAULT '',
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project subcontractors
CREATE TABLE project_subcontractors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  trade_label TEXT DEFAULT '',
  contact_name TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'on_hold', 'inactive')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Construction phases
CREATE TABLE construction_phases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  progress_percent INT NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
  allocated_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
  spent_budget DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Worker qualifications
CREATE TABLE worker_qualifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worker_name TEXT NOT NULL,
  qualification_name TEXT NOT NULL,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safety checklist
CREATE TABLE safety_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  done BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Supply orders
CREATE TABLE supply_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  material_name TEXT NOT NULL,
  quantity_label TEXT DEFAULT '',
  expected_delivery_date DATE,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ordered', 'received')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Equipment bookings
CREATE TABLE equipment_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  equipment_name TEXT NOT NULL,
  assigned_to_name TEXT DEFAULT '',
  booking_start DATE,
  booking_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Site journal entries
CREATE TABLE site_journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  location_label TEXT DEFAULT '',
  photo_path TEXT DEFAULT '',
  photo_url TEXT DEFAULT '',
  note TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Site incidents / non-conformities
CREATE TABLE site_incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  zone_id UUID REFERENCES site_zones(id) ON DELETE SET NULL,
  subcontractor_id UUID REFERENCES project_subcontractors(id) ON DELETE SET NULL,
  linked_phase_id UUID REFERENCES construction_phases(id) ON DELETE SET NULL,
  incident_type TEXT NOT NULL DEFAULT 'incident' CHECK (incident_type IN ('incident', 'non_conformity', 'observation')),
  severity TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
  occurred_on DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  corrective_action TEXT DEFAULT '',
  owner_name TEXT DEFAULT '',
  due_date DATE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE construction_phases
  ADD COLUMN zone_id UUID REFERENCES site_zones(id) ON DELETE SET NULL,
  ADD COLUMN subcontractor_id UUID REFERENCES project_subcontractors(id) ON DELETE SET NULL;

ALTER TABLE worker_qualifications
  ADD COLUMN subcontractor_id UUID REFERENCES project_subcontractors(id) ON DELETE SET NULL;

ALTER TABLE supply_orders
  ADD COLUMN zone_id UUID REFERENCES site_zones(id) ON DELETE SET NULL,
  ADD COLUMN subcontractor_id UUID REFERENCES project_subcontractors(id) ON DELETE SET NULL;

ALTER TABLE equipment_bookings
  ADD COLUMN zone_id UUID REFERENCES site_zones(id) ON DELETE SET NULL,
  ADD COLUMN subcontractor_id UUID REFERENCES project_subcontractors(id) ON DELETE SET NULL;

ALTER TABLE site_journal_entries
  ADD COLUMN zone_id UUID REFERENCES site_zones(id) ON DELETE SET NULL,
  ADD COLUMN subcontractor_id UUID REFERENCES project_subcontractors(id) ON DELETE SET NULL;

ALTER TABLE tasks
  ADD COLUMN phase_id UUID REFERENCES construction_phases(id) ON DELETE SET NULL;

ALTER TABLE expenses
  ADD COLUMN phase_id UUID REFERENCES construction_phases(id) ON DELETE SET NULL;

-- Saved search filters
CREATE TABLE saved_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  criteria JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Project members
CREATE TABLE project_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'manager', 'member')),
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, user_id)
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'task_assigned',
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity logs
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  changes JSONB NOT NULL DEFAULT '{}',
  old_values JSONB DEFAULT '{}',
  new_values JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Attachments
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size INT NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  related_table TEXT NOT NULL,
  related_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Resource permissions
CREATE TABLE resource_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id UUID NOT NULL,
  resource_type TEXT NOT NULL CHECK (resource_type IN ('task', 'project', 'document')),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level TEXT NOT NULL CHECK (permission_level IN ('view', 'edit', 'admin')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(resource_id, resource_type, user_id)
);

-- Comments
CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  mentions TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Comment reactions
CREATE TABLE comment_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id UUID NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL DEFAULT '👍',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(comment_id, user_id, emoji)
);

-- Task estimations
CREATE TABLE task_estimations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL UNIQUE REFERENCES tasks(id) ON DELETE CASCADE,
  estimated_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  actual_hours DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Time entries
CREATE TABLE time_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hours DECIMAL(10,2) NOT NULL,
  date DATE NOT NULL,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Recurrent tasks
CREATE TABLE recurrent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly')),
  next_occurrence DATE NOT NULL,
  last_generated DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task templates
CREATE TABLE task_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  estimated_hours DECIMAL(10,2),
  template_data JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task dependencies
CREATE TABLE task_dependencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  target_task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  dependency_type TEXT NOT NULL CHECK (dependency_type IN ('finish_to_start', 'start_to_start', 'finish_to_finish', 'start_to_finish')),
  lag_days INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT no_self_dependency CHECK (source_task_id != target_task_id),
  CONSTRAINT unique_task_dependency_link UNIQUE (source_task_id, target_task_id)
);

-- Project baselines
CREATE TABLE project_baselines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  baseline_date TIMESTAMPTZ NOT NULL,
  snapshot JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Team capacity
CREATE TABLE team_capacity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  hours_available DECIMAL(10,2) NOT NULL DEFAULT 40,
  hours_allocated DECIMAL(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, user_id, week_start)
);

-- Risk register
CREATE TABLE risk_register (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  probability TEXT CHECK (probability IN ('very_low', 'low', 'medium', 'high', 'very_high')) DEFAULT 'medium',
  impact TEXT CHECK (impact IN ('very_low', 'low', 'medium', 'high', 'very_high')) DEFAULT 'medium',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT CHECK (status IN ('identified', 'mitigating', 'monitoring', 'resolved')) DEFAULT 'identified',
  mitigation_plan TEXT DEFAULT '',
  contingency_plan TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Document versions
CREATE TABLE document_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  version_number INT NOT NULL,
  status TEXT CHECK (status IN ('draft', 'review', 'approved', 'archived')) DEFAULT 'draft',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  content BYTEA,
  content_url TEXT DEFAULT '',
  signature_required BOOLEAN DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  comments TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(document_id, version_number)
);

-- SLA rules
CREATE TABLE sla_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  condition TEXT NOT NULL CHECK (condition IN ('task_overdue', 'task_blocked', 'budget_exceeded', 'milestone_at_risk')),
  threshold_value INT DEFAULT 0,
  threshold_unit TEXT CHECK (threshold_unit IN ('hours', 'days', 'percent')) DEFAULT 'days',
  action TEXT NOT NULL CHECK (action IN ('notify', 'escalate', 'reassign', 'pause')),
  action_target TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- SLA violations
CREATE TABLE sla_violations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_rule_id UUID NOT NULL REFERENCES sla_rules(id) ON DELETE CASCADE,
  task_id UUID REFERENCES tasks(id) ON DELETE CASCADE,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  status TEXT CHECK (status IN ('open', 'acknowledged', 'resolved')) DEFAULT 'open',
  details JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Portfolio dashboards
CREATE TABLE portfolio_dashboards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  project_filter JSONB NOT NULL DEFAULT '{}',
  view_config JSONB NOT NULL DEFAULT '{}',
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Milestones
CREATE TABLE milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  target_date DATE NOT NULL,
  status TEXT CHECK (status IN ('planned', 'in_progress', 'completed', 'postponed')) DEFAULT 'planned',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  deliverables TEXT[] DEFAULT '{}',
  success_criteria TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Task-milestone mapping
CREATE TABLE task_milestone_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  milestone_id UUID NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(task_id, milestone_id)
);

-- Automation rules
CREATE TABLE automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  trigger_event TEXT NOT NULL CHECK (trigger_event IN ('task_status_change', 'task_assigned', 'comment_added', 'time_logged', 'due_date_reached')),
  trigger_condition JSONB NOT NULL DEFAULT '{}',
  action_type TEXT NOT NULL CHECK (action_type IN ('notify', 'update_status', 'assign', 'add_tag', 'create_task', 'link_document')),
  action_params JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  executions_count INT DEFAULT 0,
  last_executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Decision journal
CREATE TABLE decision_journal (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  context TEXT NOT NULL,
  options_considered TEXT[] NOT NULL DEFAULT '{}',
  decision_made TEXT NOT NULL,
  rationale TEXT DEFAULT '',
  alternative_rejected TEXT DEFAULT '',
  rejection_reason TEXT DEFAULT '',
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  impact_areas TEXT[] DEFAULT '{}',
  risk_level TEXT CHECK (risk_level IN ('low', 'medium', 'high')) DEFAULT 'medium',
  related_tasks UUID[] DEFAULT '{}',
  status TEXT CHECK (status IN ('pending', 'approved', 'implemented', 'reversed')) DEFAULT 'pending',
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =================================================================================
-- ÉTAPE 3: ACTIVATION DE RLS (Row Level Security)
-- =================================================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE virtual_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_subcontractors ENABLE ROW LEVEL SECURITY;
ALTER TABLE construction_phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE worker_qualifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE safety_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE equipment_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE site_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_filters ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE comment_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_estimations ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurrent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_baselines ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_capacity ENABLE ROW LEVEL SECURITY;
ALTER TABLE risk_register ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE sla_violations ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_dashboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_milestone_mapping ENABLE ROW LEVEL SECURITY;
ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE decision_journal ENABLE ROW LEVEL SECURITY;

-- =================================================================================
-- ÉTAPE 4: CRÉER LES FONCTIONS SECURITY DEFINER
-- =================================================================================

CREATE OR REPLACE FUNCTION auth_is_project_member(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM project_members
    WHERE project_id = p_project_id AND user_id = auth.uid()
  );
$$;

CREATE OR REPLACE FUNCTION auth_is_project_owner(p_project_id UUID)
RETURNS BOOLEAN
LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM projects
    WHERE id = p_project_id AND created_by = auth.uid()
  );
$$;

-- =================================================================================
-- ÉTAPE 5: CRÉER LES TRIGGERS
-- =================================================================================

CREATE OR REPLACE FUNCTION add_project_creator_as_owner()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO project_members (project_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER add_creator_as_owner_trigger
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION add_project_creator_as_owner();

CREATE OR REPLACE FUNCTION enforce_task_status_transition()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
  project_id_value UUID;
  is_privileged BOOLEAN := FALSE;
BEGIN
  actor_id := auth.uid();
  project_id_value := COALESCE(NEW.project_id, OLD.project_id);

  IF actor_id IS NULL THEN
    IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
      NEW.completed_at := NOW();
    ELSIF TG_OP = 'UPDATE' AND NEW.status <> 'done' AND OLD.status = 'done' THEN
      NEW.completed_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF project_id_value IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM project_members pm
      WHERE pm.project_id = project_id_value
        AND pm.user_id = actor_id
        AND pm.role IN ('owner', 'admin', 'manager')
    ) INTO is_privileged;
  ELSE
    is_privileged := (
      CASE
        WHEN TG_OP = 'INSERT' THEN NEW.created_by
        ELSE COALESCE(NEW.created_by, OLD.created_by)
      END
    ) = actor_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('todo', 'in-progress', 'review') THEN
      IF NOT (NEW.status = 'done' AND is_privileged) THEN
        RAISE EXCEPTION 'Statut initial invalide: %', NEW.status;
      END IF;
    END IF;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT (
      (OLD.status = 'todo' AND NEW.status = 'in-progress') OR
      (OLD.status = 'in-progress' AND NEW.status IN ('todo', 'review')) OR
      (OLD.status = 'review' AND NEW.status IN ('in-progress', 'done')) OR
      (OLD.status = 'done' AND NEW.status = 'review')
    ) THEN
      RAISE EXCEPTION 'Transition de statut invalide: % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'done' AND NOT is_privileged THEN
      RAISE EXCEPTION 'Seuls owner/admin/manager peuvent passer une tâche à done';
    END IF;
  END IF;

  IF NEW.status = 'done' AND NEW.completed_at IS NULL THEN
    NEW.completed_at := NOW();
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> 'done' AND OLD.status = 'done' THEN
    NEW.completed_at := NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_task_status_transition_trigger
  BEFORE INSERT OR UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_task_status_transition();

CREATE OR REPLACE FUNCTION enforce_task_dependency_no_cycles()
RETURNS TRIGGER AS $$
DECLARE
  source_project_id UUID;
  target_project_id UUID;
  creates_cycle BOOLEAN := FALSE;
BEGIN
  IF NEW.source_task_id = NEW.target_task_id THEN
    RAISE EXCEPTION 'Cycle de dépendance interdit: une tâche ne peut pas dépendre d''elle-même';
  END IF;

  SELECT t.project_id INTO source_project_id
  FROM tasks t
  WHERE t.id = NEW.source_task_id;

  SELECT t.project_id INTO target_project_id
  FROM tasks t
  WHERE t.id = NEW.target_task_id;

  IF source_project_id IS NULL OR target_project_id IS NULL OR source_project_id <> target_project_id THEN
    RAISE EXCEPTION 'Dépendance invalide: source et cible doivent appartenir au même projet';
  END IF;

  WITH RECURSIVE downstream(task_id) AS (
    SELECT td.target_task_id
    FROM task_dependencies td
    WHERE td.source_task_id = NEW.target_task_id
      AND (TG_OP = 'INSERT' OR td.id <> NEW.id)
    UNION
    SELECT td.target_task_id
    FROM task_dependencies td
    INNER JOIN downstream d ON td.source_task_id = d.task_id
    WHERE (TG_OP = 'INSERT' OR td.id <> NEW.id)
  )
  SELECT EXISTS (
    SELECT 1
    FROM downstream
    WHERE task_id = NEW.source_task_id
  ) INTO creates_cycle;

  IF creates_cycle THEN
    RAISE EXCEPTION 'Cycle de dépendance interdit: % -> % crée une boucle', NEW.source_task_id, NEW.target_task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_task_dependency_no_cycles_trigger
  BEFORE INSERT OR UPDATE ON task_dependencies
  FOR EACH ROW EXECUTE FUNCTION enforce_task_dependency_no_cycles();

CREATE OR REPLACE FUNCTION enforce_task_delete_guard()
RETURNS TRIGGER AS $$
DECLARE
  actor_id UUID;
  project_still_exists BOOLEAN := TRUE;
BEGIN
  actor_id := auth.uid();

  IF actor_id IS NULL THEN
    RETURN OLD;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = OLD.project_id
  ) INTO project_still_exists;

  -- Autoriser la cascade quand le projet est supprimé.
  IF NOT project_still_exists THEN
    RETURN OLD;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM tasks child
    WHERE child.parent_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Suppression bloquee: cette tache contient des sous-taches';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM task_dependencies td
    WHERE td.source_task_id = OLD.id
       OR td.target_task_id = OLD.id
  ) THEN
    RAISE EXCEPTION 'Suppression bloquee: retirez d''abord les dependances de la tache';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER enforce_task_delete_guard_trigger
  BEFORE DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION enforce_task_delete_guard();

CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO activity_logs (user_id, action, table_name, record_id, old_values, new_values)
  VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    CASE TG_OP WHEN 'INSERT' THEN 'CREATE' ELSE TG_OP END,
    TG_TABLE_NAME,
    CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END
  );
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER audit_projects AFTER INSERT OR UPDATE OR DELETE ON projects
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_tasks AFTER INSERT OR UPDATE OR DELETE ON tasks
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_documents AFTER INSERT OR UPDATE OR DELETE ON documents
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE OR REPLACE FUNCTION update_task_actual_hours()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE task_estimations
  SET actual_hours = (
    SELECT COALESCE(SUM(hours), 0) FROM time_entries WHERE task_id = COALESCE(NEW.task_id, OLD.task_id)
  ),
  updated_at = NOW()
  WHERE task_id = COALESCE(NEW.task_id, OLD.task_id);
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_actual_hours_on_entry AFTER INSERT OR UPDATE OR DELETE ON time_entries
  FOR EACH ROW EXECUTE FUNCTION update_task_actual_hours();

-- =================================================================================
-- ÉTAPE 5 BIS: DURCISSEMENT DES PRIVILÈGES SUR FONCTIONS CRITIQUES
-- =================================================================================

REVOKE ALL ON FUNCTION auth_is_project_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION auth_is_project_owner(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION add_project_creator_as_owner() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_task_status_transition() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_task_dependency_no_cycles() FROM PUBLIC;
REVOKE ALL ON FUNCTION enforce_task_delete_guard() FROM PUBLIC;
REVOKE ALL ON FUNCTION audit_trigger_function() FROM PUBLIC;
REVOKE ALL ON FUNCTION update_task_actual_hours() FROM PUBLIC;

REVOKE ALL ON FUNCTION auth_is_project_member(UUID) FROM anon;
REVOKE ALL ON FUNCTION auth_is_project_owner(UUID) FROM anon;
REVOKE ALL ON FUNCTION add_project_creator_as_owner() FROM anon;
REVOKE ALL ON FUNCTION enforce_task_status_transition() FROM anon;
REVOKE ALL ON FUNCTION enforce_task_dependency_no_cycles() FROM anon;
REVOKE ALL ON FUNCTION enforce_task_delete_guard() FROM anon;
REVOKE ALL ON FUNCTION audit_trigger_function() FROM anon;
REVOKE ALL ON FUNCTION update_task_actual_hours() FROM anon;

REVOKE ALL ON FUNCTION add_project_creator_as_owner() FROM authenticated;
REVOKE ALL ON FUNCTION enforce_task_status_transition() FROM authenticated;
REVOKE ALL ON FUNCTION enforce_task_dependency_no_cycles() FROM authenticated;
REVOKE ALL ON FUNCTION enforce_task_delete_guard() FROM authenticated;
REVOKE ALL ON FUNCTION audit_trigger_function() FROM authenticated;
REVOKE ALL ON FUNCTION update_task_actual_hours() FROM authenticated;

GRANT EXECUTE ON FUNCTION auth_is_project_member(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth_is_project_owner(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION add_project_creator_as_owner() TO service_role;
GRANT EXECUTE ON FUNCTION enforce_task_status_transition() TO service_role;
GRANT EXECUTE ON FUNCTION enforce_task_dependency_no_cycles() TO service_role;
GRANT EXECUTE ON FUNCTION enforce_task_delete_guard() TO service_role;
GRANT EXECUTE ON FUNCTION audit_trigger_function() TO service_role;
GRANT EXECUTE ON FUNCTION update_task_actual_hours() TO service_role;

-- =================================================================================
-- ÉTAPE 6: CRÉER LES INDEX POUR PERFORMANCE
-- =================================================================================

CREATE INDEX IF NOT EXISTS tasks_project_id_idx ON tasks(project_id);
CREATE INDEX IF NOT EXISTS tasks_phase_id_idx ON tasks(phase_id);
CREATE INDEX IF NOT EXISTS tasks_parent_id_idx ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS tasks_status_idx ON tasks(status);
CREATE INDEX IF NOT EXISTS tasks_end_date_idx ON tasks(end_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS tasks_project_status_idx ON tasks(project_id, status);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON notifications(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS expenses_project_id_idx ON expenses(project_id);
CREATE INDEX IF NOT EXISTS expenses_phase_id_idx ON expenses(phase_id);
CREATE INDEX IF NOT EXISTS virtual_members_created_by_idx ON virtual_members(created_by, is_favorite, created_at DESC);
CREATE INDEX IF NOT EXISTS virtual_members_project_id_idx ON virtual_members(project_id, created_at DESC) WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS virtual_members_email_idx ON virtual_members(email) WHERE email <> '';
CREATE INDEX IF NOT EXISTS virtual_members_linked_user_idx ON virtual_members(linked_user_id) WHERE linked_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS site_zones_project_idx ON site_zones(project_id, kind, code);
CREATE INDEX IF NOT EXISTS project_subcontractors_project_idx ON project_subcontractors(project_id, status, trade_label);
CREATE INDEX IF NOT EXISTS construction_phases_project_idx ON construction_phases(project_id, start_date);
CREATE INDEX IF NOT EXISTS worker_qualifications_project_idx ON worker_qualifications(project_id, expiry_date);
CREATE INDEX IF NOT EXISTS safety_checklist_project_idx ON safety_checklist_items(project_id, sort_order);
CREATE INDEX IF NOT EXISTS supply_orders_project_idx ON supply_orders(project_id, expected_delivery_date);
CREATE INDEX IF NOT EXISTS equipment_bookings_project_idx ON equipment_bookings(project_id, booking_start);
CREATE INDEX IF NOT EXISTS site_journal_entries_project_idx ON site_journal_entries(project_id, entry_date DESC);
CREATE INDEX IF NOT EXISTS site_incidents_project_idx ON site_incidents(project_id, status, severity, due_date);
CREATE INDEX IF NOT EXISTS site_incidents_zone_idx ON site_incidents(zone_id);
CREATE INDEX IF NOT EXISTS site_incidents_subcontractor_idx ON site_incidents(subcontractor_id);
CREATE INDEX IF NOT EXISTS saved_filters_user_id_idx ON saved_filters(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_user_idx ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS activity_logs_table_record_idx ON activity_logs(table_name, record_id, created_at DESC);
CREATE INDEX IF NOT EXISTS attachments_related_idx ON attachments(related_table, related_id);
CREATE INDEX IF NOT EXISTS attachments_uploader_idx ON attachments(uploaded_by);
CREATE INDEX IF NOT EXISTS resource_permissions_resource_idx ON resource_permissions(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS resource_permissions_user_idx ON resource_permissions(user_id);
CREATE INDEX IF NOT EXISTS resource_permissions_expires_idx ON resource_permissions(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS comments_task_id_idx ON comments(task_id, created_at DESC);
CREATE INDEX IF NOT EXISTS comments_author_idx ON comments(author_id);
CREATE INDEX IF NOT EXISTS time_entries_task_id_idx ON time_entries(task_id);
CREATE INDEX IF NOT EXISTS time_entries_user_idx ON time_entries(user_id, date DESC);
CREATE INDEX IF NOT EXISTS time_entries_date_idx ON time_entries(date DESC);
CREATE INDEX IF NOT EXISTS recurrent_tasks_next_occurrence_idx ON recurrent_tasks(next_occurrence);
CREATE INDEX IF NOT EXISTS task_templates_project_idx ON task_templates(project_id);
CREATE INDEX IF NOT EXISTS task_templates_creator_idx ON task_templates(created_by);
CREATE INDEX IF NOT EXISTS task_dependencies_source_idx ON task_dependencies(source_task_id);
CREATE INDEX IF NOT EXISTS task_dependencies_target_idx ON task_dependencies(target_task_id);
CREATE INDEX IF NOT EXISTS project_baselines_project_idx ON project_baselines(project_id);
CREATE INDEX IF NOT EXISTS project_baselines_date_idx ON project_baselines(baseline_date DESC);
CREATE INDEX IF NOT EXISTS team_capacity_project_user_idx ON team_capacity(project_id, user_id, week_start DESC);
CREATE INDEX IF NOT EXISTS risk_register_project_idx ON risk_register(project_id);
CREATE INDEX IF NOT EXISTS risk_register_status_idx ON risk_register(status);
CREATE INDEX IF NOT EXISTS risk_register_owner_idx ON risk_register(owner_id);
CREATE INDEX IF NOT EXISTS document_versions_document_idx ON document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS document_versions_status_idx ON document_versions(status);
CREATE INDEX IF NOT EXISTS sla_rules_project_idx ON sla_rules(project_id);
CREATE INDEX IF NOT EXISTS sla_rules_condition_idx ON sla_rules(condition);
CREATE INDEX IF NOT EXISTS sla_violations_rule_idx ON sla_violations(sla_rule_id, detected_at DESC);
CREATE INDEX IF NOT EXISTS portfolio_dashboards_creator_idx ON portfolio_dashboards(created_by);
CREATE INDEX IF NOT EXISTS milestones_project_idx ON milestones(project_id);
CREATE INDEX IF NOT EXISTS milestones_target_date_idx ON milestones(target_date);
CREATE INDEX IF NOT EXISTS milestones_status_idx ON milestones(status);
CREATE INDEX IF NOT EXISTS task_milestone_mapping_milestone_idx ON task_milestone_mapping(milestone_id);
CREATE INDEX IF NOT EXISTS automation_rules_project_idx ON automation_rules(project_id);
CREATE INDEX IF NOT EXISTS automation_rules_trigger_event_idx ON automation_rules(trigger_event);
CREATE INDEX IF NOT EXISTS decision_journal_project_idx ON decision_journal(project_id);
CREATE INDEX IF NOT EXISTS decision_journal_status_idx ON decision_journal(status);
CREATE INDEX IF NOT EXISTS decision_journal_owner_idx ON decision_journal(owner_id);
CREATE INDEX IF NOT EXISTS decision_journal_created_date_idx ON decision_journal(created_at DESC);

-- =================================================================================
-- ÉTAPE 7: CRÉER LES POLICIES
-- =================================================================================

-- ===================== PROJECTS =====================
CREATE POLICY "Users can create projects" ON projects
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can delete projects they own" ON projects
FOR DELETE USING (auth.uid() = created_by);

CREATE POLICY "Users can view projects they are members of or own" ON projects
FOR SELECT USING (
  auth.uid() = created_by
  OR auth_is_project_member(id)
);

CREATE POLICY "Users can update projects they own or manage" ON projects
FOR UPDATE USING (
  auth.uid() = created_by
  OR auth_is_project_member(id)
);

-- ===================== TASKS =====================
CREATE POLICY "Users can view tasks" ON tasks
FOR SELECT USING (
  auth.uid() = created_by OR
  (
    project_id IS NOT NULL AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can create tasks" ON tasks
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update tasks" ON tasks
FOR UPDATE USING (
  auth.uid() = created_by OR
  (
    project_id IS NOT NULL AND (
      auth.uid() = assigned_to OR
      auth_is_project_owner(project_id) OR
      auth_is_project_member(project_id)
    )
  )
);

CREATE POLICY "Users can delete tasks" ON tasks
FOR DELETE USING (
  auth.uid() = created_by OR
  (
    project_id IS NOT NULL AND (
      auth_is_project_owner(project_id) OR
      auth_is_project_member(project_id)
    )
  )
);

-- ===================== SUBTASKS =====================
CREATE POLICY "Users can view subtasks" ON subtasks
FOR SELECT USING (
  auth.uid() IN (SELECT created_by FROM tasks WHERE id = subtasks.task_id)
);

CREATE POLICY "Users can manage subtasks" ON subtasks
FOR ALL USING (
  auth.uid() IN (SELECT created_by FROM tasks WHERE id = subtasks.task_id)
);

-- ===================== DOCUMENTS =====================
CREATE POLICY "Users can view their documents" ON documents
FOR SELECT USING (
  auth.uid() = uploaded_by OR
  (
    project_id IS NOT NULL AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can upload documents" ON documents
FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their documents" ON documents
FOR DELETE USING (
  auth.uid() = uploaded_by OR
  (
    project_id IS NOT NULL AND (
      auth_is_project_owner(project_id) OR
      auth_is_project_member(project_id)
    )
  )
);

-- ===================== USER_PROFILES =====================
CREATE POLICY "Profiles are viewable by all authenticated users" ON user_profiles
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert their own profile" ON user_profiles
FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON user_profiles
FOR UPDATE USING (auth.uid() = id);

-- ===================== VIRTUAL_MEMBERS =====================
CREATE POLICY "Users can view their virtual members" ON virtual_members
FOR SELECT USING (
  auth.uid() = created_by
  OR (
    project_id IS NOT NULL AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can create virtual members" ON virtual_members
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    (project_id IS NULL AND is_favorite = TRUE)
    OR (
      project_id IS NOT NULL AND (
        auth_is_project_member(project_id) OR
        auth_is_project_owner(project_id)
      )
    )
  )
);

CREATE POLICY "Users can update their virtual members" ON virtual_members
FOR UPDATE USING (
  auth.uid() = created_by
  OR (
    project_id IS NOT NULL AND auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can delete their virtual members" ON virtual_members
FOR DELETE USING (
  auth.uid() = created_by
  OR (
    project_id IS NOT NULL AND auth_is_project_owner(project_id)
  )
);

-- ===================== EXPENSES =====================
CREATE POLICY "Users can view their expenses" ON expenses
FOR SELECT USING (
  auth.uid() = created_by OR
  (
    project_id IS NOT NULL AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can create expenses" ON expenses
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND
  (
    project_id IS NULL OR
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update their expenses" ON expenses
FOR UPDATE USING (
  auth.uid() = created_by OR
  (
    project_id IS NOT NULL AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can delete their expenses" ON expenses
FOR DELETE USING (
  auth.uid() = created_by OR
  (
    project_id IS NOT NULL AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

-- ===================== BUDGET_SETTINGS =====================
CREATE POLICY "Users can manage their budget settings" ON budget_settings
FOR ALL USING (auth.uid() = user_id);

-- ===================== SITE_ZONES =====================
CREATE POLICY "Users can view site zones" ON site_zones
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create site zones" ON site_zones
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update site zones" ON site_zones
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can delete site zones" ON site_zones
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== PROJECT_SUBCONTRACTORS =====================
CREATE POLICY "Users can view subcontractors" ON project_subcontractors
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create subcontractors" ON project_subcontractors
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update subcontractors" ON project_subcontractors
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can delete subcontractors" ON project_subcontractors
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== SAVED_FILTERS =====================
CREATE POLICY "Users can view their saved filters" ON saved_filters
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create saved filters" ON saved_filters
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their saved filters" ON saved_filters
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their saved filters" ON saved_filters
FOR DELETE USING (auth.uid() = user_id);

-- ===================== CONSTRUCTION_PHASES =====================
CREATE POLICY "Users can view construction phases" ON construction_phases
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create construction phases" ON construction_phases
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update construction phases" ON construction_phases
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can delete construction phases" ON construction_phases
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== WORKER_QUALIFICATIONS =====================
CREATE POLICY "Users can view worker qualifications" ON worker_qualifications
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create worker qualifications" ON worker_qualifications
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can delete worker qualifications" ON worker_qualifications
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== SAFETY_CHECKLIST_ITEMS =====================
CREATE POLICY "Users can view safety checklist items" ON safety_checklist_items
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create safety checklist items" ON safety_checklist_items
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update safety checklist items" ON safety_checklist_items
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can delete safety checklist items" ON safety_checklist_items
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== SUPPLY_ORDERS =====================
CREATE POLICY "Users can view supply orders" ON supply_orders
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create supply orders" ON supply_orders
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update supply orders" ON supply_orders
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can delete supply orders" ON supply_orders
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== EQUIPMENT_BOOKINGS =====================
CREATE POLICY "Users can view equipment bookings" ON equipment_bookings
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create equipment bookings" ON equipment_bookings
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update equipment bookings" ON equipment_bookings
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can delete equipment bookings" ON equipment_bookings
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== SITE_JOURNAL_ENTRIES =====================
CREATE POLICY "Users can view site journal entries" ON site_journal_entries
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create site journal entries" ON site_journal_entries
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update site journal entries" ON site_journal_entries
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can delete site journal entries" ON site_journal_entries
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== SITE_INCIDENTS =====================
CREATE POLICY "Users can view site incidents" ON site_incidents
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create site incidents" ON site_incidents
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can update site incidents" ON site_incidents
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can delete site incidents" ON site_incidents
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== PROJECT_MEMBERS =====================
CREATE POLICY "Users can view members of their projects" ON project_members
FOR SELECT USING (
  auth.uid() = user_id
  OR auth_is_project_member(project_id)
  OR auth_is_project_owner(project_id)
);

CREATE POLICY "Users can add members to projects they manage" ON project_members
FOR INSERT WITH CHECK (
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can update member roles they manage" ON project_members
FOR UPDATE USING (
  auth.uid() != user_id AND auth_is_project_owner(project_id)
);

CREATE POLICY "Users can remove members they manage" ON project_members
FOR DELETE USING (
  auth.uid() != user_id AND auth_is_project_owner(project_id)
);

-- ===================== NOTIFICATIONS =====================
CREATE POLICY "Users can view their notifications" ON notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can create notifications" ON notifications
FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update their notifications" ON notifications
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their notifications" ON notifications
FOR DELETE USING (auth.uid() = user_id);

-- ===================== ACTIVITY_LOGS =====================
CREATE POLICY "Users can view activity logs of accessible resources" ON activity_logs
FOR SELECT USING (
  auth.uid() = user_id OR
  (table_name = 'projects' AND (
    EXISTS (SELECT 1 FROM projects WHERE id = record_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM projects WHERE id = record_id AND auth_is_project_member(id))
  )) OR
  (table_name = 'tasks' AND (
    EXISTS (SELECT 1 FROM tasks WHERE id = record_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM tasks t WHERE t.id = record_id AND (
      t.assigned_to = auth.uid() OR
      auth_is_project_member(t.project_id) OR
      auth_is_project_owner(t.project_id)
    ))
  ))
);

-- ===================== ATTACHMENTS =====================
CREATE POLICY "Users can view attachments of accessible resources" ON attachments
FOR SELECT USING (
  auth.uid() = uploaded_by OR
  (related_table = 'tasks' AND EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = related_id AND (
      auth.uid() = t.created_by OR
      auth.uid() = t.assigned_to OR
      auth_is_project_member(t.project_id) OR
      auth_is_project_owner(t.project_id)
    )
  )) OR
  (related_table = 'expenses' AND EXISTS (
    SELECT 1 FROM expenses e WHERE e.id = related_id AND (
      auth.uid() = e.created_by OR
      auth_is_project_member(e.project_id) OR
      auth_is_project_owner(e.project_id)
    )
  )) OR
  (related_table = 'projects' AND EXISTS (
    SELECT 1 FROM projects p WHERE p.id = related_id AND (
      auth.uid() = p.created_by OR
      auth_is_project_member(p.id) OR
      auth_is_project_owner(p.id)
    )
  ))
);

CREATE POLICY "Authenticated users can upload attachments" ON attachments
FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

CREATE POLICY "Users can delete their attachments" ON attachments
FOR DELETE USING (auth.uid() = uploaded_by);

-- ===================== RESOURCE_PERMISSIONS =====================
CREATE POLICY "Users can view permissions on their resources" ON resource_permissions
FOR SELECT USING (
  auth.uid() = granted_by OR
  (resource_type = 'project' AND auth_is_project_owner(resource_id)) OR
  (resource_type = 'task' AND EXISTS (
    SELECT 1 FROM tasks WHERE id = resource_id AND created_by = auth.uid()
  ))
);

CREATE POLICY "Resource owners can grant permissions" ON resource_permissions
FOR INSERT WITH CHECK (
  (resource_type = 'project' AND auth_is_project_owner(resource_id)) OR
  (resource_type = 'task' AND EXISTS (
    SELECT 1 FROM tasks WHERE id = resource_id AND created_by = auth.uid()
  ))
);

CREATE POLICY "Resource owners can modify permissions" ON resource_permissions
FOR UPDATE USING (
  auth.uid() = granted_by OR
  (resource_type = 'project' AND auth_is_project_owner(resource_id))
);

CREATE POLICY "Resource owners can revoke permissions" ON resource_permissions
FOR DELETE USING (
  auth.uid() = granted_by OR
  (resource_type = 'project' AND auth_is_project_owner(resource_id))
);

-- ===================== COMMENTS =====================
CREATE POLICY "Users can view comments on accessible tasks" ON comments
FOR SELECT USING (
  auth.uid() = author_id OR EXISTS (
    SELECT 1 FROM tasks WHERE id = comments.task_id AND (
      auth.uid() = created_by OR
      auth.uid() = assigned_to OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can create comments" ON comments
FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update their comments" ON comments
FOR UPDATE USING (auth.uid() = author_id);

CREATE POLICY "Users can delete their comments" ON comments
FOR DELETE USING (auth.uid() = author_id);

-- ===================== COMMENT_REACTIONS =====================
CREATE POLICY "Users can view comment reactions" ON comment_reactions
FOR SELECT USING (true);

CREATE POLICY "Users can add reactions" ON comment_reactions
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their reactions" ON comment_reactions
FOR DELETE USING (auth.uid() = user_id);

-- ===================== TASK_ESTIMATIONS =====================
CREATE POLICY "Users can view estimations of accessible tasks" ON task_estimations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = task_estimations.task_id AND (
      auth.uid() = created_by OR
      auth.uid() = assigned_to OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Task owners can manage estimations" ON task_estimations
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = task_estimations.task_id AND (
      auth.uid() = created_by OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Task owners can update estimations" ON task_estimations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = task_estimations.task_id AND (
      auth.uid() = created_by OR
      auth_is_project_owner(project_id)
    )
  )
);

-- ===================== TIME_ENTRIES =====================
CREATE POLICY "Users can view time entries of accessible tasks" ON time_entries
FOR SELECT USING (
  auth.uid() = user_id OR
  EXISTS (
    SELECT 1 FROM tasks WHERE id = time_entries.task_id AND (
      auth.uid() = created_by OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can log their time" ON time_entries
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can modify their time entries" ON time_entries
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their time entries" ON time_entries
FOR DELETE USING (auth.uid() = user_id);

-- ===================== RECURRENT_TASKS =====================
CREATE POLICY "Users can view recurrent tasks" ON recurrent_tasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = recurrent_tasks.template_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id)
    )
  )
);

CREATE POLICY "Task owners can manage recurrence" ON recurrent_tasks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = recurrent_tasks.template_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_owner(project_id)
    )
  )
);

-- ===================== TASK_TEMPLATES =====================
CREATE POLICY "Users can view templates" ON task_templates
FOR SELECT USING (
  project_id IS NULL OR (
    auth.uid() = created_by OR
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Users can create templates" ON task_templates
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    project_id IS NULL OR
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Template creators can update" ON task_templates
FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Template creators can delete" ON task_templates
FOR DELETE USING (auth.uid() = created_by);

-- ===================== TASK_DEPENDENCIES =====================
CREATE POLICY "Users can view dependencies of accessible tasks" ON task_dependencies
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE (
      (id = source_task_id OR id = target_task_id) AND (
        auth.uid() = created_by OR
        auth.uid() = assigned_to OR
        auth_is_project_member(project_id) OR
        auth_is_project_owner(project_id)
      )
    )
  )
);

CREATE POLICY "Users can create dependencies" ON task_dependencies
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = source_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
  AND EXISTS (
    SELECT 1 FROM tasks WHERE id = target_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can update dependencies" ON task_dependencies
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = source_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = source_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
  AND EXISTS (
    SELECT 1 FROM tasks WHERE id = target_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can delete dependencies" ON task_dependencies
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = source_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

-- ===================== PROJECT_BASELINES =====================
CREATE POLICY "Users can view project baselines" ON project_baselines
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create baselines" ON project_baselines
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Project owners can manage baselines" ON project_baselines
FOR UPDATE USING (auth_is_project_owner(project_id));

-- ===================== TEAM_CAPACITY =====================
CREATE POLICY "Users can view team capacity" ON team_capacity
FOR SELECT USING (
  auth.uid() = user_id OR
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can manage their capacity" ON team_capacity
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update capacity" ON team_capacity
FOR UPDATE USING (
  auth.uid() = user_id OR
  auth_is_project_owner(project_id)
);

-- ===================== RISK_REGISTER =====================
CREATE POLICY "Users can view project risks" ON risk_register
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Users can create risks" ON risk_register
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Risk owners can update" ON risk_register
FOR UPDATE USING (
  auth.uid() = owner_id OR
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== DOCUMENT_VERSIONS =====================
CREATE POLICY "Users can view document versions" ON document_versions
FOR SELECT USING (
  auth.uid() = created_by OR
  EXISTS (
    SELECT 1 FROM documents WHERE id = document_id AND (
      auth.uid() = uploaded_by OR
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Users can create versions" ON document_versions
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Reviewers can update versions" ON document_versions
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth.uid() = reviewed_by
);

-- ===================== SLA_RULES =====================
CREATE POLICY "Users can view SLA rules" ON sla_rules
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Project owners can manage SLA rules" ON sla_rules
FOR INSERT WITH CHECK (auth_is_project_owner(project_id));

CREATE POLICY "Project owners can update rules" ON sla_rules
FOR UPDATE USING (auth_is_project_owner(project_id));

-- ===================== SLA_VIOLATIONS =====================
CREATE POLICY "Users can view SLA violations" ON sla_violations
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM sla_rules WHERE id = sla_rule_id AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

-- ===================== PORTFOLIO_DASHBOARDS =====================
CREATE POLICY "Users can view their dashboards" ON portfolio_dashboards
FOR SELECT USING (
  auth.uid() = created_by OR
  is_public
);

CREATE POLICY "Users can create dashboards" ON portfolio_dashboards
FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Creators can manage dashboards" ON portfolio_dashboards
FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete dashboards" ON portfolio_dashboards
FOR DELETE USING (auth.uid() = created_by);

-- ===================== MILESTONES =====================
CREATE POLICY "Users can view milestones" ON milestones
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Project members can create milestones" ON milestones
FOR INSERT WITH CHECK (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Owners can manage milestones" ON milestones
FOR UPDATE USING (
  auth.uid() = owner_id OR
  auth_is_project_owner(project_id)
);

-- ===================== TASK_MILESTONE_MAPPING =====================
-- No RLS needed, inherits from tasks and milestones

-- ===================== AUTOMATION_RULES =====================
CREATE POLICY "Users can view automation rules" ON automation_rules
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Project owners can manage automation rules" ON automation_rules
FOR INSERT WITH CHECK (auth_is_project_owner(project_id));

CREATE POLICY "Creators can update rules" ON automation_rules
FOR UPDATE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- ===================== DECISION_JOURNAL =====================
CREATE POLICY "Users can view decisions" ON decision_journal
FOR SELECT USING (
  auth_is_project_member(project_id) OR
  auth_is_project_owner(project_id)
);

CREATE POLICY "Team members can create decisions" ON decision_journal
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

CREATE POLICY "Owners can approve decisions" ON decision_journal
FOR UPDATE USING (
  auth.uid() = owner_id OR
  auth_is_project_owner(project_id)
);

-- =================================================================================
-- PATCH 2025-04: CORRECTIONS RLS + SCHEMA
-- =================================================================================

-- ── 1. INDEX GIN sur tasks(assignee_ids) pour le filtre .cs.{} ──────────────
CREATE INDEX IF NOT EXISTS tasks_assignee_ids_gin_idx ON tasks USING GIN (assignee_ids);

-- ── 2. task_milestone_mapping : aucune policy n'existait → DENY ALL ──────────
-- RLS est activé sur cette table mais aucune policy n'était définie.
CREATE POLICY "Members can view milestone mappings" ON task_milestone_mapping
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM milestones WHERE id = task_milestone_mapping.milestone_id AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Members can add milestone mappings" ON task_milestone_mapping
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM milestones WHERE id = task_milestone_mapping.milestone_id AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Members can remove milestone mappings" ON task_milestone_mapping
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM milestones WHERE id = task_milestone_mapping.milestone_id AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

-- ── 3. recurrent_tasks : UPDATE manquant ────────────────────────────────────
CREATE POLICY "Task owners can update recurrence" ON recurrent_tasks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = recurrent_tasks.template_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Task owners can delete recurrence" ON recurrent_tasks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tasks WHERE id = recurrent_tasks.template_task_id AND (
      auth.uid() = created_by OR
      auth_is_project_owner(project_id)
    )
  )
);

-- ── 4. automation_rules : DELETE manquant ───────────────────────────────────
CREATE POLICY "Creators can delete automation rules" ON automation_rules
FOR DELETE USING (
  auth.uid() = created_by OR
  auth_is_project_owner(project_id)
);

-- Fix : INSERT devrait aussi être accessible aux membres (pas seulement owner)
DROP POLICY IF EXISTS "Project owners can manage automation rules" ON automation_rules;
CREATE POLICY "Project members can create automation rules" ON automation_rules
FOR INSERT WITH CHECK (
  auth.uid() = created_by AND (
    auth_is_project_member(project_id) OR
    auth_is_project_owner(project_id)
  )
);

-- ── 5. risk_register : DELETE manquant ──────────────────────────────────────
CREATE POLICY "Users can delete risks" ON risk_register
FOR DELETE USING (
  auth.uid() = created_by OR
  auth.uid() = owner_id OR
  auth_is_project_owner(project_id)
);

-- ── 6. milestones : DELETE manquant ─────────────────────────────────────────
CREATE POLICY "Project owners can delete milestones" ON milestones
FOR DELETE USING (
  auth.uid() = owner_id OR
  auth_is_project_owner(project_id)
);

-- ── 7. sla_rules : DELETE manquant ──────────────────────────────────────────
CREATE POLICY "Project owners can delete SLA rules" ON sla_rules
FOR DELETE USING (auth_is_project_owner(project_id));

-- ── 8. sla_violations : INSERT + UPDATE manquants ───────────────────────────
-- slaAlerts.ts insère des violations et les met à jour (résolution)
CREATE POLICY "Authenticated users can create SLA violations" ON sla_violations
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated' AND
  EXISTS (
    SELECT 1 FROM sla_rules WHERE id = sla_violations.sla_rule_id AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

CREATE POLICY "Project members can resolve violations" ON sla_violations
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM sla_rules WHERE id = sla_violations.sla_rule_id AND (
      auth_is_project_member(project_id) OR
      auth_is_project_owner(project_id)
    )
  )
);

-- ── 9. subtasks : policies trop restrictives ────────────────────────────────
-- Avant : seul task.created_by pouvait voir les sous-tâches
-- Après : tous les membres du projet de la tâche parente peuvent les voir
DROP POLICY IF EXISTS "Users can view subtasks" ON subtasks;
DROP POLICY IF EXISTS "Users can manage subtasks" ON subtasks;

CREATE POLICY "Project members can view subtasks" ON subtasks
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = subtasks.task_id AND (
      auth.uid() = t.created_by OR
      auth_is_project_member(t.project_id) OR
      auth_is_project_owner(t.project_id) OR
      t.project_id IS NULL AND auth.uid() = ANY(t.assignee_ids::uuid[])
    )
  )
);

CREATE POLICY "Task creators and members can manage subtasks" ON subtasks
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = subtasks.task_id AND (
      auth.uid() = t.created_by OR
      auth_is_project_member(t.project_id) OR
      auth_is_project_owner(t.project_id)
    )
  )
);

CREATE POLICY "Task creators can update subtasks" ON subtasks
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = subtasks.task_id AND (
      auth.uid() = t.created_by OR
      auth_is_project_member(t.project_id) OR
      auth_is_project_owner(t.project_id)
    )
  )
);

CREATE POLICY "Task creators can delete subtasks" ON subtasks
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM tasks t WHERE t.id = subtasks.task_id AND (
      auth.uid() = t.created_by OR
      auth_is_project_member(t.project_id) OR
      auth_is_project_owner(t.project_id)
    )
  )
);

-- ── 10. project_baselines : DELETE manquant ─────────────────────────────────
CREATE POLICY "Project owners can delete baselines" ON project_baselines
FOR DELETE USING (auth_is_project_owner(project_id));

-- =================================================================================
-- PATCH 2025-04-B: NOTIFICATION PREFERENCES
-- =================================================================================

-- Préférence de notification par utilisateur
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS notify_in_app BOOLEAN NOT NULL DEFAULT TRUE;

-- =================================================================================
-- PATCH 2025-04-C: PROJECT INVITATIONS
-- =================================================================================

CREATE TABLE IF NOT EXISTS project_invitations (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member',
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at      TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE project_invitations ENABLE ROW LEVEL SECURITY;

-- Lecture publique (nécessaire pour que le visiteur puisse lire son token)
CREATE POLICY "invitations_select" ON project_invitations
  FOR SELECT USING (true);

-- Insertion par membres admin/manager/owner
CREATE POLICY "invitations_insert" ON project_invitations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM project_members
      WHERE project_id = project_invitations.project_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin', 'manager')
    )
  );

-- Mise à jour (used_at) par n'importe quel utilisateur authentifié
CREATE POLICY "invitations_update" ON project_invitations
  FOR UPDATE USING (auth.uid() IS NOT NULL);

-- =================================================================================
-- PATCH 2025-04-D: OKR — OBJECTIVES & KEY RESULTS
-- =================================================================================

CREATE TABLE IF NOT EXISTS objectives (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  due_date    DATE,
  status      TEXT NOT NULL DEFAULT 'on-track'
    CHECK (status IN ('on-track','at-risk','off-track','completed')),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS key_results (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id  UUID NOT NULL REFERENCES objectives(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  target        FLOAT NOT NULL DEFAULT 100,
  current       FLOAT NOT NULL DEFAULT 0,
  unit          TEXT NOT NULL DEFAULT '%',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE objectives  ENABLE ROW LEVEL SECURITY;
ALTER TABLE key_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "objectives_project_members" ON objectives
  FOR ALL USING (
    EXISTS (SELECT 1 FROM project_members WHERE project_id = objectives.project_id AND user_id = auth.uid())
  );

CREATE POLICY "key_results_via_objectives" ON key_results
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM objectives o
      JOIN project_members pm ON pm.project_id = o.project_id
      WHERE o.id = key_results.objective_id AND pm.user_id = auth.uid()
    )
  );

-- =================================================================================
-- STORAGE (SUPABASE)
-- ================================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'documents',
  'documents',
  TRUE,
  52428800,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_insert" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_update" ON storage.objects;
DROP POLICY IF EXISTS "documents_storage_delete" ON storage.objects;

CREATE POLICY "documents_storage_select" ON storage.objects
FOR SELECT
USING (bucket_id = 'documents');

CREATE POLICY "documents_storage_insert" ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "documents_storage_update" ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "documents_storage_delete" ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'documents'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- =================================================================================
-- COMPLETION
-- ================================================================================

SELECT 'Database reset and setup completed successfully' AS status;
