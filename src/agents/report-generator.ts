import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { PageScanResult, ViolationResult, DecisionResult } from '../types/accessibility-types';
import { AnalysisResult, RemediationStep } from '../types/claude-types';
import { SCAN_CONFIG } from '../../config/scan-config';
import * as XLSX from 'xlsx';

export interface ReportSummary {
  totalPages: number;
  passedPages: number;
  minorIssues: number;
  claudeAnalysisNeeded: number;
  criticalIssues: number;
  completionTime: string;
  wcagCompliance: WCAGCompliance;
}

export interface WCAGCompliance {
  level: 'A' | 'AA' | 'AAA' | 'Non-compliant';
  passRate: number;
  criticalViolations: number;
  seriousViolations: number;
  moderateViolations: number;
  minorViolations: number;
}

export interface ViolationBreakdown {
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  count: number;
  percentage: number;
  topViolations: {
    id: string;
    description: string;
    count: number;
    affectedPages: number;
  }[];
}

export interface DevelopmentTicket {
  id: string;
  title: string;
  description: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  estimatedEffort: string;
  wcagCriteria: string;
  affectedPages: string[];
  remediationSteps: string[];
  codeExample?: string;
}

export interface ComprehensiveReport {
  summary: ReportSummary;
  violationBreakdown: ViolationBreakdown[];
  complexIssues: {
    url: string;
    claudeFindings: {
      keyboardNavigation: string;
      visualIssues: string;
      accessibilityTree: string;
      dynamicContent: string;
    };
    screenshots: string[];
    priority: string;
    estimatedEffort: string;
  }[];
  developmentBacklog: DevelopmentTicket[];
  technicalDetails: {
    scanConfiguration: any;
    claudeAnalysisMetrics: {
      totalAnalyzed: number;
      averageCost: number;
      totalCost: number;
      averageDuration: number;
    };
    detailedViolations: PageScanResult[];
  };
  executiveSummary: {
    businessImpact: string;
    keyFindings: string[];
    recommendations: string[];
    timeline: string;
    resources: string;
  };
}

export class ReportGenerator {
  private outputDirectory: string;
  private reportData: ComprehensiveReport | null = null;

  constructor(outputDirectory: string = './results/reports') {
    this.outputDirectory = outputDirectory;
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists(): void {
    if (!existsSync(this.outputDirectory)) {
      mkdirSync(this.outputDirectory, { recursive: true });
    }
  }

  /**
   * Generate comprehensive accessibility report
   */
  async generateReport(
    bulkScanResults: DecisionResult,
    claudeAnalysisResults: AnalysisResult[],
    scanStartTime: Date,
    scanEndTime: Date
  ): Promise<ComprehensiveReport> {
    const completionTime = this.calculateCompletionTime(scanStartTime, scanEndTime);
    
    // Generate all report sections
    const summary = this.generateSummary(bulkScanResults, claudeAnalysisResults, completionTime);
    const violationBreakdown = this.generateViolationBreakdown(bulkScanResults);
    const complexIssues = this.generateComplexIssues(claudeAnalysisResults);
    const developmentBacklog = this.generateDevelopmentBacklog(bulkScanResults, claudeAnalysisResults);
    const technicalDetails = this.generateTechnicalDetails(bulkScanResults, claudeAnalysisResults);
    const executiveSummary = this.generateExecutiveSummary(summary, violationBreakdown, complexIssues);

    this.reportData = {
      summary,
      violationBreakdown,
      complexIssues,
      developmentBacklog,
      technicalDetails,
      executiveSummary
    };

    return this.reportData;
  }

  /**
   * Export report to JSON format
   */
  exportToJSON(filename: string = 'accessibility-report.json'): void {
    if (!this.reportData) {
      throw new Error('No report data available. Generate a report first using generateReport()');
    }
    const outputPath = join(this.outputDirectory, filename);
    writeFileSync(outputPath, JSON.stringify(this.reportData, null, 2));
    console.log(`JSON report exported to: ${outputPath}`);
  }

  /**
   * Export report to HTML format with charts and visualizations
   */
  exportToHTML(filename: string = 'accessibility-report.html'): void {
    if (!this.reportData) {
      throw new Error('No report data available. Generate a report first using generateReport()');
    }
    const htmlContent = this.generateHTMLReport();
    const outputPath = join(this.outputDirectory, filename);
    writeFileSync(outputPath, htmlContent);
    console.log(`HTML report exported to: ${outputPath}`);
  }

  /**
   * Export detailed violation data to Excel/CSV format
   */
  exportToExcel(filename: string = 'accessibility-detailed-report.xlsx'): void {
    if (!this.reportData) {
      throw new Error('No report data available. Generate a report first using generateReport()');
    }
    
    const workbook = XLSX.utils.book_new();
    
    // Sheet 1: Summary
    const summaryData = this.generateSummarySheet();
    const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(workbook, summarySheet, 'Summary');
    
    // Sheet 2: Detailed Violations by Page
    const violationsData = this.generateDetailedViolationsSheet();
    const violationsSheet = XLSX.utils.aoa_to_sheet(violationsData);
    XLSX.utils.book_append_sheet(workbook, violationsSheet, 'Detailed Violations');
    
    // Sheet 3: Violation Elements
    const elementsData = this.generateViolationElementsSheet();
    const elementsSheet = XLSX.utils.aoa_to_sheet(elementsData);
    XLSX.utils.book_append_sheet(workbook, elementsSheet, 'Failing Elements');
    
    // Sheet 4: Development Backlog
    const backlogData = this.generateBacklogSheet();
    const backlogSheet = XLSX.utils.aoa_to_sheet(backlogData);
    XLSX.utils.book_append_sheet(workbook, backlogSheet, 'Development Backlog');
    
    const outputPath = join(this.outputDirectory, filename);
    XLSX.writeFile(workbook, outputPath);
    console.log(`Excel report exported to: ${outputPath}`);
  }

  /**
   * Export to CSV format (alternative for systems without Excel)
   */
  exportToCSV(): void {
    if (!this.reportData) {
      throw new Error('No report data available. Generate a report first using generateReport()');
    }
    
    // Export violations data as CSV
    const violationsData = this.generateDetailedViolationsSheet();
    const violationsCsv = violationsData.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const violationsPath = join(this.outputDirectory, 'violations-detailed.csv');
    writeFileSync(violationsPath, violationsCsv);
    
    // Export elements data as CSV
    const elementsData = this.generateViolationElementsSheet();
    const elementsCsv = elementsData.map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    const elementsPath = join(this.outputDirectory, 'failing-elements.csv');
    writeFileSync(elementsPath, elementsCsv);
    
    console.log(`CSV reports exported to: ${violationsPath} and ${elementsPath}`);
  }

  private generateSummary(
    bulkScanResults: DecisionResult,
    claudeAnalysisResults: AnalysisResult[],
    completionTime: string
  ): ReportSummary {
    const totalPages = this.getTotalPages(bulkScanResults);
    const passedPages = bulkScanResults.passed.length;
    const minorIssues = bulkScanResults.minorIssues.length;
    const claudeAnalysisNeeded = bulkScanResults.claudeNeeded.length;
    const criticalIssues = bulkScanResults.critical.length;

    const wcagCompliance = this.calculateWCAGCompliance(bulkScanResults);

    return {
      totalPages,
      passedPages,
      minorIssues,
      claudeAnalysisNeeded,
      criticalIssues,
      completionTime,
      wcagCompliance
    };
  }

  private generateViolationBreakdown(bulkScanResults: DecisionResult): ViolationBreakdown[] {
    const allViolations = this.getAllViolations(bulkScanResults);
    const violationsByImpact = this.groupViolationsByImpact(allViolations);
    const totalViolations = allViolations.length;

    return ['critical', 'serious', 'moderate', 'minor'].map(impact => {
      const violations = violationsByImpact[impact] || [];
      const count = violations.length;
      const percentage = totalViolations > 0 ? (count / totalViolations) * 100 : 0;
      const topViolations = this.getTopViolations(violations);

      return {
        impact: impact as 'minor' | 'moderate' | 'serious' | 'critical',
        count,
        percentage: Math.round(percentage * 100) / 100,
        topViolations
      };
    });
  }

  private generateComplexIssues(claudeAnalysisResults: AnalysisResult[]): ComprehensiveReport['complexIssues'] {
    return claudeAnalysisResults.map(result => ({
      url: result.url,
      claudeFindings: {
        keyboardNavigation: result.findings.keyboardNavigation,
        visualIssues: result.findings.visualIssues,
        accessibilityTree: result.findings.accessibilityTree,
        dynamicContent: result.findings.dynamicContent
      },
      screenshots: result.findings.screenshots,
      priority: this.determinePriority(result.findings.remediationSteps),
      estimatedEffort: this.calculateTotalEffort(result.findings.remediationSteps)
    }));
  }

  private generateDevelopmentBacklog(
    bulkScanResults: DecisionResult,
    claudeAnalysisResults: AnalysisResult[]
  ): DevelopmentTicket[] {
    const tickets: DevelopmentTicket[] = [];
    let ticketId = 1;

    // Generate tickets from Claude analysis
    claudeAnalysisResults.forEach(result => {
      result.findings.remediationSteps.forEach(step => {
        const ticket: DevelopmentTicket = {
          id: `ACC-${ticketId.toString().padStart(3, '0')}`,
          title: `Fix ${step.issue}`,
          description: step.solution,
          priority: step.priority,
          estimatedEffort: step.effort,
          wcagCriteria: step.wcagCriteria,
          affectedPages: [result.url],
          remediationSteps: [step.solution],
          codeExample: step.codeExample
        };
        tickets.push(ticket);
        ticketId++;
      });
    });

    // Generate tickets from bulk scan critical issues
    bulkScanResults.critical.forEach(page => {
      page.violations.forEach(violation => {
        const ticket: DevelopmentTicket = {
          id: `ACC-${ticketId.toString().padStart(3, '0')}`,
          title: `Critical: ${violation.description}`,
          description: violation.help,
          priority: 'Critical',
          estimatedEffort: this.estimateEffortFromViolation(violation),
          wcagCriteria: violation.tags.filter(tag => tag.startsWith('wcag')).join(', '),
          affectedPages: [page.url],
          remediationSteps: [violation.help]
        };
        tickets.push(ticket);
        ticketId++;
      });
    });

    // Sort by priority and effort
    return tickets.sort((a, b) => {
      const priorityOrder = { 'Critical': 0, 'High': 1, 'Medium': 2, 'Low': 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  }

  private generateTechnicalDetails(
    bulkScanResults: DecisionResult,
    claudeAnalysisResults: AnalysisResult[]
  ): ComprehensiveReport['technicalDetails'] {
    const claudeAnalysisMetrics = this.calculateClaudeAnalysisMetrics(claudeAnalysisResults);
    const detailedViolations = this.getAllPageResults(bulkScanResults);

    return {
      scanConfiguration: {
        axeRules: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        browserEngine: 'Chromium',
        viewportSize: { width: 1920, height: 1080 },
        scanTimeout: 30000
      },
      claudeAnalysisMetrics,
      detailedViolations
    };
  }

  private generateExecutiveSummary(
    summary: ReportSummary,
    violationBreakdown: ViolationBreakdown[],
    complexIssues: ComprehensiveReport['complexIssues']
  ): ComprehensiveReport['executiveSummary'] {
    const criticalCount = violationBreakdown.find(v => v.impact === 'critical')?.count || 0;
    const seriousCount = violationBreakdown.find(v => v.impact === 'serious')?.count || 0;
    
    return {
      businessImpact: this.generateBusinessImpact(summary, criticalCount, seriousCount),
      keyFindings: this.generateKeyFindings(summary, violationBreakdown, complexIssues),
      recommendations: this.generateRecommendations(summary, violationBreakdown),
      timeline: this.generateTimeline(summary, complexIssues.length),
      resources: this.generateResourceEstimate(summary, complexIssues.length)
    };
  }

  private generateHTMLReport(): string {
    if (!this.reportData) {
      throw new Error('No report data available. Generate a report first using generateReport()');
    }
    const { summary, violationBreakdown, complexIssues, developmentBacklog, executiveSummary } = this.reportData;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Accessibility Testing Report</title>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 2rem;
            border-radius: 8px;
            margin-bottom: 2rem;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 1.5rem;
            border-radius: 8px;
            text-align: center;
            border-left: 4px solid #007bff;
        }
        .metric-value {
            font-size: 2rem;
            font-weight: bold;
            color: #007bff;
        }
        .critical { border-left-color: #dc3545; }
        .critical .metric-value { color: #dc3545; }
        .warning { border-left-color: #ffc107; }
        .warning .metric-value { color: #ffc107; }
        .success { border-left-color: #28a745; }
        .success .metric-value { color: #28a745; }
        .section {
            margin-bottom: 3rem;
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .chart-container {
            position: relative;
            height: 400px;
            margin: 2rem 0;
        }
        .violation-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 1rem;
        }
        .violation-table th,
        .violation-table td {
            padding: 0.75rem;
            text-align: left;
            border-bottom: 1px solid #dee2e6;
        }
        .violation-table th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .priority-critical { background-color: #f8d7da; }
        .priority-high { background-color: #fff3cd; }
        .priority-medium { background-color: #d1ecf1; }
        .priority-low { background-color: #d4edda; }
        .code-example {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            overflow-x: auto;
            margin: 1rem 0;
        }
        .recommendations {
            background: #e7f3ff;
            padding: 1.5rem;
            border-radius: 8px;
            border-left: 4px solid #007bff;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Accessibility Testing Report</h1>
        <p>Comprehensive WCAG compliance analysis completed on ${new Date().toLocaleDateString()}</p>
    </div>

    <div class="summary-grid">
        <div class="metric-card success">
            <div class="metric-value">${summary.totalPages}</div>
            <div>Total Pages</div>
        </div>
        <div class="metric-card success">
            <div class="metric-value">${summary.passedPages}</div>
            <div>Passed</div>
        </div>
        <div class="metric-card warning">
            <div class="metric-value">${summary.minorIssues}</div>
            <div>Minor Issues</div>
        </div>
        <div class="metric-card critical">
            <div class="metric-value">${summary.criticalIssues}</div>
            <div>Critical Issues</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${summary.wcagCompliance.level}</div>
            <div>WCAG Level</div>
        </div>
        <div class="metric-card">
            <div class="metric-value">${summary.wcagCompliance.passRate}%</div>
            <div>Pass Rate</div>
        </div>
    </div>

    <div class="section">
        <h2>Executive Summary</h2>
        <div class="recommendations">
            <h3>Business Impact</h3>
            <p>${executiveSummary.businessImpact}</p>
            
            <h3>Key Findings</h3>
            <ul>
                ${executiveSummary.keyFindings.map(finding => `<li>${finding}</li>`).join('')}
            </ul>
            
            <h3>Recommendations</h3>
            <ul>
                ${executiveSummary.recommendations.map(rec => `<li>${rec}</li>`).join('')}
            </ul>
        </div>
    </div>

    <div class="section">
        <h2>Violation Breakdown</h2>
        <div class="chart-container">
            <canvas id="violationChart"></canvas>
        </div>
        <table class="violation-table">
            <thead>
                <tr>
                    <th>Impact Level</th>
                    <th>Count</th>
                    <th>Percentage</th>
                    <th>Top Violations</th>
                </tr>
            </thead>
            <tbody>
                ${violationBreakdown.map(violation => `
                    <tr>
                        <td><span class="priority-${violation.impact}">${violation.impact.toUpperCase()}</span></td>
                        <td>${violation.count}</td>
                        <td>${violation.percentage}%</td>
                        <td>${violation.topViolations.map(v => v.description).join(', ')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Development Backlog</h2>
        <table class="violation-table">
            <thead>
                <tr>
                    <th>Ticket ID</th>
                    <th>Title</th>
                    <th>Priority</th>
                    <th>Effort</th>
                    <th>WCAG Criteria</th>
                    <th>Affected Pages</th>
                </tr>
            </thead>
            <tbody>
                ${developmentBacklog.slice(0, 20).map(ticket => `
                    <tr class="priority-${ticket.priority.toLowerCase()}">
                        <td>${ticket.id}</td>
                        <td>${ticket.title}</td>
                        <td>${ticket.priority}</td>
                        <td>${ticket.estimatedEffort}</td>
                        <td>${ticket.wcagCriteria}</td>
                        <td>${ticket.affectedPages.length} pages</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>

    <div class="section">
        <h2>Complex Issues Analysis</h2>
        ${complexIssues.map(issue => `
            <div class="complex-issue">
                <h3>${issue.url}</h3>
                <div class="issue-details">
                    <p><strong>Keyboard Navigation:</strong> ${issue.claudeFindings.keyboardNavigation}</p>
                    <p><strong>Visual Issues:</strong> ${issue.claudeFindings.visualIssues}</p>
                    <p><strong>Priority:</strong> ${issue.priority}</p>
                    <p><strong>Estimated Effort:</strong> ${issue.estimatedEffort}</p>
                </div>
            </div>
        `).join('')}
    </div>

    <script>
        // Create violation breakdown chart
        const ctx = document.getElementById('violationChart').getContext('2d');
        new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: ${JSON.stringify(violationBreakdown.map(v => v.impact.toUpperCase()))},
                datasets: [{
                    data: ${JSON.stringify(violationBreakdown.map(v => v.count))},
                    backgroundColor: ['#dc3545', '#fd7e14', '#ffc107', '#28a745']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    },
                    title: {
                        display: true,
                        text: 'Violations by Impact Level'
                    }
                }
            }
        });
    </script>
</body>
</html>
    `;
  }

  // Helper methods
  private getTotalPages(bulkScanResults: DecisionResult): number {
    return bulkScanResults.passed.length + 
           bulkScanResults.minorIssues.length + 
           bulkScanResults.claudeNeeded.length + 
           bulkScanResults.critical.length;
  }

  private getAllPageResults(bulkScanResults: DecisionResult): PageScanResult[] {
    return [
      ...bulkScanResults.passed,
      ...bulkScanResults.minorIssues,
      ...bulkScanResults.claudeNeeded,
      ...bulkScanResults.critical
    ];
  }

  private getAllViolations(bulkScanResults: DecisionResult): ViolationResult[] {
    const allPages = this.getAllPageResults(bulkScanResults);
    return allPages.flatMap(page => page.violations);
  }

  private groupViolationsByImpact(violations: ViolationResult[]): Record<string, ViolationResult[]> {
    return violations.reduce((acc, violation) => {
      const impact = violation.impact;
      if (!acc[impact]) acc[impact] = [];
      acc[impact].push(violation);
      return acc;
    }, {} as Record<string, ViolationResult[]>);
  }

  private getTopViolations(violations: ViolationResult[]): { id: string; description: string; count: number; affectedPages: number; }[] {
    const violationCounts = violations.reduce((acc, violation) => {
      if (!acc[violation.id]) {
        acc[violation.id] = {
          id: violation.id,
          description: violation.description,
          count: 0,
          affectedPages: new Set()
        };
      }
      acc[violation.id].count++;
      acc[violation.id].affectedPages.add('page'); // Would need page context
      return acc;
    }, {} as Record<string, any>);

    return Object.values(violationCounts)
      .map(v => ({ ...v, affectedPages: v.affectedPages.size }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private calculateWCAGCompliance(bulkScanResults: DecisionResult): WCAGCompliance {
    const totalPages = this.getTotalPages(bulkScanResults);
    const passedPages = bulkScanResults.passed.length;
    const passRate = totalPages > 0 ? Math.round((passedPages / totalPages) * 100) : 0;

    const allViolations = this.getAllViolations(bulkScanResults);
    const violationsByImpact = this.groupViolationsByImpact(allViolations);

    const criticalViolations = violationsByImpact.critical?.length || 0;
    const seriousViolations = violationsByImpact.serious?.length || 0;
    const moderateViolations = violationsByImpact.moderate?.length || 0;
    const minorViolations = violationsByImpact.minor?.length || 0;

    let level: WCAGCompliance['level'];
    if (criticalViolations > 0 || seriousViolations > 10) {
      level = 'Non-compliant';
    } else if (passRate >= 95 && seriousViolations === 0) {
      level = 'AA';
    } else if (passRate >= 90) {
      level = 'A';
    } else {
      level = 'Non-compliant';
    }

    return {
      level,
      passRate,
      criticalViolations,
      seriousViolations,
      moderateViolations,
      minorViolations
    };
  }

  private calculateCompletionTime(startTime: Date, endTime: Date): string {
    const diffMs = endTime.getTime() - startTime.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    
    if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    }
    return `${diffMinutes}m`;
  }

  private calculateClaudeAnalysisMetrics(claudeResults: AnalysisResult[]): ComprehensiveReport['technicalDetails']['claudeAnalysisMetrics'] {
    if (claudeResults.length === 0) {
      return {
        totalAnalyzed: 0,
        averageCost: 0,
        totalCost: 0,
        averageDuration: 0
      };
    }

    const totalCost = claudeResults.reduce((sum, result) => sum + result.cost, 0);
    const averageCost = totalCost / claudeResults.length;

    return {
      totalAnalyzed: claudeResults.length,
      averageCost: Math.round(averageCost * 10000) / 10000,
      totalCost: Math.round(totalCost * 100) / 100,
      averageDuration: 0 // Would need duration data
    };
  }

  private determinePriority(remediationSteps: RemediationStep[]): string {
    const priorities = remediationSteps.map(step => step.priority);
    if (priorities.includes('Critical')) return 'Critical';
    if (priorities.includes('High')) return 'High';
    if (priorities.includes('Medium')) return 'Medium';
    return 'Low';
  }

  private calculateTotalEffort(remediationSteps: RemediationStep[]): string {
    const totalHours = remediationSteps.reduce((sum, step) => {
      const hours = parseInt(step.effort) || 0;
      return sum + hours;
    }, 0);
    
    return totalHours > 0 ? `${totalHours} hours` : 'Unknown';
  }

  private estimateEffortFromViolation(violation: ViolationResult): string {
    const impactToEffort = {
      'critical': '8 hours',
      'serious': '4 hours',
      'moderate': '2 hours',
      'minor': '1 hour'
    };
    return impactToEffort[violation.impact] || '2 hours';
  }

  private generateBusinessImpact(summary: ReportSummary, criticalCount: number, seriousCount: number): string {
    const passRate = Math.round((summary.passedPages / summary.totalPages) * 100);
    
    if (passRate >= 95) {
      return `Strong accessibility foundation with ${passRate}% pass rate. Minor improvements needed for full compliance.`;
    } else if (passRate >= 80) {
      return `Good accessibility baseline with ${passRate}% pass rate. ${criticalCount + seriousCount} high-priority issues require immediate attention to prevent legal risks.`;
    } else {
      return `Significant accessibility gaps with ${passRate}% pass rate. ${criticalCount} critical and ${seriousCount} serious violations pose substantial legal and user experience risks.`;
    }
  }

  private generateKeyFindings(summary: ReportSummary, violationBreakdown: ViolationBreakdown[], complexIssues: any[]): string[] {
    const findings = [];
    
    findings.push(`${summary.totalPages} pages tested with ${summary.passedPages} fully compliant`);
    
    const criticalViolations = violationBreakdown.find(v => v.impact === 'critical');
    if (criticalViolations && criticalViolations.count > 0) {
      findings.push(`${criticalViolations.count} critical violations requiring immediate attention`);
    }

    if (complexIssues.length > 0) {
      findings.push(`${complexIssues.length} pages require manual accessibility review`);
    }

    findings.push(`Overall WCAG ${summary.wcagCompliance.level} compliance level achieved`);

    return findings;
  }

  private generateRecommendations(summary: ReportSummary, _violationBreakdown: ViolationBreakdown[]): string[] {
    const recommendations = [];

    if (summary.criticalIssues > 0) {
      recommendations.push('Address critical violations immediately to reduce legal risk');
    }

    if (summary.wcagCompliance.level === 'Non-compliant') {
      recommendations.push('Implement comprehensive accessibility testing in development pipeline');
    }

    recommendations.push('Train development team on WCAG 2.1 AA requirements');
    recommendations.push('Establish accessibility testing as part of QA process');

    return recommendations;
  }

  private generateTimeline(summary: ReportSummary, complexIssuesCount: number): string {
    const totalIssues = summary.criticalIssues + summary.minorIssues + complexIssuesCount;
    const weeksEstimate = Math.ceil(totalIssues / 20); // Assuming 20 fixes per week
    
    return `Estimated ${weeksEstimate}-${weeksEstimate + 2} weeks for full remediation with dedicated team`;
  }

  private generateResourceEstimate(summary: ReportSummary, complexIssuesCount: number): string {
    const totalIssues = summary.criticalIssues + summary.minorIssues + complexIssuesCount;
    const developersNeeded = Math.ceil(totalIssues / 50); // Assuming 50 fixes per developer
    
    return `Recommended: ${developersNeeded} developers + 1 accessibility specialist for ${Math.ceil(totalIssues / 20)} weeks`;
  }

  /**
   * Generate summary sheet data for Excel export
   */
  private generateSummarySheet(): any[][] {
    if (!this.reportData) return [];

    const { summary, violationBreakdown } = this.reportData;
    
    return [
      ['Accessibility Testing Report Summary'],
      [''],
      ['Metric', 'Value'],
      ['Total Pages Tested', summary.totalPages],
      ['Pages Passed', summary.passedPages],
      ['Pages with Minor Issues', summary.minorIssues],
      ['Pages Needing Claude Analysis', summary.claudeAnalysisNeeded],
      ['Pages with Critical Issues', summary.criticalIssues],
      ['WCAG Compliance Level', summary.wcagCompliance.level],
      ['Overall Pass Rate', `${summary.wcagCompliance.passRate}%`],
      ['Completion Time', summary.completionTime],
      [''],
      ['Violation Breakdown by Impact'],
      ['Impact Level', 'Count', 'Percentage'],
      ...violationBreakdown.map(vb => [
        vb.impact.toUpperCase(),
        vb.count,
        `${vb.percentage}%`
      ]),
      [''],
      ['WCAG Compliance Details'],
      ['Critical Violations', summary.wcagCompliance.criticalViolations],
      ['Serious Violations', summary.wcagCompliance.seriousViolations],
      ['Moderate Violations', summary.wcagCompliance.moderateViolations],
      ['Minor Violations', summary.wcagCompliance.minorViolations]
    ];
  }

  /**
   * Generate detailed violations sheet data for Excel export
   */
  private generateDetailedViolationsSheet(): any[][] {
    if (!this.reportData) return [];

    const headers = [
      'Page URL',
      'Violation ID',
      'Description',
      'Impact Level',
      'WCAG Tags',
      'Help Text',
      'Number of Elements',
      'Element Selectors',
      'Category Decision',
      'Priority',
      'Estimated Effort'
    ];

    const data = [headers];
    const allPages = this.reportData.technicalDetails.detailedViolations;

    allPages.forEach(page => {
      if (page.violations.length === 0) {
        // Add row for pages with no violations
        data.push([
          page.url,
          'No violations',
          'Page passed accessibility testing',
          'None',
          '',
          '',
          '0',
          '',
          'PASSED',
          'Low',
          '0 hours'
        ]);
      } else {
        page.violations.forEach(violation => {
          const selectors = violation.nodes.map(node => node.target.join(' > ')).join('; ');
          const wcagTags = violation.tags.filter(tag => tag.startsWith('wcag')).join(', ');
          
          data.push([
            page.url,
            violation.id,
            violation.description,
            violation.impact.toUpperCase(),
            wcagTags,
            violation.help,
            violation.nodes.length.toString(),
            selectors.substring(0, 500) + (selectors.length > 500 ? '...' : ''), // Truncate long selectors
            this.getPageCategory(page),
            this.getPagePriority(page),
            this.getPageEffort(page)
          ]);
        });
      }
    });

    return data;
  }

  /**
   * Generate violation elements sheet data for Excel export
   */
  private generateViolationElementsSheet(): any[][] {
    if (!this.reportData) return [];

    const headers = [
      'Page URL',
      'Violation ID',
      'Violation Description',
      'Impact',
      'Element Target',
      'Element HTML',
      'Failure Summary',
      'Fix Recommendation',
      'WCAG Success Criteria'
    ];

    const data = [headers];
    const allPages = this.reportData.technicalDetails.detailedViolations;

    allPages.forEach(page => {
      page.violations.forEach(violation => {
        violation.nodes.forEach(node => {
          data.push([
            page.url,
            violation.id,
            violation.description,
            violation.impact.toUpperCase(),
            node.target.join(' > '),
            node.html.substring(0, 200) + (node.html.length > 200 ? '...' : ''),
            this.getFailureSummary(node),
            this.getFixRecommendation(violation),
            violation.tags.filter(tag => tag.startsWith('wcag')).join(', ')
          ]);
        });
      });
    });

    return data;
  }

  /**
   * Generate development backlog sheet data for Excel export
   */
  private generateBacklogSheet(): any[][] {
    if (!this.reportData) return [];

    const headers = [
      'Ticket ID',
      'Title',
      'Description',
      'Priority',
      'Estimated Effort',
      'WCAG Criteria',
      'Affected Pages Count',
      'Affected Pages',
      'Remediation Steps',
      'Code Example Available'
    ];

    const data = [headers];
    
    this.reportData.developmentBacklog.forEach(ticket => {
      data.push([
        ticket.id,
        ticket.title,
        ticket.description,
        ticket.priority,
        ticket.estimatedEffort,
        ticket.wcagCriteria,
        ticket.affectedPages.length.toString(),
        ticket.affectedPages.join('; '),
        ticket.remediationSteps.join('; '),
        ticket.codeExample ? 'Yes' : 'No'
      ]);
    });

    return data;
  }

  /**
   * Helper method to get page category from decision result
   */
  private getPageCategory(page: PageScanResult): string {
    if (page.violations.length === 0) return 'PASSED';
    
    const criticalCount = page.violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
    const complexViolations = page.violations.filter(v => 
      SCAN_CONFIG.decisionThresholds.complexIssuesForClaudeAnalysis.some(complex => 
        v.id.includes(complex) || v.tags.includes(complex)
      )
    );

    if (criticalCount >= SCAN_CONFIG.decisionThresholds.criticalViolationsLimit) {
      return 'CRITICAL';
    }
    if (complexViolations.length > 0) {
      return 'CLAUDE_NEEDED';
    }
    return 'MINOR_ISSUES';
  }

  /**
   * Helper method to get page priority
   */
  private getPagePriority(page: PageScanResult): string {
    const criticalCount = page.violations.filter(v => v.impact === 'critical').length;
    const seriousCount = page.violations.filter(v => v.impact === 'serious').length;
    const moderateCount = page.violations.filter(v => v.impact === 'moderate').length;

    if (criticalCount > 0) return 'Critical';
    if (seriousCount >= 3 || (seriousCount >= 1 && moderateCount >= 5)) return 'High';
    if (seriousCount >= 1 || moderateCount >= 3) return 'Medium';
    return 'Low';
  }

  /**
   * Helper method to get estimated effort for page
   */
  private getPageEffort(page: PageScanResult): string {
    const totalNodes = page.violations.reduce((sum, violation) => sum + violation.nodes.length, 0);
    const complexViolations = page.violations.filter(v => 
      SCAN_CONFIG.decisionThresholds.complexIssuesForClaudeAnalysis.some(complex => 
        v.id.includes(complex) || v.tags.includes(complex)
      )
    );
    const criticalViolations = page.violations.filter(v => v.impact === 'critical' || v.impact === 'serious');

    let baseHours = 0;
    baseHours += criticalViolations.length * 2;
    baseHours += complexViolations.length * 3;
    baseHours += (page.violations.length - criticalViolations.length - complexViolations.length) * 0.5;
    baseHours += Math.max(0, totalNodes - page.violations.length) * 0.25;

    if (baseHours <= 1) return '0.5-1 hours';
    if (baseHours <= 2) return '1-2 hours';
    if (baseHours <= 4) return '2-4 hours';
    if (baseHours <= 8) return '4-8 hours';
    if (baseHours <= 16) return '8-16 hours';
    return '16+ hours';
  }

  /**
   * Helper method to get fix recommendation for violation
   */
  private getFixRecommendation(violation: ViolationResult): string {
    const commonFixes: Record<string, string> = {
      'color-contrast': 'Increase contrast ratio to meet WCAG AA standards (4.5:1 for normal text, 3:1 for large text)',
      'alt-text': 'Add descriptive alt text to images or mark decorative images with alt=""',
      'aria-labels': 'Add appropriate ARIA labels or improve existing ones for better screen reader support',
      'keyboard-navigation': 'Ensure all interactive elements are keyboard accessible and have visible focus indicators',
      'heading-order': 'Use proper heading hierarchy (h1, h2, h3, etc.) in logical order',
      'form-labels': 'Associate form controls with descriptive labels using for/id attributes',
      'link-purpose': 'Make link text descriptive and provide context for link purpose',
      'focus-management': 'Implement proper focus management for dynamic content and modals'
    };

    for (const [key, fix] of Object.entries(commonFixes)) {
      if (violation.id.includes(key) || violation.description.toLowerCase().includes(key)) {
        return fix;
      }
    }

    return violation.help || 'Refer to WCAG guidelines for specific remediation steps';
  }

  /**
   * Helper method to get failure summary from violation node
   */
  private getFailureSummary(node: any): string {
    // Extract failure information from check results
    const allChecks = [...(node.any || []), ...(node.all || []), ...(node.none || [])];
    const failureMessages = allChecks.map(check => check.message).filter(msg => msg);
    
    if (failureMessages.length > 0) {
      return failureMessages.join('; ');
    }
    
    return 'No specific failure summary available';
  }
}