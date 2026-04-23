// ===========================================
// Milestones & Releases - Roadmap Planning
// ===========================================

import { supabase } from './supabase';

export type MilestoneStatus = 'planned' | 'in_progress' | 'completed' | 'postponed';

export interface Milestone {
  id: string;
  project_id: string;
  name: string;
  description: string;
  target_date: string;
  status: MilestoneStatus;
  owner_id: string | null;
  deliverables: string[];
  success_criteria: string;
  created_at: string;
  updated_at: string;
}

export interface MilestoneWithTasks extends Milestone {
  tasks: Array<{ id: string; title: string; status: string }>;
  completion_percent: number;
  is_on_track: boolean;
}

// Créer un milestone
export async function createMilestone(
  projectId: string,
  name: string,
  targetDate: Date,
  description: string = '',
  successCriteria: string = ''
): Promise<Milestone | null> {
  const { data, error } = await supabase
    .from('milestones')
    .insert({
      project_id: projectId,
      name,
      description,
      target_date: targetDate.toISOString().split('T')[0],
      success_criteria: successCriteria,
      status: 'planned',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating milestone:', error);
    return null;
  }

  return data;
}

// Récupérer tous les milestones d'un projet
export async function getProjectMilestones(projectId: string): Promise<MilestoneWithTasks[]> {
  const { data: milestones, error } = await supabase
    .from('milestones')
    .select('*')
    .eq('project_id', projectId)
    .order('target_date', { ascending: true });

  if (error) {
    console.error('Error fetching milestones:', error);
    return [];
  }

  if (!milestones || milestones.length === 0) return [];

  // Batch: toutes les mappings en une requête
  const milestoneIds = milestones.map(m => m.id);
  const { data: allMappings } = await supabase
    .from('task_milestone_mapping')
    .select('milestone_id, task_id')
    .in('milestone_id', milestoneIds);

  // Batch: toutes les tâches en une requête
  const allTaskIds = [...new Set((allMappings || []).map(m => m.task_id))];
  let allTasks: Array<{ id: string; title: string; status: string }> = [];
  if (allTaskIds.length > 0) {
    const { data: taskData } = await supabase
      .from('tasks')
      .select('id, title, status')
      .in('id', allTaskIds);
    allTasks = taskData || [];
  }

  const taskMap = new Map(allTasks.map(t => [t.id, t]));
  const milestoneTaskMap = new Map<string, string[]>();
  for (const m of (allMappings || [])) {
    if (!milestoneTaskMap.has(m.milestone_id)) milestoneTaskMap.set(m.milestone_id, []);
    milestoneTaskMap.get(m.milestone_id)!.push(m.task_id);
  }

  const now = new Date();
  return milestones.map(milestone => {
    const taskIds = milestoneTaskMap.get(milestone.id) ?? [];
    const tasks = taskIds.map(id => taskMap.get(id)!).filter(Boolean);
    const completedTasks = tasks.filter(t => t.status === 'done').length;
    const completionPercent = tasks.length > 0
      ? Math.round((completedTasks / tasks.length) * 100)
      : 0;
    const targetDate = new Date(milestone.target_date);
    const isOnTrack = targetDate >= now || milestone.status === 'completed';
    return { ...milestone, tasks, completion_percent: completionPercent, is_on_track: isOnTrack };
  });
}

// Assigner une tâche à un milestone
export async function assignTaskToMilestone(taskId: string, milestoneId: string): Promise<boolean> {
  const { error } = await supabase
    .from('task_milestone_mapping')
    .insert({
      task_id: taskId,
      milestone_id: milestoneId,
    });

  if (error && !error.message.includes('duplicate')) {
    console.error('Error assigning task to milestone:', error);
    return false;
  }

  return true;
}

// Retirer une tâche d'un milestone
export async function removeTaskFromMilestone(taskId: string, milestoneId: string): Promise<boolean> {
  const { error } = await supabase
    .from('task_milestone_mapping')
    .delete()
    .eq('task_id', taskId)
    .eq('milestone_id', milestoneId);

  if (error) {
    console.error('Error removing task from milestone:', error);
    return false;
  }

  return true;
}

// Mettre à jour le statut d'un milestone
export async function updateMilestoneStatus(
  milestoneId: string,
  status: MilestoneStatus
): Promise<boolean> {
  const { error } = await supabase
    .from('milestones')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', milestoneId);

  if (error) {
    console.error('Error updating milestone status:', error);
    return false;
  }

  return true;
}

// Obtenir les milestones à risque
export async function getAtRiskMilestones(projectId: string): Promise<MilestoneWithTasks[]> {
  const milestones = await getProjectMilestones(projectId);

  const now = new Date();

  return milestones.filter(m => {
    const targetDate = new Date(m.target_date);
    const daysUntilDeadline = Math.floor(
      (targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    // À risque si: moins de 7 jours et pas tout fait
    return daysUntilDeadline < 7 && daysUntilDeadline >= 0 && m.completion_percent < 100;
  });
}

// Assigner un propriétaire à un milestone
export async function assignMilestoneOwner(milestoneId: string, ownerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('milestones')
    .update({ owner_id: ownerId })
    .eq('id', milestoneId);

  if (error) {
    console.error('Error assigning milestone owner:', error);
    return false;
  }

  return true;
}

// Générer un rapport roadmap
export async function generateRoadmapReport(projectId: string) {
  const milestones = await getProjectMilestones(projectId);

  const now = new Date();

  const report = {
    project_id: projectId,
    total_milestones: milestones.length,
    by_status: {
      planned: milestones.filter(m => m.status === 'planned').length,
      in_progress: milestones.filter(m => m.status === 'in_progress').length,
      completed: milestones.filter(m => m.status === 'completed').length,
      postponed: milestones.filter(m => m.status === 'postponed').length,
    },
    upcoming: milestones.filter(m => {
      const targetDate = new Date(m.target_date);
      return targetDate > now && targetDate <= new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    }),
    at_risk: await getAtRiskMilestones(projectId),
    average_completion: milestones.length > 0
      ? Math.round(
          milestones.reduce((sum, m) => sum + m.completion_percent, 0) / milestones.length
        )
      : 0,
  };

  return report;
}

// Supprimer un milestone
export async function deleteMilestone(milestoneId: string): Promise<boolean> {
  const { error } = await supabase
    .from('milestones')
    .delete()
    .eq('id', milestoneId);

  if (error) {
    console.error('Error deleting milestone:', error);
    return false;
  }

  return true;
}

// Insérer plusieurs tâches dans un milestone
export async function bulkAssignTasksToMilestone(
  taskIds: string[],
  milestoneId: string
): Promise<boolean> {
  const mappings = taskIds.map(taskId => ({
    task_id: taskId,
    milestone_id: milestoneId,
  }));

  const { error } = await supabase
    .from('task_milestone_mapping')
    .insert(mappings);

  if (error && !error.message.includes('duplicate')) {
    console.error('Error bulk assigning tasks:', error);
    return false;
  }

  return true;
}
