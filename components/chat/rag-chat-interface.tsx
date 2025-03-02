'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '../ui/button'
import { ChatMessage } from './chat-message'
import { Search, FileText, ArrowUp } from 'lucide-react'

interface RagMessage {
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
}

export function RagChatInterface() {
  const { data: session } = useSession()
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<RagMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    try {
      setIsLoading(true)
      
      // Add user message
      const userMessage: RagMessage = { role: 'user', content: input }
      setMessages(prev => [...prev, userMessage])

      // Call RAG API
      const response = await fetch('/api/rag/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          userId: session?.user?.email,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to send message')
      }

      const data = await response.json()
      
      // Add assistant message with sources
      const assistantMessage: RagMessage = {
        role: 'assistant',
        content: data.response,
        sources: data.sources,
      }
      setMessages(prev => [...prev, assistantMessage])
      setInput('')
    } catch (error) {
      console.error('Error sending message:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-8rem)]">
      <div className="flex-1 overflow-y-auto min-h-0">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4">
            <h1 className="text-4xl font-semibold tracking-tight">Document Q&A Assistant</h1>
            <p className="text-xl text-muted-foreground mt-2">Ask questions about your documents</p>
          </div>
        ) : (
          <div className="flex flex-col justify-start p-4">
            {messages.map((message, i) => (
              <div key={i} className="mb-4 last:mb-0">
                <ChatMessage message={message} />
                {message.sources && message.sources.length > 0 && (
                  <div className="text-sm text-muted-foreground ml-12 mt-2">
                    <p className="font-semibold">Sources:</p>
                    <ul className="list-disc list-inside">
                      {message.sources.map((source, idx) => (
                        <li key={idx}>{source}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-background border shadow-sm">
            <div className="flex items-center gap-2 px-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <FileText className="w-5 h-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your documents..."
              className="flex-1 px-3 py-3 bg-transparent text-base focus:outline-none"
              disabled={isLoading}
            />
            <Button 
              type="submit" 
              disabled={isLoading || !input.trim()}
              size="icon"
              className="mr-1"
            >
              <ArrowUp className="w-4 h-4" />
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
} 