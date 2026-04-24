import { useEffect, useState } from 'react'
import { X, Keyboard } from 'lucide-react'
import { getShortcutDisplay } from '../lib/shortcuts'

interface KeyboardShortcutsHelpProps {
  onClose: () => void
}

export function KeyboardShortcutsHelp({ onClose }: KeyboardShortcutsHelpProps) {
  const [showModal, setShowModal] = useState(false)
  const shortcuts = getShortcutDisplay()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTypingContext = !!target && (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      )

      if (isTypingContext) {
        return
      }

      if (e.key === '?') {
        e.preventDefault()
        setShowModal((prev) => !prev)
      }
      if (e.key === 'Escape') {
        setShowModal(false)
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  useEffect(() => {
    const previous = document.body.style.overflow
    if (showModal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = previous || ''
    }
    return () => {
      document.body.style.overflow = previous
    }
  }, [showModal])

  if (!showModal) {
    return null
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Raccourcis clavier"
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto"
      onClick={() => setShowModal(false)}
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] bf-modal-panel overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b p-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Keyboard className="w-5 h-5" /> Raccourcis clavier
          </h2>
          <button type="button" aria-label="Fermer" onClick={() => setShowModal(false)} className="bf-button-secondary">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Global shortcuts */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Général</h3>
            <div className="space-y-2">
              <ShortcutItem label="Créer tâche" shortcut={shortcuts.createTask} />
              <ShortcutItem label="Rechercher" shortcut={shortcuts.openSearch} />
              <ShortcutItem label="Aide" shortcut={shortcuts.showHelp} />
              <ShortcutItem label="Fermer" shortcut={shortcuts.escape} />
            </div>
          </div>

          {/* Task shortcuts */}
          <div>
            <h3 className="font-semibold text-gray-900 mb-3 text-sm uppercase tracking-wide">Tâches</h3>
            <div className="space-y-2">
              <ShortcutItem label="Basculer statut" shortcut={shortcuts.toggleStatus} />
              <ShortcutItem label="Éditer" shortcut="E" />
              <ShortcutItem label="Supprimer" shortcut="D" />
              <ShortcutItem label="Dupliquer" shortcut="C" />
            </div>
          </div>

          {/* Tips */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-6">
            <p className="text-xs text-blue-900">
              <strong>Astuce:</strong> Appuyez sur <kbd className="bg-white px-1 border rounded text-xs">?</kbd> n'importe
              où pour afficher cette boîte de dialogue.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function ShortcutItem({ label, shortcut }: { label: string; shortcut: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-700">{label}</span>
      <kbd className="px-2 py-1 bg-gray-100 border border-gray-300 rounded text-xs font-mono text-gray-700">
        {shortcut}
      </kbd>
    </div>
  )
}

