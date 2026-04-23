import { useEffect, useState } from 'react'
import { Send, Smile } from 'lucide-react'
import { createComment, getTaskComments, Comment, addCommentReaction, removeCommentReaction } from '../lib/comments'
import { MentionInput } from './MentionInput'

interface CommentSectionProps {
  taskId: string
}

export function CommentSection({ taskId }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [newComment, setNewComment] = useState('')
  const [mentions, setMentions] = useState<string[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    loadComments()
  }, [taskId])

  const loadComments = async () => {
    try {
      setLoading(true)
      const data = await getTaskComments(taskId)
      setComments(data)
    } catch (error) {
      console.error('Error loading comments:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) return

    try {
      setSubmitting(true)
      const comment = await createComment(taskId, newComment, mentions)
      if (comment) {
        setComments((prev) => [...prev, comment])
        setNewComment('')
        setMentions([])
      }
    } catch (error) {
      console.error('Error creating comment:', error)
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddReaction = async (commentId: string, emoji: string) => {
    try {
      await addCommentReaction(commentId, emoji)
      await loadComments()
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }

  const handleRemoveReaction = async (reactionId: string) => {
    try {
      await removeCommentReaction(reactionId)
      await loadComments()
    } catch (error) {
      console.error('Error removing reaction:', error)
    }
  }

  if (loading) {
    return <div className="text-center py-4 text-gray-500 text-sm">Chargement des commentaires...</div>
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900 flex items-center gap-2">
        💬 Commentaires ({comments.length})
      </h3>

      {/* Comments list */}
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onAddReaction={handleAddReaction}
            onRemoveReaction={handleRemoveReaction}
          />
        ))}
        {comments.length === 0 && <p className="text-sm text-gray-500 text-center py-4">Aucun commentaire pour l'instant.</p>}
      </div>

      {/* Comment input */}
      <form onSubmit={handleSubmit} className="border-t pt-4 space-y-2">
        <MentionInput
          value={newComment}
          onChange={(value) => setNewComment(value)}
          onMentionsChange={setMentions}
          placeholder="Ajouter un commentaire... (@pour mentionner)"
        />

        <div className="flex gap-2 justify-between items-center">
          <button
            type="button"
            onClick={() => setNewComment((prev) => `${prev}${prev ? ' ' : ''}😊`)}
            className="p-2 hover:bg-gray-100 rounded text-lg transition"
            title="Réactions rapides"
          >
            <Smile className="w-5 h-5 text-gray-600" />
          </button>
          <button
            type="submit"
            disabled={!newComment.trim() || submitting}
            className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm transition"
          >
            <Send className="w-4 h-4" />
            Envoyer
          </button>
        </div>
      </form>
    </div>
  )
}

interface CommentItemProps {
  comment: Comment
  onAddReaction: (commentId: string, emoji: string) => void
  onRemoveReaction: (reactionId: string) => void
}

function CommentItem({ comment, onAddReaction, onRemoveReaction }: CommentItemProps) {
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const authorName = comment.author_name || 'Utilisateur'

  const commonEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥']

  return (
    <div className="bg-gray-50 rounded p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-full ${comment.author_avatar || 'bg-gray-500'} text-white flex items-center justify-center text-sm font-semibold`}>
            {authorName[0]}
          </div>
          <div>
            <p className="font-medium text-sm text-gray-900">{authorName}</p>
            <p className="text-xs text-gray-500">{formatDate(comment.created_at)}</p>
          </div>
        </div>
      </div>

      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>

      {/* Reactions */}
      {comment.reactions.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2">
          {comment.reactions.reduce(
            (acc, r) => {
              const existing = acc.find((e) => e.emoji === r.emoji)
              if (existing) {
                existing.count++
                existing.ids.push(r.id)
              } else {
                acc.push({ emoji: r.emoji, count: 1, ids: [r.id] })
              }
              return acc
            },
            [] as Array<{ emoji: string; count: number; ids: string[] }>
          ).map((r) => (
            <button
              key={r.emoji}
              onClick={() => {
                const userReaction = comment.reactions.find((ur) => ur.emoji === r.emoji)
                if (userReaction) {
                  onRemoveReaction(userReaction.id)
                }
              }}
              className="flex items-center gap-1 bg-white hover:bg-gray-200 px-2 py-1 rounded text-xs border border-gray-200 transition"
            >
              <span>{r.emoji}</span>
              <span className="text-gray-600">{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Add reaction button */}
      <div className="flex gap-1 pt-1 relative">
        <button
          onClick={() => setShowReactionPicker(!showReactionPicker)}
          className="text-xs px-2 py-1 hover:bg-gray-200 rounded transition"
        >
          😊
        </button>

        {showReactionPicker && (
          <div className="absolute bottom-full left-0 mb-1 bg-white border rounded shadow-lg p-2 flex gap-1 z-10">
            {commonEmojis.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onAddReaction(comment.id, emoji)
                  setShowReactionPicker(false)
                }}
                className="text-lg hover:scale-125 transition"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function formatDate(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)

  if (diffMins < 1) return 'À l\'instant'
  if (diffMins < 60) return `Il y a ${diffMins}m`
  if (diffMins < 1440) return `Il y a ${Math.floor(diffMins / 60)}h`

  return date.toLocaleDateString('fr-FR')
}
