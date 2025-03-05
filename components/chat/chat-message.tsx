import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize from 'rehype-sanitize'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import { User, AlertTriangle } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant' | 'error'
  content: string
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isError = message.role === 'error'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`flex items-start gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        <Avatar className="h-8 w-8 border">
          {isUser ? (
            <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
          ) : isError ? (
            <AvatarFallback className="bg-red-500 text-white">!</AvatarFallback>
          ) : (
            <>
              <AvatarImage src="/bot-avatar.png" />
              <AvatarFallback className="bg-black text-white">AI</AvatarFallback>
            </>
          )}
        </Avatar>
        <div className={`rounded-2xl px-4 py-2.5 max-w-2xl text-base ${
          isUser
            ? 'bg-primary text-primary-foreground'
            : isError
            ? 'bg-destructive/10 text-destructive'
            : 'bg-muted'
        }`}>
          {isError ? (
            <p>{message.content}</p>
          ) : (
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeRaw, rehypeSanitize]}
              components={{
                code: function Code(props: ComponentProps<'code'> & { inline?: boolean }) {
                  const { inline, className, children, ...rest } = props
                  const match = /language-(\w+)/.exec(className || '')
                  return !inline && match ? (
                    <div className="code-block-wrapper my-3">
                      <div className="code-header px-4 py-1 bg-white text-black text-xs rounded-t-md border border-gray-200">
                        {match[1]}
                      </div>
                      <pre className="rounded-b-md bg-white text-black p-4 overflow-x-auto border border-gray-200">
                        <code className={className} {...rest}>
                          {String(children).replace(/\n$/, '')}
                        </code>
                      </pre>
                    </div>
                  ) : (
                    <code className={`${className} bg-white text-black px-1 py-0.5 rounded border border-gray-200`} {...rest}>
                      {children}
                    </code>
                  )
                }
              }}
            >
              {message.content}
            </ReactMarkdown>
          )}
        </div>
      </div>
    </div>
  )
} 