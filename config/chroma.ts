import { ChromaConfig } from '../lib/rag/chroma/chroma-client';

export const chromaConfig: ChromaConfig = {
  host: 'localhost',
  port: 8000,
  collectionName: 'documents',
};

export const CHROMA_PERSISTENCE_PATH = './data/chroma'; 