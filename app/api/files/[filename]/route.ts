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
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const filename = params.filename
    
    if (!filename) {
      return NextResponse.json(
        { error: 'Filename is required' },
        { status: 400 }
      )
    }

    console.log(`Deleting file: ${filename} for user: ${session.user?.email}`);
    
    try {
      const service = await getRagService()
      const success = await service.deleteDocument(filename)
      
      if (success) {
        console.log(`Successfully deleted file: ${filename}`);
        return NextResponse.json({
          message: `File "${filename}" deleted successfully`
        })
      } else {
        return NextResponse.json(
          { error: 'Failed to delete file' },
          { status: 500 }
        )
      }
    } catch (error) {
      console.error(`Error deleting file ${filename}:`, error);
      return NextResponse.json(
        { 
          error: 'Failed to delete file',
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
