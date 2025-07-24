import { writeFileSync } from 'fs';
import { join } from 'path';
import * as XLSX from 'xlsx';
import { DecisionResult, PageScanResult, ViolationResult } from '../types/accessibility-types';
import { AnalysisResult } from '../types/claude-types';
import { ensureDirectoryExists } from '../utils/file-helpers';

/**
 * Enhanced Report Generator with clearer violation reporting
 * Focuses on making critical issues extremely visible
 */
export class EnhancedReportGenerator {
  private outputDirectory: string;
  private reportData: any;

  constructor(outputDirectory: string) {
    this.outputDirectory = outputDirectory;
    ensureDirectoryExists(this.outputDirectory);
  }

  /**
   * Generate comprehensive report with enhanced clarity
   */
  async generateReport(
    categorizedResults: DecisionResult,
    claudeAnalysisResults: AnalysisResult[],
    startTime: Date,
    endTime: Date
  ): Promise<void> {
    // Combine all results for comprehensive reporting
    const allResults = [
      ...categorizedResults.passed,
      ...categorizedResults.minorIssues,
      ...categorizedResults.claudeNeeded,
      ...categorizedResults.critical
    ];

    // Build comprehensive report data
    this.reportData = {
      metadata: {
        generatedAt: new Date().toISOString(),
        scanDuration: endTime.getTime() - startTime.getTime(),
        totalPages: allResults.length,
        toolVersion: '2.0.0-enhanced'
      },
      summary: this.generateSummary(categorizedResults, claudeAnalysisResults),
      criticalIssues: this.extractCriticalIssues(categorizedResults),
      categorizedResults,
      claudeAnalysis: claudeAnalysisResults,
      detailedViolations: this.generateDetailedViolations(allResults),
      recommendations: this.generateRecommendations(categorizedResults, claudeAnalysisResults)
    };
  }

  /**
   * Export to Excel with enhanced clarity
   */
  exportToExcel(): void {
    const workbook = XLSX.utils.book_new();

    // Sheet 1: Executive Summary
    const summaryData = this.generateExecutiveSummarySheet();
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Executive Summary');

    // Sheet 2: Critical Issues (NEW - HIGHLY VISIBLE)
    const criticalData = this.generateCriticalIssuesSheet();
    const criticalSheet = XLSX.utils.aoa_to_sheet(criticalData);
    XLSX.utils.book_append_sheet(workbook, criticalSheet, '⚠️ CRITICAL ISSUES');

    // Sheet 3: All Violations by Page
    const violationsData = this.generateEnhancedViolationsSheet();
    const violationsSheet = XLSX.utils.aoa_to_sheet(violationsData);
    XLSX.utils.book_append_sheet(workbook, violationsSheet, 'All Violations');

    // Sheet 4: Claude Analysis Results
    const claudeData = this.generateClaudeAnalysisSheet();
    const claudeSheet = XLSX.utils.aoa_to_sheet(claudeData);
    XLSX.utils.book_append_sheet(workbook, claudeSheet, 'Claude Analysis');

    // Sheet 5: Remediation Roadmap
    const roadmapData = this.generateRemediationRoadmap();
    const roadmapSheet = XLSX.utils.aoa_to_sheet(roadmapData);
    XLSX.utils.book_append_sheet(workbook, roadmapSheet, 'Remediation Roadmap');

    // Save the workbook
    const excelPath = join(this.outputDirectory, 'accessibility-report-enhanced.xlsx');
    XLSX.writeFile(workbook, excelPath);
    console.log(`Enhanced Excel report saved to: ${excelPath}`);
  }

  /**
   * Generate executive summary with clear metrics
   */
  private generateExecutiveSummarySheet(): any[][] {
    const summary = this.reportData.summary;
    
    return [
      ['ACCESSIBILITY TESTING EXECUTIVE SUMMARY'],
      [],
      ['Report Generated:', new Date().toLocaleString()],
      ['Total Pages Scanned:', summary.totalPages],
      [],
      ['COMPLIANCE STATUS'],
      ['Pages Passed:', summary.passedPages, `${summary.complianceRate}%`],
      ['Pages with Issues:', summary.totalPages - summary.passedPages, `${100 - parseFloat(summary.complianceRate)}%`],
      [],
      ['ISSUE BREAKDOWN'],
      ['Critical Issues (Immediate Action):', summary.criticalPages],
      ['Complex Issues (Needs Review):', summary.claudeAnalysisNeeded],
      ['Minor Issues (Auto-fixable):', summary.minorIssuesPages],
      [],
      ['VIOLATION SEVERITY'],
      ['Critical Violations:', summary.criticalViolations],
      ['Serious Violations:', summary.seriousViolations],
      ['Moderate Violations:', summary.moderateViolations],
      ['Minor Violations:', summary.minorViolations],
      [],
      ['TOP ISSUES'],
      ...summary.topViolations.map((v: any) => [v.id, v.count, v.impact]),
      [],
      ['ESTIMATED EFFORT'],
      ['Total Remediation Hours:', summary.estimatedEffort],
      ['Critical Issues Hours:', this.calculateCriticalEffort()],
      [],
      ['RECOMMENDATIONS'],
      ...this.reportData.recommendations.slice(0, 5).map((r: string) => [r])
    ];
  }

  /**
   * Generate critical issues sheet with maximum visibility
   */
  private generateCriticalIssuesSheet(): any[][] {
    const criticalIssues = this.reportData.criticalIssues;
    
    const data = [
      ['⚠️ CRITICAL ACCESSIBILITY ISSUES REQUIRING IMMEDIATE ATTENTION ⚠️'],
      [],
      ['Total Critical Pages:', criticalIssues.pages.length],
      ['Total Critical Violations:', criticalIssues.violations.length],
      [],
      ['CRITICAL PAGES LIST'],
      ['Page URL', 'Critical Violations', 'Serious Violations', 'Total Elements Affected', 'Key Issues']
    ];

    // Add each critical page with details
    criticalIssues.pages.forEach((page: any) => {
      const criticalCount = page.violations.filter((v: ViolationResult) => v.impact === 'critical').length;
      const seriousCount = page.violations.filter((v: ViolationResult) => v.impact === 'serious').length;
      const totalElements = page.violations.reduce((sum: number, v: ViolationResult) => sum + v.nodes.length, 0);
      const keyIssues = page.violations
        .filter((v: ViolationResult) => v.impact === 'critical' || v.impact === 'serious')
        .map((v: ViolationResult) => v.id)
        .slice(0, 3)
        .join(', ');

      data.push([
        page.url,
        criticalCount,
        seriousCount,
        totalElements,
        keyIssues
      ]);
    });

    data.push([]);
    data.push(['CRITICAL VIOLATION DETAILS']);
    data.push(['Violation Type', 'Impact', 'Occurrences', 'Description', 'WCAG Criteria']);

    // Group and count critical violations
    const violationGroups = this.groupViolations(criticalIssues.violations);
    violationGroups.forEach((group: any) => {
      data.push([
        group.id,
        group.impact.toUpperCase(),
        group.count,
        group.description,
        group.wcagTags
      ]);
    });

    data.push([]);
    data.push(['IMMEDIATE ACTION REQUIRED']);
    data.push(['1. Address all CRITICAL impact violations first']);
    data.push(['2. Fix SERIOUS violations that affect keyboard navigation']);
    data.push(['3. Resolve color contrast issues for essential content']);
    data.push(['4. Ensure all interactive elements are keyboard accessible']);

    return data;
  }

  /**
   * Generate enhanced violations sheet with better organization
   */
  private generateEnhancedViolationsSheet(): any[][] {
    const headers = [
      'Page URL',
      'Category',
      'Violation ID',
      'Impact',
      'Description',
      'Elements Affected',
      'WCAG Criteria',
      'Fix Suggestion',
      'Effort Estimate',
      'Sample Element'
    ];

    const data = [headers];
    
    // Process all pages
    this.reportData.detailedViolations.forEach((page: any) => {
      if (page.violations.length === 0) {
        data.push([
          page.url,
          'PASSED',
          'None',
          'None',
          'No violations found',
          '0',
          '',
          '',
          '0 hours',
          ''
        ]);
      } else {
        page.violations.forEach((violation: ViolationResult) => {
          const wcagTags = violation.tags.filter(t => t.includes('wcag')).join(', ');
          const sampleElement = violation.nodes[0]?.html?.substring(0, 100) + '...' || '';
          const fixSuggestion = this.getFixSuggestion(violation.id);
          const effort = this.estimateViolationEffort(violation);
          
          data.push([
            page.url,
            page.category || 'UNKNOWN',
            violation.id,
            violation.impact.toUpperCase(),
            violation.help,
            violation.nodes.length.toString(),
            wcagTags,
            fixSuggestion,
            effort,
            sampleElement
          ]);
        });
      }
    });

    return data;
  }

  /**
   * Generate Claude analysis results sheet
   */
  private generateClaudeAnalysisSheet(): any[][] {
    if (!this.reportData.claudeAnalysis || this.reportData.claudeAnalysis.length === 0) {
      return [
        ['No Claude Analysis Performed'],
        ['Note: No pages were flagged for visual accessibility analysis']
      ];
    }

    const headers = [
      'Page URL',
      'Analysis Type',
      'Key Findings',
      'Remediation Priority',
      'Visual Issues',
      'Keyboard Navigation',
      'Cost'
    ];

    const data = [headers];
    
    this.reportData.claudeAnalysis.forEach((analysis: AnalysisResult) => {
      const topRemediation = analysis.remediationSteps[0];
      
      data.push([
        analysis.url,
        analysis.analysisType,
        analysis.overallAssessment.substring(0, 200),
        topRemediation?.priority || 'N/A',
        analysis.findings.visualIssues.substring(0, 150),
        analysis.findings.keyboardNavigation.substring(0, 150),
        `$${analysis.cost.toFixed(4)}`
      ]);
    });

    data.push([]);
    data.push(['Total Claude Analysis Cost:', `$${this.reportData.claudeAnalysis.reduce((sum: number, a: AnalysisResult) => sum + a.cost, 0).toFixed(2)}`]);

    return data;
  }

  /**
   * Generate remediation roadmap
   */
  private generateRemediationRoadmap(): any[][] {
    const data = [
      ['ACCESSIBILITY REMEDIATION ROADMAP'],
      [],
      ['Priority', 'Issue Type', 'Pages Affected', 'Estimated Hours', 'WCAG Criteria', 'Implementation Guide']
    ];

    // Group violations by type and priority
    const roadmap = this.buildRemediationRoadmap();
    
    roadmap.forEach((item: any) => {
      data.push([
        item.priority,
        item.issueType,
        item.pagesAffected,
        item.estimatedHours,
        item.wcagCriteria,
        item.implementationGuide
      ]);
    });

    data.push([]);
    data.push(['QUICK WINS (Can be automated)']);
    const quickWins = this.identifyQuickWins();
    quickWins.forEach((win: any) => {
      data.push([win.issue, win.solution, win.pagesAffected]);
    });

    return data;
  }

  /**
   * Helper methods
   */
  private generateSummary(categorized: DecisionResult, _claudeResults: AnalysisResult[]): any {
    const allPages = [
      ...categorized.passed,
      ...categorized.minorIssues,
      ...categorized.claudeNeeded,
      ...categorized.critical
    ];

    const allViolations = allPages.flatMap(p => p.violations);
    
    return {
      totalPages: allPages.length,
      passedPages: categorized.passed.length,
      criticalPages: categorized.critical.length,
      claudeAnalysisNeeded: categorized.claudeNeeded.length,
      minorIssuesPages: categorized.minorIssues.length,
      complianceRate: ((categorized.passed.length / allPages.length) * 100).toFixed(1),
      criticalViolations: allViolations.filter(v => v.impact === 'critical').length,
      seriousViolations: allViolations.filter(v => v.impact === 'serious').length,
      moderateViolations: allViolations.filter(v => v.impact === 'moderate').length,
      minorViolations: allViolations.filter(v => v.impact === 'minor').length,
      topViolations: this.getTopViolations(allViolations),
      estimatedEffort: this.calculateTotalEffort(allPages)
    };
  }

  private extractCriticalIssues(categorized: DecisionResult): any {
    const criticalPages = categorized.critical;
    const allCriticalViolations = criticalPages.flatMap(p => 
      p.violations.filter(v => v.impact === 'critical' || v.impact === 'serious')
    );

    return {
      pages: criticalPages,
      violations: allCriticalViolations,
      summary: `${criticalPages.length} pages with critical issues, ${allCriticalViolations.length} critical/serious violations total`
    };
  }

  private generateDetailedViolations(allResults: PageScanResult[]): any[] {
    return allResults.map(page => {
      const category = this.determineCategory(page);
      return {
        url: page.url,
        category,
        violations: page.violations,
        violationCount: page.violations.length,
        criticalCount: page.violations.filter(v => v.impact === 'critical').length,
        seriousCount: page.violations.filter(v => v.impact === 'serious').length
      };
    });
  }

  private determineCategory(page: PageScanResult): string {
    if (page.violations.length === 0) return 'PASSED';
    
    const criticalCount = page.violations.filter(v => 
      v.impact === 'critical' || v.impact === 'serious'
    ).length;
    
    if (criticalCount >= 5) return 'CRITICAL';
    
    const hasComplexIssues = page.violations.some(v => 
      ['color-contrast', 'focus-order', 'keyboard-navigation'].some(issue => v.id.includes(issue))
    );
    
    if (hasComplexIssues || criticalCount > 0) return 'CLAUDE_NEEDED';
    
    return 'MINOR_ISSUES';
  }

  private generateRecommendations(categorized: DecisionResult, _claudeResults: AnalysisResult[]): string[] {
    const recommendations: string[] = [];
    
    if (categorized.critical.length > 0) {
      recommendations.push(`URGENT: Address ${categorized.critical.length} pages with critical accessibility failures immediately`);
    }
    
    if (categorized.claudeNeeded.length > 0) {
      recommendations.push(`Schedule manual review for ${categorized.claudeNeeded.length} pages with complex accessibility issues`);
    }
    
    const allViolations = [...categorized.critical, ...categorized.claudeNeeded, ...categorized.minorIssues]
      .flatMap(p => p.violations);
    
    const violationTypes = new Map<string, number>();
    allViolations.forEach(v => {
      violationTypes.set(v.id, (violationTypes.get(v.id) || 0) + 1);
    });
    
    const topIssue = Array.from(violationTypes.entries())
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topIssue) {
      recommendations.push(`Focus on fixing "${topIssue[0]}" violations appearing on ${topIssue[1]} pages`);
    }
    
    recommendations.push('Implement automated accessibility testing in CI/CD pipeline');
    recommendations.push('Conduct accessibility training for development team');
    
    return recommendations;
  }

  private groupViolations(violations: ViolationResult[]): any[] {
    const groups = new Map<string, any>();
    
    violations.forEach(v => {
      if (!groups.has(v.id)) {
        groups.set(v.id, {
          id: v.id,
          impact: v.impact,
          description: v.help,
          wcagTags: v.tags.filter(t => t.includes('wcag')).join(', '),
          count: 0
        });
      }
      groups.get(v.id)!.count++;
    });
    
    return Array.from(groups.values()).sort((a, b) => b.count - a.count);
  }

  private getTopViolations(violations: ViolationResult[]): any[] {
    const counts = new Map<string, { count: number; impact: string }>();
    
    violations.forEach(v => {
      if (!counts.has(v.id)) {
        counts.set(v.id, { count: 0, impact: v.impact });
      }
      counts.get(v.id)!.count++;
    });
    
    return Array.from(counts.entries())
      .map(([id, data]) => ({ id, count: data.count, impact: data.impact }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }

  private calculateTotalEffort(pages: PageScanResult[]): string {
    let totalHours = 0;
    
    pages.forEach(page => {
      const critical = page.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
      const other = page.violations.length - critical;
      totalHours += (critical * 2) + (other * 0.5);
    });
    
    return `${Math.ceil(totalHours)} hours`;
  }

  private calculateCriticalEffort(): string {
    const criticalPages = this.reportData.criticalIssues.pages;
    let hours = 0;
    
    criticalPages.forEach((page: any) => {
      const critical = page.violations.filter((v: ViolationResult) => 
        v.impact === 'critical' || v.impact === 'serious'
      ).length;
      hours += critical * 2;
    });
    
    return `${Math.ceil(hours)} hours`;
  }

  private getFixSuggestion(violationId: string): string {
    const suggestions: Record<string, string> = {
      'image-alt': 'Add descriptive alt text to images',
      'label': 'Associate form labels with their controls',
      'color-contrast': 'Increase color contrast to meet WCAG ratios',
      'html-has-lang': 'Add lang attribute to HTML element',
      'button-name': 'Provide accessible name for button',
      'link-name': 'Provide descriptive link text',
      'heading-order': 'Use proper heading hierarchy',
      'focus-order-semantics': 'Ensure logical focus order',
      'aria-valid-attr': 'Use valid ARIA attributes',
      'bypass': 'Add skip navigation link'
    };
    
    for (const [key, suggestion] of Object.entries(suggestions)) {
      if (violationId.includes(key)) {
        return suggestion;
      }
    }
    
    return 'Review WCAG guidelines for specific fix';
  }

  private estimateViolationEffort(violation: ViolationResult): string {
    const nodeCount = violation.nodes.length;
    const baseHours = violation.impact === 'critical' ? 2 : 
                     violation.impact === 'serious' ? 1.5 : 
                     violation.impact === 'moderate' ? 1 : 0.5;
    
    const totalHours = baseHours + (nodeCount * 0.1);
    
    if (totalHours < 1) return '0.5 hours';
    if (totalHours < 2) return '1-2 hours';
    return `${Math.ceil(totalHours)} hours`;
  }

  private buildRemediationRoadmap(): any[] {
    const roadmap: any[] = [];
    const violations = this.reportData.detailedViolations.flatMap((p: any) => p.violations);
    
    // Group by violation type
    const groups = this.groupViolations(violations);
    
    groups.forEach(group => {
      roadmap.push({
        priority: this.getPriorityFromImpact(group.impact),
        issueType: group.id,
        pagesAffected: group.count,
        estimatedHours: Math.ceil(group.count * (group.impact === 'critical' ? 2 : 1)),
        wcagCriteria: group.wcagTags,
        implementationGuide: this.getFixSuggestion(group.id)
      });
    });
    
    return roadmap.sort((a, b) => {
      const priorityOrder = { 'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3 };
      return (priorityOrder[a.priority as keyof typeof priorityOrder] || 99) - 
             (priorityOrder[b.priority as keyof typeof priorityOrder] || 99);
    });
  }

  private getPriorityFromImpact(impact: string): string {
    switch (impact) {
      case 'critical': return 'CRITICAL';
      case 'serious': return 'HIGH';
      case 'moderate': return 'MEDIUM';
      default: return 'LOW';
    }
  }

  private identifyQuickWins(): any[] {
    const quickWins: any[] = [];
    const violations = this.reportData.detailedViolations.flatMap((p: any) => p.violations);
    
    const autoFixable = ['image-alt', 'html-has-lang', 'document-title', 'label'];
    
    autoFixable.forEach(issue => {
      const matches = violations.filter((v: ViolationResult) => v.id.includes(issue));
      if (matches.length > 0) {
        quickWins.push({
          issue: issue,
          solution: this.getFixSuggestion(issue),
          pagesAffected: new Set(this.reportData.detailedViolations
            .filter((p: any) => p.violations.some((v: ViolationResult) => v.id.includes(issue)))
            .map((p: any) => p.url)).size
        });
      }
    });
    
    return quickWins;
  }

  /**
   * Export other formats
   */
  exportToJSON(): void {
    const jsonPath = join(this.outputDirectory, 'accessibility-report-enhanced.json');
    writeFileSync(jsonPath, JSON.stringify(this.reportData, null, 2));
    console.log(`Enhanced JSON report saved to: ${jsonPath}`);
  }

  exportToCSV(): void {
    // Export critical issues as CSV
    const criticalData = this.generateCriticalIssuesSheet();
    const criticalCsv = criticalData.map(row => 
      row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const criticalPath = join(this.outputDirectory, 'critical-issues.csv');
    writeFileSync(criticalPath, criticalCsv);
    
    // Export all violations as CSV
    const violationsData = this.generateEnhancedViolationsSheet();
    const violationsCsv = violationsData.map(row => 
      row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const violationsPath = join(this.outputDirectory, 'all-violations.csv');
    writeFileSync(violationsPath, violationsCsv);
    
    console.log('CSV reports exported:');
    console.log(`- Critical issues: ${criticalPath}`);
    console.log(`- All violations: ${violationsPath}`);
  }

  exportToHTML(): void {
    const html = this.generateHTMLReport();
    const htmlPath = join(this.outputDirectory, 'accessibility-report-enhanced.html');
    writeFileSync(htmlPath, html);
    console.log(`Enhanced HTML report saved to: ${htmlPath}`);
  }

  private generateHTMLReport(): string {
    const summary = this.reportData.summary;
    const critical = this.reportData.criticalIssues;
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Enhanced Accessibility Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .critical { background-color: #ffebee; border-left: 5px solid #f44336; padding: 10px; margin: 10px 0; }
    .warning { background-color: #fff3e0; border-left: 5px solid #ff9800; padding: 10px; margin: 10px 0; }
    .success { background-color: #e8f5e9; border-left: 5px solid #4caf50; padding: 10px; margin: 10px 0; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f2f2f2; }
    h1, h2, h3 { color: #333; }
    .metric { display: inline-block; margin: 10px 20px 10px 0; }
    .metric-value { font-size: 2em; font-weight: bold; }
    .metric-label { color: #666; }
  </style>
</head>
<body>
  <h1>Enhanced Accessibility Testing Report</h1>
  <p>Generated: ${new Date().toLocaleString()}</p>
  
  <div class="metric">
    <div class="metric-value">${summary.totalPages}</div>
    <div class="metric-label">Pages Tested</div>
  </div>
  
  <div class="metric">
    <div class="metric-value">${summary.complianceRate}%</div>
    <div class="metric-label">Compliance Rate</div>
  </div>
  
  <div class="metric">
    <div class="metric-value">${summary.criticalPages}</div>
    <div class="metric-label">Critical Issues</div>
  </div>
  
  ${critical.pages.length > 0 ? `
  <div class="critical">
    <h2>⚠️ CRITICAL ISSUES REQUIRING IMMEDIATE ATTENTION</h2>
    <p><strong>${critical.pages.length} pages</strong> have critical accessibility failures that must be fixed immediately.</p>
    <ul>
      ${critical.pages.slice(0, 5).map((p: any) => `<li>${p.url} - ${p.violations.filter((v: ViolationResult) => v.impact === 'critical' || v.impact === 'serious').length} critical/serious violations</li>`).join('')}
      ${critical.pages.length > 5 ? `<li>... and ${critical.pages.length - 5} more pages</li>` : ''}
    </ul>
  </div>
  ` : ''}
  
  <h2>Violation Breakdown</h2>
  <table>
    <tr>
      <th>Severity</th>
      <th>Count</th>
      <th>Description</th>
    </tr>
    <tr>
      <td style="color: #d32f2f;">Critical</td>
      <td>${summary.criticalViolations}</td>
      <td>Blocks access to content or functionality</td>
    </tr>
    <tr>
      <td style="color: #f57c00;">Serious</td>
      <td>${summary.seriousViolations}</td>
      <td>Serious barriers to access</td>
    </tr>
    <tr>
      <td style="color: #fbc02d;">Moderate</td>
      <td>${summary.moderateViolations}</td>
      <td>Some barriers to access</td>
    </tr>
    <tr>
      <td style="color: #388e3c;">Minor</td>
      <td>${summary.minorViolations}</td>
      <td>Minor issues that should be fixed</td>
    </tr>
  </table>
  
  <h2>Top Violations</h2>
  <table>
    <tr>
      <th>Violation</th>
      <th>Occurrences</th>
      <th>Impact</th>
    </tr>
    ${summary.topViolations.slice(0, 10).map((v: any) => `
    <tr>
      <td>${v.id}</td>
      <td>${v.count}</td>
      <td>${v.impact}</td>
    </tr>
    `).join('')}
  </table>
  
  <h2>Recommendations</h2>
  <ol>
    ${this.reportData.recommendations.map((r: string) => `<li>${r}</li>`).join('')}
  </ol>
  
  <p><em>For detailed violation information, please refer to the Excel report.</em></p>
</body>
</html>`;
  }
}