import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getRagService } from '@/lib/rag/rag-instance'

export async function DELETE(
  req: NextRequest,
  { params }: { params: { filename: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const documentId = params.filename // This is actually the document ID for Supabase
    
    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    console.log(`Deleting document: ${documentId} for user: ${session.user?.email}`);
    
    try {
      const service = await getRagService()
      const success = await service.deleteDocument(documentId)
      
      if (success) {
        console.log(`Successfully deleted document: ${documentId}`);
        return NextResponse.json({
          message: `Document deleted successfully`
        })
      } else {
        return NextResponse.json(
          { error: 'Failed to delete document' },
          { status: 500 }
        )
      }
    } catch (error) {
      console.error(`Error deleting document ${documentId}:`, error);
      return NextResponse.json(
        { 
          error: 'Failed to delete document',
          details: error instanceof Error ? error.message : String(error)
        },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in file deletion endpoint:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
