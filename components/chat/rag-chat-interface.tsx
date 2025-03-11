'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '../ui/button'
import { ChatMessage } from './chat-message'
import { Search, FileText, ArrowUp } from 'lucide-react'

interface RagMessage {
  role: "user" | "assistant" | "error";
  content: string;
  sources?: string[];
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input) return

    const message = input
    setInput("")
    setMessages((messages) => [...messages, { role: "user", content: message }])

    try {
      console.log('Sending request to /api/rag/chat')
      const response = await fetch("/api/rag/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          message,
          userId: session?.user?.email 
        }),
      })

      console.log('Response status:', response.status)
      
      let errorMessage = 'Failed to send message. Please try again.'
      
      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        
        try {
          const errorData = JSON.parse(errorText)
          if (errorData.error) {
            errorMessage = errorData.error
          }
        } catch (e) {
          console.error('Failed to parse error response:', e)
        }
        
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log('Response data:', data)

      if (data.error) {
        console.error('Error in response data:', data.error)
        throw new Error(data.error)
      }

      setMessages((messages) => [
        ...messages,
        { 
          role: "assistant", 
          content: data.response,
          sources: data.sources 
        },
      ])
    } catch (error) {
      console.error('Error in handleSubmit:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message. Please try again.'
      
      setMessages((messages) => {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === "error") {
          return messages
        }
        return [...messages, { role: "error", content: errorMessage }]
      })
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
            <textarea
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = 'inherit';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder="Ask about your documents..."
              className="flex-1 px-3 py-3 bg-transparent text-base focus:outline-none resize-none min-h-[48px] max-h-[200px] overflow-y-auto"
              disabled={isLoading}
              rows={1}
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