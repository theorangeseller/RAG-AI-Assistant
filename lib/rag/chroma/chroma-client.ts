import { ChromaClient, Collection, IEmbeddingFunction } from 'chromadb';

export interface ChromaConfig {
  host: string;
  port: number;
  collectionName: string;
}

// Create a null embedding function since we're using server-side embeddings
const nullEmbeddingFunction: IEmbeddingFunction = {
  generate: async () => [],
};

export class ChromaManager {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private config: ChromaConfig;

  constructor(config: ChromaConfig) {
    this.config = config;
    this.client = new ChromaClient({
      path: `http://${config.host}:${config.port}`,
      fetchOptions: {
        // Add custom fetch options if needed
        headers: {
          'Content-Type': 'application/json',
        },
      },
    });
  }

  public async initialize(): Promise<void> {
    try {
      console.log('Initializing Chroma collection:', this.config.collectionName);
      
      // First, try to get the collection
      try {
        this.collection = await this.client.getCollection({
          name: this.config.collectionName,
          embeddingFunction: nullEmbeddingFunction,
        });
        console.log('Found existing collection:', this.config.collectionName);
      } catch (error) {
        console.log('Collection not found, creating new one:', this.config.collectionName);
        this.collection = await this.client.createCollection({
          name: this.config.collectionName,
          embeddingFunction: nullEmbeddingFunction,
        });
      }
    } catch (error) {
      console.error('Error initializing Chroma collection:', error);
      throw error;
    }
  }

  public async addDocuments(
    documents: string[],
    embeddings: number[][],
    metadatas: Record<string, any>[],
    ids: string[]
  ): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      console.log(`Adding ${documents.length} documents to collection ${this.config.collectionName}`);
      console.log('Document IDs:', ids);
      
      await this.collection.add({
        ids,
        embeddings,
        documents,
        metadatas,
      });
      
      console.log('Successfully added documents to collection');
    } catch (error) {
      console.error('Error adding documents to collection:', error);
      throw error;
    }
  }

  public async query(
    queryEmbeddings: number[][],
    nResults: number = 5
  ): Promise<{
    ids: string[];
    documents: string[];
    metadatas: Record<string, any>[];
    distances: number[];
  }> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      const results = await this.collection.query({
        queryEmbeddings,
        nResults,
      });

      if (!results.ids?.[0] || !results.documents?.[0] || !results.metadatas?.[0] || !results.distances?.[0]) {
        throw new Error('Invalid query results from Chroma');
      }

      return {
        ids: results.ids[0].filter((id): id is string => id !== null),
        documents: results.documents[0].filter((doc): doc is string => doc !== null),
        metadatas: results.metadatas[0].filter((meta): meta is Record<string, any> => meta !== null),
        distances: results.distances[0],
      };
    } catch (error) {
      console.error('Error querying Chroma:', error);
      throw error;
    }
  }

  public async deleteDocuments(ids: string[]): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      await this.collection.delete({
        ids,
      });
    } catch (error) {
      console.error('Error deleting documents from Chroma:', error);
      throw error;
    }
  }

  public async updateDocuments(
    ids: string[],
    documents: string[],
    embeddings: number[][],
    metadatas: Record<string, any>[]
  ): Promise<void> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    try {
      await this.collection.update({
        ids,
        documents,
        embeddings,
        metadatas,
      });
    } catch (error) {
      console.error('Error updating documents in Chroma:', error);
      throw error;
    }
  }

  public async getCollection(): Promise<Collection> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }
    return this.collection;
  }

  public async count(): Promise<number> {
    if (!this.collection) {
      throw new Error('Collection not initialized');
    }
    try {
      const count = await this.collection.count();
      console.log(`Collection ${this.config.collectionName} has ${count} documents`);
      return count;
    } catch (error) {
      console.error('Error getting collection count:', error);
      throw error;
    }
  }
} 