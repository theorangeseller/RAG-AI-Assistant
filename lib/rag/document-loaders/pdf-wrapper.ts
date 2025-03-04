import pdfParse from 'pdf-parse';

// Simple wrapper around pdf-parse to avoid debug mode issues
export async function parsePdf(buffer: Buffer): Promise<{
  text: string;
  info: any;
  metadata: any;
  version: string;
  numpages: number;
}> {
  try {
    return await pdfParse(buffer);
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw error;
  }
} 