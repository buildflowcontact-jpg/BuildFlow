// ===========================================
// Automation Rules - No-Code If/Then Workflows
// ===========================================

import { supabase } from './supabase';

export type TriggerEvent = 'task_status_change' | 'task_assigned' | 'comment_added' | 'time_logged' | 'due_date_reached';
export type ActionType = 'notify' | 'update_status' | 'assign' | 'add_tag' | 'create_task' | 'link_document';

export interface AutomationRule {
  id: string;
  project_id: string;
  created_by: string;
  name: string;
  description: string;
  trigger_event: TriggerEvent;
  trigger_condition: Record<string, unknown>;
  action_type: ActionType;
  action_params: Record<string, unknown>;
  is_active: boolean;
  executions_count: number;
  last_executed_at: string | null;
  created_at: string;
  updated_at: string;
}

// Créer une règle d'automation
export async function createAutomationRule(
  projectId: string,
  name: string,
  triggerEvent: TriggerEvent,
  triggerCondition: Record<string, unknown>,
  actionType: ActionType,
  actionParams: Record<string, unknown>,
  description: string = ''
): Promise<AutomationRule | null> {
  const { data, error } = await supabase
    .from('automation_rules')
    .insert({
      project_id: projectId,
      name,
      description,
      trigger_event: triggerEvent,
      trigger_condition: triggerCondition,
      action_type: actionType,
      action_params: actionParams,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating automation rule:', error);
    return null;
  }

  return data;
}

// Récupérer les règles d'un projet
export async function getProjectAutomationRules(projectId: string): Promise<AutomationRule[]> {
  const { data, error } = await supabase
    .from('automation_rules')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching automation rules:', error);
    return [];
  }

  return data || [];
}

// Exécuter une règle d'automation
export async function executeAutomationRule(rule: AutomationRule, taskId: string): Promise<boolean> {
  try {
    if (rule.action_type === 'notify') {
      // Notifier quelqu'un
      const { data: task } = await supabase
        .from('tasks')
        .select('assigned_to, assignee_ids, created_by')
        .eq('id', taskId)
        .single();

      if (task) {
        const firstAssignee = Array.isArray(task.assignee_ids) ? task.assignee_ids[0] : null;
        const recipientId = (rule.action_params as Record<string, unknown>).target_user || firstAssignee || task.assigned_to || task.created_by;
        if (recipientId) {
          await supabase.from('notifications').insert({
            user_id: recipientId as string,
            type: 'automation',
            title: `Automation: ${rule.name}`,
            body: rule.description,
            task_id: taskId,
          });
        }
      }
    } else if (rule.action_type === 'update_status') {
      // Mettre à jour le statut
      const newStatus = (rule.action_params as Record<string, unknown>).new_status;
      await supabase
        .from('tasks')
        .update({ status: newStatus })
        .eq('id', taskId);
    } else if (rule.action_type === 'assign') {
      // Assigner la tâche
      const assigneeId = (rule.action_params as Record<string, unknown>).assignee_id;
      const assigneeIds = assigneeId ? [assigneeId] : [];
      await supabase
        .from('tasks')
        .update({ assigned_to: assigneeId, assignee_ids: assigneeIds })
        .eq('id', taskId);
    } else if (rule.action_type === 'create_task') {
      // Créer une tâche
      const { title, description: desc, priority } = rule.action_params as Record<string, unknown>;
      await supabase
        .from('tasks')
        .insert({
          project_id: rule.project_id,
          title,
          description: desc,
          priority,
          created_by: rule.created_by,
        });
    }

    // Incrémenter le compteur d'exécutions
    await supabase
      .from('automation_rules')
      .update({
        executions_count: rule.executions_count + 1,
        last_executed_at: new Date().toISOString(),
      })
      .eq('id', rule.id);

    return true;
  } catch (error) {
    console.error('Error executing automation rule:', error);
    return false;
  }
}

// Vérifier si une règle doit être déclenchée
export async function checkAndExecuteRules(
  projectId: string,
  triggerEvent: TriggerEvent,
  taskId: string
): Promise<number> {
  const rules = await getProjectAutomationRules(projectId);
  const matchingRules = rules.filter(
    r => r.is_active && r.trigger_event === triggerEvent
  );

  let executedCount = 0;

  for (const rule of matchingRules) {
    // Vérifier les conditions
    const conditionMet = await evaluateCondition(rule.trigger_condition, taskId);

    if (conditionMet) {
      const success = await executeAutomationRule(rule, taskId);
      if (success) {
        executedCount++;
      }
    }
  }

  return executedCount;
}

// Évaluer une condition de déclenchement
async function evaluateCondition(condition: Record<string, unknown>, taskId: string): Promise<boolean> {
  const { data: task } = await supabase
    .from('tasks')
    .select('*')
    .eq('id', taskId)
    .single();

  if (!task) return false;

  // Logique simplifié: matcher les propriétés
  for (const [key, value] of Object.entries(condition)) {
    if (task[key as keyof typeof task] !== value) {
      return false;
    }
  }

  return true;
}

// Désactiver une règle
export async function deactivateAutomationRule(ruleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('automation_rules')
    .update({ is_active: false })
    .eq('id', ruleId);

  if (error) {
    console.error('Error deactivating rule:', error);
    return false;
  }

  return true;
}

// Activer une règle
export async function activateAutomationRule(ruleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('automation_rules')
    .update({ is_active: true })
    .eq('id', ruleId);

  if (error) {
    console.error('Error activating rule:', error);
    return false;
  }

  return true;
}

// Supprimer une règle
export async function deleteAutomationRule(ruleId: string): Promise<boolean> {
  const { error } = await supabase
    .from('automation_rules')
    .delete()
    .eq('id', ruleId);

  if (error) {
    console.error('Error deleting rule:', error);
    return false;
  }

  return true;
}

// Obtenir les templates de règles communes
export function getCommonRuleTemplates() {
  return [
    {
      name: 'Auto-close when all subtasks done',
      trigger_event: 'task_status_change',
      action_type: 'update_status',
      description: 'Automatically mark task as done when all subtasks are completed',
    },
    {
      name: 'Notify on task assignment',
      trigger_event: 'task_assigned',
      action_type: 'notify',
      description: 'Send notification when a task is assigned',
    },
    {
      name: 'Create follow-up on due date',
      trigger_event: 'due_date_reached',
      action_type: 'create_task',
      description: 'Create a follow-up task 7 days after the original due date',
    },
    {
      name: 'Auto-update status on time log',
      trigger_event: 'time_logged',
      action_type: 'update_status',
      description: 'Change task status to in-progress when time is logged',
    },
    {
      name: 'Notify team on comment',
      trigger_event: 'comment_added',
      action_type: 'notify',
      description: 'Notify project members when a comment is added to a task',
    },
  ];
}

// Générer un rapport d'automation
export async function generateAutomationReport(projectId: string) {
  const rules = await getProjectAutomationRules(projectId);

  const report = {
    project_id: projectId,
    total_rules: rules.length,
    active_rules: rules.filter(r => r.is_active).length,
    by_event: {} as Record<string, number>,
    by_action: {} as Record<string, number>,
    most_executed: rules.sort((a, b) => b.executions_count - a.executions_count).slice(0, 5),
    total_executions: rules.reduce((sum, r) => sum + r.executions_count, 0),
  };

  for (const rule of rules) {
    report.by_event[rule.trigger_event] = (report.by_event[rule.trigger_event] || 0) + 1;
    report.by_action[rule.action_type] = (report.by_action[rule.action_type] || 0) + 1;
  }

  return report;
}
