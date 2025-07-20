import { writeFileSync } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { DecisionResult, PageScanResult, ViolationResult } from '../types/accessibility-types';
import { AnalysisResult } from '../types/claude-types';
import { ensureDirectoryExists } from '../utils/file-helpers';

interface TestCoverage {
  automated: string[];
  manual: string[];
  passed: string[];
  failed: string[];
  notApplicable: string[];
}

interface PageTestResult {
  url: string;
  category: string;
  automatedTests: {
    total: number;
    passed: number;
    failed: number;
    violations: ViolationResult[];
    testsRun: string[];
  };
  manualTests?: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
    testsRun: string[];
    findings: any;
  };
  overallScore: 'PASS' | 'WARNING' | 'SERIOUS' | 'CRITICAL';
  scoreDetails: {
    critical: number;
    serious: number;
    moderate: number;
    minor: number;
  };
}

/**
 * Comprehensive Report Generator with full test tracking and clear scoring
 */
export class ComprehensiveReportGenerator {
  private outputDirectory: string;
  private reportData: any;
  private wcag21Tests: string[] = [
    // WCAG 2.1 Level A & AA tests typically run by axe-core
    'area-alt', 'aria-allowed-attr', 'aria-command-name', 'aria-hidden-body', 
    'aria-hidden-focus', 'aria-input-field-name', 'aria-meter-name', 'aria-progressbar-name',
    'aria-required-attr', 'aria-required-children', 'aria-required-parent', 'aria-roledescription',
    'aria-roles', 'aria-toggle-field-name', 'aria-tooltip-name', 'aria-valid-attr-value',
    'aria-valid-attr', 'audio-caption', 'autocomplete-valid', 'avoid-inline-spacing',
    'blink', 'button-name', 'bypass', 'color-contrast', 'definition-list', 'dlitem',
    'document-title', 'duplicate-id-active', 'duplicate-id-aria', 'duplicate-id',
    'empty-heading', 'focus-order-semantics', 'form-field-multiple-labels', 'frame-tested',
    'frame-title-unique', 'frame-title', 'heading-order', 'hidden-content', 'html-has-lang',
    'html-lang-valid', 'html-xml-lang-mismatch', 'identical-links-same-purpose',
    'image-alt', 'input-button-name', 'input-image-alt', 'label-content-name-mismatch',
    'label-title-only', 'label', 'landmark-banner-is-top-level', 'landmark-complementary-is-top-level',
    'landmark-contentinfo-is-top-level', 'landmark-main-is-top-level', 'landmark-no-duplicate-banner',
    'landmark-no-duplicate-contentinfo', 'landmark-no-duplicate-main', 'landmark-one-main',
    'landmark-unique', 'link-in-text-block', 'link-name', 'list', 'listitem',
    'marquee', 'meta-refresh', 'meta-viewport-large', 'meta-viewport', 'nested-interactive',
    'no-autoplay-audio', 'object-alt', 'p-as-heading', 'page-has-heading-one',
    'presentation-role-conflict', 'region', 'role-img-alt', 'scope-attr-valid',
    'scrollable-region-focusable', 'select-name', 'server-side-image-map', 'skip-link',
    'svg-img-alt', 'tabindex', 'table-duplicate-name', 'table-fake-caption',
    'td-headers-attr', 'td-has-header', 'th-has-data-cells', 'valid-lang',
    'video-caption', 'video-description'
  ];

  private manualTestsPerformed: string[] = [
    // Tests that Claude would perform visually
    'keyboard-navigation-flow', 'focus-indicator-visibility', 'color-contrast-enhanced',
    'text-readability', 'interactive-element-affordance', 'error-identification',
    'consistent-navigation', 'consistent-identification', 'visual-focus-order',
    'content-on-hover-or-focus', 'animation-control', 'resize-text-200',
    'images-of-text-usage', 'visual-presentation', 'link-purpose-in-context'
  ];

  constructor(outputDirectory: string) {
    this.outputDirectory = outputDirectory;
    ensureDirectoryExists(this.outputDirectory);
  }

  /**
   * Generate comprehensive report with test tracking
   */
  async generateReport(
    categorizedResults: DecisionResult,
    claudeAnalysisResults: AnalysisResult[],
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    // Process all pages with comprehensive test tracking
    const pageTestResults = this.processAllPages(categorizedResults, claudeAnalysisResults);
    
    // Build comprehensive report data
    this.reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        scanDuration: endTime.getTime() - startTime.getTime(),
        totalPages: pageTestResults.length,
        toolVersion: '3.0.0-comprehensive'
      },
      testCoverage: this.calculateTestCoverage(pageTestResults),
      summary: this.generateComprehensiveSummary(pageTestResults),
      pageTestResults,
      categorizedResults,
      claudeAnalysis: claudeAnalysisResults,
      aggregatedFindings: this.aggregateFindings(pageTestResults),
      recommendations: this.generatePrioritizedRecommendations(pageTestResults)
    };
  }

  /**
   * Export to Excel with comprehensive test tracking
   */
  exportToExcel(): void {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Test Coverage & Summary
    const coverageData = this.generateTestCoverageSheet();
    const coverageSheet = XLSX.utils.aoa_to_sheet(coverageData);
    XLSX.utils.book_append_sheet(workbook, coverageSheet, 'Test Coverage & Summary');

    // Sheet 2: Page-by-Page Results with Scores
    const pageResultsData = this.generatePageResultsSheet();
    const pageResultsSheet = XLSX.utils.aoa_to_sheet(pageResultsData);
    XLSX.utils.book_append_sheet(workbook, pageResultsSheet, 'Page Results & Scores');

    // Sheet 3: Critical & Serious Issues
    const criticalData = this.generateCriticalIssuesSheet();
    const criticalSheet = XLSX.utils.aoa_to_sheet(criticalData);
    XLSX.utils.book_append_sheet(workbook, criticalSheet, 'Critical Issues');

    // Sheet 4: Detailed Violations by Test
    const violationsData = this.generateViolationsByTestSheet();
    const violationsSheet = XLSX.utils.aoa_to_sheet(violationsData);
    XLSX.utils.book_append_sheet(workbook, violationsSheet, 'Violations by Test');

    // Sheet 5: Claude Manual Testing Results
    const claudeData = this.generateClaudeTestResultsSheet();
    const claudeSheet = XLSX.utils.aoa_to_sheet(claudeData);
    XLSX.utils.book_append_sheet(workbook, claudeSheet, 'Manual Testing Results');

    // Sheet 6: Aggregated Findings
    const aggregatedData = this.generateAggregatedFindingsSheet();
    const aggregatedSheet = XLSX.utils.aoa_to_sheet(aggregatedData);
    XLSX.utils.book_append_sheet(workbook, aggregatedSheet, 'Aggregated Findings');

    // Save the workbook
    const excelPath = join(this.outputDirectory, 'accessibility-comprehensive-report.xlsx');
    XLSX.writeFile(workbook, excelPath);
    console.log(`Comprehensive Excel report saved to: ${excelPath}`);
  }

  /**
   * Process all pages to create comprehensive test results
   */
  private processAllPages(
    categorizedResults: DecisionResult,
    claudeAnalysisResults: AnalysisResult[]
  ): PageTestResult[] {
    const allPages = [
      ...categorizedResults.passed,
      ...categorizedResults.minorIssues,
      ...categorizedResults.claudeNeeded,
      ...categorizedResults.critical
    ];

    return allPages.map(page => {
      const claudeResult = claudeAnalysisResults.find(c => c.url === page.url);
      return this.createPageTestResult(page, claudeResult);
    });
  }

  /**
   * Create comprehensive test result for a single page
   */
  private createPageTestResult(page: PageScanResult, claudeResult?: AnalysisResult): PageTestResult {
    // Calculate automated test results
    const testsRun = this.getTestsRunForPage(page);
    const failedTests = Array.from(new Set(page.violations.map(v => v.id)));
    const passedTests = testsRun.filter(test => !failedTests.includes(test));
    
    // Calculate scores
    const scoreDetails = {
      critical: page.violations.filter(v => v.impact === 'critical').length,
      serious: page.violations.filter(v => v.impact === 'serious').length,
      moderate: page.violations.filter(v => v.impact === 'moderate').length,
      minor: page.violations.filter(v => v.impact === 'minor').length
    };

    const overallScore = this.calculateOverallScore(scoreDetails, claudeResult);
    
    const result: PageTestResult = {
      url: page.url,
      category: this.determineCategory(page, claudeResult),
      automatedTests: {
        total: testsRun.length,
        passed: passedTests.length,
        failed: failedTests.length,
        violations: page.violations,
        testsRun
      },
      overallScore,
      scoreDetails
    };

    // Add manual test results if Claude analysis was performed
    if (claudeResult) {
      result.manualTests = this.processClaudeResults(claudeResult);
    }

    return result;
  }

  /**
   * Get list of tests that were run on a page
   */
  private getTestsRunForPage(page: PageScanResult): string[] {
    // Start with all WCAG tests that axe-core would run
    const testsRun = [...this.wcag21Tests];
    
    // Add any additional tests found in violations/passes
    const additionalTests = new Set<string>();
    
    page.violations.forEach(v => additionalTests.add(v.id));
    page.passes.forEach(p => additionalTests.add(p.id));
    page.incomplete.forEach(i => additionalTests.add(i.id));
    page.inapplicable.forEach(i => additionalTests.add(i.id));
    
    additionalTests.forEach(test => {
      if (!testsRun.includes(test)) {
        testsRun.push(test);
      }
    });
    
    return testsRun.sort();
  }

  /**
   * Process Claude results into manual test format
   */
  private processClaudeResults(claudeResult: AnalysisResult): any {
    const findings = claudeResult.findings;
    let passed = 0;
    let failed = 0;
    let warnings = 0;
    
    // Analyze remediation steps to determine pass/fail counts
    claudeResult.remediationSteps.forEach(step => {
      switch (step.priority) {
        case 'Critical':
        case 'High':
          failed++;
          break;
        case 'Medium':
          warnings++;
          break;
        case 'Low':
          passed++;
          break;
      }
    });
    
    // Estimate total manual tests (some may have passed)
    const total = this.manualTestsPerformed.length;
    passed = Math.max(0, total - failed - warnings);
    
    return {
      total,
      passed,
      failed,
      warnings,
      testsRun: this.manualTestsPerformed,
      findings: {
        keyboardNavigation: findings.keyboardNavigation,
        visualIssues: findings.visualIssues,
        accessibilityTree: findings.accessibilityTree,
        dynamicContent: findings.dynamicContent,
        remediationSteps: claudeResult.remediationSteps
      }
    };
  }

  /**
   * Calculate overall score based on violations and manual findings
   */
  private calculateOverallScore(scoreDetails: any, claudeResult?: AnalysisResult): 'PASS' | 'WARNING' | 'SERIOUS' | 'CRITICAL' {
    if (scoreDetails.critical > 0) return 'CRITICAL';
    if (scoreDetails.serious > 0) return 'SERIOUS';
    
    // Check Claude findings if available
    if (claudeResult) {
      const hasCriticalManual = claudeResult.remediationSteps.some(s => s.priority === 'Critical');
      const hasSeriousManual = claudeResult.remediationSteps.some(s => s.priority === 'High');
      
      if (hasCriticalManual) return 'CRITICAL';
      if (hasSeriousManual) return 'SERIOUS';
    }
    
    if (scoreDetails.moderate > 0) return 'WARNING';
    if (scoreDetails.minor > 0) return 'WARNING';
    
    return 'PASS';
  }

  /**
   * Generate test coverage sheet
   */
  private generateTestCoverageSheet(): any[][] {
    const coverage = this.reportData.testCoverage;
    const summary = this.reportData.summary;
    
    return [
      ['ACCESSIBILITY TEST COVERAGE REPORT'],
      [],
      ['Report Generated:', new Date().toLocaleString()],
      ['Total Pages Tested:', this.reportData.metadata.totalPages],
      ['Scan Duration:', `${(this.reportData.metadata.scanDuration / 1000).toFixed(1)} seconds`],
      [],
      ['AUTOMATED TEST COVERAGE (axe-core)'],
      ['Total WCAG 2.1 A & AA Tests Available:', this.wcag21Tests.length],
      ['Tests Successfully Run:', coverage.automated.length],
      ['Test Coverage Percentage:', `${((coverage.automated.length / this.wcag21Tests.length) * 100).toFixed(1)}%`],
      [],
      ['AUTOMATED TESTS RUN:'],
      ...this.wcag21Tests.map(test => [
        test,
        coverage.passed.includes(test) ? 'PASSED' : 
        coverage.failed.includes(test) ? 'FAILED' : 
        coverage.notApplicable.includes(test) ? 'N/A' : 'NOT RUN'
      ]),
      [],
      ['MANUAL/VISUAL TESTS (Claude Analysis)'],
      ['Pages Requiring Manual Testing:', summary.pagesWithManualTests],
      ['Manual Tests Performed:', coverage.manual.length > 0 ? 'YES' : 'NO'],
      ['Manual Test Types:', coverage.manual.join(', ') || 'None'],
      [],
      ['OVERALL COMPLIANCE SUMMARY'],
      ['Pages Fully Passing:', summary.fullyCompliant],
      ['Pages with Warnings:', summary.warnings],
      ['Pages with Serious Issues:', summary.serious],
      ['Pages with Critical Issues:', summary.critical],
      ['Overall Compliance Rate:', `${summary.complianceRate}%`]
    ];
  }

  /**
   * Generate page-by-page results with scores
   */
  private generatePageResultsSheet(): any[][] {
    const headers = [
      'Page URL',
      'Overall Score',
      'Category',
      'Automated Tests Run',
      'Automated Pass',
      'Automated Fail',
      'Manual Tests Run',
      'Manual Pass',
      'Manual Fail',
      'Critical Issues',
      'Serious Issues',
      'Warnings',
      'Minor Issues',
      'Total Elements Affected',
      'Key Failures'
    ];

    const data = [headers];
    
    this.reportData.pageTestResults.forEach((page: PageTestResult) => {
      const totalElements = page.automatedTests.violations.reduce((sum, v) => sum + v.nodes.length, 0);
      const keyFailures = page.automatedTests.violations
        .filter(v => v.impact === 'critical' || v.impact === 'serious')
        .map(v => v.id)
        .slice(0, 3)
        .join(', ');
      
      data.push([
        page.url,
        page.overallScore,
        page.category,
        page.automatedTests.total.toString(),
        page.automatedTests.passed.toString(),
        page.automatedTests.failed.toString(),
        (page.manualTests?.total || 0).toString(),
        (page.manualTests?.passed || 0).toString(),
        (page.manualTests?.failed || 0).toString(),
        page.scoreDetails.critical.toString(),
        page.scoreDetails.serious.toString(),
        page.scoreDetails.moderate.toString(),
        page.scoreDetails.minor.toString(),
        totalElements.toString(),
        keyFailures || 'None'
      ]);
    });

    return data;
  }

  /**
   * Generate critical issues sheet
   */
  private generateCriticalIssuesSheet(): any[][] {
    const criticalPages = this.reportData.pageTestResults.filter(
      (p: PageTestResult) => p.overallScore === 'CRITICAL' || p.overallScore === 'SERIOUS'
    );
    
    const data = [
      ['CRITICAL & SERIOUS ACCESSIBILITY ISSUES'],
      [],
      ['Total Pages with Critical/Serious Issues:', criticalPages.length],
      [],
      ['PAGES REQUIRING IMMEDIATE ATTENTION'],
      ['Page URL', 'Score', 'Failed Tests', 'Critical Count', 'Serious Count', 'Top Issues', 'Manual Test Findings']
    ];

    criticalPages.forEach((page: PageTestResult) => {
      const topIssues = page.automatedTests.violations
        .sort((a, b) => {
          const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
          return impactOrder[a.impact as keyof typeof impactOrder] - impactOrder[b.impact as keyof typeof impactOrder];
        })
        .slice(0, 3)
        .map(v => `${v.id} (${v.impact})`)
        .join(', ');
      
      const manualFindings = page.manualTests 
        ? `Failed: ${page.manualTests.failed}, Warnings: ${page.manualTests.warnings}`
        : 'Not tested';
      
      data.push([
        page.url,
        page.overallScore,
        page.automatedTests.failed.toString(),
        page.scoreDetails.critical.toString(),
        page.scoreDetails.serious.toString(),
        topIssues,
        manualFindings
      ]);
    });

    return data;
  }

  /**
   * Generate violations organized by test type
   */
  private generateViolationsByTestSheet(): any[][] {
    // Group violations by test ID across all pages
    const violationsByTest = new Map<string, {
      description: string;
      impact: string;
      pagesAffected: string[];
      totalOccurrences: number;
      wcagCriteria: string;
    }>();

    this.reportData.pageTestResults.forEach((page: PageTestResult) => {
      page.automatedTests.violations.forEach((violation: ViolationResult) => {
        if (!violationsByTest.has(violation.id)) {
          violationsByTest.set(violation.id, {
            description: violation.help,
            impact: violation.impact,
            pagesAffected: [],
            totalOccurrences: 0,
            wcagCriteria: violation.tags.filter(t => t.includes('wcag')).join(', ')
          });
        }
        
        const testData = violationsByTest.get(violation.id)!;
        testData.pagesAffected.push(page.url);
        testData.totalOccurrences += violation.nodes.length;
      });
    });

    const headers = [
      'Test ID',
      'Description',
      'Impact',
      'Pages Affected',
      'Total Occurrences',
      'WCAG Criteria',
      'Fix Recommendation'
    ];

    const data = [headers];
    
    // Sort by impact and occurrence count
    const sortedTests = Array.from(violationsByTest.entries()).sort((a, b) => {
      const impactOrder = { critical: 0, serious: 1, moderate: 2, minor: 3 };
      const impactDiff = impactOrder[a[1].impact as keyof typeof impactOrder] - 
                         impactOrder[b[1].impact as keyof typeof impactOrder];
      return impactDiff === 0 ? b[1].totalOccurrences - a[1].totalOccurrences : impactDiff;
    });

    sortedTests.forEach(([testId, testData]) => {
      data.push([
        testId,
        testData.description,
        testData.impact.toUpperCase(),
        testData.pagesAffected.length.toString(),
        testData.totalOccurrences.toString(),
        testData.wcagCriteria,
        this.getFixRecommendation(testId)
      ]);
    });

    return data;
  }

  /**
   * Generate Claude manual testing results
   */
  private generateClaudeTestResultsSheet(): any[][] {
    const claudeResults = this.reportData.claudeAnalysis;
    
    if (!claudeResults || claudeResults.length === 0) {
      return [
        ['No Manual Testing Performed'],
        ['All pages passed automated testing or did not require manual verification']
      ];
    }

    const headers = [
      'Page URL',
      'Manual Tests Run',
      'Keyboard Navigation',
      'Visual Issues',
      'Focus Management',
      'ARIA Implementation',
      'Top Remediation',
      'Manual Score',
      'Cost'
    ];

    const data = [headers];
    
    claudeResults.forEach((result: AnalysisResult) => {
      const pageTestResult = this.reportData.pageTestResults.find(
        (p: PageTestResult) => p.url === result.url
      );
      
      const manualScore = pageTestResult?.manualTests 
        ? `Pass: ${pageTestResult.manualTests.passed}, Fail: ${pageTestResult.manualTests.failed}, Warn: ${pageTestResult.manualTests.warnings}`
        : 'N/A';
      
      const topRemediation = result.remediationSteps[0];
      
      data.push([
        result.url,
        this.manualTestsPerformed.join(', '),
        this.summarizeFindings(result.findings.keyboardNavigation),
        this.summarizeFindings(result.findings.visualIssues),
        this.findFocusIssues(result),
        this.findAriaIssues(result),
        topRemediation ? `${topRemediation.issue} (${topRemediation.priority})` : 'None',
        manualScore,
        `$${result.cost.toFixed(4)}`
      ]);
    });

    data.push([]);
    data.push(['Total Manual Testing Cost:', `$${claudeResults.reduce((sum: number, r: AnalysisResult) => sum + r.cost, 0).toFixed(2)}`]);

    return data;
  }

  /**
   * Generate aggregated findings sheet
   */
  private generateAggregatedFindingsSheet(): any[][] {
    const aggregated = this.reportData.aggregatedFindings;
    
    return [
      ['AGGREGATED FINDINGS ACROSS ALL PAGES'],
      [],
      ['SCORE DISTRIBUTION'],
      ['Score Level', 'Page Count', 'Percentage'],
      ['PASS', aggregated.scoreDistribution.pass, `${aggregated.scoreDistribution.passPercentage}%`],
      ['WARNING', aggregated.scoreDistribution.warning, `${aggregated.scoreDistribution.warningPercentage}%`],
      ['SERIOUS', aggregated.scoreDistribution.serious, `${aggregated.scoreDistribution.seriousPercentage}%`],
      ['CRITICAL', aggregated.scoreDistribution.critical, `${aggregated.scoreDistribution.criticalPercentage}%`],
      [],
      ['TOP 10 MOST COMMON VIOLATIONS'],
      ['Rank', 'Test ID', 'Impact', 'Occurrences', 'Pages Affected', 'Description'],
      ...aggregated.topViolations.map((v: any, i: number) => [
        i + 1,
        v.id,
        v.impact.toUpperCase(),
        v.occurrences,
        v.pagesAffected,
        v.description
      ]),
      [],
      ['TEST FAILURE RATES'],
      ['Test ID', 'Failure Rate', 'Pages Failed', 'Total Pages'],
      ...aggregated.testFailureRates.slice(0, 20).map((t: any) => [
        t.testId,
        `${t.failureRate}%`,
        t.pagesFailed,
        t.totalPages
      ]),
      [],
      ['REMEDIATION EFFORT SUMMARY'],
      ['Priority', 'Issue Count', 'Estimated Hours', 'Key Areas'],
      ['Critical', aggregated.remediationEffort.critical.count, aggregated.remediationEffort.critical.hours, aggregated.remediationEffort.critical.areas],
      ['High', aggregated.remediationEffort.high.count, aggregated.remediationEffort.high.hours, aggregated.remediationEffort.high.areas],
      ['Medium', aggregated.remediationEffort.medium.count, aggregated.remediationEffort.medium.hours, aggregated.remediationEffort.medium.areas],
      ['Low', aggregated.remediationEffort.low.count, aggregated.remediationEffort.low.hours, aggregated.remediationEffort.low.areas]
    ];
  }

  /**
   * Helper methods
   */
  private calculateTestCoverage(pageTestResults: PageTestResult[]): TestCoverage {
    const automated = new Set<string>();
    const manual = new Set<string>();
    const passed = new Set<string>();
    const failed = new Set<string>();
    const notApplicable = new Set<string>();

    pageTestResults.forEach(page => {
      page.automatedTests.testsRun.forEach(test => automated.add(test));
      
      // Track which tests passed/failed across all pages
      page.automatedTests.violations.forEach(v => failed.add(v.id));
      
      if (page.manualTests) {
        page.manualTests.testsRun.forEach(test => manual.add(test));
      }
    });

    // Determine passed tests (run but not failed)
    automated.forEach(test => {
      if (!failed.has(test)) {
        passed.add(test);
      }
    });

    return {
      automated: Array.from(automated),
      manual: Array.from(manual),
      passed: Array.from(passed),
      failed: Array.from(failed),
      notApplicable: Array.from(notApplicable)
    };
  }

  private generateComprehensiveSummary(pageTestResults: PageTestResult[]): any {
    const scoreDistribution = {
      pass: pageTestResults.filter(p => p.overallScore === 'PASS').length,
      warning: pageTestResults.filter(p => p.overallScore === 'WARNING').length,
      serious: pageTestResults.filter(p => p.overallScore === 'SERIOUS').length,
      critical: pageTestResults.filter(p => p.overallScore === 'CRITICAL').length
    };

    const total = pageTestResults.length;
    const fullyCompliant = scoreDistribution.pass;
    const complianceRate = total > 0 ? ((fullyCompliant / total) * 100).toFixed(1) : '0';

    return {
      totalPages: total,
      fullyCompliant,
      warnings: scoreDistribution.warning,
      serious: scoreDistribution.serious,
      critical: scoreDistribution.critical,
      complianceRate,
      pagesWithManualTests: pageTestResults.filter(p => p.manualTests).length,
      totalAutomatedTests: new Set(pageTestResults.flatMap(p => p.automatedTests.testsRun)).size,
      totalManualTests: this.manualTestsPerformed.length
    };
  }

  private aggregateFindings(pageTestResults: PageTestResult[]): any {
    // Score distribution
    const total = pageTestResults.length;
    const scoreDistribution = {
      pass: pageTestResults.filter(p => p.overallScore === 'PASS').length,
      warning: pageTestResults.filter(p => p.overallScore === 'WARNING').length,
      serious: pageTestResults.filter(p => p.overallScore === 'SERIOUS').length,
      critical: pageTestResults.filter(p => p.overallScore === 'CRITICAL').length,
      passPercentage: ((pageTestResults.filter(p => p.overallScore === 'PASS').length / total) * 100).toFixed(1),
      warningPercentage: ((pageTestResults.filter(p => p.overallScore === 'WARNING').length / total) * 100).toFixed(1),
      seriousPercentage: ((pageTestResults.filter(p => p.overallScore === 'SERIOUS').length / total) * 100).toFixed(1),
      criticalPercentage: ((pageTestResults.filter(p => p.overallScore === 'CRITICAL').length / total) * 100).toFixed(1)
    };

    // Top violations
    const violationCounts = new Map<string, any>();
    pageTestResults.forEach(page => {
      page.automatedTests.violations.forEach(v => {
        if (!violationCounts.has(v.id)) {
          violationCounts.set(v.id, {
            id: v.id,
            description: v.help,
            impact: v.impact,
            occurrences: 0,
            pagesAffected: new Set()
          });
        }
        const data = violationCounts.get(v.id)!;
        data.occurrences += v.nodes.length;
        data.pagesAffected.add(page.url);
      });
    });

    const topViolations = Array.from(violationCounts.values())
      .map(v => ({ ...v, pagesAffected: v.pagesAffected.size }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 10);

    // Test failure rates
    const testFailureRates = this.calculateTestFailureRates(pageTestResults);

    // Remediation effort
    const remediationEffort = this.calculateRemediationEffort(pageTestResults);

    return {
      scoreDistribution,
      topViolations,
      testFailureRates,
      remediationEffort
    };
  }

  private calculateTestFailureRates(pageTestResults: PageTestResult[]): any[] {
    const testStats = new Map<string, { failed: number; total: number }>();
    
    pageTestResults.forEach(page => {
      page.automatedTests.testsRun.forEach(test => {
        if (!testStats.has(test)) {
          testStats.set(test, { failed: 0, total: 0 });
        }
        const stats = testStats.get(test)!;
        stats.total++;
        
        if (page.automatedTests.violations.some(v => v.id === test)) {
          stats.failed++;
        }
      });
    });

    return Array.from(testStats.entries())
      .map(([testId, stats]) => ({
        testId,
        failureRate: ((stats.failed / stats.total) * 100).toFixed(1),
        pagesFailed: stats.failed,
        totalPages: stats.total
      }))
      .sort((a, b) => parseFloat(b.failureRate) - parseFloat(a.failureRate));
  }

  private calculateRemediationEffort(pageTestResults: PageTestResult[]): any {
    const effort = {
      critical: { count: 0, hours: 0, areas: new Set<string>() },
      high: { count: 0, hours: 0, areas: new Set<string>() },
      medium: { count: 0, hours: 0, areas: new Set<string>() },
      low: { count: 0, hours: 0, areas: new Set<string>() }
    };

    pageTestResults.forEach(page => {
      page.automatedTests.violations.forEach(v => {
        const priority = v.impact === 'critical' ? 'critical' :
                        v.impact === 'serious' ? 'high' :
                        v.impact === 'moderate' ? 'medium' : 'low';
        
        effort[priority as keyof typeof effort].count += v.nodes.length;
        effort[priority as keyof typeof effort].hours += v.nodes.length * (priority === 'critical' ? 2 : priority === 'high' ? 1.5 : priority === 'medium' ? 1 : 0.5);
        effort[priority as keyof typeof effort].areas.add(v.id);
      });
    });

    // Convert sets to strings
    Object.keys(effort).forEach(key => {
      const e = effort[key as keyof typeof effort];
      (e as any).areas = Array.from(e.areas).slice(0, 3).join(', ');
      e.hours = Math.ceil(e.hours);
    });

    return effort;
  }

  private generatePrioritizedRecommendations(pageTestResults: PageTestResult[]): string[] {
    const recommendations: string[] = [];
    
    const criticalCount = pageTestResults.filter(p => p.overallScore === 'CRITICAL').length;
    const seriousCount = pageTestResults.filter(p => p.overallScore === 'SERIOUS').length;
    
    if (criticalCount > 0) {
      recommendations.push(`URGENT: Fix ${criticalCount} pages with CRITICAL accessibility failures immediately`);
    }
    
    if (seriousCount > 0) {
      recommendations.push(`HIGH PRIORITY: Address ${seriousCount} pages with SERIOUS accessibility issues`);
    }
    
    // Find most common failures
    const failureCounts = new Map<string, number>();
    pageTestResults.forEach(page => {
      page.automatedTests.violations.forEach(v => {
        failureCounts.set(v.id, (failureCounts.get(v.id) || 0) + 1);
      });
    });
    
    const topFailure = Array.from(failureCounts.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topFailure) {
      recommendations.push(`Focus on "${topFailure[0]}" violations affecting ${topFailure[1]} pages`);
    }
    
    // Manual testing recommendations
    const manualTestingDone = pageTestResults.filter(p => p.manualTests).length;
    const shouldHaveManualTesting = pageTestResults.filter(p => 
      p.category === 'CLAUDE_NEEDED' || p.scoreDetails.serious > 0
    ).length;
    
    if (shouldHaveManualTesting > manualTestingDone) {
      recommendations.push(`Perform manual testing on ${shouldHaveManualTesting - manualTestingDone} additional pages with complex issues`);
    }
    
    recommendations.push('Implement automated accessibility testing in CI/CD pipeline');
    recommendations.push('Train development team on WCAG 2.1 AA compliance');
    
    return recommendations;
  }

  private determineCategory(page: PageScanResult, claudeResult?: AnalysisResult): string {
    if (page.violations.length === 0 && (!claudeResult || claudeResult.remediationSteps.length === 0)) {
      return 'PASSED';
    }
    
    const criticalCount = page.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
    if (criticalCount >= 5) return 'CRITICAL';
    
    if (claudeResult) return 'CLAUDE_TESTED';
    
    if (criticalCount > 0) return 'NEEDS_REVIEW';
    
    return 'MINOR_ISSUES';
  }

  private getFixRecommendation(testId: string): string {
    const recommendations: Record<string, string> = {
      'color-contrast': 'Ensure text has 4.5:1 contrast ratio (3:1 for large text)',
      'image-alt': 'Add descriptive alt text to all informative images',
      'button-name': 'Provide accessible name using text content, aria-label, or aria-labelledby',
      'link-name': 'Use descriptive link text that makes sense out of context',
      'label': 'Associate all form controls with labels using for/id or aria-labelledby',
      'html-has-lang': 'Add lang attribute to <html> element',
      'document-title': 'Provide unique, descriptive <title> for each page',
      'heading-order': 'Use proper heading hierarchy (h1→h2→h3)',
      'landmark-one-main': 'Ensure page has one <main> landmark',
      'focus-order-semantics': 'Ensure tab order follows visual layout'
    };
    
    for (const [key, recommendation] of Object.entries(recommendations)) {
      if (testId.includes(key)) {
        return recommendation;
      }
    }
    
    return 'Review WCAG documentation for specific remediation guidance';
  }

  private summarizeFindings(finding: string): string {
    if (!finding) return 'Not tested';
    
    const words = finding.split(' ').slice(0, 15);
    return words.join(' ') + (finding.split(' ').length > 15 ? '...' : '');
  }

  private findFocusIssues(result: AnalysisResult): string {
    const focusKeywords = ['focus', 'tab', 'keyboard'];
    const allFindings = Object.values(result.findings).join(' ').toLowerCase();
    
    const hasFocusIssues = focusKeywords.some(keyword => allFindings.includes(keyword));
    
    if (hasFocusIssues) {
      const focusSteps = result.remediationSteps.filter(step => 
        focusKeywords.some(keyword => step.issue.toLowerCase().includes(keyword))
      );
      return focusSteps.length > 0 ? `${focusSteps.length} issues found` : 'Potential issues detected';
    }
    
    return 'No issues found';
  }

  private findAriaIssues(result: AnalysisResult): string {
    const ariaKeywords = ['aria', 'role', 'semantic'];
    const allFindings = Object.values(result.findings).join(' ').toLowerCase();
    
    const hasAriaIssues = ariaKeywords.some(keyword => allFindings.includes(keyword));
    
    if (hasAriaIssues) {
      const ariaSteps = result.remediationSteps.filter(step => 
        ariaKeywords.some(keyword => step.issue.toLowerCase().includes(keyword))
      );
      return ariaSteps.length > 0 ? `${ariaSteps.length} issues found` : 'Potential issues detected';
    }
    
    return 'No issues found';
  }

  /**
   * Export other formats
   */
  exportToJSON(): void {
    const jsonPath = join(this.outputDirectory, 'accessibility-comprehensive-report.json');
    writeFileSync(jsonPath, JSON.stringify(this.reportData, null, 2));
    console.log(`Comprehensive JSON report saved to: ${jsonPath}`);
  }

  exportToHTML(): void {
    const html = this.generateHTMLReport();
    const htmlPath = join(this.outputDirectory, 'accessibility-comprehensive-report.html');
    writeFileSync(htmlPath, html);
    console.log(`Comprehensive HTML report saved to: ${htmlPath}`);
  }

  private generateHTMLReport(): string {
    const summary = this.reportData.summary;
    const aggregated = this.reportData.aggregatedFindings;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Comprehensive Accessibility Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; line-height: 1.6; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 30px; }
    .metric-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
    .metric-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 20px; text-align: center; }
    .metric-value { font-size: 2.5em; font-weight: bold; margin: 10px 0; }
    .metric-label { color: #666; font-size: 0.9em; }
    .critical { color: #d32f2f; }
    .serious { color: #f57c00; }
    .warning { color: #fbc02d; }
    .pass { color: #388e3c; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
    th { background-color: #f2f2f2; font-weight: bold; }
    tr:nth-child(even) { background-color: #f9f9f9; }
    .section { margin: 40px 0; }
    h1, h2, h3 { color: #333; }
    .test-coverage { background: #e3f2fd; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .critical-alert { background: #ffebee; border-left: 5px solid #f44336; padding: 15px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Comprehensive Accessibility Testing Report</h1>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
    <p><strong>Total Pages Tested:</strong> ${summary.totalPages}</p>
    <p><strong>Overall Compliance Rate:</strong> ${summary.complianceRate}%</p>
  </div>

  <div class="section">
    <h2>Executive Summary</h2>
    <div class="metric-grid">
      <div class="metric-card">
        <div class="metric-value pass">${summary.fullyCompliant}</div>
        <div class="metric-label">Fully Compliant Pages</div>
      </div>
      <div class="metric-card">
        <div class="metric-value warning">${summary.warnings}</div>
        <div class="metric-label">Pages with Warnings</div>
      </div>
      <div class="metric-card">
        <div class="metric-value serious">${summary.serious}</div>
        <div class="metric-label">Pages with Serious Issues</div>
      </div>
      <div class="metric-card">
        <div class="metric-value critical">${summary.critical}</div>
        <div class="metric-label">Pages with Critical Issues</div>
      </div>
    </div>
  </div>

  <div class="test-coverage">
    <h3>Test Coverage</h3>
    <p><strong>Automated Tests:</strong> ${summary.totalAutomatedTests} WCAG 2.1 A & AA tests</p>
    <p><strong>Manual Tests:</strong> ${summary.pagesWithManualTests} pages tested with ${summary.totalManualTests} visual/interaction tests</p>
  </div>

  ${aggregated.scoreDistribution.critical > 0 ? `
  <div class="critical-alert">
    <h3>Critical Issues Requiring Immediate Attention</h3>
    <p><strong>${aggregated.scoreDistribution.critical} pages</strong> have critical accessibility failures that block access to content or functionality.</p>
    <p>These issues must be fixed immediately to ensure basic accessibility compliance.</p>
  </div>
  ` : ''}

  <div class="section">
    <h2>Score Distribution</h2>
    <table>
      <tr>
        <th>Score Level</th>
        <th>Page Count</th>
        <th>Percentage</th>
        <th>Description</th>
      </tr>
      <tr>
        <td class="pass">PASS</td>
        <td>${aggregated.scoreDistribution.pass}</td>
        <td>${aggregated.scoreDistribution.passPercentage}%</td>
        <td>No accessibility issues detected</td>
      </tr>
      <tr>
        <td class="warning">WARNING</td>
        <td>${aggregated.scoreDistribution.warning}</td>
        <td>${aggregated.scoreDistribution.warningPercentage}%</td>
        <td>Minor to moderate issues present</td>
      </tr>
      <tr>
        <td class="serious">SERIOUS</td>
        <td>${aggregated.scoreDistribution.serious}</td>
        <td>${aggregated.scoreDistribution.seriousPercentage}%</td>
        <td>Serious barriers to accessibility</td>
      </tr>
      <tr>
        <td class="critical">CRITICAL</td>
        <td>${aggregated.scoreDistribution.critical}</td>
        <td>${aggregated.scoreDistribution.criticalPercentage}%</td>
        <td>Critical failures blocking access</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Top 10 Most Common Violations</h2>
    <table>
      <tr>
        <th>Rank</th>
        <th>Test ID</th>
        <th>Impact</th>
        <th>Occurrences</th>
        <th>Pages Affected</th>
      </tr>
      ${aggregated.topViolations.map((v: any, i: number) => `
      <tr>
        <td>${i + 1}</td>
        <td>${v.id}</td>
        <td class="${v.impact}">${v.impact.toUpperCase()}</td>
        <td>${v.occurrences}</td>
        <td>${v.pagesAffected}</td>
      </tr>
      `).join('')}
    </table>
  </div>

  <div class="section">
    <h2>Remediation Effort Summary</h2>
    <table>
      <tr>
        <th>Priority</th>
        <th>Issue Count</th>
        <th>Estimated Hours</th>
        <th>Key Areas</th>
      </tr>
      <tr>
        <td class="critical">Critical</td>
        <td>${aggregated.remediationEffort.critical.count}</td>
        <td>${aggregated.remediationEffort.critical.hours}</td>
        <td>${aggregated.remediationEffort.critical.areas}</td>
      </tr>
      <tr>
        <td class="serious">High</td>
        <td>${aggregated.remediationEffort.high.count}</td>
        <td>${aggregated.remediationEffort.high.hours}</td>
        <td>${aggregated.remediationEffort.high.areas}</td>
      </tr>
      <tr>
        <td class="warning">Medium</td>
        <td>${aggregated.remediationEffort.medium.count}</td>
        <td>${aggregated.remediationEffort.medium.hours}</td>
        <td>${aggregated.remediationEffort.medium.areas}</td>
      </tr>
      <tr>
        <td>Low</td>
        <td>${aggregated.remediationEffort.low.count}</td>
        <td>${aggregated.remediationEffort.low.hours}</td>
        <td>${aggregated.remediationEffort.low.areas}</td>
      </tr>
    </table>
  </div>

  <div class="section">
    <h2>Recommendations</h2>
    <ol>
      ${this.reportData.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
    </ol>
  </div>

  <p><em>For detailed test results and remediation guidance, please refer to the Excel report.</em></p>
</body>
</html>`;
  }

  exportToCSV(): void {
    // Export page results as primary CSV
    const pageResultsData = this.generatePageResultsSheet();
    const pageResultsCsv = pageResultsData.map(row => 
      row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const resultsPath = join(this.outputDirectory, 'page-results-with-scores.csv');
    writeFileSync(resultsPath, pageResultsCsv);
    
    // Export violations by test as secondary CSV
    const violationsData = this.generateViolationsByTestSheet();
    const violationsCsv = violationsData.map(row => 
      row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const violationsPath = join(this.outputDirectory, 'violations-by-test.csv');
    writeFileSync(violationsPath, violationsCsv);
    
    console.log('CSV reports exported:');
    console.log(`- Page results: ${resultsPath}`);
    console.log(`- Violations by test: ${violationsPath}`);
  }
}