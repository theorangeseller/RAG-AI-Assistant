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
    console.log('RAG chat API called');
    
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.log('Authentication failed');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { message } = body

    if (!message) {
      console.log('No message provided');
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    console.log('Getting RAG service');
    const service = await getRagService()
    const sourceDir = path.join(process.cwd(), 'filesource')
    
    // Check if filesource directory exists
    try {
      await fs.access(sourceDir);
      const files = await fs.readdir(sourceDir);
      console.log(`Found ${files.length} files in filesource directory:`, files);
    } catch (error) {
      console.error('Error accessing filesource directory:', error);
      return NextResponse.json(
        { error: 'Document source directory not found or inaccessible' },
        { status: 500 }
      );
    }
    
    // Get the Chroma manager from the service
    console.log('Getting Chroma manager');
    const chromaManager = await service.getChromaManager();
    const documentCount = await chromaManager.count();
    console.log(`Document count in Chroma: ${documentCount}`);
    
    if (documentCount === 0) {
      console.log('No documents in Chroma, loading from filesource');
      const files = await fs.readdir(sourceDir)
      
      // Filter for supported file types
      const supportedFiles = files.filter(file => 
        SUPPORTED_EXTENSIONS.includes(path.extname(file).toLowerCase())
      );
      console.log(`Found ${supportedFiles.length} supported files to load:`, supportedFiles);
      
      for (const file of supportedFiles) {
        try {
          const filePath = path.join(sourceDir, file);
          console.log(`Loading file: ${filePath}`);
          await service.addDocument(filePath);
          console.log(`Successfully loaded file: ${file}`);
        } catch (error) {
          console.error(`Error loading file ${file}:`, error);
        }
      }
      
      // Verify documents were added
      const newCount = await chromaManager.count();
      console.log(`New document count after loading: ${newCount}`);
      
      if (newCount === 0) {
        return NextResponse.json(
          { error: 'Failed to load documents into the system' },
          { status: 500 }
        );
      }
    }

    // Generate response using RAG
    console.log('Generating response for question:', message);
    try {
      const { response, relevantSources } = await generateResponse({ question: message });
      console.log('Response generated successfully');
      console.log('Relevant sources:', relevantSources);
      
      return NextResponse.json({
        response,
        sources: relevantSources,
      })
    } catch (ragError) {
      console.error('Error in generateResponse:', ragError);
      return NextResponse.json(
        { 
          error: 'Failed to generate response',
          details: ragError instanceof Error ? ragError.message : String(ragError)
        },
        { status: 500 }
      )
    }
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