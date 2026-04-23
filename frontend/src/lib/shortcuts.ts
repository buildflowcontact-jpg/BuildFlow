import React from 'react'

// Keyboard shortcuts configuration

export interface KeyboardShortcut {
  keys: string[]
  description: string
  action: () => void
  category: 'navigation' | 'task' | 'project' | 'global'
}

export const KEYBOARD_SHORTCUTS = {
  createTask: {
    mac: ['cmd', 'K'],
    windows: ['ctrl', 'K'],
    description: 'Créer une nouvelle tâche',
  },
  toggleStatus: {
    mac: ['cmd', 'enter'],
    windows: ['ctrl', 'enter'],
    description: 'Basculer le statut de la tâche',
  },
  openSearch: {
    mac: ['cmd', '/'],
    windows: ['ctrl', '/'],
    description: 'Ouvrir la recherche',
  },
  showHelp: {
    mac: ['?'],
    windows: ['?'],
    description: 'Afficher l\'aide',
  },
  escape: {
    mac: ['esc'],
    windows: ['esc'],
    description: 'Fermer le modal/menu',
  },
}

// Detect key combination
export function isKeyCombo(event: KeyboardEvent, keys: string[]): boolean {
  const keysPressed: Record<string, boolean> = {
    cmd: event.metaKey,
    ctrl: event.ctrlKey,
    shift: event.shiftKey,
    alt: event.altKey,
  }

  return keys.every((key) => {
    if (key in keysPressed) return keysPressed[key]
    return event.key.toLowerCase() === key.toLowerCase()
  })
}

// Hook for keyboard shortcuts
export function useKeyboardShortcuts(callbacks: Record<string, () => void>) {
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Create task: Cmd/Ctrl + K
      if (isKeyCombo(e, ['cmd', 'k']) || isKeyCombo(e, ['ctrl', 'k'])) {
        e.preventDefault()
        callbacks.createTask?.()
      }

      // Help: ?
      if (e.key === '?') {
        e.preventDefault()
        callbacks.showHelp?.()
      }

      // Search: Cmd/Ctrl + /
      if (isKeyCombo(e, ['cmd', '/']) || isKeyCombo(e, ['ctrl', '/'])) {
        e.preventDefault()
        callbacks.openSearch?.()
      }

      // Escape
      if (e.key === 'Escape') {
        callbacks.closeModals?.()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [callbacks])
}

// Display shortcuts reference
export function getShortcutDisplay(isMac: boolean = false): Record<string, string> {
  const isMacOS = isMac || /Mac|iPhone|iPad|iPod/.test(navigator.platform)

  return {
    createTask: isMacOS ? '⌘ K' : 'Ctrl + K',
    toggleStatus: isMacOS ? '⌘ ⏎' : 'Ctrl + Enter',
    openSearch: isMacOS ? '⌘ /' : 'Ctrl + /',
    showHelp: '?',
    escape: 'Esc',
  }
}
