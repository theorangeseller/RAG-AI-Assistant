import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { Document } from '@langchain/core/documents'
import path from 'path'
import fs from 'fs'

export async function loadAndProcessDocuments(sourceDir: string): Promise<Document[]> {
  // Read all files in the source directory
  const files = fs.readdirSync(sourceDir)
  
  // Load and process each file
  const documents: Document[] = []
  for (const file of files) {
    const content = fs.readFileSync(path.join(sourceDir, file), 'utf-8')
    documents.push(
      new Document({
        pageContent: content,
        metadata: { source: file }
      })
    )
  }

  // Split documents into chunks
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  })

  const splitDocs = await splitter.splitDocuments(documents)
  return splitDocs.map((doc: Document) => ({
    ...doc,
    metadata: {
      ...doc.metadata,
      source: path.basename(doc.metadata.source as string),
    },
  }))
} 