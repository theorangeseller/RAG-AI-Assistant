import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateResponse } from '@/lib/rag/rag-chain'
import { getRagService } from '@/lib/rag/rag-instance'
import path from 'path'
import fs from 'fs/promises'

const SUPPORTED_EXTENSIONS = [
  '.txt', '.md', '.markdown',
  '.pdf', '.doc', '.docx',
  '.xls', '.xlsx', '.csv',
  '.json', '.xml'
];

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

    const service = await getRagService()
    
    // Generate response using RAG
    const { response, relevantSources } = await generateResponse({ question: message });

    return NextResponse.json({
      response,
      sources: relevantSources,
    })
  } catch (error) {
    console.error('Error in RAG chat endpoint:', error);
    return NextResponse.json(
      { 
        error: 'Failed to process chat request',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
} 