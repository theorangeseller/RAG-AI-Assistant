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
    console.log('Initializing RAG service with config:', {
      cacheDir: config.cacheDir,
      versionDir: config.versionDir,
      chromaConfig: {
        host: config.chroma.host,
        port: config.chroma.port,
        collectionName: config.chroma.collectionName
      }
    });
    
    this.cacheManager = new CacheManager(config.cacheDir);
    this.versionManager = new VersionManager(config.versionDir);
    this.chromaManager = new ChromaManager(config.chroma);
    
    console.log('Initializing OpenAI embeddings with API key:', 
      process.env.OPENAI_API_KEY ? 'Present' : 'Missing');
    this.embeddings = new OpenAIEmbeddings();
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing RAG service components');
      await this.chromaManager.initialize();
      console.log('RAG service initialization complete');
    } catch (error) {
      console.error('Failed to initialize RAG service:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
      throw error;
    }
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
    try {
      console.log('Generating embeddings for query:', query);
      const queryEmbedding = await this.embeddings.embedQuery(query);
      console.log('Query embedding generated successfully');
      
      console.log('Querying Chroma with embeddings');
      const results = await this.chromaManager.query([queryEmbedding], nResults);
      console.log('Chroma query completed successfully');
      
      return {
        chunks: results.documents,
        metadatas: results.metadatas,
        distances: results.distances,
      };
    } catch (error) {
      console.error('Error in RAG service query:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
        if (error.stack) {
          console.error('Stack trace:', error.stack);
        }
      }
      throw error;
    }
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

  public async listDocuments(): Promise<{
    filename: string;
    documentId: string;
    chunkCount: number;
    uploadDate: Date;
    fileSize?: number;
    fileType: string;
  }[]> {
    try {
      console.log('Listing all documents');
      
      // Get all documents from ChromaDB to find unique document IDs
      const chromaManager = this.getChromaManager();
      const collection = await chromaManager.getCollection();
      
      // Get all documents (this might be a lot, but we need to find unique documentIds)
      const results = await collection.get({});
      
      if (!results.metadatas || results.metadatas.length === 0) {
        return [];
      }

      // Group by documentId and get metadata
      const documentsMap = new Map<string, any>();
      
      for (let i = 0; i < results.metadatas.length; i++) {
        const metadata = results.metadatas[i] as Record<string, any>;
        const documentId = metadata.documentId;
        
        if (documentId && !documentsMap.has(documentId)) {
          // Get file stats if file exists
          const filePath = path.join(process.cwd(), 'filesource', documentId);
          let fileSize: number | undefined;
          let uploadDate = new Date();
          
          try {
            const stats = await fs.stat(filePath);
            fileSize = stats.size;
            uploadDate = stats.mtime;
          } catch (error) {
            console.warn(`File not found for document ${documentId}:`, error);
          }
          
          documentsMap.set(documentId, {
            filename: documentId,
            documentId,
            chunkCount: metadata.totalChunks || 0,
            uploadDate,
            fileSize,
            fileType: metadata.fileType || 'unknown'
          });
        }
      }
      
      return Array.from(documentsMap.values());
    } catch (error) {
      console.error('Error listing documents:', error);
      throw error;
    }
  }

  public async deleteDocument(documentId: string): Promise<boolean> {
    try {
      console.log(`Deleting document: ${documentId}`);
      
      // 1. Delete from ChromaDB - find all chunks for this document
      const chromaManager = this.getChromaManager();
      const collection = await chromaManager.getCollection();
      
      // Get all chunks for this document
      const results = await collection.get({
        where: { documentId: documentId }
      });
      
      if (results.ids && results.ids.length > 0) {
        console.log(`Found ${results.ids.length} chunks to delete for document ${documentId}`);
        await chromaManager.deleteDocuments(results.ids);
      }
      
      // 2. Delete physical file
      const filePath = path.join(process.cwd(), 'filesource', documentId);
      try {
        await fs.unlink(filePath);
        console.log(`Deleted physical file: ${filePath}`);
      } catch (error) {
        console.warn(`Could not delete physical file ${filePath}:`, error);
      }
      
      // 3. Clear cache
      this.cacheManager.invalidateCache(documentId);
      console.log(`Cleared cache for document: ${documentId}`);
      
      // 4. Remove version history
      // Note: The version manager doesn't have a delete method, so we'll leave this for now
      
      console.log(`Successfully deleted document: ${documentId}`);
      return true;
    } catch (error) {
      console.error(`Error deleting document ${documentId}:`, error);
      throw error;
    }
  }
} 