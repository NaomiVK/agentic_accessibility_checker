import puppeteer, { Page, Browser } from 'puppeteer';
import { AxePuppeteer } from '@axe-core/puppeteer';
import * as fs from 'fs';
import * as path from 'path';
import { PageScanResult, ViolationResult, BulkScanOptions, PageData } from '../types/accessibility-types';
import { SCAN_CONFIG } from '../../config/scan-config';

interface WorkerTask {
  url: string;
  index: number;
  total: number;
}

interface WorkerResult {
  url: string;
  result: PageScanResult;
  needsClaudeAnalysis: boolean;
}

interface BulkScanSummary {
  totalPages: number;
  passedPages: number;
  minorIssues: number;
  claudeAnalysisNeeded: number;
  criticalIssues: number;
  errors: number;
  completionTime: string;
  processingTimeMs: number;
}

export class BulkScannerAgent {
  private browser: Browser | null = null;
  private options: BulkScanOptions;
  private processedCount: number = 0;
  private results: WorkerResult[] = [];
  private errors: string[] = [];
  private totalUrlsToProcess: number = 0;

  constructor(options: BulkScanOptions) {
    this.options = {
      maxWorkers: options.maxWorkers || 5,
      outputDirectory: options.outputDirectory || 'results/bulk-scan-results',
      timeout: options.timeout || 30000,
      retryAttempts: options.retryAttempts || 3
    };

    // Ensure output directory exists
    this.ensureOutputDirectory();
  }

  private ensureOutputDirectory(): void {
    if (!fs.existsSync(this.options.outputDirectory)) {
      fs.mkdirSync(this.options.outputDirectory, { recursive: true });
    }
  }

  /**
   * Main entry point for bulk scanning
   */
  async scanPages(urls: string[]): Promise<BulkScanSummary> {
    const startTime = Date.now();
    this.totalUrlsToProcess = urls.length;
    console.log(`Starting bulk scan of ${urls.length} URLs with ${this.options.maxWorkers} workers`);

    try {
      // Initialize browser with better configuration
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu',
          '--disable-extensions',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        defaultViewport: { width: 1920, height: 1080 },
        timeout: this.options.timeout
      });

      // Process URLs in batches
      const tasks: WorkerTask[] = urls.map((url, index) => ({
        url,
        index,
        total: urls.length
      }));

      // Process with worker pool
      await this.processWithWorkers(tasks);

      // Generate summary
      const summary = this.generateSummary(urls.length, startTime);

      // Save results
      await this.saveResults(summary);

      console.log(`Bulk scan completed in ${summary.completionTime}`);
      return summary;

    } catch (error) {
      console.error('ERROR: Bulk scan failed:', error);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  /**
   * Process URLs with worker pool pattern
   */
  private async processWithWorkers(tasks: WorkerTask[]): Promise<void> {
    const workQueue = [...tasks];
    const workers: Promise<void>[] = [];

    // Create worker promises
    for (let i = 0; i < this.options.maxWorkers; i++) {
      workers.push(this.createWorker(workQueue, i));
    }

    // Wait for all workers to complete
    await Promise.all(workers);
  }

  /**
   * Individual worker that processes URLs from the queue
   */
  private async createWorker(workQueue: WorkerTask[], workerId: number): Promise<void> {
    try {
      while (workQueue.length > 0) {
        const task = workQueue.shift();
        if (!task) break;

        console.log(`Worker ${workerId}: Scanning ${task.url} (${task.index + 1}/${task.total})`);

        const result = await this.scanSinglePage(task.url);
        const needsClaudeAnalysis = this.needsHumanAnalysis(result);

        this.results.push({
          url: task.url,
          result,
          needsClaudeAnalysis
        });

        this.processedCount++;

        // Rate limiting between scans
        await this.delay(2000);
      }
    } catch (error) {
      console.error(`ERROR: Worker ${workerId} failed:`, error);
      this.errors.push(`Worker ${workerId}: ${error}`);
    }
  }

  /**
   * Scan a single page with retry logic
   */
  private async scanSinglePage(url: string): Promise<PageScanResult> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= this.options.retryAttempts!; attempt++) {
      let page: Page | null = null;
      
      try {
        page = await this.browser!.newPage();
        
        // Set user agent and viewport for better compatibility
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
        await page.setViewport({ width: 1920, height: 1080 });
        
        const result = await this.performScan(page, url);
        await page.close();
        return result;
        
      } catch (error) {
        if (page) {
          try {
            await page.close();
          } catch (closeError) {
            console.warn(`Failed to close page for ${url}:`, closeError);
          }
        }
        
        lastError = error as Error;
        console.log(`WARNING: Attempt ${attempt}/${this.options.retryAttempts} failed for ${url}: ${error}`);
        
        if (attempt < this.options.retryAttempts!) {
          await this.delay(2000 * attempt); // Exponential backoff
        }
      }
    }

    // All attempts failed
    return {
      url,
      timestamp: new Date().toISOString(),
      violations: [],
      passes: [],
      incomplete: [],
      inapplicable: [],
      scanDuration: 0,
      error: lastError?.message || 'Unknown error'
    };
  }

  /**
   * Perform actual accessibility scan on a page
   */
  private async performScan(page: Page, url: string): Promise<PageScanResult> {
    const startTime = Date.now();

    try {
      console.log(`Navigating to: ${url}`);
      
      // Navigate to page with better error handling
      const response = await page.goto(url, {
        timeout: this.options.timeout,
        waitUntil: 'domcontentloaded' // Changed from networkidle2 for better reliability
      });

      if (!response) {
        throw new Error('Navigation failed - no response received');
      }

      if (!response.ok()) {
        throw new Error(`HTTP ${response.status()}: ${response.statusText()}`);
      }

      console.log(`Page loaded: ${url} (${response.status()})`);

      // Wait a bit for dynamic content to load
      await new Promise(resolve => setTimeout(resolve, 2000));

      console.log(`Running axe-core scan on: ${url}`);

      // Run accessibility scan with axe-core for WCAG 2.1 AA
      const axeResults = await new AxePuppeteer(page)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();

      const scanDuration = Date.now() - startTime;

      console.log(`Scan completed for ${url}: ${axeResults.violations.length} violations, ${axeResults.passes.length} passes`);

      return {
        url,
        timestamp: new Date().toISOString(),
        violations: axeResults.violations as ViolationResult[],
        passes: axeResults.passes as ViolationResult[],
        incomplete: axeResults.incomplete as ViolationResult[],
        inapplicable: axeResults.inapplicable as ViolationResult[],
        scanDuration
      };

    } catch (error) {
      // const scanDuration = Date.now() - startTime;
      console.error(`ERROR: Scan failed for ${url}:`, error);
      throw error;
    }
  }

  /**
   * Determine if a page needs human analysis based on violation types
   */
  needsHumanAnalysis(scanResult: PageScanResult): boolean {
    if (scanResult.error) {
      return true; // Error cases need manual review
    }

    // Check for critical violations
    const criticalViolations = scanResult.violations.filter(v => v.impact === 'critical');
    if (criticalViolations.length >= SCAN_CONFIG.decisionThresholds.criticalViolationsLimit) {
      return true;
    }

    // Check for complex issues that need visual analysis
    const complexIssues = scanResult.violations.filter(violation =>
      SCAN_CONFIG.decisionThresholds.complexIssuesForClaudeAnalysis.includes(violation.id)
    );
    if (complexIssues.length > 0) {
      return true;
    }

    // Check for high number of incomplete results
    if (scanResult.incomplete.length > SCAN_CONFIG.decisionThresholds.incompleteResultsLimit) {
      return true;
    }

    // Check for specific violation types that need visual verification
    const visualVerificationNeeded = scanResult.violations.some(violation => {
      return [
        'color-contrast',
        'focus-order-semantics',
        'keyboard-navigation',
        'aria-hidden-focus',
        'visual-only-information',
        'focus-management',
        'modal-focus-trap',
        'skip-link'
      ].includes(violation.id);
    });

    return visualVerificationNeeded;
  }

  /**
   * Categorize scan results for decision making
   */
  categorizeResults(): {
    passed: PageScanResult[];
    minorIssues: PageScanResult[];
    claudeNeeded: PageScanResult[];
    critical: PageScanResult[];
  } {
    const passed: PageScanResult[] = [];
    const minorIssues: PageScanResult[] = [];
    const claudeNeeded: PageScanResult[] = [];
    const critical: PageScanResult[] = [];

    for (const { result, needsClaudeAnalysis } of this.results) {
      if (result.error) {
        critical.push(result);
      } else if (result.violations.length === 0) {
        passed.push(result);
      } else if (needsClaudeAnalysis) {
        claudeNeeded.push(result);
      } else {
        // Check if issues are minor/auto-fixable
        const hasSerious = result.violations.some(v => v.impact === 'serious' || v.impact === 'critical');
        if (hasSerious) {
          critical.push(result);
        } else {
          minorIssues.push(result);
        }
      }
    }

    return { passed, minorIssues, claudeNeeded, critical };
  }

  /**
   * Get pages that need Claude analysis
   */
  getPagesForClaudeAnalysis(): PageData[] {
    return this.results
      .filter(r => r.needsClaudeAnalysis && !r.result.error)
      .map(r => ({
        url: r.url,
        violations: r.result.violations,
        pageContext: {
          title: '', // Could be extracted during scan
          description: '',
          hasForm: r.result.violations.some(v => v.nodes.some(n => n.html.includes('<form'))),
          hasNavigation: r.result.violations.some(v => v.nodes.some(n => n.html.includes('nav'))),
          hasModal: r.result.violations.some(v => v.nodes.some(n => n.html.includes('modal') || n.html.includes('dialog')))
        }
      }));
  }

  /**
   * Generate summary of scan results
   */
  private generateSummary(totalPages: number, startTime: number): BulkScanSummary {
    const categorized = this.categorizeResults();
    const processingTimeMs = Date.now() - startTime;
    
    return {
      totalPages,
      passedPages: categorized.passed.length,
      minorIssues: categorized.minorIssues.length,
      claudeAnalysisNeeded: categorized.claudeNeeded.length,
      criticalIssues: categorized.critical.length,
      errors: this.errors.length,
      completionTime: this.formatDuration(processingTimeMs),
      processingTimeMs
    };
  }

  /**
   * Save scan results to JSON files
   */
  private async saveResults(summary: BulkScanSummary): Promise<void> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    // Save detailed results
    const detailedResults = {
      summary,
      results: this.results.map(r => r.result),
      errors: this.errors,
      timestamp: new Date().toISOString()
    };

    const detailedPath = path.join(this.options.outputDirectory, `detailed-results-${timestamp}.json`);
    fs.writeFileSync(detailedPath, JSON.stringify(detailedResults, null, 2));
    
    // Save categorized results
    const categorized = this.categorizeResults();
    const categorizedPath = path.join(this.options.outputDirectory, `categorized-results-${timestamp}.json`);
    fs.writeFileSync(categorizedPath, JSON.stringify(categorized, null, 2));
    
    // Save Claude analysis queue
    const claudeQueue = this.getPagesForClaudeAnalysis();
    const claudeQueuePath = path.join(this.options.outputDirectory, `claude-queue-${timestamp}.json`);
    fs.writeFileSync(claudeQueuePath, JSON.stringify(claudeQueue, null, 2));
    
    // Save summary
    const summaryPath = path.join(this.options.outputDirectory, `summary-${timestamp}.json`);
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

    console.log(`Results saved to: ${this.options.outputDirectory}`);
    console.log(`   - Detailed results: ${detailedPath}`);
    console.log(`   - Categorized results: ${categorizedPath}`);
    console.log(`   - Claude analysis queue: ${claudeQueuePath}`);
    console.log(`   - Summary: ${summaryPath}`);
  }

  /**
   * Utility methods
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Get scan progress
   */
  getProgress(): { processed: number; total: number; percentage: number } {
    const total = this.totalUrlsToProcess;
    const percentage = total > 0 ? Math.round((this.processedCount / total) * 100) : 0;
    
    return {
      processed: this.processedCount,
      total,
      percentage
    };
  }

  /**
   * Get current scan statistics
   */
  getStats(): {
    totalScanned: number;
    violations: number;
    passes: number;
    errors: number;
    averageScanTime: number;
  } {
    const totalScanned = this.results.length;
    const violations = this.results.reduce((sum, r) => sum + r.result.violations.length, 0);
    const passes = this.results.reduce((sum, r) => sum + r.result.passes.length, 0);
    const errors = this.results.filter(r => r.result.error).length;
    const totalScanTime = this.results.reduce((sum, r) => sum + r.result.scanDuration, 0);
    const averageScanTime = totalScanned > 0 ? totalScanTime / totalScanned : 0;

    return {
      totalScanned,
      violations,
      passes,
      errors,
      averageScanTime
    };
  }
}

// Worker interface for future extension
// interface _Worker {
//   id: number;
//   status: 'idle' | 'working' | 'error';
//   currentUrl?: string;
//   processedCount: number;
// }