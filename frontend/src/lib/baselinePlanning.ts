// ===========================================
// Baseline Planning - Frozen Initial Plan Comparison
// ===========================================

import { supabase } from './supabase';

export interface ProjectBaseline {
  id: string;
  project_id: string;
  created_by: string;
  name: string;
  description: string;
  baseline_date: string;
  snapshot: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export interface BaselineComparison {
  taskId: string;
  title: string;
  baselineStart: string | null;
  baselineEnd: string | null;
  currentStart: string | null;
  currentEnd: string | null;
  driftDays: number;
  statusChange: boolean;
  budgetChange: number;
}

// Créer une baseline du plan actuel
export async function createBaseline(
  projectId: string,
  name: string,
  description: string = ''
): Promise<ProjectBaseline | null> {
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('project_id', projectId);

  const { data: budget } = await supabase
    .from('projects')
    .select('id, name, start_date, end_date, budget')
    .eq('id', projectId)
    .single();

  const snapshot = {
    project: budget,
    tasks: tasks || [],
    captured_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from('project_baselines')
    .insert({
      project_id: projectId,
      name,
      description,
      baseline_date: new Date().toISOString(),
      snapshot,
      is_active: true,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating baseline:', error);
    return null;
  }

  return data;
}

// Récupérer toutes les baselines d'un projet
export async function getProjectBaselines(projectId: string): Promise<ProjectBaseline[]> {
  const { data, error } = await supabase
    .from('project_baselines')
    .select('*')
    .eq('project_id', projectId)
    .order('baseline_date', { ascending: false });

  if (error) {
    console.error('Error fetching baselines:', error);
    return [];
  }

  return data || [];
}

// Comparer la baseline actuelle avec le plan courant
export async function compareWithBaseline(
  projectId: string,
  baselineId: string
): Promise<BaselineComparison[]> {
  const { data: baseline, error: baselineError } = await supabase
    .from('project_baselines')
    .select('snapshot')
    .eq('id', baselineId)
    .single();

  if (baselineError || !baseline) {
    console.error('Error fetching baseline:', baselineError);
    return [];
  }

  const { data: currentTasks } = await supabase
    .from('tasks')
    .select('id, title, start_date, end_date, status')
    .eq('project_id', projectId);

  const snapshot = baseline.snapshot as Record<string, unknown>;
  const baselineTasks = (snapshot.tasks as Array<Record<string, unknown>>) || [];

  const comparisons: BaselineComparison[] = [];

  for (const baselineTask of baselineTasks) {
    const currentTask = (currentTasks || []).find(t => t.id === baselineTask.id);
    
    if (currentTask) {
      const baselineStart = baselineTask.start_date as string;
      const baselineEnd = baselineTask.end_date as string;
      const currentStart = currentTask.start_date;
      const currentEnd = currentTask.end_date;

      const baselineEndDate = baselineEnd ? new Date(baselineEnd).getTime() : 0;
      const currentEndDate = currentEnd ? new Date(currentEnd).getTime() : 0;
      const driftDays = Math.round((currentEndDate - baselineEndDate) / (1000 * 60 * 60 * 24));

      comparisons.push({
        taskId: baselineTask.id as string,
        title: baselineTask.title as string,
        baselineStart,
        baselineEnd,
        currentStart,
        currentEnd,
        driftDays,
        statusChange: baselineTask.status !== currentTask.status,
        budgetChange: 0, // À calculer si budget tracking est disponible
      });
    }
  }

  return comparisons;
}

// Obtenir les métriques de dérive
export async function getBaselineDriftMetrics(projectId: string, baselineId: string) {
  const comparisons = await compareWithBaseline(projectId, baselineId);

  const metrics = {
    totalTasks: comparisons.length,
    driftedTasks: comparisons.filter(c => c.driftDays !== 0).length,
    averageDrift: comparisons.length > 0
      ? comparisons.reduce((sum, c) => sum + c.driftDays, 0) / comparisons.length
      : 0,
    maxDrift: comparisons.length > 0
      ? Math.max(...comparisons.map(c => Math.abs(c.driftDays)))
      : 0,
    tasksBehindSchedule: comparisons.filter(c => c.driftDays > 0).length,
    tasksAheadOfSchedule: comparisons.filter(c => c.driftDays < 0).length,
  };

  return metrics;
}

// Restaurer un plan à partir d'une baseline
export async function restoreFromBaseline(baselineId: string): Promise<boolean> {
  try {
    const { data: baseline } = await supabase
      .from('project_baselines')
      .select('snapshot')
      .eq('id', baselineId)
      .single();

    if (!baseline) return false;

    // Logique de restauration (à adapter selon la complexité)
    // Pour l'instant, c'est juste un marqueur
    return true;
  } catch (error) {
    console.error('Error restoring baseline:', error);
    return false;
  }
}

// Archiver une baseline
export async function archiveBaseline(baselineId: string): Promise<boolean> {
  const { error } = await supabase
    .from('project_baselines')
    .update({ is_active: false })
    .eq('id', baselineId);

  if (error) {
    console.error('Error archiving baseline:', error);
    return false;
  }

  return true;
}
