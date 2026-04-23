import React, { useRef, useState } from 'react'
import { Upload, X } from 'lucide-react'
import { uploadFile, UploadedFile, getAttachments, deleteAttachment, formatFileSize, getFileIcon } from '../lib/storage'

interface FileUploadProps {
  relatedTable: string
  relatedId: string
  onUploadComplete?: (file: UploadedFile) => void
  onFilesChange?: (files: UploadedFile[]) => void
  maxSize?: number // in MB
}

export function FileUpload({ relatedTable, relatedId, onUploadComplete, onFilesChange, maxSize = 50 }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string>('')
  const [userId, setUserId] = useState<string>('')

  // Load user ID and existing files on mount
  React.useEffect(() => {
    const loadData = async () => {
      try {
        const { data: { user } } = await (await import('../lib/supabase')).supabase.auth.getUser()
        if (user) setUserId(user.id)

        const existingFiles = await getAttachments(relatedTable, relatedId)
        setFiles(existingFiles)
        onFilesChange?.(existingFiles)
      } catch (err) {
        console.error('Error loading files:', err)
      }
    }

    loadData()
  }, [relatedTable, relatedId, onFilesChange])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.currentTarget.files
    if (!selectedFiles) return

    setError('')
    setLoading(true)

    try {
      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i]

        if (file.size > maxSize * 1024 * 1024) {
          throw new Error(`${file.name} dépasse la taille maximale de ${maxSize}MB`)
        }

        const uploadedFile = await uploadFile(file, relatedTable, relatedId, userId)
        if (uploadedFile) {
          setFiles((prev) => [uploadedFile, ...prev])
          onUploadComplete?.(uploadedFile)
        }
      }

      // Refresh file list
      const updatedFiles = await getAttachments(relatedTable, relatedId)
      setFiles(updatedFiles)
      onFilesChange?.(updatedFiles)

      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Erreur lors du téléchargement'
      setError(errorMsg)
      console.error('Upload error:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteFile = async (fileId: string, filePath: string) => {
    try {
      const success = await deleteAttachment(fileId, filePath)
      if (success) {
        setFiles((prev) => prev.filter((f) => f.id !== fileId))
        const updatedFiles = files.filter((f) => f.id !== fileId)
        onFilesChange?.(updatedFiles)
      }
    } catch (err) {
      console.error('Error deleting file:', err)
      setError('Erreur lors de la suppression')
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.add('bg-blue-50', 'border-blue-400')
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400')
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.currentTarget.classList.remove('bg-blue-50', 'border-blue-400')
    if (fileInputRef.current) {
      fileInputRef.current.files = e.dataTransfer.files
      handleFileSelect({ currentTarget: fileInputRef.current } as any)
    }
  }

  return (
    <div className="space-y-4">
      {/* Upload Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          disabled={loading}
          className="hidden"
          accept="*/*"
        />

        <div className="flex flex-col items-center justify-center gap-2">
          <Upload className="w-8 h-8 text-gray-400" />
          <div className="text-sm text-center">
            <p className="font-medium text-gray-700">Cliquez ou glissez-déposez</p>
            <p className="text-gray-500">fichiers jusqu'à {maxSize}MB</p>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">{error}</div>}

      {/* Files List */}
      {files.length > 0 && (
        <div className="space-y-2">
          <h4 className="font-medium text-sm text-gray-700">Fichiers attachés ({files.length})</h4>
          <div className="space-y-2">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center justify-between bg-gray-50 p-3 rounded border border-gray-200 hover:bg-gray-100 transition"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-lg">{getFileIcon(file.file_name)}</span>
                  <div className="flex-1 min-w-0">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline truncate block"
                    >
                      {file.file_name}
                    </a>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.file_size)} • {new Date(file.created_at).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteFile(file.id, file.file_path)}
                  className="p-2 hover:bg-red-100 text-red-600 rounded transition"
                  title="Supprimer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center gap-2 text-blue-600">
          <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
          <span className="text-sm">Téléchargement en cours...</span>
        </div>
      )}
    </div>
  )
}
