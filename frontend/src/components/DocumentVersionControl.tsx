import { useState, useEffect } from 'react';
import { FileText, CheckCircle, Clock } from 'lucide-react';
import { getDocumentVersions, submitForReview } from '../lib/documentWorkflow';

interface DocumentVersion {
  id: string;
  version_number: number;
  status: string;
  created_at: string;
  content_url: string;
}

export default function DocumentVersionControl({ documentId }: { documentId: string }) {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadVersions();
  }, [documentId]);

  async function loadVersions() {
    const data = await getDocumentVersions(documentId);
    setVersions(data);
    setLoading(false);
  }

  async function handleSubmitReview(versionId: string) {
    await submitForReview(versionId);
    loadVersions();
  }

  const getStatusIcon = (status: string) => {
    if (status === 'approved') return <CheckCircle size={16} className="text-green-600" />;
    if (status === 'review') return <Clock size={16} className="text-blue-600" />;
    return <FileText size={16} className="text-gray-400" />;
  };

  const getStatusColor = (status: string) => {
    if (status === 'approved') return 'bg-green-50';
    if (status === 'review') return 'bg-blue-50';
    if (status === 'draft') return 'bg-gray-50';
    return 'bg-gray-100';
  };

  if (loading) return <div className="text-center py-4">Chargement...</div>;

  return (
    <div className="bg-white rounded-lg border p-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <FileText size={18} /> Versions du document
      </h3>

      <div className="space-y-2">
        {versions.map((version) => (
          <div key={version.id} className={`p-3 rounded border ${getStatusColor(version.status)}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon(version.status)}
                <div>
                  <p className="font-medium text-sm">v{version.version_number}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(version.created_at).toLocaleDateString('fr-FR')}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs rounded font-medium ${
                version.status === 'approved' ? 'bg-green-200 text-green-800' :
                version.status === 'review' ? 'bg-blue-200 text-blue-800' :
                version.status === 'draft' ? 'bg-gray-200 text-gray-800' : ''
              }`}>
                {version.status === 'draft' ? 'Brouillon' :
                 version.status === 'review' ? 'En revue' :
                 version.status === 'approved' ? 'Approuvé' : version.status}
              </span>
            </div>

            {version.status === 'draft' && (
              <button
                onClick={() => handleSubmitReview(version.id)}
                className="mt-2 w-full py-1 text-xs bg-blue-100 text-blue-600 rounded hover:bg-blue-200 font-medium"
              >
                Soumettre pour revue
              </button>
            )}
          </div>
        ))}
      </div>

      {versions.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-4">Aucune version</p>
      )}
    </div>
  );
}
