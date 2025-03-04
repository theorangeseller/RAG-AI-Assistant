import { CacheManager } from './cache/cache-manager';
import { VersionManager } from './version-control/version-manager';
import { ChromaManager, ChromaConfig } from './chroma/chroma-client';
import { DocumentLoader } from './document-loaders/document-loader';
import path from 'path';
import { OpenAIEmbeddings } from '@langchain/openai';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';
import fs from 'fs/promises';

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

  private async processDocument(filePath: string): Promise<{
    chunks: string[];
    embeddings: number[][];
    metadata: Record<string, any>;
  }> {
    // Load and process the document using the DocumentLoader
    const loadedDoc = await DocumentLoader.load(filePath);
    
    const docs = await DocumentLoader.splitDocument(loadedDoc);
    
    // Generate embeddings for all chunks
    const chunks = docs.map(doc => doc.pageContent);
    const embeddings = await this.embeddings.embedDocuments(chunks);
    
    return {
      chunks,
      embeddings,
      metadata: loadedDoc.metadata,
    };
  }

  public async addDocument(
    filePath: string,
    content?: string,
    metadata: Record<string, any> = {}
  ): Promise<string> {
    const documentId = path.basename(filePath);
    
    // Check cache first
    const cachedData = content ? 
      await this.cacheManager.getCachedEmbeddings(documentId, content) :
      await this.cacheManager.getCachedEmbeddings(
        documentId, 
        await fs.readFile(filePath, 'utf-8')
      );
    
    let chunks: string[];
    let embeddings: number[][];
    let docMetadata: Record<string, any>;
    
    if (cachedData) {
      // Use cached data
      chunks = cachedData.chunks;
      embeddings = cachedData.embeddings;
      docMetadata = cachedData.metadata || {};
    } else {
      // Process document and cache results
      const processed = await this.processDocument(filePath);
      chunks = processed.chunks;
      embeddings = processed.embeddings;
      docMetadata = processed.metadata;
      
      await this.cacheManager.cacheEmbeddings(
        documentId,
        content || await fs.readFile(filePath, 'utf-8'),
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
      ...docMetadata,
      documentId,
      chunkIndex: index,
      totalChunks: chunks.length,
    }));

    await this.chromaManager.addDocuments(chunks, embeddings, chunkMetadatas, chunkIds);

    // Create version
    const hash = this.cacheManager.generateHash(content || await fs.readFile(filePath, 'utf-8'));
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