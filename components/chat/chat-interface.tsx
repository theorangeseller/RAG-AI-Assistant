'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '../ui/button'
import { ChatMessage } from './chat-message'
import { useChat } from '@/lib/hooks/use-chat'
import { Search, Sparkles, ArrowUp } from 'lucide-react'

export function ChatInterface() {
  const { data: session } = useSession()
  const [input, setInput] = useState('')
  const { messages, sendMessage, isLoading } = useChat()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return

    await sendMessage(input)
    setInput('')
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8">
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-semibold tracking-tight">Welcome to OS News AI Assistant.</h1>
          <p className="text-xl text-muted-foreground">How can I help you today?</p>
        </div>
        <div className="w-full max-w-3xl px-4">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-background border shadow-sm">
              <div className="flex items-center gap-2 px-3">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Sparkles className="w-5 h-5 text-muted-foreground" />
              </div>
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="What do you want to know?"
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
            <div className="flex justify-center gap-4 mt-4">
              <Button variant="outline" size="sm">Research</Button>
              <Button variant="outline" size="sm">Brainstorm</Button>
              <Button variant="outline" size="sm">Analyze Data</Button>
              <Button variant="outline" size="sm">Code</Button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
          {messages.map((message, i) => (
            <ChatMessage key={i} message={message} />
          ))}
        </div>
      </div>

      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-background border shadow-sm">
            <div className="flex items-center gap-2 px-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Sparkles className="w-5 h-5 text-muted-foreground" />
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="What do you want to know?"
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
          <div className="flex justify-center gap-4 mt-4">
            <Button variant="outline" size="sm">Research</Button>
            <Button variant="outline" size="sm">Brainstorm</Button>
            <Button variant="outline" size="sm">Analyze Data</Button>
            <Button variant="outline" size="sm">Code</Button>
          </div>
        </form>
      </div>
    </div>
  )
} 