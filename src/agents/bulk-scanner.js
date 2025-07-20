"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BulkScannerAgent = void 0;
const puppeteer_1 = __importDefault(require("puppeteer"));
const puppeteer_2 = require("@axe-core/puppeteer");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const scan_config_1 = require("../../config/scan-config");
class BulkScannerAgent {
    constructor(options) {
        this.browser = null;
        this.processedCount = 0;
        this.results = [];
        this.errors = [];
        this.options = {
            maxWorkers: options.maxWorkers || 5,
            outputDirectory: options.outputDirectory || 'results/bulk-scan-results',
            timeout: options.timeout || 30000,
            retryAttempts: options.retryAttempts || 3
        };
        // Ensure output directory exists
        this.ensureOutputDirectory();
    }
    ensureOutputDirectory() {
        if (!fs.existsSync(this.options.outputDirectory)) {
            fs.mkdirSync(this.options.outputDirectory, { recursive: true });
        }
    }
    /**
     * Main entry point for bulk scanning
     */
    scanPages(urls) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            console.log(`STARTING: Bulk scan of ${urls.length} URLs with ${this.options.maxWorkers} workers`);
            try {
                // Initialize browser
                this.browser = yield puppeteer_1.default.launch({
                    headless: true,
                    args: ['--no-sandbox', '--disable-setuid-sandbox']
                });
                // Process URLs in batches
                const tasks = urls.map((url, index) => ({
                    url,
                    index,
                    total: urls.length
                }));
                // Process with worker pool
                yield this.processWithWorkers(tasks);
                // Generate summary
                const summary = this.generateSummary(urls.length, startTime);
                // Save results
                yield this.saveResults(summary);
                console.log(`COMPLETED: Bulk scan in ${summary.completionTime}`);
                return summary;
            }
            catch (error) {
                console.error('ERROR: Bulk scan failed:', error);
                throw error;
            }
            finally {
                yield this.cleanup();
            }
        });
    }
    /**
     * Process URLs with worker pool pattern
     */
    processWithWorkers(tasks) {
        return __awaiter(this, void 0, void 0, function* () {
            const workQueue = [...tasks];
            const workers = [];
            // Create worker promises
            for (let i = 0; i < this.options.maxWorkers; i++) {
                workers.push(this.createWorker(workQueue, i));
            }
            // Wait for all workers to complete
            yield Promise.all(workers);
        });
    }
    /**
     * Individual worker that processes URLs from the queue
     */
    createWorker(workQueue, workerId) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                while (workQueue.length > 0) {
                    const task = workQueue.shift();
                    if (!task)
                        break;
                    console.log(`SCANNING: Worker ${workerId}: ${task.url} (${task.index + 1}/${task.total})`);
                    const result = yield this.scanSinglePage(task.url);
                    const needsClaudeAnalysis = this.needsHumanAnalysis(result);
                    this.results.push({
                        url: task.url,
                        result,
                        needsClaudeAnalysis
                    });
                    this.processedCount++;
                    // Rate limiting
                    yield this.delay(2000);
                }
            }
            catch (error) {
                console.error(`ERROR: Worker ${workerId} failed:`, error);
                this.errors.push(`Worker ${workerId}: ${error}`);
            }
        });
    }
    /**
     * Scan a single page with retry logic
     */
    scanSinglePage(url) {
        return __awaiter(this, void 0, void 0, function* () {
            let lastError = null;
            for (let attempt = 1; attempt <= this.options.retryAttempts; attempt++) {
                try {
                    const page = yield this.browser.newPage();
                    try {
                        const result = yield this.performScan(page, url);
                        yield page.close();
                        return result;
                    }
                    catch (error) {
                        yield page.close();
                        throw error;
                    }
                }
                catch (error) {
                    lastError = error;
                    console.log(`WARNING: Attempt ${attempt}/${this.options.retryAttempts} failed for ${url}: ${error}`);
                    if (attempt < this.options.retryAttempts) {
                        yield this.delay(1000 * attempt); // Exponential backoff
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
                error: (lastError === null || lastError === void 0 ? void 0 : lastError.message) || 'Unknown error'
            };
        });
    }
    /**
     * Perform actual accessibility scan on a page
     */
    performScan(page, url) {
        return __awaiter(this, void 0, void 0, function* () {
            const startTime = Date.now();
            try {
                // Navigate to page
                yield page.goto(url, {
                    timeout: this.options.timeout,
                    waitUntil: 'networkidle2'
                });
                // Run accessibility scan with axe-core for WCAG 2.1 AA
                const axeResults = yield new puppeteer_2.AxePuppeteer(page)
                    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
                    .analyze();
                const scanDuration = Date.now() - startTime;
                return {
                    url,
                    timestamp: new Date().toISOString(),
                    violations: axeResults.violations,
                    passes: axeResults.passes,
                    incomplete: axeResults.incomplete,
                    inapplicable: axeResults.inapplicable,
                    scanDuration
                };
            }
            catch (error) {
                const scanDuration = Date.now() - startTime;
                throw new Error(`Scan failed for ${url}: ${error}`);
            }
        });
    }
    /**
     * Determine if a page needs human analysis based on violation types
     */
    needsHumanAnalysis(scanResult) {
        if (scanResult.error) {
            return true; // Error cases need manual review
        }
        // Check for critical violations
        const criticalViolations = scanResult.violations.filter(v => v.impact === 'critical');
        if (criticalViolations.length >= scan_config_1.SCAN_CONFIG.decisionThresholds.criticalViolationsLimit) {
            return true;
        }
        // Check for complex issues that need visual analysis
        const complexIssues = scanResult.violations.filter(violation => scan_config_1.SCAN_CONFIG.decisionThresholds.complexIssuesForClaudeAnalysis.includes(violation.id));
        if (complexIssues.length > 0) {
            return true;
        }
        // Check for high number of incomplete results
        if (scanResult.incomplete.length > scan_config_1.SCAN_CONFIG.decisionThresholds.incompleteResultsLimit) {
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
    categorizeResults() {
        const passed = [];
        const minorIssues = [];
        const claudeNeeded = [];
        const critical = [];
        for (const { result, needsClaudeAnalysis } of this.results) {
            if (result.error) {
                critical.push(result);
            }
            else if (result.violations.length === 0) {
                passed.push(result);
            }
            else if (needsClaudeAnalysis) {
                claudeNeeded.push(result);
            }
            else {
                // Check if issues are minor/auto-fixable
                const hasSerious = result.violations.some(v => v.impact === 'serious' || v.impact === 'critical');
                if (hasSerious) {
                    critical.push(result);
                }
                else {
                    minorIssues.push(result);
                }
            }
        }
        return { passed, minorIssues, claudeNeeded, critical };
    }
    /**
     * Get pages that need Claude analysis
     */
    getPagesForClaudeAnalysis() {
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
    generateSummary(totalPages, startTime) {
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
    saveResults(summary) {
        return __awaiter(this, void 0, void 0, function* () {
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
            console.log(`SAVED: Results to ${this.options.outputDirectory}`);
            console.log(`   - Detailed results: ${detailedPath}`);
            console.log(`   - Categorized results: ${categorizedPath}`);
            console.log(`   - Claude analysis queue: ${claudeQueuePath}`);
            console.log(`   - Summary: ${summaryPath}`);
        });
    }
    /**
     * Utility methods
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        }
        else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        }
        else {
            return `${seconds}s`;
        }
    }
    cleanup() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.browser) {
                yield this.browser.close();
                this.browser = null;
            }
        });
    }
    /**
     * Get scan progress
     */
    getProgress() {
        const total = this.results.length + this.processedCount;
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
    getStats() {
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
exports.BulkScannerAgent = BulkScannerAgent;
