import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { toast } from 'sonner'

interface Message {
  role: 'user' | 'assistant' | 'error' | 'system'
  content: string
  sources?: string[]
}

export function useChat() {
  const { data: session } = useSession()
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  const sendMessage = async (content: string) => {
    try {
      setIsLoading(true)
      
      // Add user message
      const userMessage: Message = { role: 'user', content }
      setMessages(prev => [...prev, userMessage])

      // Call unified chat API (now with RAG capabilities)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
          userId: session?.user?.email,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error('Error response:', {
          status: response.status,
          statusText: response.statusText,
          body: errorText
        })
        
        try {
          const errorData = JSON.parse(errorText)
          throw new Error(errorData.error || 'Failed to send message')
        } catch (e) {
          throw new Error('Failed to send message')
        }
      }

      const data = await response.json()
      if (data.error) {
        throw new Error(data.error)
      }
      
      // Add assistant message with potential sources
      const assistantMessage: Message = {
        role: 'assistant',
        content: data.response,
        sources: data.sources || undefined
      }
      setMessages(prev => [...prev, assistantMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to send message'
      
      setMessages((messages) => {
        const lastMessage = messages[messages.length - 1]
        if (lastMessage?.role === "error") {
          return messages
        }
        return [...messages, { role: "error", content: errorMessage }]
      })
    } finally {
      setIsLoading(false)
    }
  }

  const uploadFile = async (file: File) => {
    try {
      setIsUploading(true)
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/rag/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to upload file')
      }

      const data = await response.json()
      setMessages(prev => [...prev, {
        role: 'system',
        content: `File "${data.filename}" uploaded and processed successfully. You can now ask questions about this document.`
      }])
      toast.success('File uploaded successfully')
      return true
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to upload file')
      return false
    } finally {
      setIsUploading(false)
    }
  }

  return {
    messages,
    sendMessage,
    uploadFile,
    isLoading,
    isUploading,
  }
} 