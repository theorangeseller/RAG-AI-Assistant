import { createClient } from '@supabase/supabase-js'
import { OpenAIEmbeddings } from '@langchain/openai'

export interface SupabaseVectorStoreConfig {
  supabaseUrl: string
  supabaseKey: string
  tableName?: string
  queryName?: string
}

export interface DocumentChunk {
  id: string
  document_id: string
  chunk_index: number
  content: string
  embedding: number[]
  metadata: Record<string, any>
  created_at: string
}

export interface Document {
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

export class SupabaseVectorStore {
  private supabase: any
  private embeddings: OpenAIEmbeddings
  private tableName: string
  private queryName: string

  constructor(config: SupabaseVectorStoreConfig) {
    this.supabase = createClient(config.supabaseUrl, config.supabaseKey)
    this.embeddings = new OpenAIEmbeddings()
    this.tableName = config.tableName || 'document_chunks'
    this.queryName = config.queryName || 'match_documents'
  }

  /**
   * Add documents to the vector store
   */
  async addDocuments(
    documents: Array<{
      content: string
      metadata: Record<string, any>
    }>,
    documentId: string
  ): Promise<void> {
    try {
      // Clean and prepare texts for embedding generation
      const texts = documents.map(doc => this.cleanTextContent(doc.content))
      const embeddings = await this.embeddings.embedDocuments(texts)

      // Prepare data for insertion with cleaned content
      const chunks = documents.map((doc, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: this.cleanTextContent(doc.content),
        embedding: embeddings[index],
        metadata: doc.metadata
      }))

      // Insert chunks in batches
      const batchSize = 100
      for (let i = 0; i < chunks.length; i += batchSize) {
        const batch = chunks.slice(i, i + batchSize)
        const { error } = await this.supabase
          .from(this.tableName)
          .insert(batch)

        if (error) {
          console.error('Error inserting document chunks:', error)
          throw error
        }
      }

      console.log(`Successfully added ${chunks.length} chunks for document ${documentId}`)
    } catch (error) {
      console.error('Error in addDocuments:', error)
      throw error
    }
  }

  /**
   * Search for similar documents using vector similarity
   */
  async similaritySearch(
    query: string,
    userId: string,
    k: number = 5,
    filter?: Record<string, any>
  ): Promise<Array<{
    content: string
    metadata: Record<string, any>
    similarity: number
  }>> {
    try {
      // Generate embedding for the query
      const queryEmbedding = await this.embeddings.embedQuery(query)

      // Use direct SQL query since we're using service role
      const { data, error } = await this.supabase.rpc('match_documents_for_user', {
        query_embedding: queryEmbedding,
        match_count: k,
        user_id: userId
      })

      if (error) {
        console.error('Error in similarity search:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in similaritySearch:', error)
      throw error
    }
  }

  /**
   * Delete documents by document ID
   */
  async deleteDocuments(documentIds: string[]): Promise<void> {
    try {
      const { error } = await this.supabase
        .from(this.tableName)
        .delete()
        .in('document_id', documentIds)

      if (error) {
        console.error('Error deleting documents:', error)
        throw error
      }

      console.log(`Successfully deleted chunks for documents: ${documentIds.join(', ')}`)
    } catch (error) {
      console.error('Error in deleteDocuments:', error)
      throw error
    }
  }

  /**
   * Get document count
   */
  async count(): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from(this.tableName)
        .select('*', { count: 'exact', head: true })

      if (error) {
        console.error('Error counting documents:', error)
        throw error
      }

      return count || 0
    } catch (error) {
      console.error('Error in count:', error)
      throw error
    }
  }

  /**
   * Get all documents for a user
   */
  async getDocuments(userId: string): Promise<Document[]> {
    try {
      const { data, error } = await this.supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('uploaded_at', { ascending: false })

      if (error) {
        console.error('Error getting documents:', error)
        throw error
      }

      return data || []
    } catch (error) {
      console.error('Error in getDocuments:', error)
      throw error
    }
  }

  /**
   * Delete a specific document and all its chunks
   */
  async deleteDocument(documentId: string): Promise<void> {
    try {
      // Delete chunks first (due to foreign key constraint)
      const { error: chunksError } = await this.supabase
        .from(this.tableName)
        .delete()
        .eq('document_id', documentId)

      if (chunksError) {
        console.error('Error deleting document chunks:', chunksError)
        throw chunksError
      }

      // Delete the document
      const { error: docError } = await this.supabase
        .from('documents')
        .delete()
        .eq('id', documentId)

      if (docError) {
        console.error('Error deleting document:', docError)
        throw docError
      }

      console.log(`Successfully deleted document ${documentId}`)
    } catch (error) {
      console.error('Error in deleteDocument:', error)
      throw error
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
      || 'No readable text content found in this chunk'
  }
}

// RPC function to create in Supabase for vector similarity search
export const createVectorSearchFunction = `
CREATE OR REPLACE FUNCTION match_documents (
  query_embedding vector(1536),
  match_count int DEFAULT 5,
  filter jsonb DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.metadata,
    1 - (dc.embedding <=> query_embedding) as similarity
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.user_id = auth.uid()
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
`
