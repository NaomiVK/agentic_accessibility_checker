import { BulkScannerAgent } from './src/agents/bulk-scanner';
import { DecisionAgent } from './src/agents/decision-agent';
import { ClaudeAnalysisAgent } from './src/agents/claude-analysis-agent';
import { ReportGenerator } from './src/agents/report-generator';
import { PageAnalysisRequest } from './src/types/claude-types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Autonomous Accessibility Testing with Claude Vision
 * 
 * This script demonstrates how the entire workflow runs programmatically:
 * 1. Bulk scan pages with axe-core
 * 2. Decision agent categorizes results
 * 3. Claude analyzes complex issues with vision-enabled Playwright
 * 4. Generate comprehensive reports
 */
async function runAutonomousAccessibilityTest() {
  console.log('===========================================');
  console.log('Autonomous Accessibility Testing with Vision');
  console.log('===========================================');
  console.log('');
  
  // Test URLs - using a small subset for demonstration
  const testUrls = [
    'https://www.canada.ca/en/services/taxes/child-and-family-benefits.html',
    'https://www.canada.ca/en/revenue-agency.html'
  ];
  
  try {
    // Step 1: Initialize agents
    console.log('Step 1: Initializing agents...');
    const bulkScanner = new BulkScannerAgent({
      maxWorkers: 1,
      outputDirectory: './results/autonomous-test/bulk-scan',
      timeout: 45000,
      retryAttempts: 2
    });
    const decisionAgent = new DecisionAgent();
    const claudeAgent = new ClaudeAnalysisAgent();
    const reportGenerator = new ReportGenerator('./results/autonomous-test');
    
    // Step 2: Bulk scan with axe-core
    console.log('\nStep 2: Running bulk accessibility scan with axe-core...');
    const scanSummary = await bulkScanner.scanPages(testUrls);
    
    console.log(`Scanned ${scanSummary.totalPages} pages in ${scanSummary.completionTime}`);
    
    // Step 3: Get categorized results from bulk scanner
    console.log('\nStep 3: Getting categorized results...');
    const decisions = bulkScanner.categorizeResults();
    
    console.log('Categorization results:');
    console.log(`- Passed: ${decisions.passed.length} pages`);
    console.log(`- Minor issues: ${decisions.minorIssues.length} pages`);
    console.log(`- Need Claude analysis: ${decisions.claudeNeeded.length} pages`);
    console.log(`- Critical issues: ${decisions.critical.length} pages`);
    
    // Step 4: Claude vision analysis for complex issues
    let claudeResults: any[] = [];
    if (decisions.claudeNeeded.length > 0) {
      console.log('\nStep 4: Running Claude vision analysis on complex issues...');
      console.log('This uses the Claude Code SDK with Playwright MCP for:');
      console.log('- Visual inspection of violations');
      console.log('- Keyboard navigation testing');
      console.log('- Focus indicator verification');
      console.log('- Color contrast analysis');
      console.log('- Dynamic content testing');
      
      // Convert to PageAnalysisRequest format
      const claudeRequests: PageAnalysisRequest[] = decisions.claudeNeeded.map(page => ({
        url: page.url,
        violations: page.violations,
        priority: page.violations.some(v => v.impact === 'critical') ? 'Critical' as const :
                 page.violations.some(v => v.impact === 'serious') ? 'High' as const :
                 'Medium' as const,
        pageContext: {
          title: `Page: ${page.url}`,
          description: 'Government of Canada page requiring accessibility analysis',
          hasForm: page.violations.some(v => v.nodes.some(n => n.html.includes('<form'))),
          hasNavigation: page.violations.some(v => v.nodes.some(n => n.html.includes('nav'))),
          hasModal: page.violations.some(v => v.nodes.some(n => n.html.includes('modal') || n.html.includes('dialog')))
        }
      }));
      
      // Process with Claude vision
      claudeResults = await claudeAgent.processComplexIssues(claudeRequests);
      
      console.log(`\nClaude analyzed ${claudeResults.length} pages with vision`);
      claudeResults.forEach(result => {
        console.log(`\n- ${result.url}:`);
        console.log(`  Cost: $${result.cost.toFixed(4)}`);
        console.log(`  Remediation steps: ${result.remediationSteps.length}`);
        console.log(`  Screenshots taken: ${result.findings.screenshots.length}`);
        console.log(`  Overall: ${result.overallAssessment.substring(0, 100)}...`);
      });
    }
    
    // Step 5: Generate comprehensive reports
    console.log('\nStep 5: Generating comprehensive reports...');
    const startTime = new Date(Date.now() - 300000); // 5 minutes ago
    const endTime = new Date();
    
    const report = await reportGenerator.generateReport(
      decisions,
      claudeResults,
      startTime,
      endTime
    );
    
    // Export all report formats
    reportGenerator.exportToJSON('autonomous-test-report.json');
    reportGenerator.exportToHTML('autonomous-test-report.html');
    reportGenerator.exportToExcel('autonomous-test-detailed.xlsx');
    reportGenerator.exportToCSV();
    
    // Summary statistics
    console.log('\n===========================================');
    console.log('Test Complete - Summary Statistics');
    console.log('===========================================');
    console.log(`Total pages tested: ${report.summary.totalPages}`);
    console.log(`Pages passed: ${report.summary.passedPages}`);
    console.log(`WCAG compliance: ${report.summary.wcagCompliance.level}`);
    console.log(`Pass rate: ${report.summary.wcagCompliance.passRate}%`);
    
    if (claudeResults.length > 0) {
      const totalCost = claudeResults.reduce((sum, r) => sum + r.cost, 0);
      console.log(`\nClaude Vision Analysis:`);
      console.log(`- Pages analyzed: ${claudeResults.length}`);
      console.log(`- Total cost: $${totalCost.toFixed(4)}`);
      console.log(`- Average cost per page: $${(totalCost / claudeResults.length).toFixed(4)}`);
    }
    
    console.log('\nReports generated in: ./results/autonomous-test/');
    console.log('- autonomous-test-report.json (structured data)');
    console.log('- autonomous-test-report.html (visual dashboard)');
    console.log('- autonomous-test-detailed.xlsx (4 detailed sheets)');
    console.log('- violations-detailed.csv & failing-elements.csv');
    
    return {
      success: true,
      summary: report.summary,
      claudeAnalysisCount: claudeResults.length
    };
    
  } catch (error) {
    console.error('\nERROR: Test failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

// Run the autonomous test
if (require.main === module) {
  console.log('Starting autonomous accessibility test...');
  console.log('This will run completely programmatically using:');
  console.log('- Axe-core for automated scanning');
  console.log('- Claude Code SDK for vision analysis');
  console.log('- Playwright MCP for browser automation');
  console.log('');
  
  runAutonomousAccessibilityTest().then(result => {
    if (result.success) {
      console.log('\nSUCCESS: Autonomous test completed!');
      process.exit(0);
    } else {
      console.error('\nFAILED:', result.error);
      process.exit(1);
    }
  });
}

export { runAutonomousAccessibilityTest };