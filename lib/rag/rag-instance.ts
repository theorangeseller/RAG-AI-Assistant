import { RAGService } from './rag-service';
import { getSupabaseRAGService } from './supabase-rag-service'
import { chromaConfig } from '@/config/chroma';
import path from 'path';

let ragService: RAGService | null = null;

// Keep ChromaDB implementation for backward compatibility
export async function getChromaRagService() {
  if (!ragService) {
    ragService = new RAGService({
      cacheDir: path.join(process.cwd(), 'data', 'cache'),
      versionDir: path.join(process.cwd(), 'data', 'versions'),
      chroma: chromaConfig,
    });
    await ragService.initialize();
  }
  return ragService;
}

// Use Supabase RAG service as the default
export async function getRagService() {
  return getSupabaseRAGService()
} 