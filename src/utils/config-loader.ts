import { readFileSync } from 'fs';
import { join } from 'path';

export interface UrlsConfig {
  urls: string[];
  config: {
    batchSize: number;
    maxWorkers: number;
    timeout: number;
    retryAttempts: number;
    skipPatterns: string[];
  };
}

export async function loadUrls(filePath: string): Promise<UrlsConfig> {
  try {
    const fullPath = join(process.cwd(), filePath);
    const fileContent = readFileSync(fullPath, 'utf-8');
    return JSON.parse(fileContent);
  } catch (error) {
    throw new Error(`Failed to load URLs from ${filePath}: ${error}`);
  }
}

export function validateUrls(urls: string[]): string[] {
  const validUrls: string[] = [];
  
  for (const url of urls) {
    try {
      new URL(url);
      validUrls.push(url);
    } catch {
      console.warn(`WARNING: Invalid URL skipped: ${url}`);
    }
  }
  
  return validUrls;
}