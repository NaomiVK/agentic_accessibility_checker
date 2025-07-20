import { PageScanResult, DecisionResult, ViolationResult } from '../types/accessibility-types';
import { SCAN_CONFIG, DECISION_CATEGORIES } from '../../config/scan-config';

export interface DecisionMetrics {
  totalPages: number;
  passedPages: number;
  minorIssuesPages: number;
  claudeNeededPages: number;
  criticalPages: number;
  decisionDuration: number;
}

export interface PageDecision {
  url: string;
  category: keyof typeof DECISION_CATEGORIES;
  reason: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedEffort: string;
  complexViolations: string[];
  criticalViolations: string[];
}

export class DecisionAgent {
  private readonly complexIssues: string[];
  private readonly criticalThreshold: number;
  private readonly incompleteThreshold: number;

  constructor() {
    this.complexIssues = SCAN_CONFIG.decisionThresholds.complexIssuesForClaudeAnalysis;
    this.criticalThreshold = SCAN_CONFIG.decisionThresholds.criticalViolationsLimit;
    this.incompleteThreshold = SCAN_CONFIG.decisionThresholds.incompleteResultsLimit;
  }

  /**
   * Analyzes scan results and categorizes pages based on violation types and complexity
   */
  public categorizePages(scanResults: PageScanResult[]): DecisionResult {
    const startTime = Date.now();
    
    const result: DecisionResult = {
      passed: [],
      minorIssues: [],
      claudeNeeded: [],
      critical: []
    };

    for (const scanResult of scanResults) {
      const decision = this.makeDecision(scanResult);
      
      switch (decision.category) {
        case 'PASSED':
          result.passed.push(scanResult);
          break;
        case 'MINOR_ISSUES':
          result.minorIssues.push(scanResult);
          break;
        case 'CLAUDE_NEEDED':
          result.claudeNeeded.push(scanResult);
          break;
        case 'CRITICAL':
          result.critical.push(scanResult);
          break;
      }
    }

    const decisionDuration = Date.now() - startTime;
    this.logDecisionMetrics(result, decisionDuration);

    return result;
  }

  /**
   * Makes a decision for a single page based on its scan results
   */
  public makeDecision(scanResult: PageScanResult): PageDecision {
    const { url, violations, incomplete, error } = scanResult;

    // Handle scan errors
    if (error) {
      return {
        url,
        category: 'CRITICAL',
        reason: `Scan failed: ${error}`,
        priority: 'Critical',
        estimatedEffort: '2-4 hours',
        complexViolations: [],
        criticalViolations: ['scan-error']
      };
    }

    // Check for critical violations
    const criticalViolations = this.getCriticalViolations(violations);
    if (criticalViolations.length >= this.criticalThreshold) {
      return {
        url,
        category: 'CRITICAL',
        reason: `${criticalViolations.length} critical violations found`,
        priority: 'Critical',
        estimatedEffort: this.estimateEffort(violations),
        complexViolations: this.getComplexViolations(violations).map(v => v.id),
        criticalViolations: criticalViolations.map(v => v.id)
      };
    }

    // Check for complex issues requiring Claude analysis
    const complexViolations = this.getComplexViolations(violations);
    const needsClaudeAnalysis = this.needsHumanAnalysis(violations, incomplete);
    
    if (needsClaudeAnalysis || complexViolations.length > 0) {
      return {
        url,
        category: 'CLAUDE_NEEDED',
        reason: this.buildClaudeAnalysisReason(violations, incomplete, complexViolations),
        priority: this.calculatePriority(violations),
        estimatedEffort: this.estimateEffort(violations),
        complexViolations: complexViolations.map(v => v.id),
        criticalViolations: criticalViolations.map(v => v.id)
      };
    }

    // Check if page has no violations
    if (violations.length === 0) {
      return {
        url,
        category: 'PASSED',
        reason: 'No violations found',
        priority: 'Low',
        estimatedEffort: '0 hours',
        complexViolations: [],
        criticalViolations: []
      };
    }

    // Remaining violations are minor/moderate issues
    return {
      url,
      category: 'MINOR_ISSUES',
      reason: `${violations.length} auto-fixable violations found`,
      priority: this.calculatePriority(violations),
      estimatedEffort: this.estimateEffort(violations),
      complexViolations: [],
      criticalViolations: []
    };
  }

  /**
   * Determines if a page needs human analysis based on violation types and incomplete results
   */
  private needsHumanAnalysis(violations: ViolationResult[], incomplete: ViolationResult[]): boolean {
    // Check for high number of incomplete results
    if (incomplete.length > this.incompleteThreshold) {
      return true;
    }

    // Check for specific violation types that need visual verification
    const visualVerificationRules = [
      'color-contrast',
      'focus-visible',
      'focus-order-semantics',
      'keyboard-navigation',
      'aria-hidden-focus',
      'visual-only-information',
      'bypass',
      'landmark-one-main',
      'page-has-heading-one'
    ];

    return violations.some(violation => 
      visualVerificationRules.some(rule => violation.id.includes(rule))
    );
  }

  /**
   * Gets violations that are considered critical (serious or critical impact)
   */
  private getCriticalViolations(violations: ViolationResult[]): ViolationResult[] {
    return violations.filter(violation => 
      violation.impact === 'critical' || violation.impact === 'serious'
    );
  }

  /**
   * Gets violations that are considered complex and require human analysis
   */
  private getComplexViolations(violations: ViolationResult[]): ViolationResult[] {
    return violations.filter(violation =>
      this.complexIssues.some(complexIssue => 
        violation.id.includes(complexIssue) || violation.tags.includes(complexIssue)
      )
    );
  }

  /**
   * Builds a detailed reason for why Claude analysis is needed
   */
  private buildClaudeAnalysisReason(
    violations: ViolationResult[], 
    incomplete: ViolationResult[], 
    complexViolations: ViolationResult[]
  ): string {
    const reasons: string[] = [];

    if (complexViolations.length > 0) {
      reasons.push(`${complexViolations.length} complex violations requiring visual analysis`);
    }

    if (incomplete.length > this.incompleteThreshold) {
      reasons.push(`${incomplete.length} incomplete results need verification`);
    }

    const focusIssues = violations.filter(v => v.id.includes('focus'));
    if (focusIssues.length > 0) {
      reasons.push(`${focusIssues.length} focus management issues`);
    }

    const keyboardIssues = violations.filter(v => v.id.includes('keyboard'));
    if (keyboardIssues.length > 0) {
      reasons.push(`${keyboardIssues.length} keyboard navigation issues`);
    }

    const ariaIssues = violations.filter(v => v.id.includes('aria'));
    if (ariaIssues.length > 0) {
      reasons.push(`${ariaIssues.length} ARIA implementation issues`);
    }

    return reasons.join(', ') || 'Complex accessibility issues detected';
  }

  /**
   * Calculates priority based on violation impact levels
   */
  private calculatePriority(violations: ViolationResult[]): 'Low' | 'Medium' | 'High' | 'Critical' {
    const criticalCount = violations.filter(v => v.impact === 'critical').length;
    const seriousCount = violations.filter(v => v.impact === 'serious').length;
    const moderateCount = violations.filter(v => v.impact === 'moderate').length;

    if (criticalCount > 0) return 'Critical';
    if (seriousCount >= 3 || (seriousCount >= 1 && moderateCount >= 5)) return 'High';
    if (seriousCount >= 1 || moderateCount >= 3) return 'Medium';
    return 'Low';
  }

  /**
   * Estimates effort required to fix violations
   */
  private estimateEffort(violations: ViolationResult[]): string {
    const totalNodes = violations.reduce((sum, violation) => sum + violation.nodes.length, 0);
    const complexViolations = this.getComplexViolations(violations);
    const criticalViolations = this.getCriticalViolations(violations);

    let baseHours = 0;

    // Base time per violation type
    baseHours += criticalViolations.length * 2; // 2 hours per critical
    baseHours += complexViolations.length * 3; // 3 hours per complex
    baseHours += (violations.length - criticalViolations.length - complexViolations.length) * 0.5; // 0.5 hours per simple

    // Additional time for multiple instances
    baseHours += Math.max(0, totalNodes - violations.length) * 0.25; // 0.25 hours per additional node

    // Round to reasonable ranges
    if (baseHours <= 1) return '0.5-1 hours';
    if (baseHours <= 2) return '1-2 hours';
    if (baseHours <= 4) return '2-4 hours';
    if (baseHours <= 8) return '4-8 hours';
    if (baseHours <= 16) return '8-16 hours';
    return '16+ hours';
  }

  /**
   * Logs decision metrics for monitoring and reporting
   */
  private logDecisionMetrics(result: DecisionResult, duration: number): void {
    const metrics: DecisionMetrics = {
      totalPages: result.passed.length + result.minorIssues.length + result.claudeNeeded.length + result.critical.length,
      passedPages: result.passed.length,
      minorIssuesPages: result.minorIssues.length,
      claudeNeededPages: result.claudeNeeded.length,
      criticalPages: result.critical.length,
      decisionDuration: duration
    };

    console.log('[METRICS] Decision Agent Metrics:', {
      ...metrics,
      passRate: `${((metrics.passedPages / metrics.totalPages) * 100).toFixed(1)}%`,
      claudeAnalysisRate: `${((metrics.claudeNeededPages / metrics.totalPages) * 100).toFixed(1)}%`,
      criticalRate: `${((metrics.criticalPages / metrics.totalPages) * 100).toFixed(1)}%`,
      avgDecisionTime: `${(duration / metrics.totalPages).toFixed(2)}ms per page`
    });
  }

  /**
   * Gets detailed breakdown of decision categories for a set of pages
   */
  public getDecisionBreakdown(scanResults: PageScanResult[]): {
    category: string;
    count: number;
    percentage: number;
    pages: string[];
  }[] {
    const result = this.categorizePages(scanResults);
    const total = scanResults.length;

    return [
      {
        category: 'PASSED',
        count: result.passed.length,
        percentage: (result.passed.length / total) * 100,
        pages: result.passed.map(p => p.url)
      },
      {
        category: 'MINOR_ISSUES',
        count: result.minorIssues.length,
        percentage: (result.minorIssues.length / total) * 100,
        pages: result.minorIssues.map(p => p.url)
      },
      {
        category: 'CLAUDE_NEEDED',
        count: result.claudeNeeded.length,
        percentage: (result.claudeNeeded.length / total) * 100,
        pages: result.claudeNeeded.map(p => p.url)
      },
      {
        category: 'CRITICAL',
        count: result.critical.length,
        percentage: (result.critical.length / total) * 100,
        pages: result.critical.map(p => p.url)
      }
    ];
  }

  /**
   * Filters pages that need immediate attention (critical issues)
   */
  public getHighPriorityPages(scanResults: PageScanResult[]): PageScanResult[] {
    return scanResults.filter(result => {
      const decision = this.makeDecision(result);
      return decision.category === 'CRITICAL' || decision.priority === 'Critical';
    });
  }

  /**
   * Gets recommended batch processing order based on priority and complexity
   */
  public getBatchProcessingOrder(scanResults: PageScanResult[]): {
    immediate: PageScanResult[];
    claudeAnalysis: PageScanResult[];
    automated: PageScanResult[];
    passed: PageScanResult[];
  } {
    const categorized = this.categorizePages(scanResults);
    
    return {
      immediate: categorized.critical,
      claudeAnalysis: categorized.claudeNeeded,
      automated: categorized.minorIssues,
      passed: categorized.passed
    };
  }
}

export default DecisionAgent;