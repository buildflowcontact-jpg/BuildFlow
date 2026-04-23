// ===========================================
// Portfolio Dashboard - Multi-Project Consolidation
// ===========================================

import { supabase } from './supabase';

export interface PortfolioDashboard {
  id: string;
  created_by: string;
  name: string;
  description: string;
  project_filter: Record<string, unknown>;
  view_config: Record<string, unknown>;
  is_public: boolean;
  created_at: string;
  updated_at: string;
}

export interface PortfolioMetrics {
  total_projects: number;
  active_projects: number;
  completed_projects: number;
  at_risk_projects: number;
  total_tasks: number;
  completed_tasks: number;
  overdue_tasks: number;
  total_budget: number;
  budget_spent: number;
  budget_remaining: number;
  average_completion: number;
}

// Créer un portfolio dashboard
export async function createPortfolioDashboard(
  name: string,
  description: string = '',
  projectFilter: Record<string, unknown> = {},
  isPublic: boolean = false
): Promise<PortfolioDashboard | null> {
  const { data, error } = await supabase
    .from('portfolio_dashboards')
    .insert({
      name,
      description,
      project_filter: projectFilter,
      view_config: {},
      is_public: isPublic,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating portfolio dashboard:', error);
    return null;
  }

  return data;
}

// Récupérer tous les dashboards de l'utilisateur
export async function getUserPortfolioDashboards(): Promise<PortfolioDashboard[]> {
  const { data, error } = await supabase
    .from('portfolio_dashboards')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching dashboards:', error);
    return [];
  }

  return data || [];
}

// Récupérer un dashboard spécifique
export async function getPortfolioDashboard(dashboardId: string): Promise<PortfolioDashboard | null> {
  const { data, error } = await supabase
    .from('portfolio_dashboards')
    .select('*')
    .eq('id', dashboardId)
    .single();

  if (error) {
    console.error('Error fetching dashboard:', error);
    return null;
  }

  return data;
}

// Mettre à jour la configuration d'un dashboard
export async function updatePortfolioDashboard(
  dashboardId: string,
  viewConfig: Record<string, unknown>
): Promise<boolean> {
  const { error } = await supabase
    .from('portfolio_dashboards')
    .update({ view_config: viewConfig })
    .eq('id', dashboardId);

  if (error) {
    console.error('Error updating dashboard:', error);
    return false;
  }

  return true;
}

// Calculer les métriques du portfolio
export async function getPortfolioMetrics(): Promise<PortfolioMetrics> {
  // Récupérer tous les projets
  const { data: projects } = await supabase
    .from('projects')
    .select('id, status, budget');

  // Récupérer toutes les tâches
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, status, project_id, due_date');

  const now = new Date();

  const metrics: PortfolioMetrics = {
    total_projects: projects?.length || 0,
    active_projects: (projects || []).filter(p => p.status === 'active').length,
    completed_projects: (projects || []).filter(p => p.status === 'completed').length,
    at_risk_projects: 0, // À calculer basé sur les tâches en retard
    total_tasks: tasks?.length || 0,
    completed_tasks: (tasks || []).filter(t => t.status === 'done').length,
    overdue_tasks: (tasks || []).filter(t => {
      if (t.due_date) {
        const dueDate = new Date(t.due_date);
        return dueDate < now && t.status !== 'done';
      }
      return false;
    }).length,
    total_budget: (projects || []).reduce((sum, p) => sum + (p.budget || 0), 0),
    budget_spent: 0, // À calculer depuis expenses
    budget_remaining: 0, // À calculer
    average_completion: tasks && tasks.length > 0
      ? Math.round(((tasks.filter(t => t.status === 'done').length / tasks.length) * 100))
      : 0,
  };

  // Calculer les projets à risque (projets avec tâches en retard)
  for (const project of projects || []) {
    const projectTasks = (tasks || []).filter(t => t.project_id === project.id);
    const overdueTasks = projectTasks.filter(t => {
      if (t.due_date) {
        const dueDate = new Date(t.due_date);
        return dueDate < now && t.status !== 'done';
      }
      return false;
    });

    if (overdueTasks.length > 0) {
      metrics.at_risk_projects++;
    }
  }

  return metrics;
}

// Obtenir le health status d'un projet
export async function getProjectHealthStatus(projectId: string) {
  const { data: project } = await supabase
    .from('projects')
    .select('status, start_date, end_date, budget')
    .eq('id', projectId)
    .single();

  const { data: tasks } = await supabase
    .from('tasks')
    .select('status, due_date')
    .eq('project_id', projectId);

  if (!project || !tasks) {
    return { health: 'unknown', score: 0 };
  }

  const now = new Date();
  const endDate = project.end_date ? new Date(project.end_date) : null;
  const completionRate = tasks.length > 0
    ? (tasks.filter(t => t.status === 'done').length / tasks.length) * 100
    : 0;
  const overdueTasks = tasks.filter(t => {
    if (t.due_date) {
      const dueDate = new Date(t.due_date);
      return dueDate < now && t.status !== 'done';
    }
    return false;
  }).length;

  let score = 100;

  if (overdueTasks > 0) {
    score -= overdueTasks * 10;
  }

  if (endDate && endDate < now && project.status !== 'completed') {
    score -= 20;
  }

  if (completionRate < 25 && endDate && now > new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000)) {
    score -= 30;
  }

  return {
    health: Math.max(0, score) > 70 ? 'healthy' : Math.max(0, score) > 40 ? 'at_risk' : 'in_trouble',
    score: Math.max(0, score),
    completion_rate: Math.round(completionRate),
    overdue_tasks: overdueTasks,
    is_delayed: endDate ? endDate < now : false,
  };
}

// Exporter un rapport portfolio
export async function exportPortfolioReport(format: 'csv' | 'json' = 'json') {
  const metrics = await getPortfolioMetrics();

  const { data: projects } = await supabase
    .from('projects')
    .select('*');

  const health = await Promise.all((projects || []).map(p => getProjectHealthStatus(p.id)));

  const report = {
    generated_at: new Date().toISOString(),
    metrics,
    projects: (projects || []).map((p, idx) => ({
      ...p,
      health_status: health[idx],
    })),
  };

  if (format === 'json') {
    return report;
  }

  // CSV format
  const csvContent = [
    'Project,Status,Health,Completion Rate,Overdue Tasks',
    ...(projects || []).map((p, idx) => [
      p.name,
      p.status,
      health[idx].health,
      `${health[idx].completion_rate}%`,
      health[idx].overdue_tasks,
    ].join(',')),
  ].join('\n');

  return csvContent;
}

// Supprimer un dashboard
export async function deletePortfolioDashboard(dashboardId: string): Promise<boolean> {
  const { error } = await supabase
    .from('portfolio_dashboards')
    .delete()
    .eq('id', dashboardId);

  if (error) {
    console.error('Error deleting dashboard:', error);
    return false;
  }

  return true;
}
