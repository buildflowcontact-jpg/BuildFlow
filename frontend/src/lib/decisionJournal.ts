// ===========================================
// Decision Journal - Arbitrage & Impact Tracking
// ===========================================

import { supabase } from './supabase';

export type DecisionStatus = 'pending' | 'approved' | 'implemented' | 'reversed';

export interface Decision {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  context: string;
  options_considered: string[];
  decision_made: string;
  rationale: string;
  alternative_rejected: string;
  rejection_reason: string;
  owner_id: string | null;
  impact_areas: string[];
  risk_level: 'low' | 'medium' | 'high';
  related_tasks: string[];
  status: DecisionStatus;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  updated_at: string;
}

// Créer une décision
export async function createDecision(
  projectId: string,
  title: string,
  context: string,
  decisionMade: string,
  optionsConsidered: string[] = []
): Promise<Decision | null> {
  const { data, error } = await supabase
    .from('decision_journal')
    .insert({
      project_id: projectId,
      title,
      context,
      decision_made: decisionMade,
      options_considered: optionsConsidered,
      status: 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating decision:', error);
    return null;
  }

  return data;
}

// Récupérer les décisions d'un projet
export async function getProjectDecisions(projectId: string): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decision_journal')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching decisions:', error);
    return [];
  }

  return data || [];
}

// Obtenir une décision spécifique
export async function getDecision(decisionId: string): Promise<Decision | null> {
  const { data, error } = await supabase
    .from('decision_journal')
    .select('*')
    .eq('id', decisionId)
    .single();

  if (error) {
    console.error('Error fetching decision:', error);
    return null;
  }

  return data;
}

// Ajouter une rationale et plans d'mitigation
export async function addDecisionDetails(
  decisionId: string,
  rationale: string,
  alternativeRejected: string,
  rejectionReason: string,
  impactAreas: string[] = [],
  riskLevel: 'low' | 'medium' | 'high' = 'medium'
): Promise<boolean> {
  const { error } = await supabase
    .from('decision_journal')
    .update({
      rationale,
      alternative_rejected: alternativeRejected,
      rejection_reason: rejectionReason,
      impact_areas: impactAreas,
      risk_level: riskLevel,
      updated_at: new Date().toISOString(),
    })
    .eq('id', decisionId);

  if (error) {
    console.error('Error updating decision details:', error);
    return false;
  }

  return true;
}

// Approuver une décision
export async function approveDecision(
  decisionId: string,
  approvedBy: string
): Promise<boolean> {
  const { error } = await supabase
    .from('decision_journal')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      approved_by: approvedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('id', decisionId);

  if (error) {
    console.error('Error approving decision:', error);
    return false;
  }

  return true;
}

// Marquer une décision comme implémentée
export async function markDecisionImplemented(decisionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('decision_journal')
    .update({
      status: 'implemented',
      updated_at: new Date().toISOString(),
    })
    .eq('id', decisionId);

  if (error) {
    console.error('Error marking decision as implemented:', error);
    return false;
  }

  return true;
}

// Annuler une décision
export async function reverseDecision(decisionId: string, reason: string): Promise<boolean> {
  const { error } = await supabase
    .from('decision_journal')
    .update({
      status: 'reversed',
      rejection_reason: reason,
      updated_at: new Date().toISOString(),
    })
    .eq('id', decisionId);

  if (error) {
    console.error('Error reversing decision:', error);
    return false;
  }

  return true;
}

// Assigner à un propriétaire
export async function assignDecisionOwner(decisionId: string, ownerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('decision_journal')
    .update({ owner_id: ownerId })
    .eq('id', decisionId);

  if (error) {
    console.error('Error assigning decision owner:', error);
    return false;
  }

  return true;
}

// Lier des tâches à une décision
export async function linkTasksToDecision(
  decisionId: string,
  taskIds: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from('decision_journal')
    .update({ related_tasks: taskIds })
    .eq('id', decisionId);

  if (error) {
    console.error('Error linking tasks to decision:', error);
    return false;
  }

  return true;
}

// Obtenir les décisions en attente d'approbation
export async function getPendingApprovalDecisions(projectId: string): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decision_journal')
    .select('*')
    .eq('project_id', projectId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching pending decisions:', error);
    return [];
  }

  return data || [];
}

// Obtenir les décisions à haut risque
export async function getHighRiskDecisions(projectId: string): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decision_journal')
    .select('*')
    .eq('project_id', projectId)
    .eq('risk_level', 'high')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching high-risk decisions:', error);
    return [];
  }

  return data || [];
}

// Générer un rapport de décisions
export async function generateDecisionReport(projectId: string) {
  const decisions = await getProjectDecisions(projectId);

  const report = {
    project_id: projectId,
    total_decisions: decisions.length,
    by_status: {
      pending: decisions.filter(d => d.status === 'pending').length,
      approved: decisions.filter(d => d.status === 'approved').length,
      implemented: decisions.filter(d => d.status === 'implemented').length,
      reversed: decisions.filter(d => d.status === 'reversed').length,
    },
    by_risk_level: {
      low: decisions.filter(d => d.risk_level === 'low').length,
      medium: decisions.filter(d => d.risk_level === 'medium').length,
      high: decisions.filter(d => d.risk_level === 'high').length,
    },
    pending_approval: decisions.filter(d => d.status === 'pending').length,
    high_risk_count: decisions.filter(d => d.risk_level === 'high').length,
    impact_areas: [...new Set(decisions.flatMap(d => d.impact_areas))],
    average_options_considered: decisions.length > 0
      ? Math.round(
          decisions.reduce((sum, d) => sum + d.options_considered.length, 0) / decisions.length
        )
      : 0,
  };

  return report;
}

// Rechercher des décisions par impact
export async function searchDecisionsByImpact(
  projectId: string,
  impactArea: string
): Promise<Decision[]> {
  const { data, error } = await supabase
    .from('decision_journal')
    .select('*')
    .eq('project_id', projectId)
    .contains('impact_areas', [impactArea])
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error searching decisions by impact:', error);
    return [];
  }

  return data || [];
}

// Supprimer une décision
export async function deleteDecision(decisionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('decision_journal')
    .delete()
    .eq('id', decisionId);

  if (error) {
    console.error('Error deleting decision:', error);
    return false;
  }

  return true;
}

// Exporter un decision journal en CSV
export async function exportDecisionJournal(projectId: string): Promise<string> {
  const decisions = await getProjectDecisions(projectId);

  const headers = [
    'Title',
    'Context',
    'Decision Made',
    'Rationale',
    'Risk Level',
    'Status',
    'Impact Areas',
    'Created Date',
  ];

  const rows = decisions.map(d => [
    d.title,
    d.context.substring(0, 50) + '...',
    d.decision_made,
    d.rationale,
    d.risk_level,
    d.status,
    d.impact_areas.join('; '),
    new Date(d.created_at).toLocaleDateString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  return csvContent;
}
