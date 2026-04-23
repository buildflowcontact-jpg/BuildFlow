import React, { useEffect, useRef, useState } from 'react'
import { getMentionablePlayers } from '../lib/comments'

interface MentionInputProps {
  value: string
  onChange: (value: string) => void
  onMentionsChange?: (mentions: string[]) => void
  placeholder?: string
  rows?: number
}

export function MentionInput({
  value,
  onChange,
  onMentionsChange,
  placeholder = 'Tapez votre message...',
  rows = 3,
}: MentionInputProps) {
  const [suggestions, setSuggestions] = useState<Array<{ id: string; name: string; email: string }>>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [triggerIndex, setTriggerIndex] = useState(-1)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const loadUsers = async () => {
      const users = await getMentionablePlayers()
      setSuggestions(users)
    }
    loadUsers()
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.currentTarget.value
    onChange(text)

    // Check for @ mention trigger
    const lastAtIndex = text.lastIndexOf('@')
    if (lastAtIndex !== -1) {
      const afterAt = text.substring(lastAtIndex + 1)
      const hasSpace = afterAt.includes(' ')

      if (!hasSpace) {
        setTriggerIndex(lastAtIndex)
        setShowSuggestions(true)
        setSelectedIndex(0)
      } else {
        setShowSuggestions(false)
      }
    } else {
      setShowSuggestions(false)
    }

    // Update mentions list
    const mentionMatches = text.match(/@\w+/g) || []
    const mentionNames = mentionMatches.map((m) => m.substring(1))
    onMentionsChange?.(mentionNames)
  }

  const handleMentionSelect = (user: { id: string; name: string }) => {
    const beforeAt = value.substring(0, triggerIndex)
    const afterAt = value.substring(triggerIndex + 1)
    const afterAtSpaceIndex = afterAt.indexOf(' ')
    const afterMention = afterAtSpaceIndex !== -1 ? afterAt.substring(afterAtSpaceIndex) : ''

    const newText = `${beforeAt}@${user.name}${afterMention ? ' ' : ''}`
    onChange(newText)

    setShowSuggestions(false)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % suggestions.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length)
    } else if (e.key === 'Enter' && suggestions[selectedIndex]) {
      e.preventDefault()
      handleMentionSelect(suggestions[selectedIndex])
    } else if (e.key === 'Escape') {
      setShowSuggestions(false)
    }
  }

  return (
    <div className="relative">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
      />

      {/* Mention suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute bottom-full left-0 mb-1 w-full bg-white border border-gray-300 rounded-lg shadow-lg z-50 max-h-48 overflow-y-auto"
        >
          {suggestions.map((user, index) => (
            <button
              key={user.id}
              onClick={() => handleMentionSelect(user)}
              className={`w-full text-left px-3 py-2 hover:bg-blue-50 transition ${index === selectedIndex ? 'bg-blue-100' : ''}`}
            >
              <p className="font-medium text-sm text-gray-900">{user.name}</p>
              <p className="text-xs text-gray-500">{user.email}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
