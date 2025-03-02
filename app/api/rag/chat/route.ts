import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateResponse } from '@/lib/rag/rag-chain'
import { loadAndProcessDocuments } from '@/lib/rag/document-processor'
import { initializeVectorStore, getVectorStore } from '@/lib/rag/vector-store'
import path from 'path'

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { message } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Initialize vector store if not already initialized
    if (!getVectorStore()) {
      const sourceDir = path.join(process.cwd(), 'filesource')
      const documents = await loadAndProcessDocuments(sourceDir)
      await initializeVectorStore(documents)
    }

    // Generate response using RAG
    const result = await generateResponse(message)

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error in RAG chat:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 