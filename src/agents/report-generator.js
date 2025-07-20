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
exports.ReportGenerator = void 0;
const fs_1 = require("fs");
const path_1 = require("path");
class ReportGenerator {
    constructor(outputDirectory = './results/reports') {
        this.outputDirectory = outputDirectory;
        this.ensureDirectoryExists();
    }
    ensureDirectoryExists() {
        if (!(0, fs_1.existsSync)(this.outputDirectory)) {
            (0, fs_1.mkdirSync)(this.outputDirectory, { recursive: true });
        }
    }
    /**
     * Generate comprehensive accessibility report
     */
    generateReport(bulkScanResults, claudeAnalysisResults, scanStartTime, scanEndTime) {
        return __awaiter(this, void 0, void 0, function* () {
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
        });
    }
    /**
     * Export report to JSON format
     */
    exportToJSON(filename = 'accessibility-report.json') {
        const outputPath = (0, path_1.join)(this.outputDirectory, filename);
        (0, fs_1.writeFileSync)(outputPath, JSON.stringify(this.reportData, null, 2));
        console.log(`EXPORTED: JSON report to ${outputPath}`);
    }
    /**
     * Export report to HTML format with charts and visualizations
     */
    exportToHTML(filename = 'accessibility-report.html') {
        const htmlContent = this.generateHTMLReport();
        const outputPath = (0, path_1.join)(this.outputDirectory, filename);
        (0, fs_1.writeFileSync)(outputPath, htmlContent);
        console.log(`EXPORTED: HTML report to ${outputPath}`);
    }
    generateSummary(bulkScanResults, claudeAnalysisResults, completionTime) {
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
    generateViolationBreakdown(bulkScanResults) {
        const allViolations = this.getAllViolations(bulkScanResults);
        const violationsByImpact = this.groupViolationsByImpact(allViolations);
        const totalViolations = allViolations.length;
        return ['critical', 'serious', 'moderate', 'minor'].map(impact => {
            const violations = violationsByImpact[impact] || [];
            const count = violations.length;
            const percentage = totalViolations > 0 ? (count / totalViolations) * 100 : 0;
            const topViolations = this.getTopViolations(violations);
            return {
                impact: impact,
                count,
                percentage: Math.round(percentage * 100) / 100,
                topViolations
            };
        });
    }
    generateComplexIssues(claudeAnalysisResults) {
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
    generateDevelopmentBacklog(bulkScanResults, claudeAnalysisResults) {
        const tickets = [];
        let ticketId = 1;
        // Generate tickets from Claude analysis
        claudeAnalysisResults.forEach(result => {
            result.findings.remediationSteps.forEach(step => {
                const ticket = {
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
                const ticket = {
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
    generateTechnicalDetails(bulkScanResults, claudeAnalysisResults) {
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
    generateExecutiveSummary(summary, violationBreakdown, complexIssues) {
        var _a, _b;
        const criticalCount = ((_a = violationBreakdown.find(v => v.impact === 'critical')) === null || _a === void 0 ? void 0 : _a.count) || 0;
        const seriousCount = ((_b = violationBreakdown.find(v => v.impact === 'serious')) === null || _b === void 0 ? void 0 : _b.count) || 0;
        return {
            businessImpact: this.generateBusinessImpact(summary, criticalCount, seriousCount),
            keyFindings: this.generateKeyFindings(summary, violationBreakdown, complexIssues),
            recommendations: this.generateRecommendations(summary, violationBreakdown),
            timeline: this.generateTimeline(summary, complexIssues.length),
            resources: this.generateResourceEstimate(summary, complexIssues.length)
        };
    }
    generateHTMLReport() {
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
    getTotalPages(bulkScanResults) {
        return bulkScanResults.passed.length +
            bulkScanResults.minorIssues.length +
            bulkScanResults.claudeNeeded.length +
            bulkScanResults.critical.length;
    }
    getAllPageResults(bulkScanResults) {
        return [
            ...bulkScanResults.passed,
            ...bulkScanResults.minorIssues,
            ...bulkScanResults.claudeNeeded,
            ...bulkScanResults.critical
        ];
    }
    getAllViolations(bulkScanResults) {
        const allPages = this.getAllPageResults(bulkScanResults);
        return allPages.flatMap(page => page.violations);
    }
    groupViolationsByImpact(violations) {
        return violations.reduce((acc, violation) => {
            const impact = violation.impact;
            if (!acc[impact])
                acc[impact] = [];
            acc[impact].push(violation);
            return acc;
        }, {});
    }
    getTopViolations(violations) {
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
        }, {});
        return Object.values(violationCounts)
            .map(v => (Object.assign(Object.assign({}, v), { affectedPages: v.affectedPages.size })))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }
    calculateWCAGCompliance(bulkScanResults) {
        var _a, _b, _c, _d;
        const totalPages = this.getTotalPages(bulkScanResults);
        const passedPages = bulkScanResults.passed.length;
        const passRate = totalPages > 0 ? Math.round((passedPages / totalPages) * 100) : 0;
        const allViolations = this.getAllViolations(bulkScanResults);
        const violationsByImpact = this.groupViolationsByImpact(allViolations);
        const criticalViolations = ((_a = violationsByImpact.critical) === null || _a === void 0 ? void 0 : _a.length) || 0;
        const seriousViolations = ((_b = violationsByImpact.serious) === null || _b === void 0 ? void 0 : _b.length) || 0;
        const moderateViolations = ((_c = violationsByImpact.moderate) === null || _c === void 0 ? void 0 : _c.length) || 0;
        const minorViolations = ((_d = violationsByImpact.minor) === null || _d === void 0 ? void 0 : _d.length) || 0;
        let level;
        if (criticalViolations > 0 || seriousViolations > 10) {
            level = 'Non-compliant';
        }
        else if (passRate >= 95 && seriousViolations === 0) {
            level = 'AA';
        }
        else if (passRate >= 90) {
            level = 'A';
        }
        else {
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
    calculateCompletionTime(startTime, endTime) {
        const diffMs = endTime.getTime() - startTime.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        if (diffHours > 0) {
            return `${diffHours}h ${diffMinutes}m`;
        }
        return `${diffMinutes}m`;
    }
    calculateClaudeAnalysisMetrics(claudeResults) {
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
    determinePriority(remediationSteps) {
        const priorities = remediationSteps.map(step => step.priority);
        if (priorities.includes('Critical'))
            return 'Critical';
        if (priorities.includes('High'))
            return 'High';
        if (priorities.includes('Medium'))
            return 'Medium';
        return 'Low';
    }
    calculateTotalEffort(remediationSteps) {
        const totalHours = remediationSteps.reduce((sum, step) => {
            const hours = parseInt(step.effort) || 0;
            return sum + hours;
        }, 0);
        return totalHours > 0 ? `${totalHours} hours` : 'Unknown';
    }
    estimateEffortFromViolation(violation) {
        const impactToEffort = {
            'critical': '8 hours',
            'serious': '4 hours',
            'moderate': '2 hours',
            'minor': '1 hour'
        };
        return impactToEffort[violation.impact] || '2 hours';
    }
    generateBusinessImpact(summary, criticalCount, seriousCount) {
        const passRate = Math.round((summary.passedPages / summary.totalPages) * 100);
        if (passRate >= 95) {
            return `Strong accessibility foundation with ${passRate}% pass rate. Minor improvements needed for full compliance.`;
        }
        else if (passRate >= 80) {
            return `Good accessibility baseline with ${passRate}% pass rate. ${criticalCount + seriousCount} high-priority issues require immediate attention to prevent legal risks.`;
        }
        else {
            return `Significant accessibility gaps with ${passRate}% pass rate. ${criticalCount} critical and ${seriousCount} serious violations pose substantial legal and user experience risks.`;
        }
    }
    generateKeyFindings(summary, violationBreakdown, complexIssues) {
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
    generateRecommendations(summary, violationBreakdown) {
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
    generateTimeline(summary, complexIssuesCount) {
        const totalIssues = summary.criticalIssues + summary.minorIssues + complexIssuesCount;
        const weeksEstimate = Math.ceil(totalIssues / 20); // Assuming 20 fixes per week
        return `Estimated ${weeksEstimate}-${weeksEstimate + 2} weeks for full remediation with dedicated team`;
    }
    generateResourceEstimate(summary, complexIssuesCount) {
        const totalIssues = summary.criticalIssues + summary.minorIssues + complexIssuesCount;
        const developersNeeded = Math.ceil(totalIssues / 50); // Assuming 50 fixes per developer
        return `Recommended: ${developersNeeded} developers + 1 accessibility specialist for ${Math.ceil(totalIssues / 20)} weeks`;
    }
}
exports.ReportGenerator = ReportGenerator;
