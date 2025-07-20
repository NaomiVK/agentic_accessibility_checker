#!/usr/bin/env node

import { program } from 'commander';
import { BulkScannerAgent } from './src/agents/bulk-scanner';
import { DecisionAgent } from './src/agents/decision-agent';
import { ClaudeAnalysisAgent } from './src/agents/claude-analysis-agent';
import { ComprehensiveReportGenerator } from './src/agents/comprehensive-report-generator';
import { loadUrls } from './src/utils/config-loader';
import { AnalysisResult } from './src/types/claude-types';

async function main() {
  program
    .option('-i, --input <file>', 'Input file with URLs to test', 'config/urls-to-test.json')
    .option('-w, --workers <number>', 'Number of concurrent workers', '5')
    .option('-o, --output <directory>', 'Output directory for results', 'results')
    .option('--skip-claude', 'Skip Claude analysis and only run bulk scanning')
    .parse();

  const options = program.opts();
  
  console.log('Starting Accessibility Testing Agent Workflow');
  console.log(`Input file: ${options.input}`);
  console.log(`Workers: ${options.workers}`);
  console.log(`Output directory: ${options.output}`);
  
  try {
    // Step 1: Load URLs to test
    const urlsConfig = await loadUrls(options.input);
    console.log(`Loaded ${urlsConfig.urls.length} URLs to test`);
    
    // Step 2: Initialize agents
    const bulkScannerOptions = {
      maxWorkers: parseInt(options.workers),
      outputDirectory: `${options.output}/bulk-scan-results`,
      timeout: 30000,
      retryAttempts: 3
    };
    const bulkScanner = new BulkScannerAgent(bulkScannerOptions);
    const decisionAgent = new DecisionAgent();
    const claudeAgent = new ClaudeAnalysisAgent();
    const reportGenerator = new ComprehensiveReportGenerator(`${options.output}/final-reports`);
    
    // Step 3: Bulk scanning
    console.log('Starting bulk accessibility scanning...');
    const bulkSummary = await bulkScanner.scanPages(urlsConfig.urls);
    
    // Get categorized results from the scanner
    const scanResults = bulkScanner.categorizeResults();
    
    console.log(`Bulk scanning complete. Processed ${bulkSummary.totalPages} pages`);
    
    // Step 4: Decision making (use results from bulk scanner)
    console.log('Results already categorized by bulk scanner...');
    const decisions = scanResults;
    
    console.log(`Decision summary:
    - Passed: ${decisions.passed.length}
    - Minor issues: ${decisions.minorIssues.length}
    - Claude analysis needed: ${decisions.claudeNeeded.length}
    - Critical: ${decisions.critical.length}`);
    
    // Step 5: Claude analysis (if not skipped)
    let claudeResults: AnalysisResult[] = [];
    if (!options.skipClaude && decisions.claudeNeeded.length > 0) {
      console.log('Starting Claude Code visual analysis...');
      
      // Convert PageScanResult[] to PageAnalysisRequest[]
      const claudeAnalysisRequests = decisions.claudeNeeded.map(page => ({
        url: page.url,
        violations: page.violations,
        priority: page.violations.some(v => v.impact === 'critical') ? 'Critical' as const :
                 page.violations.some(v => v.impact === 'serious') ? 'High' as const :
                 'Medium' as const,
        pageContext: {
          title: '',
          description: '',
          hasForm: page.violations.some(v => v.nodes.some(n => n.html.includes('<form'))),
          hasNavigation: page.violations.some(v => v.nodes.some(n => n.html.includes('nav'))),
          hasModal: page.violations.some(v => v.nodes.some(n => n.html.includes('modal') || n.html.includes('dialog')))
        }
      }));
      
      claudeResults = await claudeAgent.processComplexIssues(claudeAnalysisRequests);
      console.log(`Claude analysis complete. Analyzed ${claudeResults.length} pages`);
    }
    
    // Step 6: Generate final reports
    console.log('Generating comprehensive reports...');
    const startTime = new Date(Date.now() - 60000); // Approximate start time
    const endTime = new Date();
    
    const reports = await reportGenerator.generateReport(
      decisions,
      claudeResults,
      startTime,
      endTime
    );
    
    // Export reports
    reportGenerator.exportToJSON();
    reportGenerator.exportToHTML();
    reportGenerator.exportToExcel();
    reportGenerator.exportToCSV();
    
    console.log('Accessibility testing workflow completed successfully!');
    console.log(`Final reports generated in: ${options.output}/final-reports`);
    
  } catch (error) {
    console.error('Error in accessibility testing workflow:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}