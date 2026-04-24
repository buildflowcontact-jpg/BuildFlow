import { useToast } from './ToastContext';

const toastTypeStyles: Record<string, string> = {
  success: 'bg-green-600 text-white',
  error: 'bg-red-600 text-white',
  info: 'bg-blue-600 text-white',
  warning: 'bg-yellow-500 text-black',
};

export const ToastContainer = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div className="fixed z-50 top-6 right-6 flex flex-col gap-3 items-end">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`min-w-[220px] px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 ${toastTypeStyles[toast.type] || toastTypeStyles.info} animate-fade-in`}
          role="alert"
          tabIndex={0}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            className="ml-2 text-lg font-bold opacity-70 hover:opacity-100 focus:outline-none"
            onClick={() => removeToast(toast.id)}
            aria-label="Fermer la notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
};

// Animation CSS à ajouter dans index.css ou global
// .animate-fade-in { animation: fadeIn 0.3s; }
// @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: none; } }
