// ===========================================
// Task Dependencies - Gestion des dépendances tâches
// ===========================================

import { supabase } from './supabase';

export type DependencyType = 'finish_to_start' | 'start_to_start' | 'finish_to_finish' | 'start_to_finish';

export interface TaskDependency {
  id: string;
  source_task_id: string;
  target_task_id: string;
  dependency_type: DependencyType;
  lag_days: number;
  created_at: string;
}

export interface DependencyWithDetails extends TaskDependency {
  source_task?: { id: string; title: string; end_date: string | null };
  target_task?: { id: string; title: string; start_date: string | null };
}

type TaskDateSnapshot = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
};

export type CascadedDateUpdate = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  due_date: string | null;
};

function parseDateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toDateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

function diffDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / msPerDay));
}

function applyDependencyConstraint(
  source: TaskDateSnapshot,
  target: TaskDateSnapshot,
  dependencyType: DependencyType,
  lagDays: number
): TaskDateSnapshot {
  const sourceStart = parseDateOnly(source.start_date);
  const sourceEnd = parseDateOnly(source.end_date ?? source.due_date ?? null);
  const targetStart = parseDateOnly(target.start_date);
  const targetEnd = parseDateOnly(target.end_date ?? target.due_date ?? null);

  const preservedDuration = targetStart && targetEnd ? diffDays(targetStart, targetEnd) : 0;

  const setTargetFromStart = (requiredStart: Date): TaskDateSnapshot => {
    const nextStart = toDateOnly(requiredStart);
    const nextEnd = toDateOnly(addDays(requiredStart, preservedDuration));
    return {
      ...target,
      start_date: nextStart,
      end_date: nextEnd,
      due_date: nextEnd,
    };
  };

  const setTargetFromEnd = (requiredEnd: Date): TaskDateSnapshot => {
    const nextEnd = toDateOnly(requiredEnd);
    if (preservedDuration > 0) {
      const nextStart = toDateOnly(addDays(requiredEnd, -preservedDuration));
      return {
        ...target,
        start_date: nextStart,
        end_date: nextEnd,
        due_date: nextEnd,
      };
    }

    return {
      ...target,
      start_date: target.start_date,
      end_date: nextEnd,
      due_date: nextEnd,
    };
  };

  switch (dependencyType) {
    case 'finish_to_start': {
      if (!sourceEnd) return target;
      const requiredStart = addDays(sourceEnd, lagDays);
      if (!targetStart || targetStart < requiredStart) {
        return setTargetFromStart(requiredStart);
      }
      return target;
    }
    case 'start_to_start': {
      if (!sourceStart) return target;
      const requiredStart = addDays(sourceStart, lagDays);
      if (!targetStart || targetStart < requiredStart) {
        return setTargetFromStart(requiredStart);
      }
      return target;
    }
    case 'finish_to_finish': {
      if (!sourceEnd) return target;
      const requiredEnd = addDays(sourceEnd, lagDays);
      if (!targetEnd || targetEnd < requiredEnd) {
        return setTargetFromEnd(requiredEnd);
      }
      return target;
    }
    case 'start_to_finish': {
      if (!sourceStart) return target;
      const requiredEnd = addDays(sourceStart, lagDays);
      if (!targetEnd || targetEnd < requiredEnd) {
        return setTargetFromEnd(requiredEnd);
      }
      return target;
    }
    default:
      return target;
  }
}

// Créer une dépendance entre deux tâches
export async function createTaskDependency(
  sourceTaskId: string,
  targetTaskId: string,
  dependencyType: DependencyType,
  lagDays: number = 0
): Promise<TaskDependency | null> {
  const { data, error } = await supabase
    .from('task_dependencies')
    .insert({
      source_task_id: sourceTaskId,
      target_task_id: targetTaskId,
      dependency_type: dependencyType,
      lag_days: lagDays,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating task dependency:', error);
    return null;
  }

  return data;
}

// Récupérer toutes les dépendances d'une tâche
export async function getTaskDependencies(taskId: string): Promise<TaskDependency[]> {
  const { data, error } = await supabase
    .from('task_dependencies')
    .select('*')
    .or(`source_task_id.eq.${taskId},target_task_id.eq.${taskId}`);

  if (error) {
    console.error('Error fetching task dependencies:', error);
    return [];
  }

  return data || [];
}

// Supprimer une dépendance
export async function deleteTaskDependency(dependencyId: string): Promise<boolean> {
  const { error } = await supabase
    .from('task_dependencies')
    .delete()
    .eq('id', dependencyId);

  if (error) {
    console.error('Error deleting task dependency:', error);
    return false;
  }

  return true;
}

// Vérifier les cycles de dépendances (détection de deadlock)
export async function detectDependencyCycles(taskId: string, maxDepth = 50): Promise<boolean> {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();

  async function hasCycle(currentId: string, depth: number): Promise<boolean> {
    if (depth > maxDepth) return false; // sécurité anti-boucle infinie
    visited.add(currentId);
    recursionStack.add(currentId);

    const dependencies = await supabase
      .from('task_dependencies')
      .select('target_task_id')
      .eq('source_task_id', currentId);

    if (dependencies.error) return false;

    for (const dep of dependencies.data || []) {
      if (!visited.has(dep.target_task_id)) {
        if (await hasCycle(dep.target_task_id, depth + 1)) return true;
      } else if (recursionStack.has(dep.target_task_id)) {
        return true;
      }
    }

    recursionStack.delete(currentId);
    return false;
  }

  return await hasCycle(taskId, 0);
}

// Calculer le chemin critique
export async function calculateCriticalPath(projectId: string): Promise<string[]> {
  const { data: tasks, error: tasksError } = await supabase
    .from('tasks')
    .select('id, start_date, end_date')
    .eq('project_id', projectId);

  if (tasksError || !tasks) return [];

  // Calculate duration client-side
  const tasksWithDuration = tasks.map(t => ({
    ...t,
    duration: t.end_date && t.start_date
      ? Math.ceil((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / (1000 * 60 * 60 * 24))
      : 0
  }));

  const { error: depsError } = await supabase
    .from('task_dependencies')
    .select('source_task_id, target_task_id, lag_days')
    .in('source_task_id', tasksWithDuration.map(t => t.id));

  if (depsError) return [];

  // Algorithme simplifié: retourner les tâches les plus longues
  const sortedByDuration = tasksWithDuration
    .sort((a, b) => b.duration - a.duration)
    .slice(0, Math.max(3, Math.ceil(tasksWithDuration.length * 0.3)))
    .map(t => t.id);

  return sortedByDuration;
}

// Calculer les slack days (marge temporelle)
export async function calculateTaskSlack(taskId: string): Promise<number> {
  const { data: task, error: taskError } = await supabase
    .from('tasks')
    .select('start_date, end_date')
    .eq('id', taskId)
    .single();

  if (taskError || !task) return 0;

  const actualDuration = task.end_date && task.start_date 
    ? new Date(task.end_date).getTime() - new Date(task.start_date).getTime()
    : 0;

  // Calculer la duration requise basée sur les dépendances
  const { data: deps } = await supabase
    .from('task_dependencies')
    .select('lag_days')
    .or(`source_task_id.eq.${taskId},target_task_id.eq.${taskId}`);

  const totalLag = (deps || []).reduce((sum, dep) => sum + (dep.lag_days || 0), 0);
  const requiredDuration = totalLag * 24 * 60 * 60 * 1000; // Convert days to ms

  return Math.max(0, actualDuration - requiredDuration) / (24 * 60 * 60 * 1000); // Return as days
}

// Mettre en avant-plan les tâches affectées par une dépendance
export async function getAffectedTasks(taskId: string): Promise<string[]> {
  const downstream: string[] = [];
  const visited = new Set<string>();

  async function collectDownstream(currentId: string) {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const { data } = await supabase
      .from('task_dependencies')
      .select('target_task_id')
      .eq('source_task_id', currentId);

    for (const dep of data || []) {
      downstream.push(dep.target_task_id);
      await collectDownstream(dep.target_task_id);
    }
  }

  await collectDownstream(taskId);
  return downstream;
}

// Recalcule les dates des tâches aval quand une tâche source est déplacée.
export async function recalculateDependentTaskDates(changedTaskId: string): Promise<CascadedDateUpdate[]> {
  const updatesMap = new Map<string, CascadedDateUpdate>();
  const queue: string[] = [changedTaskId];
  const enqueued = new Set<string>([changedTaskId]);
  let iterations = 0;
  const maxIterations = 500;

  while (queue.length > 0 && iterations < maxIterations) {
    iterations += 1;
    const currentTaskId = queue.shift()!;

    const { data: outgoingDeps, error: depsError } = await supabase
      .from('task_dependencies')
      .select('source_task_id, target_task_id, dependency_type, lag_days')
      .eq('source_task_id', currentTaskId);

    if (depsError || !outgoingDeps || outgoingDeps.length === 0) {
      continue;
    }

    const targetIds = Array.from(new Set(outgoingDeps.map(dep => dep.target_task_id)));
    const allTaskIds = Array.from(new Set([currentTaskId, ...targetIds]));

    const { data: taskRows, error: tasksError } = await supabase
      .from('tasks')
      .select('id, start_date, end_date, due_date')
      .in('id', allTaskIds);

    if (tasksError || !taskRows) {
      continue;
    }

    const taskById = new Map<string, TaskDateSnapshot>(
      taskRows.map((row: any) => [
        row.id,
        {
          id: row.id,
          start_date: row.start_date,
          end_date: row.end_date,
          due_date: row.due_date,
        },
      ])
    );

    for (const dep of outgoingDeps) {
      const source = taskById.get(dep.source_task_id);
      const target = taskById.get(dep.target_task_id);
      if (!source || !target) continue;

      const candidate = applyDependencyConstraint(
        source,
        target,
        dep.dependency_type as DependencyType,
        dep.lag_days ?? 0
      );

      const changed =
        candidate.start_date !== target.start_date ||
        candidate.end_date !== target.end_date ||
        candidate.due_date !== target.due_date;

      if (!changed) continue;

      const { error: updateError } = await supabase
        .from('tasks')
        .update({
          start_date: candidate.start_date,
          end_date: candidate.end_date,
          due_date: candidate.due_date,
        })
        .eq('id', target.id);

      if (updateError) continue;

      taskById.set(target.id, candidate);
      updatesMap.set(target.id, {
        id: target.id,
        start_date: candidate.start_date,
        end_date: candidate.end_date,
        due_date: candidate.due_date,
      });

      if (!enqueued.has(target.id)) {
        queue.push(target.id);
        enqueued.add(target.id);
      }
    }
  }

  return Array.from(updatesMap.values());
}
