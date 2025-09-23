'use client'

import { useState, useRef, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '../ui/button'
import { ChatMessage } from './chat-message'
import { useChat } from '@/lib/hooks/use-chat'
import { Search, Sparkles, ArrowUp, Upload, FileText } from 'lucide-react'

export function ChatInterface() {
  const { data: session } = useSession()
  const [input, setInput] = useState('')
  const { messages, sendMessage, uploadFile, isLoading, isUploading } = useChat()
  const fileInputRef = useRef<HTMLInputElement>(null)
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

    await sendMessage(input)
    setInput('')
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    await uploadFile(file)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-8">
        <input
          type="file"
          ref={fileInputRef}
          className="hidden"
          onChange={handleFileUpload}
          accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.xml"
        />
        <div className="text-center space-y-1">
          <h1 className="text-4xl font-semibold tracking-tight">Welcome to OS News AI Assistant</h1>
          <p className="text-xl text-muted-foreground">Chat with AI or upload documents for Q&A</p>
        </div>
        <div className="w-full max-w-3xl px-4">
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 p-1 rounded-2xl bg-background border shadow-sm">
              <div className="flex items-center gap-2 px-3">
                <Search className="w-5 h-5 text-muted-foreground" />
                <Sparkles className="w-5 h-5 text-muted-foreground" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="p-0"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  title="Upload document"
                >
                  <Upload className={`w-5 h-5 text-muted-foreground ${isUploading ? 'animate-pulse' : ''}`} />
                </Button>
              </div>
              <textarea
                value={input}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                  setInput(e.target.value);
                  // Auto-resize
                  e.target.style.height = 'inherit';
                  e.target.style.height = `${e.target.scrollHeight}px`;
                }}
                placeholder="Ask me anything or upload a document..."
                className="flex-1 px-3 py-3 bg-transparent text-base focus:outline-none resize-none min-h-[48px] max-h-[200px] overflow-y-auto"
                disabled={isLoading || isUploading}
                rows={1}
              />
              <Button 
                type="submit" 
                disabled={isLoading || isUploading || !input.trim()}
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
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        onChange={handleFileUpload}
        accept=".txt,.md,.pdf,.doc,.docx,.xls,.xlsx,.csv,.json,.xml"
      />
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 p-4">
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
      </div>

      <div className="border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 p-4">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center gap-2 p-1 rounded-2xl bg-background border shadow-sm">
            <div className="flex items-center gap-2 px-3">
              <Search className="w-5 h-5 text-muted-foreground" />
              <Sparkles className="w-5 h-5 text-muted-foreground" />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="p-0"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                title="Upload document"
              >
                <Upload className={`w-5 h-5 text-muted-foreground ${isUploading ? 'animate-pulse' : ''}`} />
              </Button>
            </div>
            <textarea
              value={input}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                setInput(e.target.value);
                // Auto-resize
                e.target.style.height = 'inherit';
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              placeholder="Ask me anything or upload a document..."
              className="flex-1 px-3 py-3 bg-transparent text-base focus:outline-none resize-none min-h-[48px] max-h-[200px] overflow-y-auto"
              disabled={isLoading || isUploading}
              rows={1}
            />
            <Button 
              type="submit" 
              disabled={isLoading || isUploading || !input.trim()}
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