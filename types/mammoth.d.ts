declare module 'mammoth' {
  interface ConversionResult {
    value: string;
    messages: any[];
  }

  interface Options {
    buffer?: Buffer;
    path?: string;
    styleMap?: string[];
  }

  export function extractRawText(options: Options): Promise<ConversionResult>;
  export function convertToHtml(options: Options): Promise<ConversionResult>;
} 