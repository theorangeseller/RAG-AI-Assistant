import { CacheManager } from './cache/cache-manager';
import { VersionManager } from './version-control/version-manager';
import { ChromaManager, ChromaConfig } from './chroma/chroma-client';
import path from 'path';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

export interface RAGServiceConfig {
  cacheDir: string;
  versionDir: string;
  chroma: ChromaConfig;
}

export class RAGService {
  private cacheManager: CacheManager;
  private versionManager: VersionManager;
  private chromaManager: ChromaManager;
  private embeddings: OpenAIEmbeddings;

  constructor(config: RAGServiceConfig) {
    this.cacheManager = new CacheManager(config.cacheDir);
    this.versionManager = new VersionManager(config.versionDir);
    this.chromaManager = new ChromaManager(config.chroma);
    this.embeddings = new OpenAIEmbeddings();
  }

  public async initialize(): Promise<void> {
    await this.chromaManager.initialize();
  }

  public getChromaManager(): ChromaManager {
    return this.chromaManager;
  }

  private async processDocument(content: string): Promise<{
    chunks: string[];
    embeddings: number[][];
  }> {
    const textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: 500,
      chunkOverlap: 100,
      separators: ['\n\n', '\n', '。', '、', ' '],
    });
    
    const chunks = await textSplitter.splitText(content);
    const embeddings = await this.embeddings.embedDocuments(chunks);
    return { chunks, embeddings };
  }

  public async addDocument(
    documentId: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    // Check cache first
    const cachedData = await this.cacheManager.getCachedEmbeddings(documentId, content);
    
    let chunks: string[];
    let embeddings: number[][];
    
    if (cachedData) {
      // Use cached data
      chunks = cachedData.chunks;
      embeddings = cachedData.embeddings;
    } else {
      // Process document and cache results
      const processed = await this.processDocument(content);
      chunks = processed.chunks;
      embeddings = processed.embeddings;
      
      await this.cacheManager.cacheEmbeddings(
        documentId,
        content,
        embeddings,
        chunks,
        'latest'
      );
    }

    // Create document IDs for chunks
    const chunkIds = chunks.map((_, index) => `${documentId}_chunk_${index}`);

    // Add to Chroma
    const chunkMetadatas = chunks.map((chunk, index) => ({
      ...metadata,
      documentId,
      chunkIndex: index,
      totalChunks: chunks.length,
    }));

    await this.chromaManager.addDocuments(chunks, embeddings, chunkMetadatas, chunkIds);

    // Create version
    const hash = this.cacheManager.generateHash(content);
    const versionId = this.versionManager.createVersion(
      documentId,
      hash,
      ['initial'],
      documentId
    );

    return versionId;
  }

  public async updateDocument(
    documentId: string,
    content: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    // Process new content
    const { chunks, embeddings } = await this.processDocument(content);
    
    // Generate new chunk IDs
    const chunkIds = chunks.map((_, index) => `${documentId}_chunk_${index}`);
    
    // Create new metadatas
    const chunkMetadatas = chunks.map((chunk, index) => ({
      ...metadata,
      documentId,
      chunkIndex: index,
      totalChunks: chunks.length,
    }));

    // Delete old chunks
    const currentVersion = this.versionManager.getCurrentVersion(documentId);
    if (currentVersion) {
      await this.chromaManager.deleteDocuments([`${documentId}_chunk_*`]);
    }

    // Add new chunks
    await this.chromaManager.addDocuments(chunks, embeddings, chunkMetadatas, chunkIds);

    // Cache new embeddings
    await this.cacheManager.cacheEmbeddings(
      documentId,
      content,
      embeddings,
      chunks,
      'latest'
    );

    // Create new version
    const hash = this.cacheManager.generateHash(content);
    const versionId = this.versionManager.createVersion(
      documentId,
      hash,
      ['update'],
      documentId
    );

    return versionId;
  }

  public async query(
    query: string,
    nResults: number = 5
  ): Promise<{
    chunks: string[];
    metadatas: Record<string, any>[];
    distances: number[];
  }> {
    const queryEmbedding = await this.embeddings.embedQuery(query);
    
    const results = await this.chromaManager.query([queryEmbedding], nResults);
    
    return {
      chunks: results.documents,
      metadatas: results.metadatas,
      distances: results.distances,
    };
  }

  public async rollbackToVersion(documentId: string, versionId: string): Promise<boolean> {
    const version = this.versionManager.getVersion(documentId, versionId);
    if (!version) return false;

    const cachedData = await this.cacheManager.getMetadata(documentId);
    if (!cachedData || cachedData.hash !== version.hash) {
      throw new Error('Cache miss for version rollback');
    }

    return this.versionManager.rollbackToVersion(documentId, versionId);
  }

  public getVersionHistory(documentId: string) {
    return this.versionManager.getVersionHistory(documentId);
  }
} 