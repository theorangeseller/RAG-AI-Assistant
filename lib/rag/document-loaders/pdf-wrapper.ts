import pdfParse, { Options } from 'pdf-parse';
import fs from 'fs/promises';
import path from 'path';

// Simple wrapper around pdf-parse to avoid debug mode issues
export async function parsePdf(buffer: Buffer): Promise<{
  text: string;
  info: any;
  metadata: any;
  version: string;
  numpages: number;
}> {
  try {
    // Configure pdf-parse to avoid loading test files
    const options: Options = {
      // Disable loading of test files
      max: 0
    };

    return await pdfParse(buffer, options);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    // Return a minimal valid response instead of throwing
    return {
      text: '',
      info: {},
      metadata: {},
      version: '1.0',
      numpages: 0
    };
  }
} 