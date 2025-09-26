import { SupabaseVectorStore } from './supabase-vector-store'
import { SupabaseFileStorage } from './supabase-file-storage'
import { DocumentLoader } from './document-loaders/document-loader'
import { OpenAIEmbeddings } from '@langchain/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'

export interface SupabaseRAGServiceConfig {
  supabaseUrl: string
  supabaseKey: string
  bucketName?: string
  tableName?: string
}

export class SupabaseRAGService {
  private vectorStore: SupabaseVectorStore
  private fileStorage: SupabaseFileStorage
  private embeddings: OpenAIEmbeddings
  private textSplitter: RecursiveCharacterTextSplitter

  constructor(config: SupabaseRAGServiceConfig) {
    console.log('Initializing Supabase RAG service with config:', {
      supabaseUrl: config.supabaseUrl,
      bucketName: config.bucketName || 'documents',
      tableName: config.tableName || 'document_chunks'
    })

    this.vectorStore = new SupabaseVectorStore({
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey,
      tableName: config.tableName
    })

    this.fileStorage = new SupabaseFileStorage({
      supabaseUrl: config.supabaseUrl,
      supabaseKey: config.supabaseKey,
      bucketName: config.bucketName
    })

    this.embeddings = new OpenAIEmbeddings()
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    })
  }

  /**
   * Add a document to the RAG system
   */
  async addDocument(
    file: File | Buffer,
    filename: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      console.log(`Adding document: ${filename} for user: ${userId}`)

      // Check if file already exists by content hash
      const contentHash = await this.generateContentHash(file)
      const existingFile = await this.fileStorage.fileExists(contentHash, userId)
      
      if (existingFile) {
        console.log(`Document already exists: ${filename}`)
        return existingFile.id
      }

      // Upload file to Supabase Storage
      const uploadedFile = await this.fileStorage.uploadFile(
        file,
        filename,
        userId,
        {
          ...metadata,
          content_hash: contentHash
        }
      )

      // Process document content
      const content = await this.extractContent(file, filename)
      const chunks = await this.textSplitter.splitText(content)

      // Prepare document chunks
      const documentChunks = chunks.map((chunk, index) => ({
        content: chunk,
        metadata: {
          ...metadata,
          filename,
          chunk_index: index,
          total_chunks: chunks.length,
          document_id: uploadedFile.id
        }
      }))

      // Add chunks to vector store
      await this.vectorStore.addDocuments(documentChunks, uploadedFile.id)

      console.log(`Successfully added document: ${filename} with ${chunks.length} chunks`)
      return uploadedFile.id
    } catch (error) {
      console.error(`Error adding document ${filename}:`, error)
      throw error
    }
  }

  /**
   * Query documents using semantic search
   */
  async query(
    query: string,
    userId: string,
    nResults: number = 5
  ): Promise<{
    chunks: string[]
    metadatas: Record<string, any>[]
    distances: number[]
  }> {
    try {
      console.log(`Querying documents for user: ${userId}`)
      
      // Perform semantic search
      const results = await this.vectorStore.similaritySearch(query, userId, nResults)
      
      return {
        chunks: results.map(r => r.content),
        metadatas: results.map(r => r.metadata),
        distances: results.map(r => 1 - r.similarity) // Convert similarity to distance
      }
    } catch (error) {
      console.error('Error in query:', error)
      throw error
    }
  }

  /**
   * List all documents for a user
   */
  async listDocuments(userId: string): Promise<Array<{
    id: string
    filename: string
    file_size: number
    file_type: string
    uploaded_at: string
    chunk_count?: number
  }>> {
    try {
      const documents = await this.fileStorage.listFiles(userId)
      return documents.map(doc => ({
        id: doc.id,
        filename: doc.filename,
        file_size: doc.file_size,
        file_type: doc.file_type,
        uploaded_at: doc.uploaded_at
      }))
    } catch (error) {
      console.error('Error listing documents:', error)
      throw error
    }
  }

  /**
   * Delete a document and all its chunks
   */
  async deleteDocument(documentId: string): Promise<boolean> {
    try {
      console.log(`Deleting document: ${documentId}`)
      
      // Delete from vector store (chunks)
      await this.vectorStore.deleteDocument(documentId)
      
      // Delete from file storage (this now handles the case where document might be already deleted)
      await this.fileStorage.deleteFile(documentId)
      
      console.log(`Successfully deleted document: ${documentId}`)
      return true
    } catch (error) {
      console.error(`Error deleting document ${documentId}:`, error)
      throw error
    }
  }

  /**
   * Get document count for a user
   */
  async getDocumentCount(userId: string): Promise<number> {
    try {
      const documents = await this.listDocuments(userId)
      return documents.length
    } catch (error) {
      console.error('Error getting document count:', error)
      return 0
    }
  }

  /**
   * Extract content from file based on type
   */
  private async extractContent(file: File | Buffer, filename: string): Promise<string> {
    try {
      const extension = filename.split('.').pop()?.toLowerCase() || ''
      let rawContent: string = ''
      
      switch (extension) {
        case 'txt':
        case 'md':
          rawContent = file instanceof File ? await file.text() : file.toString()
          break
        
        case 'pdf':
          // For PDF files, we'll use a more robust approach
          // First try to extract as text, then clean it
          try {
            rawContent = file instanceof File ? await file.text() : file.toString()
          } catch (pdfError) {
            console.warn(`PDF text extraction failed for ${filename}, using fallback`)
            // Fallback: treat as binary and extract readable text
            const buffer = file instanceof File ? await file.arrayBuffer() : file
            rawContent = Buffer.from(buffer).toString('utf8', 0, Math.min(10000, buffer.byteLength))
          }
          break
        
        case 'json':
          const jsonContent = file instanceof File ? await file.text() : file.toString()
          const parsed = JSON.parse(jsonContent)
          rawContent = JSON.stringify(parsed, null, 2)
          break
        
        default:
          // For other file types, try to extract as text
          rawContent = file instanceof File ? await file.text() : file.toString()
          break
      }
      
      // Clean the content to remove null bytes and other problematic characters
      return this.cleanTextContent(rawContent)
    } catch (error) {
      console.error(`Error extracting content from ${filename}:`, error)
      throw new Error(`Failed to extract content from ${filename}`)
    }
  }

  /**
   * Clean text content to remove null bytes and other problematic characters
   */
  private cleanTextContent(content: string): string {
    if (!content) return ''
    
    return content
      // Remove null bytes that cause PostgreSQL issues
      .replace(/\0/g, '')
      // Remove other control characters except newlines, tabs, and carriage returns
      .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
      // Replace multiple whitespace with single space
      .replace(/\s+/g, ' ')
      // Trim whitespace
      .trim()
      // Ensure we have some content
      || 'No readable text content found in this file'
  }

  /**
   * Generate content hash for a file
   */
  private async generateContentHash(file: File | Buffer): Promise<string> {
    const buffer = file instanceof File ? await file.arrayBuffer() : file
    const crypto = await import('crypto')
    return crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex')
  }

  /**
   * Update document content
   */
  async updateDocument(
    documentId: string,
    file: File | Buffer,
    filename: string,
    userId: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    try {
      console.log(`Updating document: ${documentId}`)
      
      // Delete existing document
      await this.deleteDocument(documentId)
      
      // Add new document
      return await this.addDocument(file, filename, userId, metadata)
    } catch (error) {
      console.error(`Error updating document ${documentId}:`, error)
      throw error
    }
  }
}

// Singleton instance
let supabaseRAGService: SupabaseRAGService | null = null

export function getSupabaseRAGService(): SupabaseRAGService {
  if (!supabaseRAGService) {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Supabase configuration missing. Please check your environment variables.')
    }

    supabaseRAGService = new SupabaseRAGService({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      bucketName: 'documents',
      tableName: 'document_chunks'
    })
  }

  return supabaseRAGService
}
