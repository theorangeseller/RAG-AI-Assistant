'use client'

import { useState } from 'react'
import { Button } from '../ui/button'
import { Settings, FileText } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { RagChatInterface } from './rag-chat-interface'

export function RagSettingsButton() {
  const [isRagOpen, setIsRagOpen] = useState(false)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <Settings className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsRagOpen(true)}>
            <FileText className="mr-2 h-4 w-4" />
            <span>Document Q&A</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isRagOpen} onOpenChange={setIsRagOpen}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>Document Q&A Assistant</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden">
            <RagChatInterface />
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
} 