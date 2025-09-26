import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRagService } from '@/lib/rag/rag-instance'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('Fetching file list for user:', session.user?.email);
    
    try {
      const service = await getRagService()
      const documents = await service.listDocuments(session.user.id)
      
      console.log(`Found ${documents.length} documents for user ${session.user.id}`);
      
      return NextResponse.json({
        files: documents.map(doc => ({
          filename: doc.filename,
          documentId: doc.id,
          chunkCount: 0, // Will be populated by Supabase service if needed
          uploadDate: doc.uploaded_at,
          fileSize: doc.file_size,
          fileType: doc.file_type
        }))
      })
    } catch (error) {
      console.error('Error fetching file list:', error);
      return NextResponse.json(
        { 
          error: 'Failed to fetch file list',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in files endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
