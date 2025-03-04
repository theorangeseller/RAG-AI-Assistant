import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { getRagService } from './rag-instance'

const SYSTEM_TEMPLATE = `You are a helpful AI assistant that can answer questions based on both provided context and general knowledge.

If context is provided, use it to answer questions about specific documents or company information.
If no context is provided, you can answer using your general knowledge for common questions.

Context (if available):
{context}

Question: {question}

Answer: `

const prompt = PromptTemplate.fromTemplate(SYSTEM_TEMPLATE)

const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
})

const formatDocs = (docs: string[]) => {
  return docs.join('\n\n')
}

// Threshold for considering a chunk relevant (cosine similarity)
const RELEVANCE_THRESHOLD = 0.7

// Helper function to check if a question requires document context
function requiresDocumentContext(question: string): boolean {
  const companySpecificKeywords = [
    'prudential',
    'company',
    'vision',
    'mission',
    'values',
    'core values',
    'strategy',
    'organization',
    'business',
    'services',
    'プルデンシャル',
    'ビジョン',
    'ミッション',
    '会社'
  ]
  
  const lowercaseQuestion = question.toLowerCase()
  return companySpecificKeywords.some(keyword => 
    lowercaseQuestion.includes(keyword.toLowerCase())
  )
}

export const ragChain = RunnableSequence.from([
  async (input: { question: string }) => {
    const service = await getRagService()
    
    const { chunks, metadatas, distances } = await service.query(input.question, 4)
    
    // Filter out irrelevant chunks based on distance
    const relevantChunks: string[] = []
    const relevantMetadata: Record<string, any>[] = []
    
    chunks.forEach((chunk, index) => {
      // Convert distance to similarity score (1 - distance), as distance is inverse to similarity
      const similarity = 1 - distances[index]
      if (similarity >= RELEVANCE_THRESHOLD) {
        relevantChunks.push(chunk)
        relevantMetadata.push(metadatas[index])
      }
    })

    return {
      question: input.question,
      context: formatDocs(relevantChunks),
      relevantMetadata,
      requiresContext: requiresDocumentContext(input.question)
    }
  },
  async (input) => {
    // If the question requires document context but none was found
    if (input.requiresContext && !input.context) {
      return {
        response: "I don't have enough relevant information in the provided documents to answer this question accurately.",
        relevantMetadata: [],
      }
    }

    // Generate response with or without context
    const response = await prompt.pipe(model).pipe(new StringOutputParser()).invoke({
      question: input.question,
      context: input.context || "No specific context needed for this general knowledge question.",
    })

    return {
      response,
      relevantMetadata: input.relevantMetadata,
    }
  }
])

export async function generateResponse(input: { question: string }): Promise<{
  response: string;
  relevantSources: string[];
}> {
  const result = await ragChain.invoke(input)
  
  // Extract unique source files from relevant metadata
  const relevantSources: string[] = Array.from(new Set(
    result.relevantMetadata
      .map((metadata: Record<string, any>) => metadata.source)
      .filter((source: unknown): source is string => 
        typeof source === 'string' && source.length > 0
      )
  ))

  return {
    response: result.response,
    relevantSources,
  }
} 