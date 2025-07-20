import { ClaudeAnalysisAgent } from './src/agents/claude-analysis-agent';
import { PageAnalysisRequest } from './src/types/claude-types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Demonstration of Claude Vision-Enabled Accessibility Analysis
 * 
 * This shows how the Claude Code SDK works programmatically with the Playwright MCP
 * to perform visual accessibility testing that goes beyond automated tools.
 */
async function demonstrateClaudeVisionAnalysis() {
  console.log('==========================================');
  console.log('Claude Vision Accessibility Analysis Demo');
  console.log('==========================================\n');
  
  // Create a sample page with complex accessibility issues that need visual analysis
  const samplePage: PageAnalysisRequest = {
    url: 'https://www.canada.ca/en/services/taxes/child-and-family-benefits.html',
    violations: [
      {
        id: 'color-contrast',
        impact: 'serious',
        description: 'Elements must have sufficient color contrast',
        help: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
        nodes: [
          {
            any: [],
            all: [{
              id: 'color-contrast',
              impact: 'serious',
              message: 'Element has insufficient color contrast',
              data: { fgColor: '#767676', bgColor: '#ffffff', contrastRatio: 3.5 },
              relatedNodes: []
            }],
            none: [],
            html: '<a href="#" class="nav-link">Navigation Link</a>',
            impact: 'serious',
            target: ['nav > ul > li > a']
          }
        ],
        tags: ['wcag2aa', 'wcag143']
      }
    ],
    priority: 'High',
    pageContext: {
      title: 'Tax credits and benefits - Canada.ca',
      description: 'Government page requiring accessibility analysis',
      hasForm: true,
      hasNavigation: true,
      hasModal: false
    }
  };
  
  try {
    // Initialize Claude analysis agent
    const claudeAgent = new ClaudeAnalysisAgent();
    
    console.log('Starting Claude Vision Analysis...');
    console.log(`URL: ${samplePage.url}`);
    console.log(`Violations to analyze: ${samplePage.violations.length}`);
    console.log('\nClaude will use the Playwright MCP to:');
    console.log('- Navigate to the page');
    console.log('- Take screenshots of violation areas');
    console.log('- Test keyboard navigation');
    console.log('- Verify focus indicators');
    console.log('- Analyze color contrast visually');
    console.log('- Test dynamic content\n');
    
    // Perform the analysis
    console.log('Analyzing page (this may take 30-60 seconds)...\n');
    const result = await claudeAgent.analyzeWithClaude(samplePage);
    
    // Display results
    console.log('\n==========================================');
    console.log('Analysis Results');
    console.log('==========================================\n');
    
    console.log(`Session ID: ${result.sessionId}`);
    console.log(`Cost: $${result.cost.toFixed(4)}`);
    console.log(`Timestamp: ${result.timestamp}\n`);
    
    console.log('Keyboard Navigation Findings:');
    console.log(result.findings.keyboardNavigation);
    console.log('\nVisual Issues Identified:');
    console.log(result.findings.visualIssues);
    console.log('\nAccessibility Tree Analysis:');
    console.log(result.findings.accessibilityTree);
    console.log('\nDynamic Content Assessment:');
    console.log(result.findings.dynamicContent);
    
    console.log(`\nScreenshots taken: ${result.findings.screenshots.length}`);
    result.findings.screenshots.forEach((screenshot, index) => {
      console.log(`  ${index + 1}. ${screenshot}`);
    });
    
    console.log(`\nRemediation Steps (${result.remediationSteps.length} total):`);
    result.remediationSteps.forEach((step, index) => {
      console.log(`\n${index + 1}. ${step.issue}`);
      console.log(`   Priority: ${step.priority}`);
      console.log(`   Effort: ${step.effort}`);
      console.log(`   WCAG: ${step.wcagCriteria}`);
      console.log(`   Solution: ${step.solution}`);
      if (step.codeExample) {
        console.log(`   Code Example:\n   ${step.codeExample.split('\n').join('\n   ')}`);
      }
    });
    
    console.log('\n==========================================');
    console.log('Overall Assessment');
    console.log('==========================================');
    console.log(result.overallAssessment);
    
    // Save detailed results
    const fs = require('fs').promises;
    const outputPath = './results/claude-analysis/demo-vision-analysis.json';
    await fs.mkdir('./results/claude-analysis', { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(result, null, 2));
    console.log(`\nDetailed results saved to: ${outputPath}`);
    
    return result;
    
  } catch (error) {
    console.error('\nError during analysis:', error);
    throw error;
  }
}

// Run the demonstration
if (require.main === module) {
  console.log('Claude Vision Accessibility Analysis Demonstration\n');
  console.log('This demonstrates how the Claude Code SDK works programmatically');
  console.log('with the Playwright MCP to perform visual accessibility testing.\n');
  console.log('The analysis will:');
  console.log('1. Use Claude Code SDK to invoke Claude programmatically');
  console.log('2. Use Playwright MCP to navigate and interact with the page');
  console.log('3. Perform visual analysis that automated tools cannot do');
  console.log('4. Return structured results with specific remediation steps\n');
  
  demonstrateClaudeVisionAnalysis()
    .then(() => {
      console.log('\nDemo completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\nDemo failed:', error);
      process.exit(1);
    });
}

export { demonstrateClaudeVisionAnalysis };