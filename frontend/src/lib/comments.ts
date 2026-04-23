import { supabase } from './supabase'

export interface Comment {
  id: string
  task_id: string
  author_id: string
  author_name?: string
  author_avatar?: string
  content: string
  mentions: string[]
  reactions: CommentReaction[]
  created_at: string
  updated_at: string
}

export interface CommentReaction {
  id: string
  comment_id: string
  user_id: string
  emoji: string
}

// Get all comments for a task
export async function getTaskComments(taskId: string): Promise<Comment[]> {
  try {
    const { data, error } = await supabase
      .from('comments')
      .select(
        `
        id,
        task_id,
        author_id,
        content,
        mentions,
        created_at,
        updated_at,
        comment_reactions(id, comment_id, user_id, emoji)
      `
      )
      .eq('task_id', taskId)
      .order('created_at', { ascending: true })

    if (error) throw error

    // Batch fetch: une seule requête pour tous les auteurs
    const authorIds = [...new Set((data || []).map((c: any) => c.author_id))]
    const profilesMap = new Map<string, { name: string; color: string }>()
    if (authorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('user_profiles')
        .select('id, name, color')
        .in('id', authorIds)
      for (const p of profiles || []) {
        profilesMap.set(p.id, { name: p.name || 'Anonyme', color: p.color || 'bg-gray-500' })
      }
    }

    const commentsWithAuthors: Comment[] = (data || []).map((comment: any) => {
      const profile = profilesMap.get(comment.author_id)
      return {
        ...comment,
        author_name: profile?.name || 'Anonyme',
        author_avatar: profile?.color || 'bg-gray-500',
        reactions: comment.comment_reactions || [],
      }
    })

    return commentsWithAuthors
  } catch (error) {
    console.error('Error fetching comments:', error)
    return []
  }
}

// Create a new comment
export async function createComment(taskId: string, content: string, mentions: string[] = []): Promise<Comment | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          task_id: taskId,
          author_id: user.id,
          content,
          mentions,
        },
      ])
      .select()
      .single()

    if (error) throw error

    // Fetch profile for the new comment
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('name, color')
      .eq('id', user.id)
      .single()

    return {
      ...data,
      author_name: profile?.name || user.email,
      author_avatar: profile?.color || 'bg-gray-500',
      reactions: [],
    }
  } catch (error) {
    console.error('Error creating comment:', error)
    return null
  }
}

// Update a comment
export async function updateComment(commentId: string, content: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    const { error } = await supabase
      .from('comments')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', commentId)
      .eq('author_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error updating comment:', error)
    return false
  }
}

// Delete a comment
export async function deleteComment(commentId: string): Promise<boolean> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    const { error } = await supabase.from('comments').delete().eq('id', commentId).eq('author_id', user.id)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error deleting comment:', error)
    return false
  }
}

// Add reaction to comment
export async function addCommentReaction(commentId: string, emoji: string): Promise<CommentReaction | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Utilisateur non authentifié')

    const { data, error } = await supabase
      .from('comment_reactions')
      .insert([
        {
          comment_id: commentId,
          user_id: user.id,
          emoji,
        },
      ])
      .select()
      .single()

    if (error && error.code !== 'PGRST116') throw error

    // If already exists, fetch existing
    if (error?.code === 'PGRST116') {
      const { data: existing } = await supabase
        .from('comment_reactions')
        .select('*')
        .eq('comment_id', commentId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .single()

      return existing
    }

    return data
  } catch (error) {
    console.error('Error adding reaction:', error)
    return null
  }
}

// Remove reaction from comment
export async function removeCommentReaction(reactionId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('comment_reactions').delete().eq('id', reactionId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Error removing reaction:', error)
    return false
  }
}

// Get all users mentionable (for @mentions autocomplete)
export async function getMentionablePlayers(): Promise<Array<{ id: string; name: string; email: string }>> {
  try {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('id, name, email')
      .order('name', { ascending: true })

    if (error) throw error
    return data || []
  } catch (error) {
    console.error('Error fetching mentionable users:', error)
    return []
  }
}
