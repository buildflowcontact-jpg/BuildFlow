// ===========================================
// SLA & Auto-Alerts - Service Level Agreements & Automation
// ===========================================

import { supabase } from './supabase';

export type AlertCondition = 'task_overdue' | 'task_blocked' | 'budget_exceeded' | 'milestone_at_risk';
export type AlertAction = 'notify' | 'escalate' | 'reassign' | 'pause';
export type AlertUnit = 'hours' | 'days' | 'percent';
export type ViolationStatus = 'open' | 'acknowledged' | 'resolved';

export interface SLARule {
  id: string;
  project_id: string;
  created_by: string;
  name: string;
  condition: AlertCondition;
  threshold_value: number;
  threshold_unit: AlertUnit;
  action: AlertAction;
  action_target: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SLAViolation {
  id: string;
  sla_rule_id: string;
  task_id: string | null;
  detected_at: string;
  resolved_at: string | null;
  status: ViolationStatus;
  details: Record<string, unknown>;
  created_at: string;
}

// Créer une règle SLA
export async function createSLARule(
  projectId: string,
  name: string,
  condition: AlertCondition,
  thresholdValue: number,
  thresholdUnit: AlertUnit,
  action: AlertAction
): Promise<SLARule | null> {
  const { data, error } = await supabase
    .from('sla_rules')
    .insert({
      project_id: projectId,
      name,
      condition,
      threshold_value: thresholdValue,
      threshold_unit: thresholdUnit,
      action,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating SLA rule:', error);
    return null;
  }

  return data;
}

// Récupérer les règles SLA d'un projet
export async function getProjectSLARules(projectId: string): Promise<SLARule[]> {
  const { data, error } = await supabase
    .from('sla_rules')
    .select('*')
    .eq('project_id', projectId)
    .eq('is_active', true);

  if (error) {
    console.error('Error fetching SLA rules:', error);
    return [];
  }

  return data || [];
}

// Vérifier les violations SLA pour les tâches en retard
export async function checkTaskOverdueViolations(projectId: string): Promise<SLAViolation[]> {
  const rules = await getProjectSLARules(projectId);
  const overdueRules = rules.filter(r => r.condition === 'task_overdue');

  if (overdueRules.length === 0) return [];

  const violations: SLAViolation[] = [];

  for (const rule of overdueRules) {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, due_date')
      .eq('project_id', projectId)
      .eq('status', 'in-progress');

    const now = new Date();

    for (const task of tasks || []) {
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (rule.threshold_unit === 'days' && daysOverdue >= rule.threshold_value) {
          const existing = await getExistingViolation(rule.id, task.id);

          if (!existing) {
            const { data: violation } = await supabase
              .from('sla_violations')
              .insert({
                sla_rule_id: rule.id,
                task_id: task.id,
                detected_at: new Date().toISOString(),
                status: 'open',
                details: {
                  task_title: task.title,
                  days_overdue: daysOverdue,
                  threshold: rule.threshold_value,
                },
              })
              .select()
              .single();

            if (violation) {
              violations.push(violation);
              await executeAlertAction(rule, task.id);
            }
          }
        }
      }
    }
  }

  return violations;
}

// Récupérer une violation existante
async function getExistingViolation(ruleId: string, taskId: string): Promise<SLAViolation | null> {
  const { data, error } = await supabase
    .from('sla_violations')
    .select('*')
    .eq('sla_rule_id', ruleId)
    .eq('task_id', taskId)
    .eq('status', 'open')
    .maybeSingle();

  return error ? null : data;
}

// Exécuter l'action d'alerte
async function executeAlertAction(rule: SLARule, taskId: string): Promise<void> {
  if (rule.action === 'notify') {
    // Créer une notification
    const { data: task } = await supabase
      .from('tasks')
      .select('created_by, assigned_to, assignee_ids')
      .eq('id', taskId)
      .single();

    if (task) {
      const firstAssignee = Array.isArray(task.assignee_ids) ? task.assignee_ids[0] : null;
      const recipientId = firstAssignee || task.assigned_to || task.created_by;
      if (recipientId) {
        await supabase.from('notifications').insert({
          user_id: recipientId,
          type: 'sla_violation',
          title: `SLA Alert: ${rule.name}`,
          body: `Task is violating SLA rule: ${rule.name}`,
          task_id: taskId,
        });
      }
    }
  } else if (rule.action === 'escalate') {
    // Escalade vers le responsable du projet
    const { data: task } = await supabase
      .from('tasks')
      .select('project_id')
      .eq('id', taskId)
      .single();

    if (task) {
      const { data: project } = await supabase
        .from('projects')
        .select('created_by')
        .eq('id', task.project_id)
        .single();

      if (project) {
        await supabase.from('notifications').insert({
          user_id: project.created_by,
          type: 'escalation',
          title: `SLA Escalation: ${rule.name}`,
          body: `A task is escalated due to SLA violation: ${rule.name}`,
          task_id: taskId,
        });
      }
    }
  }
}

// Marquer une violation comme résolue
export async function resolveViolation(violationId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sla_violations')
    .update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', violationId);

  if (error) {
    console.error('Error resolving violation:', error);
    return false;
  }

  return true;
}

// Obtenir les violations ouvertes
export async function getOpenViolations(projectId: string): Promise<SLAViolation[]> {
  const rules = await getProjectSLARules(projectId);
  const ruleIds = rules.map(r => r.id);

  if (ruleIds.length === 0) return [];

  const { data, error } = await supabase
    .from('sla_violations')
    .select('*')
    .in('sla_rule_id', ruleIds)
    .eq('status', 'open')
    .order('detected_at', { ascending: false });

  if (error) {
    console.error('Error fetching violations:', error);
    return [];
  }

  return data || [];
}

// Désactiver une règle SLA
export async function deactivateSLARule(ruleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('sla_rules')
    .update({ is_active: false })
    .eq('id', ruleId);

  if (error) {
    console.error('Error deactivating rule:', error);
    return false;
  }

  return true;
}

// Générer un rapport SLA
export async function generateSLAReport(projectId: string) {
  const rules = await getProjectSLARules(projectId);
  const violations = await getOpenViolations(projectId);

  const report = {
    project_id: projectId,
    total_rules: rules.length,
    active_rules: rules.filter(r => r.is_active).length,
    total_violations: violations.length,
    open_violations: violations.filter(v => v.status === 'open').length,
    by_condition: {
      task_overdue: violations.filter(v => {
        const rule = rules.find(r => r.id === v.sla_rule_id);
        return rule?.condition === 'task_overdue';
      }).length,
      task_blocked: violations.filter(v => {
        const rule = rules.find(r => r.id === v.sla_rule_id);
        return rule?.condition === 'task_blocked';
      }).length,
      budget_exceeded: violations.filter(v => {
        const rule = rules.find(r => r.id === v.sla_rule_id);
        return rule?.condition === 'budget_exceeded';
      }).length,
      milestone_at_risk: violations.filter(v => {
        const rule = rules.find(r => r.id === v.sla_rule_id);
        return rule?.condition === 'milestone_at_risk';
      }).length,
    },
  };

  return report;
}
