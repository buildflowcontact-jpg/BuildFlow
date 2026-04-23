// ===========================================
// Workload Distribution - Team Capacity Planning
// ===========================================

import { supabase } from './supabase';

export interface TeamCapacity {
  id: string;
  project_id: string;
  user_id: string;
  week_start: string;
  hours_available: number;
  hours_allocated: number;
  created_at: string;
  updated_at: string;
}

export interface TeamCapacityStatus {
  user_id: string;
  user_name: string;
  week_start: string;
  available_hours: number;
  allocated_hours: number;
  utilization_percent: number;
  overloaded: boolean;
  remaining_capacity: number;
}

// Enregistrer la capacité d'un membre pour une semaine
export async function setTeamCapacity(
  projectId: string,
  userId: string,
  weekStart: Date,
  hoursAvailable: number
): Promise<TeamCapacity | null> {
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('team_capacity')
    .upsert(
      {
        project_id: projectId,
        user_id: userId,
        week_start: weekStartStr,
        hours_available: hoursAvailable,
      },
      { onConflict: 'project_id,user_id,week_start' }
    )
    .select()
    .single();

  if (error) {
    console.error('Error setting team capacity:', error);
    return null;
  }

  return data;
}

// Récupérer la capacité d'équipe pour une semaine
export async function getTeamCapacityForWeek(
  projectId: string,
  weekStart: Date
): Promise<TeamCapacity[]> {
  const weekStartStr = weekStart.toISOString().split('T')[0];

  const { data, error } = await supabase
    .from('team_capacity')
    .select('*')
    .eq('project_id', projectId)
    .eq('week_start', weekStartStr);

  if (error) {
    console.error('Error fetching team capacity:', error);
    return [];
  }

  return data || [];
}

// Calculer la capacité allouée pour un utilisateur dans une semaine
export async function calculateAllocatedHours(
  userId: string,
  weekStart: Date
): Promise<number> {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const { data: timeEntries } = await supabase
    .from('time_entries')
    .select('hours')
    .eq('user_id', userId)
    .gte('date', weekStart.toISOString().split('T')[0])
    .lte('date', weekEnd.toISOString().split('T')[0]);

  return (timeEntries || []).reduce((sum, entry) => sum + entry.hours, 0);
}

// Obtenir le statut de charge de travail d'une équipe
export async function getTeamWorkloadStatus(
  projectId: string,
  weekStart: Date
): Promise<TeamCapacityStatus[]> {
  const capacities = await getTeamCapacityForWeek(projectId, weekStart);
  if (capacities.length === 0) return [];

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekStartStr = weekStart.toISOString().split('T')[0];
  const weekEndStr = weekEnd.toISOString().split('T')[0];
  const userIds = capacities.map(c => c.user_id);

  // Batch: toutes les entrées de temps en une requête
  const { data: allEntries } = await supabase
    .from('time_entries')
    .select('user_id, hours')
    .in('user_id', userIds)
    .gte('date', weekStartStr)
    .lte('date', weekEndStr);

  // Batch: tous les profils en une requête
  const { data: profiles } = await supabase
    .from('user_profiles')
    .select('id, name')
    .in('id', userIds);

  const hoursMap = new Map<string, number>();
  for (const e of (allEntries || [])) {
    hoursMap.set(e.user_id, (hoursMap.get(e.user_id) ?? 0) + e.hours);
  }
  const profileMap = new Map((profiles ?? []).map(p => [p.id, p.name as string]));

  return capacities.map(capacity => {
    const allocatedHours = hoursMap.get(capacity.user_id) ?? 0;
    const utilization = capacity.hours_available > 0
      ? (allocatedHours / capacity.hours_available) * 100
      : 0;
    return {
      user_id: capacity.user_id,
      user_name: profileMap.get(capacity.user_id) || 'Unknown',
      week_start: capacity.week_start,
      available_hours: capacity.hours_available,
      allocated_hours: allocatedHours,
      utilization_percent: Math.round(utilization),
      overloaded: allocatedHours > capacity.hours_available,
      remaining_capacity: Math.max(0, capacity.hours_available - allocatedHours),
    };
  });
}

// Détecter les surcharges de travail
export async function detectWorkloadOverloads(
  projectId: string,
  weekStart: Date
): Promise<TeamCapacityStatus[]> {
  const workloadStatus = await getTeamWorkloadStatus(projectId, weekStart);
  return workloadStatus.filter(status => status.overloaded);
}

// Proposer une réallocation de tâches
export async function suggestTaskReallocation(
  projectId: string,
  weekStart: Date
): Promise<Array<{ from_user: string; to_user: string; task_id: string }>> {
  const workloadStatus = await getTeamWorkloadStatus(projectId, weekStart);

  const overloaded = workloadStatus.filter(s => s.overloaded);
  const underutilized = workloadStatus.filter(s => s.utilization_percent < 50);

  const suggestions: Array<{ from_user: string; to_user: string; task_id: string }> = [];

  // Logique simplifié: pour chaque personne surchargée, assigner des tâches aux personnes sous-utilisées
  for (const overloadedUser of overloaded) {
    const excessHours = overloadedUser.allocated_hours - overloadedUser.available_hours;
    let hoursToReassign = excessHours;

    for (const underUtil of underutilized) {
      if (hoursToReassign <= 0) break;

      const { data: tasks } = await supabase
        .from('tasks')
        .select('id, estimated_hours:task_estimations(estimated_hours)')
        .contains('assignee_ids', [overloadedUser.user_id])
        .eq('status', 'todo')
        .limit(1);

      if (tasks && tasks.length > 0) {
        suggestions.push({
          from_user: overloadedUser.user_id,
          to_user: underUtil.user_id,
          task_id: tasks[0].id,
        });
        hoursToReassign -= 10; // Assume 10h per task for demo
      }
    }
  }

  return suggestions;
}

// Générer un rapport de capacité
export async function generateCapacityReport(
  projectId: string,
  startDate: Date,
  endDate: Date
) {
  const report = {
    project_id: projectId,
    period_start: startDate.toISOString(),
    period_end: endDate.toISOString(),
    weeks: [] as Array<unknown>,
  };

  const currentWeek = new Date(startDate);

  while (currentWeek <= endDate) {
    const weekStatus = await getTeamWorkloadStatus(projectId, currentWeek);
    report.weeks.push({
      week_start: currentWeek.toISOString().split('T')[0],
      team_status: weekStatus,
      avg_utilization: weekStatus.length > 0
        ? Math.round(
            weekStatus.reduce((sum, s) => sum + s.utilization_percent, 0) /
            weekStatus.length
          )
        : 0,
      overloaded_count: weekStatus.filter(s => s.overloaded).length,
    });

    currentWeek.setDate(currentWeek.getDate() + 7);
  }

  return report;
}
