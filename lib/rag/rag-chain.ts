import { ChatOpenAI } from '@langchain/openai'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { getRagService } from './rag-instance'

const SYSTEM_TEMPLATE = `You are a helpful AI assistant that can answer questions based on both provided context and general knowledge.

If context is provided:
1. Analyze the context carefully to understand the relevant information
2. Use the context as your primary source for answering questions about specific documents or company information
3. If the context is insufficient, supplement with your general knowledge while clearly indicating what comes from context vs. your knowledge
4. When citing context, use relevant quotes and indicate their source

If no context is provided or for general knowledge questions:
1. For technical questions, provide detailed, step-by-step explanations
2. For conceptual questions, break down complex topics into understandable parts
3. Use examples when they would help clarify the explanation
4. If you're unsure about specific details, acknowledge the limitations of your response

When formatting your responses:
1. For document-based questions:
   - Use proper markdown formatting
   - Include relevant quotes from the context when appropriate
   - Cite specific sections or documents when possible
   - Organize information logically with headings and lists

2. For technical questions:
   - Break down complex concepts into smaller parts
   - Use code blocks with language specification when relevant
   - Include examples and explanations
   - Add comments to explain complex logic

3. For conceptual questions:
   - Start with a high-level overview
   - Follow with detailed explanations
   - Use analogies or examples when helpful
   - Include relevant diagrams or structured information using markdown

4. For all responses:
   - Ensure clarity and readability
   - Use appropriate formatting (lists, tables, code blocks)
   - Highlight key points or important information
   - Include next steps or related topics when relevant

Context (if available):
{context}

Question: {question}

Answer: `

const prompt = PromptTemplate.fromTemplate(SYSTEM_TEMPLATE)

const model = new ChatOpenAI({
  modelName: 'gpt-4o-mini',
  temperature: 0,
  openAIApiKey: process.env.OPENAI_API_KEY,
})

const formatDocs = (docs: string[]) => {
  return docs.join('\n\n')
}

// Threshold for considering a chunk relevant (cosine similarity)
const RELEVANCE_THRESHOLD = 0.6

// Helper function to sort and deduplicate chunks by similarity
function processChunks(chunks: string[], distances: number[], metadatas: Record<string, any>[]) {
  // Create array of chunk objects with their metadata and similarity scores
  const chunkObjects = chunks.map((chunk, index) => ({
    text: chunk,
    similarity: 1 - distances[index],
    metadata: metadatas[index]
  }));

  // Sort by similarity score (highest first)
  chunkObjects.sort((a, b) => b.similarity - a.similarity);

  // Remove duplicates or near-duplicates
  const uniqueChunks = chunkObjects.filter((chunk, index, self) => 
    self.findIndex(c => 
      // Check for similar content using Levenshtein distance or simple string comparison
      c.text.trim() === chunk.text.trim() ||
      (c.text.length > 50 && chunk.text.includes(c.text.substring(0, 50)))
    ) === index
  );

  return {
    chunks: uniqueChunks.map(c => c.text),
    metadatas: uniqueChunks.map(c => c.metadata)
  };
}

// Helper function to check if a question requires document context
function requiresDocumentContext(question: string): boolean {
  // Convert to lowercase for case-insensitive matching
  const q = question.toLowerCase()
  
  // Simple calculations and basic math
  if (q.match(/^(what is |calculate |solve )?[\d\s\+\-\*\/\(\)=]+\??$/)) {
    return false
  }
  
  // Common conversational questions
  if (q.match(/^(hello|hi|hey|how are you|what('s| is) your name)\??$/)) {
    return false
  }
  
  // Questions about time
  if (q.match(/what('s| is) the time|what day is|what('s| is) today/)) {
    return false
  }

  // Code-related questions that can be answered with general knowledge
  if (q.match(/^(write|create|generate|show me) (a |an )?(script|code|program|example|function) (for|to|that)/i)) {
    return false
  }

  // Common knowledge questions
  if (q.match(/^(what is|tell me about|explain|how does|why is|who is|when did)/i)) {
    // Check for technical or specific terms that might need document context
    const technicalTerms = [
      'api', 'endpoint', 'database', 'config', 'setup', 'install',
      'deploy', 'server', 'client', 'service', 'component', 'module',
      'function', 'class', 'method', 'variable', 'constant', 'interface',
      'implementation', 'architecture', 'design', 'pattern', 'system',
      'framework', 'library', 'package', 'dependency', 'version',
      'environment', 'production', 'development', 'staging', 'testing'
    ]
    
    // If the question contains technical terms, it might need document context
    if (technicalTerms.some(term => q.includes(term))) {
      return true
    }
    
    // If no technical terms are found, treat it as general knowledge
    return false
  }
  
  // Default to requiring context for other questions
  return true
}

export const ragChain = RunnableSequence.from([
  async (input: { question: string }) => {
    try {
      console.log('Starting RAG chain processing for question:', input.question);
      
      // First check if this is a simple question that doesn't need document context
      const needsContext = requiresDocumentContext(input.question);
      if (!needsContext) {
        console.log('Question identified as simple/general knowledge - skipping document query');
        return {
          question: input.question,
          context: "No specific context needed for this general knowledge question.",
          relevantMetadata: [],
          requiresContext: false
        }
      }

      const service = await getRagService()
      
      console.log('Querying for relevant chunks');
      try {
        // Increased number of chunks to retrieve for better context
        const { chunks, metadatas, distances } = await service.query(input.question, 6)
        console.log(`Retrieved ${chunks.length} chunks from query`);
        
        // Process and filter chunks
        const { chunks: relevantChunks, metadatas: relevantMetadata } = processChunks(chunks, distances, metadatas);
        
        console.log(`Processed to ${relevantChunks.length} relevant chunks`);
        
        // If we have relevant chunks, include some context about their relationships
        let context = formatDocs(relevantChunks);
        if (relevantChunks.length > 0) {
          context = `The following information is relevant to your question. The chunks are ordered by relevance:\n\n${context}`;
        }
        
        return {
          question: input.question,
          context,
          relevantMetadata,
          requiresContext: true
        }
      } catch (queryError) {
        console.error('Error in service.query:', queryError);
        throw new Error(`Failed to query documents: ${queryError instanceof Error ? queryError.message : String(queryError)}`);
      }
    } catch (error) {
      console.error('Error in RAG chain query step:', error);
      throw error;
    }
  },
  async (input) => {
    try {
      console.log('Processing RAG chain response');
      
      // For simple questions or general knowledge, just generate a response
      if (!input.requiresContext) {
        console.log('Generating response for simple/general knowledge question');
        const response = await prompt.pipe(model).pipe(new StringOutputParser()).invoke({
          question: input.question,
          context: input.context
        });
        return {
          response,
          relevantMetadata: []
        };
      }

      // For document-based questions that require context
      if (input.requiresContext && !input.context) {
        console.log('Question requires context but none was found');
        return {
          response: "I don't have enough relevant information in the provided documents to answer this question accurately.",
          relevantMetadata: [],
        }
      }

      console.log('Generating response with document context');
      try {
        const response = await prompt.pipe(model).pipe(new StringOutputParser()).invoke({
          question: input.question,
          context: input.context
        })
        
        console.log('Response generated successfully');
        
        return {
          response,
          relevantMetadata: input.relevantMetadata,
        }
      } catch (modelError) {
        console.error('Error in model.invoke:', modelError);
        throw new Error(`Failed to generate response: ${modelError instanceof Error ? modelError.message : String(modelError)}`);
      }
    } catch (error) {
      console.error('Error in RAG chain response step:', error);
      throw error;
    }
  }
])

export async function generateResponse(input: { question: string }): Promise<{
  response: string;
  relevantSources: string[];
}> {
  try {
    console.log('Starting generateResponse for question:', input.question);
    const result = await ragChain.invoke(input)
    
    // Extract unique source files from relevant metadata
    const relevantSources: string[] = Array.from(new Set(
      result.relevantMetadata
        .map((metadata: Record<string, any>) => metadata.source)
        .filter((source: unknown): source is string => 
          typeof source === 'string' && source.length > 0
        )
    ))
    
    console.log('Generated response with sources:', relevantSources);
    
    return {
      response: result.response,
      relevantSources,
    }
  } catch (error) {
    console.error('Error in generateResponse:', error);
    throw error;
  }
} 