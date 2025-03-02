import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { TextLoader } from 'langchain/document_loaders/fs/text'
import { Document } from '@langchain/core/documents'
import path from 'path'
import fs from 'fs'

export async function loadAndProcessDocuments(sourceDir: string): Promise<Document[]> {
  const documents: Document[] = []
  
  // Read all files in the source directory
  const files = fs.readdirSync(sourceDir)
  
  for (const file of files) {
    if (file.endsWith('.txt')) {
      const filePath = path.join(sourceDir, file)
      const loader = new TextLoader(filePath)
      const docs = await loader.load()
      
      // Add source metadata
      docs.forEach(doc => {
        doc.metadata = {
          ...doc.metadata,
          source: file,
        }
      })
      
      documents.push(...docs)
    }
  }

  // Split documents into chunks
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  })

  const splitDocs = await textSplitter.splitDocuments(documents)
  return splitDocs
} 