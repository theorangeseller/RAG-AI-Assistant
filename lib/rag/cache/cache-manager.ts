import { createHash } from 'crypto';
import fs from 'fs';
import path from 'path';

export interface CacheMetadata {
  hash: string;
  lastProcessed: Date;
  chunkCount: number;
  version: string;
}

export interface CacheEntry {
  metadata: CacheMetadata;
  embeddings: number[][];
  chunks: string[];
}

export class CacheManager {
  private cacheDir: string;
  private metadataPath: string;
  private metadata: Record<string, CacheMetadata>;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
    this.metadataPath = path.join(cacheDir, 'metadata.json');
    this.metadata = this.loadMetadata();
    this.ensureDirectories();
  }

  private ensureDirectories() {
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }
    if (!fs.existsSync(path.join(this.cacheDir, 'embeddings'))) {
      fs.mkdirSync(path.join(this.cacheDir, 'embeddings'));
    }
  }

  private loadMetadata(): Record<string, CacheMetadata> {
    try {
      if (fs.existsSync(this.metadataPath)) {
        const data = fs.readFileSync(this.metadataPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading cache metadata:', error);
    }
    return {};
  }

  private saveMetadata() {
    try {
      fs.writeFileSync(this.metadataPath, JSON.stringify(this.metadata, null, 2));
    } catch (error) {
      console.error('Error saving cache metadata:', error);
    }
  }

  public generateHash(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }

  public async getCachedEmbeddings(filePath: string, content: string): Promise<CacheEntry | null> {
    const hash = this.generateHash(content);
    const metadata = this.metadata[filePath];

    if (metadata && metadata.hash === hash) {
      try {
        const cachePath = path.join(this.cacheDir, 'embeddings', hash);
        const embeddingsPath = path.join(cachePath, 'embeddings.json');
        const chunksPath = path.join(cachePath, 'chunks.json');

        if (fs.existsSync(embeddingsPath) && fs.existsSync(chunksPath)) {
          const embeddings = JSON.parse(fs.readFileSync(embeddingsPath, 'utf-8'));
          const chunks = JSON.parse(fs.readFileSync(chunksPath, 'utf-8'));
          return { metadata, embeddings, chunks };
        }
      } catch (error) {
        console.error('Error reading cache:', error);
      }
    }

    return null;
  }

  public async cacheEmbeddings(
    filePath: string,
    content: string,
    embeddings: number[][],
    chunks: string[],
    version: string
  ): Promise<void> {
    const hash = this.generateHash(content);
    const metadata: CacheMetadata = {
      hash,
      lastProcessed: new Date(),
      chunkCount: chunks.length,
      version,
    };

    try {
      const cachePath = path.join(this.cacheDir, 'embeddings', hash);
      fs.mkdirSync(cachePath, { recursive: true });

      fs.writeFileSync(
        path.join(cachePath, 'embeddings.json'),
        JSON.stringify(embeddings)
      );
      fs.writeFileSync(
        path.join(cachePath, 'chunks.json'),
        JSON.stringify(chunks)
      );

      this.metadata[filePath] = metadata;
      this.saveMetadata();
    } catch (error) {
      console.error('Error caching embeddings:', error);
      throw error;
    }
  }

  public invalidateCache(filePath: string): void {
    const metadata = this.metadata[filePath];
    if (metadata) {
      try {
        const cachePath = path.join(this.cacheDir, 'embeddings', metadata.hash);
        if (fs.existsSync(cachePath)) {
          fs.rmSync(cachePath, { recursive: true });
        }
        delete this.metadata[filePath];
        this.saveMetadata();
      } catch (error) {
        console.error('Error invalidating cache:', error);
      }
    }
  }

  public getMetadata(filePath: string): CacheMetadata | null {
    return this.metadata[filePath] || null;
  }
} 