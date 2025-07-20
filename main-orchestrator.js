#!/usr/bin/env node
"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const bulk_scanner_1 = require("./src/agents/bulk-scanner");
const decision_agent_1 = require("./src/agents/decision-agent");
const claude_analysis_agent_1 = require("./src/agents/claude-analysis-agent");
const report_generator_1 = require("./src/agents/report-generator");
const config_loader_1 = require("./src/utils/config-loader");
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        commander_1.program
            .option('-i, --input <file>', 'Input file with URLs to test', 'config/urls-to-test.json')
            .option('-w, --workers <number>', 'Number of concurrent workers', '5')
            .option('-o, --output <directory>', 'Output directory for results', 'results')
            .option('--skip-claude', 'Skip Claude analysis and only run bulk scanning')
            .parse();
        const options = commander_1.program.opts();
        console.log('STARTING: Accessibility Testing Agent Workflow');
        console.log(`INPUT FILE: ${options.input}`);
        console.log(`WORKERS: ${options.workers}`);
        console.log(`OUTPUT DIRECTORY: ${options.output}`);
        try {
            // Step 1: Load URLs to test
            const urlsConfig = yield (0, config_loader_1.loadUrls)(options.input);
            console.log(`LOADED: ${urlsConfig.urls.length} URLs to test`);
            // Step 2: Initialize agents
            const bulkScanner = new bulk_scanner_1.BulkScannerAgent();
            const decisionAgent = new decision_agent_1.DecisionAgent();
            const claudeAgent = new claude_analysis_agent_1.ClaudeAnalysisAgent();
            const reportGenerator = new report_generator_1.ReportGenerator();
            // Step 3: Bulk scanning
            console.log('STARTING: Bulk accessibility scanning...');
            const scanResults = yield bulkScanner.scanPages(urlsConfig.urls, {
                maxWorkers: parseInt(options.workers),
                outputDirectory: `${options.output}/bulk-scan-results`
            });
            console.log(`COMPLETE: Bulk scanning processed ${scanResults.length} pages`);
            // Step 4: Decision making
            console.log('ANALYZING: Results and making decisions...');
            const decisions = yield decisionAgent.categorizeResults(scanResults);
            console.log(`SUMMARY: Decision results\n    - PASSED: ${decisions.passed.length}\n    - MINOR ISSUES: ${decisions.minorIssues.length}\n    - CLAUDE ANALYSIS NEEDED: ${decisions.claudeNeeded.length}\n    - CRITICAL: ${decisions.critical.length}`);
            // Step 5: Claude analysis (if not skipped)
            let claudeResults = [];
            if (!options.skipClaude && decisions.claudeNeeded.length > 0) {
                console.log('STARTING: Claude Code visual analysis...');
                claudeResults = yield claudeAgent.processComplexIssues(decisions.claudeNeeded, `${options.output}/claude-analysis`);
                console.log(`COMPLETE: Claude analysis for ${claudeResults.length} pages`);
            }
            // Step 6: Generate final reports
            console.log('GENERATING: Comprehensive reports...');
            const reports = yield reportGenerator.generateReports({
                bulkScanResults: scanResults,
                decisions,
                claudeResults,
                outputDirectory: `${options.output}/final-reports`
            });
            console.log('SUCCESS: Accessibility testing workflow completed!');
            console.log(`REPORTS GENERATED: ${options.output}/final-reports`);
        }
        catch (error) {
            console.error('ERROR: In accessibility testing workflow:', error);
            process.exit(1);
        }
    });
}
if (require.main === module) {
    main();
}
