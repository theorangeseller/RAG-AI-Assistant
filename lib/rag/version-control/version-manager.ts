import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';

export interface VersionMetadata {
  versionId: string;
  timestamp: Date;
  hash: string;
  changes: string[];
  embeddingCacheRef: string;
}

export interface DocumentVersions {
  versions: VersionMetadata[];
  currentVersion: string;
}

export class VersionManager {
  private versionDir: string;
  private versions: Record<string, DocumentVersions>;
  private versionPath: string;

  constructor(versionDir: string) {
    this.versionDir = versionDir;
    this.versionPath = path.join(versionDir, 'versions.json');
    this.versions = this.loadVersions();
    this.ensureDirectory();
  }

  private ensureDirectory() {
    if (!fs.existsSync(this.versionDir)) {
      fs.mkdirSync(this.versionDir, { recursive: true });
    }
  }

  private loadVersions(): Record<string, DocumentVersions> {
    try {
      if (fs.existsSync(this.versionPath)) {
        const data = fs.readFileSync(this.versionPath, 'utf-8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Error loading versions:', error);
    }
    return {};
  }

  private saveVersions() {
    try {
      fs.writeFileSync(this.versionPath, JSON.stringify(this.versions, null, 2));
    } catch (error) {
      console.error('Error saving versions:', error);
    }
  }

  public createVersion(
    documentId: string,
    hash: string,
    changes: string[],
    embeddingCacheRef: string
  ): string {
    const versionId = uuidv4();
    const version: VersionMetadata = {
      versionId,
      timestamp: new Date(),
      hash,
      changes,
      embeddingCacheRef,
    };

    if (!this.versions[documentId]) {
      this.versions[documentId] = {
        versions: [],
        currentVersion: versionId,
      };
    }

    this.versions[documentId].versions.push(version);
    this.versions[documentId].currentVersion = versionId;
    this.saveVersions();

    return versionId;
  }

  public getVersion(documentId: string, versionId?: string): VersionMetadata | null {
    const docVersions = this.versions[documentId];
    if (!docVersions) return null;

    const targetVersionId = versionId || docVersions.currentVersion;
    return docVersions.versions.find(v => v.versionId === targetVersionId) || null;
  }

  public getCurrentVersion(documentId: string): VersionMetadata | null {
    const docVersions = this.versions[documentId];
    if (!docVersions) return null;

    return this.getVersion(documentId, docVersions.currentVersion);
  }

  public getVersionHistory(documentId: string): VersionMetadata[] {
    return this.versions[documentId]?.versions || [];
  }

  public rollbackToVersion(documentId: string, versionId: string): boolean {
    const docVersions = this.versions[documentId];
    if (!docVersions) return false;

    const version = docVersions.versions.find(v => v.versionId === versionId);
    if (!version) return false;

    docVersions.currentVersion = versionId;
    this.saveVersions();
    return true;
  }

  public deleteVersion(documentId: string, versionId: string): boolean {
    const docVersions = this.versions[documentId];
    if (!docVersions) return false;

    const versionIndex = docVersions.versions.findIndex(v => v.versionId === versionId);
    if (versionIndex === -1) return false;

    // Don't allow deleting the current version
    if (versionId === docVersions.currentVersion) return false;

    docVersions.versions.splice(versionIndex, 1);
    this.saveVersions();
    return true;
  }
} 