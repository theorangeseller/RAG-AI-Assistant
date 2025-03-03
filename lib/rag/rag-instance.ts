import { RAGService } from './rag-service';
import { chromaConfig } from '@/config/chroma';
import path from 'path';

let ragService: RAGService | null = null;

export async function getRagService() {
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