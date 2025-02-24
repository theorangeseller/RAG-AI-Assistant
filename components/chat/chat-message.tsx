import { Avatar, AvatarFallback, AvatarImage } from '../ui/avatar'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`flex items-start gap-3 ${
          isUser ? 'flex-row-reverse' : 'flex-row'
        }`}
      >
        <Avatar className="h-8 w-8 border">
          {isUser ? (
            <AvatarFallback className="bg-primary text-primary-foreground">U</AvatarFallback>
          ) : (
            <>
              <AvatarImage src="/bot-avatar.png" />
              <AvatarFallback className="bg-black text-white">AI</AvatarFallback>
            </>
          )}
        </Avatar>
        <div
          className={`rounded-2xl px-4 py-2.5 max-w-2xl text-base ${
            isUser
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted'
          }`}
        >
          {message.content}
        </div>
      </div>
    </div>
  )
} 