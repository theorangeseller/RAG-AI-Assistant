import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRagService } from '@/lib/rag/rag-instance'

export async function GET(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    console.log('Fetching file list for user:', session.user?.email);
    
    try {
      const service = await getRagService()
      const documents = await service.listDocuments()
      
      console.log(`Found ${documents.length} documents`);
      
      return NextResponse.json({
        files: documents
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
