// ===========================================
// Risk Register - Risk Management System
// ===========================================

import { supabase } from './supabase';

export type ProbabilityLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type ImpactLevel = 'very_low' | 'low' | 'medium' | 'high' | 'very_high';
export type RiskStatus = 'identified' | 'mitigating' | 'monitoring' | 'resolved';

export interface Risk {
  id: string;
  project_id: string;
  created_by: string;
  title: string;
  description: string;
  probability: ProbabilityLevel;
  impact: ImpactLevel;
  owner_id: string | null;
  status: RiskStatus;
  mitigation_plan: string;
  contingency_plan: string;
  created_at: string;
  updated_at: string;
}

const probabilityScore: Record<ProbabilityLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

const impactScore: Record<ImpactLevel, number> = {
  very_low: 1,
  low: 2,
  medium: 3,
  high: 4,
  very_high: 5,
};

// Créer un risque
export async function createRisk(
  projectId: string,
  title: string,
  description: string,
  probability: ProbabilityLevel,
  impact: ImpactLevel
): Promise<Risk | null> {
  const { data, error } = await supabase
    .from('risk_register')
    .insert({
      project_id: projectId,
      title,
      description,
      probability,
      impact,
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating risk:', error);
    return null;
  }

  return data;
}

// Récupérer tous les risques d'un projet
export async function getProjectRisks(projectId: string): Promise<Risk[]> {
  const { data, error } = await supabase
    .from('risk_register')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching risks:', error);
    return [];
  }

  return data || [];
}

// Mettre à jour le statut et plan de mitigation d'un risque
export async function updateRiskMitigation(
  riskId: string,
  status: RiskStatus,
  mitigationPlan: string,
  contingencyPlan: string
): Promise<Risk | null> {
  const { data, error } = await supabase
    .from('risk_register')
    .update({
      status,
      mitigation_plan: mitigationPlan,
      contingency_plan: contingencyPlan,
      updated_at: new Date().toISOString(),
    })
    .eq('id', riskId)
    .select()
    .single();

  if (error) {
    console.error('Error updating risk:', error);
    return null;
  }

  return data;
}

// Assigner un propriétaire à un risque
export async function assignRiskOwner(riskId: string, ownerId: string): Promise<boolean> {
  const { error } = await supabase
    .from('risk_register')
    .update({ owner_id: ownerId })
    .eq('id', riskId);

  if (error) {
    console.error('Error assigning risk owner:', error);
    return false;
  }

  return true;
}

// Calculer le score de risque (Probability × Impact)
export function calculateRiskScore(probability: ProbabilityLevel, impact: ImpactLevel): number {
  return probabilityScore[probability] * impactScore[impact];
}

// Obtenir les risques triés par score (priorité)
export async function getRisksByPriority(projectId: string): Promise<Array<Risk & { risk_score: number }>> {
  const risks = await getProjectRisks(projectId);

  return risks
    .map(risk => ({
      ...risk,
      risk_score: calculateRiskScore(risk.probability, risk.impact),
    }))
    .sort((a, b) => b.risk_score - a.risk_score);
}

// Obtenir les risques High/Very High
export async function getHighPriorityRisks(projectId: string): Promise<Risk[]> {
  const { data, error } = await supabase
    .from('risk_register')
    .select('*')
    .eq('project_id', projectId)
    .in('impact', ['high', 'very_high']);

  if (error) {
    console.error('Error fetching high priority risks:', error);
    return [];
  }

  return data || [];
}

// Générer un rapport de risque
export async function generateRiskReport(projectId: string) {
  const risks = await getRisksByPriority(projectId);

  const riskMatrix = {
    very_high: risks.filter(r => calculateRiskScore(r.probability, r.impact) >= 16).length,
    high: risks.filter(r => {
      const score = calculateRiskScore(r.probability, r.impact);
      return score >= 12 && score < 16;
    }).length,
    medium: risks.filter(r => {
      const score = calculateRiskScore(r.probability, r.impact);
      return score >= 6 && score < 12;
    }).length,
    low: risks.filter(r => calculateRiskScore(r.probability, r.impact) < 6).length,
  };

  return {
    project_id: projectId,
    total_risks: risks.length,
    by_status: {
      identified: risks.filter(r => r.status === 'identified').length,
      mitigating: risks.filter(r => r.status === 'mitigating').length,
      monitoring: risks.filter(r => r.status === 'monitoring').length,
      resolved: risks.filter(r => r.status === 'resolved').length,
    },
    risk_matrix: riskMatrix,
    avg_risk_score: risks.length > 0
      ? Math.round(risks.reduce((sum, r) => sum + calculateRiskScore(r.probability, r.impact), 0) / risks.length)
      : 0,
  };
}

// Supprimer un risque
export async function deleteRisk(riskId: string): Promise<boolean> {
  const { error } = await supabase
    .from('risk_register')
    .delete()
    .eq('id', riskId);

  if (error) {
    console.error('Error deleting risk:', error);
    return false;
  }

  return true;
}
