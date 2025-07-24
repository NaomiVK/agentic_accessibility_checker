import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { BulkAccessibilityScanner } from '../../src/agents/bulk-scanner';
import puppeteer from 'puppeteer';

// Mock puppeteer
jest.mock('puppeteer');
const mockPuppeteer = puppeteer as jest.Mocked<typeof puppeteer>;

// Mock axe-core/puppeteer
jest.mock('@axe-core/puppeteer', () => ({
  AxePuppeteer: jest.fn().mockImplementation(() => ({
    analyze: jest.fn().mockResolvedValue({
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: []
    })
  }))
}));

describe('BulkAccessibilityScanner', () => {
  let scanner: BulkAccessibilityScanner;
  let mockBrowser: any;
  let mockPage: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock browser and page
    mockPage = {
      goto: jest.fn().mockResolvedValue(undefined),
      waitForSelector: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      setViewport: jest.fn().mockResolvedValue(undefined),
    };

    mockBrowser = {
      newPage: jest.fn().mockResolvedValue(mockPage),
      close: jest.fn().mockResolvedValue(undefined),
    };

    mockPuppeteer.launch.mockResolvedValue(mockBrowser as any);

    scanner = new BulkAccessibilityScanner({
      maxWorkers: 2,
      timeout: 30000,
      retryAttempts: 2,
      axeOptions: {
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      }
    });
  });

  describe('scanUrls', () => {
    it('should scan multiple URLs successfully', async () => {
      const urls = ['https://example.com', 'https://example.org'];
      
      const results = await scanner.scanUrls(urls);

      expect(results).toHaveLength(2);
      expect(mockPuppeteer.launch).toHaveBeenCalled();
      expect(mockPage.goto).toHaveBeenCalledTimes(2);
      expect(results[0].url).toBe('https://example.com');
      expect(results[1].url).toBe('https://example.org');
    });

    it('should handle page navigation errors', async () => {
      mockPage.goto.mockRejectedValueOnce(new Error('Navigation failed'));

      const results = await scanner.scanUrls(['https://example.com']);

      expect(results).toHaveLength(1);
      expect(results[0].error).toBe('Navigation failed');
      expect(results[0].violations).toEqual([]);
    });

    it('should retry failed scans', async () => {
      // First attempt fails, second succeeds
      mockPage.goto
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(undefined);

      const results = await scanner.scanUrls(['https://example.com']);

      expect(results).toHaveLength(1);
      expect(mockPage.goto).toHaveBeenCalledTimes(2); // Initial + 1 retry
      expect(results[0].error).toBeUndefined();
    });

    it('should respect worker limits', async () => {
      const urls = Array(10).fill('https://example.com').map((url, i) => `${url}/${i}`);
      
      // Track concurrent page creations
      let concurrentPages = 0;
      let maxConcurrent = 0;
      
      mockBrowser.newPage.mockImplementation(async () => {
        concurrentPages++;
        maxConcurrent = Math.max(maxConcurrent, concurrentPages);
        
        // Simulate some processing time
        await new Promise(resolve => setTimeout(resolve, 10));
        
        concurrentPages--;
        return mockPage;
      });

      await scanner.scanUrls(urls);

      // Should never exceed maxWorkers (2)
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  describe('scanPage', () => {
    it('should include scan duration in results', async () => {
      const result = await scanner['scanPage'](mockPage, 'https://example.com');

      expect(result.scanDuration).toBeGreaterThan(0);
      expect(result.timestamp).toBeDefined();
    });

    it('should apply axe options', async () => {
      const { AxePuppeteer } = require('@axe-core/puppeteer');
      const mockAnalyze = jest.fn().mockResolvedValue({
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: []
      });

      AxePuppeteer.mockImplementation(() => ({
        analyze: mockAnalyze
      }));

      await scanner['scanPage'](mockPage, 'https://example.com');

      expect(AxePuppeteer).toHaveBeenCalledWith(mockPage);
      expect(mockAnalyze).toHaveBeenCalledWith({
        runOnly: {
          type: 'tag',
          values: ['wcag2a', 'wcag2aa']
        }
      });
    });
  });

  describe('error handling', () => {
    it('should handle browser launch failures', async () => {
      mockPuppeteer.launch.mockRejectedValue(new Error('Browser launch failed'));

      await expect(scanner.scanUrls(['https://example.com'])).rejects.toThrow('Browser launch failed');
    });

    it('should close browser on error', async () => {
      mockPage.goto.mockRejectedValue(new Error('Critical error'));

      try {
        await scanner.scanUrls(['https://example.com']);
      } catch (error) {
        // Expected to throw
      }

      // Browser should still be closed
      expect(mockBrowser.close).toHaveBeenCalled();
    });
  });

  describe('progress tracking', () => {
    it('should emit progress events', async () => {
      const progressCallback = jest.fn();
      scanner.on('progress', progressCallback);

      const urls = ['https://example.com', 'https://example.org'];
      await scanner.scanUrls(urls);

      expect(progressCallback).toHaveBeenCalled();
      const lastCall = progressCallback.mock.calls[progressCallback.mock.calls.length - 1][0];
      expect(lastCall.completed).toBe(2);
      expect(lastCall.total).toBe(2);
      expect(lastCall.percentage).toBe(100);
    });
  });
});