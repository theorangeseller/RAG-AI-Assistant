import { MemoryVectorStore } from '@langchain/community/vectorstores/memory'
import { OpenAIEmbeddings } from '@langchain/openai'
import { Document } from '@langchain/core/documents'

// Initialize embeddings model
const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY,
})

let vectorStore: MemoryVectorStore | null = null

export async function initializeVectorStore(documents: Document[]): Promise<void> {
  // Create a new vector store instance
  vectorStore = await MemoryVectorStore.fromDocuments(
    documents,
    embeddings
  )
}

export async function similaritySearch(query: string, k: number = 4) {
  if (!vectorStore) {
    throw new Error('Vector store not initialized')
  }

  const results = await vectorStore.similaritySearch(query, k)
  return results
}

export function getVectorStore() {
  return vectorStore
} 