import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { mkdir, writeFile } from 'fs/promises'
import { join } from 'path'
import { getRagService } from '@/lib/rag/rag-instance'

const SUPPORTED_TYPES = [
  'text/plain',
  'text/markdown',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
  'application/json',
  'application/xml'
]

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const formData = await req.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!SUPPORTED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Unsupported file type' },
        { status: 400 }
      )
    }

    // Legacy local copy for local development only. Supabase is the primary storage path.
    // In serverless environments (Amplify SSR), local FS is ephemeral and this should not block uploads.
    if (process.env.NODE_ENV !== 'production') {
      const filesourceDir = join(process.cwd(), 'filesource')
      try {
        await mkdir(filesourceDir, { recursive: true })
        await writeFile(join(filesourceDir, file.name), Buffer.from(await file.arrayBuffer()))
      } catch (error) {
        console.warn('Skipping local filesource save; continuing with Supabase upload:', error)
      }
    }

    // Process and embed the file
    try {
      const service = await getRagService()
      
      // Use Supabase RAG service with file buffer and user ID
      const documentId = await service.addDocument(
        file,
        file.name,
        session.user.id,
        { uploaded_via: 'api' }
      )

      return NextResponse.json({
        success: true,
        documentId,
        message: 'File uploaded and processed successfully',
        filename: file.name
      })
    } catch (error) {
      console.error('Error processing file:', error)
      return NextResponse.json(
        { error: 'Failed to process file' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in upload endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to handle upload' },
      { status: 500 }
    )
  }
} 