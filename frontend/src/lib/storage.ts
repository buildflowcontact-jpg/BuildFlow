import { supabase } from './supabase'

export interface UploadedFile {
  id: string
  file_name: string
  file_path: string
  file_type: string
  file_size: number
  uploaded_by: string
  related_table: string
  related_id: string
  created_at: string
  url?: string
}

const STORAGE_BUCKET = 'attachments'
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

export async function uploadFile(
  file: File,
  relatedTable: string,
  relatedId: string,
  userId: string
): Promise<UploadedFile | null> {
  try {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`Le fichier dépasse la taille maximale de 50MB`)
    }

    // Generate unique file path: projects/{projectId}/attachments/{timestamp}-{filename}
    // or tasks/{taskId}/attachments/{timestamp}-{filename}
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filePath = `${relatedTable}/${relatedId}/${timestamp}-${sanitizedName}`

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(filePath, file, { upsert: false })

    if (uploadError) throw uploadError

    // Create attachment record in database
    const { data, error: dbError } = await supabase
      .from('attachments')
      .insert([
        {
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: userId,
          related_table: relatedTable,
          related_id: relatedId,
        },
      ])
      .select()
      .single()

    if (dbError) throw dbError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(filePath)

    return {
      ...data,
      url: urlData?.publicUrl,
    }
  } catch (error) {
    console.error('Error uploading file:', error)
    throw error
  }
}

export async function getAttachments(
  relatedTable: string,
  relatedId: string
): Promise<UploadedFile[]> {
  try {
    const { data, error } = await supabase
      .from('attachments')
      .select('*')
      .eq('related_table', relatedTable)
      .eq('related_id', relatedId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Add public URLs to each file
    return (data || []).map((file) => {
      const { data: urlData } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(file.file_path)

      return {
        ...file,
        url: urlData?.publicUrl,
      }
    })
  } catch (error) {
    console.error('Error fetching attachments:', error)
    return []
  }
}

export async function deleteAttachment(fileId: string, filePath: string): Promise<boolean> {
  try {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .remove([filePath])

    if (storageError) throw storageError

    // Delete from database
    const { error: dbError } = await supabase
      .from('attachments')
      .delete()
      .eq('id', fileId)

    if (dbError) throw dbError

    return true
  } catch (error) {
    console.error('Error deleting attachment:', error)
    return false
  }
}

export async function getFileUrl(filePath: string): Promise<string> {
  const { data } = supabase.storage
    .from(STORAGE_BUCKET)
    .getPublicUrl(filePath)

  return data?.publicUrl || ''
}

// Format file size in human-readable format
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

// Get file extension and icon
export function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const iconMap: Record<string, string> = {
    pdf: '📄',
    doc: '📘',
    docx: '📘',
    xls: '📊',
    xlsx: '📊',
    ppt: '🎬',
    pptx: '🎬',
    jpg: '🖼️',
    jpeg: '🖼️',
    png: '🖼️',
    gif: '🖼️',
    zip: '📦',
    rar: '📦',
    txt: '📝',
    csv: '📋',
  }
  return iconMap[ext] || '📎'
}
