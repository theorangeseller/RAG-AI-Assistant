import { ChatInterface } from '@/components/chat/chat-interface'
import { Header } from '@/components/header'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      <Header />
      <div className="flex-1 container mx-auto flex flex-col items-center justify-center px-4">
        <div className="w-full max-w-3xl">
          <ChatInterface />
        </div>
      </div>
    </main>
  )
} 