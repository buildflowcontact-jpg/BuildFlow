type ModalTabItem = {
  id: string
  label: string
  disabled?: boolean
  accent?: 'indigo' | 'emerald' | 'amber' | 'rose' | 'sky'
}

interface ModalTabsProps {
  tabs: ModalTabItem[]
  value: string
  onChange: (id: string) => void
  className?: string
}

const ACCENT_CLASSES: Record<NonNullable<ModalTabItem['accent']>, string> = {
  indigo: 'border-indigo-300 bg-indigo-50 text-indigo-900',
  emerald: 'border-emerald-300 bg-emerald-50 text-emerald-900',
  amber: 'border-amber-300 bg-amber-50 text-amber-900',
  rose: 'border-rose-300 bg-rose-50 text-rose-900',
  sky: 'border-sky-300 bg-sky-50 text-sky-900',
}

const DEFAULT_ACCENTS: Array<NonNullable<ModalTabItem['accent']>> = ['indigo', 'emerald', 'amber', 'rose', 'sky']

export function ModalTabs({ tabs, value, onChange, className = '' }: ModalTabsProps) {
  const enabledTabs = tabs.filter((tab) => !tab.disabled)

  const focusTabById = (tabId: string) => {
    const nextTab = document.querySelector<HTMLButtonElement>(`button[data-modal-tab-id="${tabId}"]`)
    nextTab?.focus()
  }

  const onTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>, tabId: string) => {
    if (enabledTabs.length === 0) return
    const currentIndex = enabledTabs.findIndex((tab) => tab.id === tabId)
    if (currentIndex < 0) return

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault()
      const next = enabledTabs[(currentIndex + 1) % enabledTabs.length]
      onChange(next.id)
      focusTabById(next.id)
      return
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault()
      const prev = enabledTabs[(currentIndex - 1 + enabledTabs.length) % enabledTabs.length]
      onChange(prev.id)
      focusTabById(prev.id)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      const first = enabledTabs[0]
      onChange(first.id)
      focusTabById(first.id)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      const last = enabledTabs[enabledTabs.length - 1]
      onChange(last.id)
      focusTabById(last.id)
    }
  }

  return (
    <div className={`w-full border-b-2 border-slate-300 bg-[linear-gradient(to_bottom,rgba(248,250,252,0.7),rgba(255,255,255,0))] ${className}`}>
      <div role="tablist" aria-orientation="horizontal" className="flex flex-wrap items-end gap-1.5 pb-0 pt-2">
        {tabs.map((tab, index) => {
          const active = value === tab.id
          const accent = tab.accent ?? DEFAULT_ACCENTS[index % DEFAULT_ACCENTS.length]
          const activeAccentClass = ACCENT_CLASSES[accent]
          const offsetY = active ? 0 : Math.min(index, 4) + 2

          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              id={`modal-tab-${tab.id}`}
              aria-selected={active}
              aria-controls={`modal-tab-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              data-modal-tab-id={tab.id}
              disabled={tab.disabled}
              onClick={() => !tab.disabled && onChange(tab.id)}
              onKeyDown={(event) => onTabKeyDown(event, tab.id)}
              style={{ transform: `translateY(${offsetY}px)` }}
              className={`relative -mb-px rounded-t-2xl border px-4 pt-2.5 pb-2 text-xs font-semibold transition whitespace-nowrap ${
                active
                  ? `${activeAccentClass} border-b-white shadow-[0_-2px_0_rgba(15,23,42,0.03),0_10px_18px_-14px_rgba(15,23,42,0.55)]`
                  : 'border-slate-300 bg-slate-100 text-slate-600 shadow-[inset_0_-1px_0_rgba(148,163,184,0.25)] hover:bg-slate-50 hover:text-slate-800 hover:-translate-y-[1px]'
              } ${tab.disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span className="pointer-events-none relative z-10">{tab.label}</span>
              {active && (
                <>
                  <span className="absolute left-0 right-0 -bottom-px h-px bg-white" aria-hidden="true" />
                  <span
                    className="absolute -bottom-[7px] right-4 h-3 w-3 rotate-45 border-r border-b border-slate-300 bg-white"
                    aria-hidden="true"
                  />
                  <span
                    className="absolute -bottom-[7px] left-4 h-3 w-3 rotate-45 border-l border-b border-slate-300 bg-white"
                    aria-hidden="true"
                  />
                </>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
