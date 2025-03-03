import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { generateResponse } from '@/lib/rag/rag-chain'
import { loadAndProcessDocuments } from '@/lib/rag/document-processor'
import { getRagService } from '@/lib/rag/rag-instance'
import path from 'path'
import fs from 'fs/promises'

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

    console.log('Initializing RAG service...');
    const service = await getRagService()
    const sourceDir = path.join(process.cwd(), 'filesource')
    
    // Get the Chroma manager from the service
    const chromaManager = await service.getChromaManager();
    const documentCount = await chromaManager.count();
    
    if (documentCount === 0) {
      console.log('No documents found in collection, loading from filesource directory...');
      const files = await fs.readdir(sourceDir)
      console.log('Found files:', files);
      
      for (const file of files) {
        console.log(`Loading file: ${file}`);
        const content = await fs.readFile(path.join(sourceDir, file), 'utf-8')
        console.log(`Adding document ${file} to RAG service...`);
        await service.addDocument(file, content, { source: file })
        console.log(`Successfully added ${file}`);
      }
      
      // Verify documents were added
      const newCount = await chromaManager.count();
      console.log(`Collection now has ${newCount} documents`);
      
      if (newCount === 0) {
        throw new Error('Failed to add documents to collection');
      }
    } else {
      console.log(`Found ${documentCount} existing documents in collection`);
    }

    console.log('Generating response for query:', message);
    // Generate response using RAG
    const { response, relevantSources } = await generateResponse({ question: message });
    
    console.log('Found relevant sources:', relevantSources);

    return NextResponse.json({
      response,
      sources: relevantSources,
    })
  } catch (error) {
    console.error('Error in RAG chat endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
} 