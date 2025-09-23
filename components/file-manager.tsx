'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from './ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog'
import { Trash2, File, FileText, FileImage, FileSpreadsheet, AlertCircle, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface FileInfo {
  filename: string
  documentId: string
  chunkCount: number
  uploadDate: string
  fileSize?: number
  fileType: string
}

interface FileManagerProps {
  isOpen: boolean
  onOpenChange: (open: boolean) => void
}

export function FileManager({ isOpen, onOpenChange }: FileManagerProps) {
  const { data: session } = useSession()
  const [files, setFiles] = useState<FileInfo[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [deletingFiles, setDeletingFiles] = useState<Set<string>>(new Set())

  const fetchFiles = async () => {
    if (!session) return

    setIsLoading(true)
    try {
      const response = await fetch('/api/files')
      if (!response.ok) {
        throw new Error('Failed to fetch files')
      }
      const data = await response.json()
      setFiles(data.files || [])
    } catch (error) {
      console.error('Error fetching files:', error)
      toast.error('Failed to load files')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen && session) {
      fetchFiles()
    }
  }, [isOpen, session])

  const handleDeleteFile = async (filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"? This will remove the file and all its associated data from the system.`)) {
      return
    }

    setDeletingFiles(prev => new Set(prev).add(filename))
    
    try {
      const response = await fetch(`/api/files/${encodeURIComponent(filename)}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete file')
      }

      toast.success(`File "${filename}" deleted successfully`)
      setFiles(prev => prev.filter(file => file.filename !== filename))
    } catch (error) {
      console.error('Error deleting file:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to delete file')
    } finally {
      setDeletingFiles(prev => {
        const newSet = new Set(prev)
        newSet.delete(filename)
        return newSet
      })
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return 'Unknown size'
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return `${Math.round(bytes / Math.pow(1024, i) * 100) / 100} ${sizes[i]}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString() + ' ' + new Date(dateString).toLocaleTimeString()
  }

  const getFileIcon = (fileType: string, filename: string) => {
    const extension = filename.split('.').pop()?.toLowerCase()
    
    if (fileType === 'pdf' || extension === 'pdf') {
      return <File className="w-4 h-4 text-red-500" />
    } else if (fileType === 'word' || ['doc', 'docx'].includes(extension || '')) {
      return <FileText className="w-4 h-4 text-blue-500" />
    } else if (fileType === 'excel' || ['xls', 'xlsx', 'csv'].includes(extension || '')) {
      return <FileSpreadsheet className="w-4 h-4 text-green-500" />
    } else if (['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(extension || '')) {
      return <FileImage className="w-4 h-4 text-purple-500" />
    } else {
      return <FileText className="w-4 h-4 text-gray-500" />
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Document Manager</DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Loading files...</span>
            </div>
          ) : files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <File className="w-12 h-12 mb-4" />
              <p className="text-lg font-medium">No documents uploaded</p>
              <p className="text-sm">Upload documents in the chat to get started</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="grid gap-3">
                {files.map((file) => (
                  <div
                    key={file.documentId}
                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(file.fileType, file.filename)}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium truncate" title={file.filename}>
                            {file.filename}
                          </p>
                          {file.chunkCount > 0 && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                              {file.chunkCount} chunks
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                          <span>{formatFileSize(file.fileSize)}</span>
                          <span>{formatDate(file.uploadDate)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteFile(file.filename)}
                      disabled={deletingFiles.has(file.filename)}
                      className="text-destructive hover:text-destructive-foreground hover:bg-destructive"
                    >
                      {deletingFiles.has(file.filename) ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          {files.length > 0 && (
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertCircle className="w-4 h-4" />
                <span>Deleting a document will remove it from the system and all associated chat context.</span>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
