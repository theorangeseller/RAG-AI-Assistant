import { Document } from '@langchain/core/documents'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { marked } from 'marked'
import { parsePdf } from './pdf-wrapper'
import * as XLSX from 'xlsx'
import * as mammoth from 'mammoth'
import * as xml2js from 'xml2js'
import * as fs from 'fs/promises'
import * as path from 'path'

export interface DocumentMetadata {
  source: string;
  fileType: string;
  [key: string]: any;
}

export interface LoadedDocument {
  content: string;
  metadata: DocumentMetadata;
}

export class DocumentLoader {
  private static async readFile(filePath: string): Promise<Buffer> {
    try {
      return await fs.readFile(filePath);
    } catch (error) {
      console.error(`Error reading file ${filePath}:`, error);
      throw error;
    }
  }

  private static async loadMarkdown(filePath: string): Promise<LoadedDocument> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const tokens = marked.lexer(content);
      const textContent = marked.parser(tokens);
      
      return {
        content: textContent,
        metadata: {
          source: path.basename(filePath),
          fileType: 'markdown',
        },
      };
    } catch (error) {
      console.error(`Error loading markdown file ${filePath}:`, error);
      throw error;
    }
  }

  private static async loadPDF(filePath: string): Promise<LoadedDocument> {
    try {
      const buffer = await DocumentLoader.readFile(filePath);
      const { text, info } = await parsePdf(buffer);
      
      return {
        content: text,
        metadata: {
          source: path.basename(filePath),
          fileType: 'pdf',
          pageCount: info.Pages,
          ...info,
        },
      };
    } catch (error) {
      console.error(`Error loading PDF file ${filePath}:`, error);
      throw error;
    }
  }

  private static async loadExcel(filePath: string): Promise<LoadedDocument> {
    try {
      const buffer = await DocumentLoader.readFile(filePath);
      const workbook = XLSX.read(buffer);
      
      let content = '';
      workbook.SheetNames.forEach(sheetName => {
        const sheet = workbook.Sheets[sheetName];
        content += `Sheet: ${sheetName}\n${XLSX.utils.sheet_to_csv(sheet)}\n\n`;
      });
      
      return {
        content: content.trim(),
        metadata: {
          source: path.basename(filePath),
          fileType: 'excel',
          sheets: workbook.SheetNames,
        },
      };
    } catch (error) {
      console.error(`Error loading Excel file ${filePath}:`, error);
      throw error;
    }
  }

  private static async loadWord(filePath: string): Promise<LoadedDocument> {
    try {
      const buffer = await DocumentLoader.readFile(filePath);
      const { value: content } = await mammoth.extractRawText({ buffer });
      
      return {
        content,
        metadata: {
          source: path.basename(filePath),
          fileType: 'word',
        },
      };
    } catch (error) {
      console.error(`Error loading Word file ${filePath}:`, error);
      throw error;
    }
  }

  private static async loadCSV(filePath: string): Promise<LoadedDocument> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const workbook = XLSX.read(content, { type: 'string' });
      const csvContent = XLSX.utils.sheet_to_csv(workbook.Sheets[workbook.SheetNames[0]]);
      
      return {
        content: csvContent,
        metadata: {
          source: path.basename(filePath),
          fileType: 'csv',
        },
      };
    } catch (error) {
      console.error(`Error loading CSV file ${filePath}:`, error);
      throw error;
    }
  }

  private static async loadJSON(filePath: string): Promise<LoadedDocument> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      
      return {
        content: JSON.stringify(parsed, null, 2),
        metadata: {
          source: path.basename(filePath),
          fileType: 'json',
        },
      };
    } catch (error) {
      console.error(`Error loading JSON file ${filePath}:`, error);
      throw error;
    }
  }

  private static async loadXML(filePath: string): Promise<LoadedDocument> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const parser = new xml2js.Parser({ explicitArray: false });
      const parsed = await parser.parseStringPromise(content);
      
      return {
        content: JSON.stringify(parsed, null, 2),
        metadata: {
          source: path.basename(filePath),
          fileType: 'xml',
        },
      };
    } catch (error) {
      console.error(`Error loading XML file ${filePath}:`, error);
      throw error;
    }
  }

  private static async loadText(filePath: string): Promise<LoadedDocument> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      return {
        content,
        metadata: {
          source: path.basename(filePath),
          fileType: 'text',
        },
      };
    } catch (error) {
      console.error(`Error loading text file ${filePath}:`, error);
      throw error;
    }
  }

  public static async load(filePath: string): Promise<LoadedDocument> {
    console.log(`Loading document: ${filePath}`);
    const ext = path.extname(filePath).toLowerCase();
    
    try {
      let result: LoadedDocument;
      switch (ext) {
        case '.md':
        case '.markdown':
          result = await DocumentLoader.loadMarkdown(filePath);
          break;
        case '.pdf':
          result = await DocumentLoader.loadPDF(filePath);
          break;
        case '.xlsx':
        case '.xls':
          result = await DocumentLoader.loadExcel(filePath);
          break;
        case '.doc':
        case '.docx':
          result = await DocumentLoader.loadWord(filePath);
          break;
        case '.csv':
          result = await DocumentLoader.loadCSV(filePath);
          break;
        case '.json':
          result = await DocumentLoader.loadJSON(filePath);
          break;
        case '.xml':
          result = await DocumentLoader.loadXML(filePath);
          break;
        case '.txt':
          result = await DocumentLoader.loadText(filePath);
          break;
        default:
          throw new Error(`Unsupported file type: ${ext}`);
      }
      console.log(`Successfully loaded document: ${filePath}`);
      console.log(`Content length: ${result.content.length} characters`);
      console.log(`Metadata:`, result.metadata);
      return result;
    } catch (error) {
      console.error(`Failed to load document ${filePath}:`, error);
      throw error;
    }
  }

  public static async splitDocument(doc: LoadedDocument, chunkSize: number = 500): Promise<Document[]> {
    try {
      console.log(`Splitting document with chunk size: ${chunkSize}`);
      const splitter = new RecursiveCharacterTextSplitter({
        chunkSize,
        chunkOverlap: 100,
        separators: ['\n\n', '\n', '。', '、', ' '],
      });

      const docs = await splitter.createDocuments(
        [doc.content],
        [doc.metadata]
      );

      console.log(`Split document into ${docs.length} chunks`);
      return docs;
    } catch (error) {
      console.error('Error splitting document:', error);
      throw error;
    }
  }
} 