import { useState } from 'react';
import { FileCheck, Send, Clock } from 'lucide-react';

interface DocumentStep {
  step: number;
  name: string;
  status: 'pending' | 'in_progress' | 'completed';
  user?: string;
  date?: string;
}

const steps: DocumentStep[] = [
  { step: 1, name: 'Création', status: 'completed', user: 'Marie L.', date: '2024-01-15' },
  { step: 2, name: 'Révision', status: 'in_progress', user: 'Jean M.' },
  { step: 3, name: 'Approbation', status: 'pending' },
  { step: 4, name: 'Signature', status: 'pending' },
];

export default function DocumentApprovalFlow() {
  const [currentStep] = useState(1);

  const getStepColor = (status: string, stepNum: number) => {
    if (status === 'completed') return 'bg-green-100 text-green-700';
    if (status === 'in_progress' || stepNum === currentStep) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-400';
  };

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center gap-2 mb-4">
        <FileCheck size={18} className="text-blue-600" />
        <h3 className="font-semibold">Processus d'approbation</h3>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => (
          <div key={step.step}>
            <div className="flex items-center gap-3">
              {/* Step circle */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${getStepColor(
                  step.status,
                  step.step
                )}`}
              >
                {step.status === 'completed' ? '✓' : step.step}
              </div>

              {/* Step info */}
              <div className="flex-1">
                <p className="font-medium text-sm">{step.name}</p>
                {step.user && (
                  <p className="text-xs text-gray-500">
                    {step.user}
                    {step.date && ` (${new Date(step.date).toLocaleDateString('fr-FR')})`}
                  </p>
                )}
                {step.status === 'in_progress' && (
                  <p className="text-xs text-blue-600 flex items-center gap-1">
                    <Clock size={12} /> En cours...
                  </p>
                )}
              </div>

              {/* Status badge */}
              <span
                className={`px-2 py-1 text-xs rounded font-medium ${
                  step.status === 'completed'
                    ? 'bg-green-100 text-green-700'
                    : step.status === 'in_progress'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-500'
                }`}
              >
                {step.status === 'completed' ? 'Complété' : step.status === 'in_progress' ? 'En cours' : 'En attente'}
              </span>
            </div>

            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div className="ml-4 h-4 border-l-2 border-gray-300 my-2" />
            )}
          </div>
        ))}
      </div>

      <button
        className="w-full mt-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium flex items-center justify-center gap-2"
      >
        <Send size={16} /> Soumettre pour approbation
      </button>
    </div>
  );
}
