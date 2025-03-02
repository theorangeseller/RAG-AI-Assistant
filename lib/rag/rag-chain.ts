import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { similaritySearch } from './vector-store'
import { Document } from '@langchain/core/documents'

const SYSTEM_TEMPLATE = `You are a helpful AI assistant that answers questions based on the provided context.
Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know. Don't try to make up an answer.
Keep your answers concise and relevant to the question.

Context:
{context}

Question: {question}

Answer: `

const prompt = PromptTemplate.fromTemplate(SYSTEM_TEMPLATE)

const model = new ChatOpenAI({
  modelName: 'gpt-3.5-turbo',
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
})

const formatDocs = (docs: Document[]) => {
  return docs.map((doc) => doc.pageContent).join('\n\n')
}

export const ragChain = RunnableSequence.from([
  async (input: { question: string }) => {
    const relevantDocs = await similaritySearch(input.question)
    const formattedDocs = formatDocs(relevantDocs)
    return {
      question: input.question,
      context: formattedDocs,
    }
  },
  prompt,
  model,
  new StringOutputParser(),
])

export async function generateResponse(question: string) {
  try {
    const response = await ragChain.invoke({
      question: question,
    })

    // Get the sources from the last similarity search
    const sources = (await similaritySearch(question))
      .map(doc => doc.metadata.source)
      .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
    
    return {
      response,
      sources,
    }
  } catch (error) {
    console.error('Error generating response:', error)
    throw error
  }
} 