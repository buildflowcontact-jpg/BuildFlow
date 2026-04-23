// ===========================================
// Document Workflow - Document Versioning & Approval
// ===========================================

import { supabase } from './supabase';

export type DocumentStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface DocumentVersion {
  id: string;
  document_id: string;
  version_number: number;
  status: DocumentStatus;
  created_by: string;
  reviewed_by: string | null;
  approved_by: string | null;
  content_url: string;
  signature_required: boolean;
  signed_at: string | null;
  signed_by: string | null;
  comments: string;
  created_at: string;
}

export interface DocumentWithVersions {
  id: string;
  name: string;
  versions: DocumentVersion[];
  current_status: DocumentStatus;
  latest_version: number;
}

// Créer une nouvelle version d'un document
export async function createDocumentVersion(
  documentId: string,
  contentUrl: string,
  signatureRequired: boolean = false,
  comments: string = ''
): Promise<DocumentVersion | null> {
  // Récupérer la version précédente
  const { data: prevVersions } = await supabase
    .from('document_versions')
    .select('version_number')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false })
    .limit(1);

  const nextVersion = (prevVersions?.[0]?.version_number || 0) + 1;

  const { data, error } = await supabase
    .from('document_versions')
    .insert({
      document_id: documentId,
      version_number: nextVersion,
      content_url: contentUrl,
      signature_required: signatureRequired,
      comments,
      status: 'draft',
    })
    .select()
    .single();

  if (error) {
    console.error('Error creating document version:', error);
    return null;
  }

  return data;
}

// Récupérer toutes les versions d'un document
export async function getDocumentVersions(documentId: string): Promise<DocumentVersion[]> {
  const { data, error } = await supabase
    .from('document_versions')
    .select('*')
    .eq('document_id', documentId)
    .order('version_number', { ascending: false });

  if (error) {
    console.error('Error fetching document versions:', error);
    return [];
  }

  return data || [];
}

// Soumettre une version pour revue
export async function submitForReview(versionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('document_versions')
    .update({ status: 'review' })
    .eq('id', versionId);

  if (error) {
    console.error('Error submitting for review:', error);
    return false;
  }

  return true;
}

// Approuver une version avec signature optionnelle
export async function approveDocumentVersion(
  versionId: string,
  approvedBy: string,
  signature?: string
): Promise<boolean> {
  const { error } = await supabase
    .from('document_versions')
    .update({
      status: 'approved',
      approved_by: approvedBy,
      signed_at: signature ? new Date().toISOString() : null,
      signed_by: signature ? approvedBy : null,
    })
    .eq('id', versionId);

  if (error) {
    console.error('Error approving document:', error);
    return false;
  }

  return true;
}

// Rejeter une version
export async function rejectDocumentVersion(
  versionId: string,
  rejectionReason: string
): Promise<boolean> {
  const { error } = await supabase
    .from('document_versions')
    .update({
      status: 'draft',
      comments: rejectionReason,
    })
    .eq('id', versionId);

  if (error) {
    console.error('Error rejecting document:', error);
    return false;
  }

  return true;
}

// Obtenir l'historique d'approbation d'un document
export async function getApprovalHistory(documentId: string) {
  const versions = await getDocumentVersions(documentId);

  const history = [];

  for (const version of versions) {
    const versionHistory: Record<string, unknown> = {
      version_number: version.version_number,
      status: version.status,
      created_at: version.created_at,
    };

    if (version.created_by) {
      const { data: creator } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', version.created_by)
        .single();

      versionHistory.created_by_name = creator?.name;
    }

    if (version.reviewed_by) {
      const { data: reviewer } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', version.reviewed_by)
        .single();

      versionHistory.reviewed_by_name = reviewer?.name;
    }

    if (version.approved_by) {
      const { data: approver } = await supabase
        .from('user_profiles')
        .select('name')
        .eq('id', version.approved_by)
        .single();

      versionHistory.approved_by_name = approver?.name;
      versionHistory.approved_at = version.signed_at;
    }

    history.push(versionHistory);
  }

  return history;
}

// Obtenir les documents en attente de revue
export async function getPendingReviewDocuments(projectId: string): Promise<DocumentWithVersions[]> {
  const { data: documents } = await supabase
    .from('documents')
    .select('id, title')
    .eq('project_id', projectId);

  const pending = [];

  for (const doc of documents || []) {
    const versions = await getDocumentVersions(doc.id);
    const reviewVersions = versions.filter(v => v.status === 'review');

    if (reviewVersions.length > 0) {
      pending.push({
        id: doc.id,
        name: doc.title || 'Untitled',
        versions: versions,
        current_status: 'review' as DocumentStatus,
        latest_version: Math.max(...versions.map(v => v.version_number)),
      });
    }
  }

  return pending;
}

// Archiver une version
export async function archiveDocumentVersion(versionId: string): Promise<boolean> {
  const { error } = await supabase
    .from('document_versions')
    .update({ status: 'archived' })
    .eq('id', versionId);

  if (error) {
    console.error('Error archiving document version:', error);
    return false;
  }

  return true;
}
