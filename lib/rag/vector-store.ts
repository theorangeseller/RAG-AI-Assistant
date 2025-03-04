import { Chroma } from '@langchain/community/vectorstores/chroma'
import { OpenAIEmbeddings } from '@langchain/openai'
import { Document } from '@langchain/core/documents'

let vectorStore: Chroma | null = null

export async function initializeVectorStore(): Promise<void> {
  if (!vectorStore) {
    const embeddings = new OpenAIEmbeddings()
    vectorStore = new Chroma(embeddings, {
      url: 'http://localhost:8000',
      collectionName: 'documents'
    })
  }
}

export function getVectorStore(): Chroma | null {
  return vectorStore
}

export async function createVectorStore(docs: Document[]): Promise<Chroma> {
  const embeddings = new OpenAIEmbeddings()
  return await Chroma.fromDocuments(docs, embeddings, {
    url: 'http://localhost:8000',
    collectionName: 'documents'
  })
} 