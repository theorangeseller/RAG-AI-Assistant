import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'

export interface SupabaseFileStorageConfig {
  supabaseUrl: string
  supabaseKey: string
  bucketName?: string
}

export interface UploadedFile {
  id: string
  filename: string
  file_path: string
  file_size: number
  file_type: string
  content_hash: string
  uploaded_at: string
  user_id: string
  metadata: Record<string, any>
}

export class SupabaseFileStorage {
  public supabase: any // Make public for deletion access
  public bucketName: string // Make public for deletion access

  constructor(config: SupabaseFileStorageConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey)
    this.bucketName = config.bucketName || 'documents'
  }

  /**
   * Upload a file to Supabase Storage
   */
  async uploadFile(
    file: File | Buffer,
    filename: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<UploadedFile> {
    try {
      // Generate content hash
      const contentHash = await this.generateContentHash(file)
      
      // Sanitize filename to remove special characters that might cause storage issues
      const sanitizedFilename = this.sanitizeFilename(filename)
      
      // Create file path with user ID for organization
      const filePath = `${userId}/${Date.now()}-${sanitizedFilename}`
      
      // Upload file to storage
      const { data: uploadData, error: uploadError } = await this.supabase.storage
        .from(this.bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        })

      if (uploadError) {
        console.error('Error uploading file:', uploadError)
        throw uploadError
      }

      // Get file info
      const { data: fileInfo } = await this.supabase.storage
        .from(this.bucketName)
        .list(userId, {
          search: filename
        })

      // Create document record in database
      const documentData = {
        filename, // Keep original filename for display
        file_path: filePath,
        file_size: file instanceof File ? file.size : file.length,
        file_type: this.getFileType(filename),
        content_hash: contentHash,
        user_id: userId,
        metadata: {
          ...metadata,
          original_filename: filename, // Store original filename
          sanitized_filename: sanitizedFilename, // Store sanitized filename
          storage_path: uploadData.path,
          uploaded_at: new Date().toISOString()
        }
      }

      const { data: document, error: docError } = await this.supabase
        .from('documents')
        .insert(documentData)
        .select()
        .single()

      if (docError) {
        console.error('Error creating document record:', docError)
        // Clean up uploaded file if database insert fails
        await this.supabase.storage
          .from(this.bucketName)
          .remove([filePath])
        throw docError
      }

      console.log(`Successfully uploaded file: ${filename}`)
      return document
    } catch (error) {
      console.error('Error in uploadFile:', error)
      throw error
    }
  }

  /**
   * Download a file from Supabase Storage
   */
  async downloadFile(filePath: string): Promise<Blob> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .download(filePath)

      if (error) {
        console.error('Error downloading file:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in downloadFile:', error)
      throw error
    }
  }

  /**
   * Get file URL for direct access
   */
  async getFileUrl(filePath: string, expiresIn: number = 3600): Promise<string> {
    try {
      const { data, error } = await this.supabase.storage
        .from(this.bucketName)
        .createSignedUrl(filePath, expiresIn)

      if (error) {
        console.error('Error creating signed URL:', error)
        throw error
      }

      return data.signedUrl
    } catch (error) {
      console.error('Error in getFileUrl:', error)
      throw error
    }
  }

  /**
   * Delete a file from storage and database
   */
  async deleteFile(documentId: string): Promise<void> {
    try {
      // Get document info first
      const { data: document, error: docError } = await this.supabase
        .from('documents')
        .select('file_path')
        .eq('id', documentId)
        .single()

      if (docError) {
        // If document doesn't exist (PGRST116), it might already be deleted
        if (docError.code === 'PGRST116') {
          console.log(`Document ${documentId} already deleted from database`)
          return // Exit gracefully
        }
        console.error('Error getting document info:', docError)
        throw docError
      }

      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from(this.bucketName)
        .remove([document.file_path])

      if (storageError) {
        console.warn('Warning deleting file from storage:', storageError)
        // Don't throw - storage deletion is less critical
      } else {
        console.log(`Successfully deleted file from storage: ${document.file_path}`)
      }

      // Delete from database (only if document still exists)
      const { error: deleteError } = await this.supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (deleteError && deleteError.code !== 'PGRST116') {
        console.error('Error deleting document record:', deleteError)
        throw deleteError
      }

      console.log(`Successfully deleted document record: ${documentId}`)
    } catch (error) {
      console.error('Error in deleteFile:', error)
      throw error
    }
  }

  /**
   * List files for a user
   */
  async listFiles(userId: string): Promise<UploadedFile[]> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error listing files:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in listFiles:', error)
      throw error
    }
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(documentId: string): Promise<UploadedFile | null> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single()

      if (error) {
        console.error('Error getting file metadata:', error)
        throw error
      }

      return data
    } catch (error) {
      console.error('Error in getFileMetadata:', error)
      throw error
    }
  }

  /**
   * Generate content hash for a file
   */
  private async generateContentHash(file: File | Buffer): Promise<string> {
    const buffer = file instanceof File ? await file.arrayBuffer() : file
    return createHash('sha256').update(Buffer.from(buffer)).digest('hex')
  }

  /**
   * Get file type from filename
   */
  private getFileType(filename: string): string {
    const extension = filename.split('.').pop()?.toLowerCase() || ''
    
    const typeMap: Record<string, string> = {
      'pdf': 'application/pdf',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'csv': 'text/csv',
      'txt': 'text/plain',
      'md': 'text/markdown',
      'json': 'application/json',
      'xml': 'application/xml'
    }

    return typeMap[extension] || 'application/octet-stream'
  }

  /**
   * Sanitize filename to remove special characters that might cause storage issues
   */
  private sanitizeFilename(filename: string): string {
    // Get file extension
    const lastDotIndex = filename.lastIndexOf('.')
    const name = lastDotIndex > 0 ? filename.substring(0, lastDotIndex) : filename
    const extension = lastDotIndex > 0 ? filename.substring(lastDotIndex) : ''
    
    // Replace non-ASCII characters and special characters with safe alternatives
    const sanitizedName = name
      .replace(/[^\w\s-]/g, '') // Remove special characters except word chars, spaces, and hyphens
      .replace(/\s+/g, '_') // Replace spaces with underscores
      .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
      .replace(/^-+|-+$/g, '') // Remove leading/trailing hyphens
      .substring(0, 100) // Limit length to avoid path issues
    
    return sanitizedName + extension
  }

  /**
   * Check if file exists by content hash
   */
  async fileExists(contentHash: string, userId: string): Promise<UploadedFile | null> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('content_hash', contentHash)
        .eq('user_id', userId)
        .single()

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Error checking file existence:', error)
        throw error
      }

      return data || null
    } catch (error) {
      console.error('Error in fileExists:', error)
      throw error
    }
  }
}
