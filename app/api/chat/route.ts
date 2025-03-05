import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { ChatOpenAI } from '@langchain/openai'

const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0.7,
  openAIApiKey: process.env.OPENAI_API_KEY,
})

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    
    if (!session) {
      console.log('Authentication failed')
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const body = await req.json()
    const { message } = body

    if (!message) {
      console.log('No message provided')
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    console.log('Generating response for:', message)
    
    try {
      const result = await model.invoke(message)
      console.log('Response generated successfully')
      
      return NextResponse.json({
        response: result.content,
      })
    } catch (error) {
      console.error('Error generating response:', error)
      return NextResponse.json(
        { error: 'Failed to generate response' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error in chat endpoint:', error)
    return NextResponse.json(
      { error: 'Failed to process chat request' },
      { status: 500 }
    )
  }
} 