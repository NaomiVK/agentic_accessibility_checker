import { ClaudeAnalysisAgent } from './src/agents/claude-analysis-agent';
import { PageAnalysisRequest } from './src/types/claude-types';
import { ViolationResult } from './src/types/accessibility-types';

/**
 * Test script to demonstrate Claude vision-enabled accessibility analysis
 * This shows how the Claude agent works with the Playwright MCP server
 */
async function testClaudeVisionAnalysis() {
  console.log('Testing Claude Vision-Enabled Accessibility Analysis');
  console.log('================================================');
  
  try {
    // Initialize Claude analysis agent
    const claudeAgent = new ClaudeAnalysisAgent();
    
    // Create a sample page with complex accessibility issues
    const testPage: PageAnalysisRequest = {
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
                message: 'Element has insufficient color contrast of 3.5:1 (foreground color: #767676, background color: #ffffff, font size: 14pt, font weight: normal). Expected contrast ratio of 4.5:1',
                data: { fgColor: '#767676', bgColor: '#ffffff', contrastRatio: 3.5 },
                relatedNodes: []
              }],
              none: [],
              html: '<a href="#" class="nav-link">Important Links</a>',
              impact: 'serious',
              target: ['nav > ul > li:nth-child(3) > a']
            }
          ],
          tags: ['wcag2aa', 'wcag143']
        },
        {
          id: 'keyboard-navigation',
          impact: 'critical',
          description: 'Interactive elements must be keyboard accessible',
          help: 'Ensures all interactive elements can be accessed via keyboard',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/keyboard',
          nodes: [
            {
              any: [],
              all: [],
              none: [],
              html: '<div class="dropdown-menu" onclick="toggleMenu()">Menu</div>',
              impact: 'critical',
              target: ['.dropdown-menu']
            }
          ],
          tags: ['wcag2a', 'wcag211']
        },
        {
          id: 'focus-visible',
          impact: 'serious',
          description: 'Interactive elements must have visible focus indicators',
          help: 'Ensures interactive elements have visible focus indicators for keyboard users',
          helpUrl: 'https://www.w3.org/WAI/WCAG21/Understanding/focus-visible',
          nodes: [
            {
              any: [],
              all: [],
              none: [],
              html: '<button class="submit-btn">Submit</button>',
              impact: 'serious',
              target: ['.submit-btn']
            }
          ],
          tags: ['wcag2aa', 'wcag2411']
        }
      ],
      priority: 'High',
      pageContext: {
        title: 'Child and family benefits - Canada.ca',
        description: 'Government of Canada page about child and family benefits',
        hasForm: true,
        hasNavigation: true,
        hasModal: false
      }
    };
    
    console.log('\nAnalyzing page with Claude vision capabilities...');
    console.log(`URL: ${testPage.url}`);
    console.log(`Violations to analyze: ${testPage.violations.length}`);
    console.log('Complex issues: color-contrast, keyboard-navigation, focus-visible');
    
    // Perform Claude analysis with vision-enabled Playwright
    const result = await claudeAgent.analyzeWithClaude(testPage);
    
    console.log('\nAnalysis Complete!');
    console.log('==================');
    console.log(`Session ID: ${result.sessionId}`);
    console.log(`Cost: $${result.cost.toFixed(4)}`);
    console.log(`Timestamp: ${result.timestamp}`);
    
    console.log('\nKey Findings:');
    console.log(`- Keyboard Navigation: ${result.findings.keyboardNavigation.substring(0, 100)}...`);
    console.log(`- Visual Issues: ${result.findings.visualIssues.substring(0, 100)}...`);
    console.log(`- Screenshots taken: ${result.findings.screenshots.length}`);
    console.log(`- Remediation steps: ${result.remediationSteps.length}`);
    
    console.log('\nRemediation Steps:');
    result.remediationSteps.forEach((step, index) => {
      console.log(`\n${index + 1}. ${step.issue}`);
      console.log(`   Priority: ${step.priority}`);
      console.log(`   Effort: ${step.effort}`);
      console.log(`   WCAG: ${step.wcagCriteria}`);
      console.log(`   Solution: ${step.solution.substring(0, 150)}...`);
      if (step.codeExample) {
        console.log(`   Code example provided: Yes`);
      }
    });
    
    console.log('\nOverall Assessment:');
    console.log(result.overallAssessment);
    
    // Save detailed results
    const fs = require('fs');
    const outputPath = './results/claude-analysis/test-vision-analysis.json';
    fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
    console.log(`\nDetailed results saved to: ${outputPath}`);
    
  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run the test
if (require.main === module) {
  testClaudeVisionAnalysis().then(() => {
    console.log('\nTest completed successfully!');
    process.exit(0);
  });
}

export { testClaudeVisionAnalysis };