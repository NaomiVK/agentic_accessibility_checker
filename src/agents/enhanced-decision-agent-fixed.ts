import { PageScanResult, ViolationResult } from '../types/accessibility-types';
import { SCAN_CONFIG, DECISION_CATEGORIES } from '../../config/scan-config';
// Import base types from enhanced-decision-agent
import type { 
  DecisionReasoning, 
  ReasoningFactor, 
  AlternativeDecision,
  EnhancedPageDecision
} from './enhanced-decision-agent';

// Re-define types that need to be used here
interface LearningMemory {
  patternHistory: Map<string, PatternOccurrence[]>;
  decisionOutcomes: Map<string, DecisionOutcome[]>;
  contextualPatterns: Map<string, ContextPattern[]>;
}

interface PatternOccurrence {
  url: string;
  timestamp: string;
  violationTypes: string[];
  decision: string;
  wasCorrect?: boolean;
}

interface DecisionOutcome {
  url: string;
  predictedCategory: string;
  actualCategory?: string;
  feedback?: string;
  timestamp: string;
}

interface ContextPattern {
  pageType: string;
  commonViolations: string[];
  typicalDecision: string;
  confidence: number;
}

/**
 * Fixed Enhanced Decision Agent with clearer categorization logic
 * Ensures critical issues and complex patterns are properly identified for Claude analysis
 */
export class EnhancedDecisionAgentFixed {
  private readonly complexIssues: string[];
  private readonly criticalThreshold: number;
  private readonly incompleteThreshold: number;
  private learningMemory: LearningMemory;
  private decisionHistory: Map<string, EnhancedPageDecision[]>;

  constructor() {
    this.complexIssues = SCAN_CONFIG.decisionThresholds.complexIssuesForClaudeAnalysis;
    this.criticalThreshold = SCAN_CONFIG.decisionThresholds.criticalViolationsLimit;
    this.incompleteThreshold = SCAN_CONFIG.decisionThresholds.incompleteResultsLimit;
    
    this.learningMemory = {
      patternHistory: new Map(),
      decisionOutcomes: new Map(),
      contextualPatterns: new Map()
    };
    this.decisionHistory = new Map();
  }

  /**
   * Enhanced decision making with clearer logic for Claude analysis
   */
  public makeDecisionWithReasoning(scanResult: PageScanResult): EnhancedPageDecision {
    const { url, violations, incomplete, error } = scanResult;
    
    // Handle scan errors
    if (error) {
      return this.createErrorDecision(url, error);
    }

    // Get critical and complex violations
    const criticalViolations = this.getCriticalViolations(violations);
    const complexViolations = this.getComplexViolations(violations);
    
    // CRITICAL: 5+ critical/serious violations - needs immediate attention
    if (criticalViolations.length >= this.criticalThreshold) {
      return this.createDecision(
        url, 
        'CRITICAL',
        `${criticalViolations.length} critical/serious violations require immediate attention`,
        0.95,
        violations,
        criticalViolations,
        complexViolations,
        incomplete
      );
    }

    // CLAUDE_NEEDED: Complex issues that need visual/contextual analysis
    const needsClaudeAnalysis = this.determineClaudeNeed(violations, incomplete, complexViolations);
    if (needsClaudeAnalysis.needed) {
      return this.createDecision(
        url,
        'CLAUDE_NEEDED',
        needsClaudeAnalysis.reason,
        needsClaudeAnalysis.confidence,
        violations,
        criticalViolations,
        complexViolations,
        incomplete
      );
    }

    // PASSED: No violations
    if (violations.length === 0) {
      return this.createDecision(
        url,
        'PASSED',
        'No accessibility violations detected',
        1.0,
        violations,
        criticalViolations,
        complexViolations,
        incomplete
      );
    }

    // MINOR_ISSUES: Only simple, auto-fixable violations
    return this.createDecision(
      url,
      'MINOR_ISSUES',
      `${violations.length} auto-fixable violations found`,
      0.8,
      violations,
      criticalViolations,
      complexViolations,
      incomplete
    );
  }

  /**
   * Determine if Claude analysis is needed with clear criteria
   */
  private determineClaudeNeed(
    violations: ViolationResult[], 
    incomplete: ViolationResult[],
    complexViolations: ViolationResult[]
  ): { needed: boolean; reason: string; confidence: number } {
    const reasons: string[] = [];
    let confidence = 0.7;

    // 1. Complex violations that need visual analysis
    if (complexViolations.length > 0) {
      reasons.push(`${complexViolations.length} complex violations requiring visual analysis`);
      confidence = Math.max(confidence, 0.85);
    }

    // 2. High number of incomplete results
    if (incomplete.length > this.incompleteThreshold) {
      reasons.push(`${incomplete.length} incomplete results need verification`);
      confidence = Math.max(confidence, 0.8);
    }

    // 3. Visual verification rules
    const visualVerificationNeeded = violations.filter(v => 
      ['color-contrast', 'focus-visible', 'focus-order-semantics', 'keyboard-navigation',
       'aria-hidden-focus', 'visual-only-information', 'bypass', 'landmark-one-main',
       'page-has-heading-one'].some(rule => v.id.includes(rule))
    );
    
    if (visualVerificationNeeded.length > 0) {
      reasons.push(`${visualVerificationNeeded.length} violations need visual verification`);
      confidence = Math.max(confidence, 0.9);
    }

    // 4. Focus and keyboard issues (often interrelated)
    const focusKeyboardIssues = violations.filter(v => 
      v.id.includes('focus') || v.id.includes('keyboard') || v.id.includes('tabindex')
    );
    
    if (focusKeyboardIssues.length >= 2) {
      reasons.push(`${focusKeyboardIssues.length} focus/keyboard navigation issues`);
      confidence = Math.max(confidence, 0.85);
    }

    // 5. ARIA implementation issues
    const ariaIssues = violations.filter(v => v.id.includes('aria'));
    if (ariaIssues.length >= 3) {
      reasons.push(`${ariaIssues.length} ARIA implementation issues`);
      confidence = Math.max(confidence, 0.8);
    }

    // 6. Critical but below threshold (1-4 critical issues still important)
    const criticalCount = violations.filter(v => 
      v.impact === 'critical' || v.impact === 'serious'
    ).length;
    
    if (criticalCount > 0 && criticalCount < this.criticalThreshold) {
      reasons.push(`${criticalCount} critical/serious violations need review`);
      confidence = Math.max(confidence, 0.75);
    }

    return {
      needed: reasons.length > 0,
      reason: reasons.join('; ') || 'No complex issues detected',
      confidence
    };
  }

  /**
   * Create a decision with full reasoning
   */
  private createDecision(
    url: string,
    category: keyof typeof DECISION_CATEGORIES,
    reason: string,
    confidence: number,
    violations: ViolationResult[],
    criticalViolations: ViolationResult[],
    complexViolations: ViolationResult[],
    incomplete: ViolationResult[]
  ): EnhancedPageDecision {
    // Build reasoning factors
    const factors = this.buildReasoningFactors(violations, incomplete, category);
    
    // Generate alternatives
    const alternatives = this.generateAlternatives(category, violations, confidence);
    
    // Build contextual analysis
    const contextualAnalysis = this.buildContextualAnalysis(violations, criticalViolations, complexViolations);
    
    // Extract insights
    const learningInsights = this.extractInsights(url, violations, category);
    
    const reasoning: DecisionReasoning = {
      decision: category,
      confidence,
      factors,
      contextualAnalysis,
      alternativeDecisions: alternatives,
      learningInsights
    };

    // Store for learning
    this.updateLearningMemory(url, violations, { decision: category, confidence });

    return {
      url,
      category,
      reasoning,
      reason,
      priority: this.calculatePriority(violations),
      estimatedEffort: this.estimateEffort(violations),
      complexViolations: complexViolations.map(v => v.id),
      criticalViolations: criticalViolations.map(v => v.id),
      adaptiveSuggestions: this.generateSuggestions(violations, category),
      uncertaintyFactors: confidence < 0.8 ? ['Confidence below 80% - review recommended'] : []
    };
  }

  private buildReasoningFactors(
    violations: ViolationResult[], 
    incomplete: ViolationResult[],
    category: keyof typeof DECISION_CATEGORIES
  ): ReasoningFactor[] {
    const factors: ReasoningFactor[] = [];

    // Violation severity factor
    const criticalCount = violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
    if (criticalCount > 0) {
      factors.push({
        type: 'violation',
        description: `${criticalCount} critical/serious violations found`,
        weight: 0.9,
        evidence: violations.filter(v => v.impact === 'critical' || v.impact === 'serious').map(v => v.id)
      });
    }

    // Pattern detection
    const patterns = this.detectPatterns(violations);
    patterns.forEach(pattern => {
      factors.push({
        type: 'pattern',
        description: pattern,
        weight: 0.7,
        evidence: []
      });
    });

    // Incomplete results
    if (incomplete.length > 0) {
      factors.push({
        type: 'context',
        description: `${incomplete.length} incomplete results require manual verification`,
        weight: 0.6,
        evidence: incomplete.map(i => i.id)
      });
    }

    return factors;
  }

  private detectPatterns(violations: ViolationResult[]): string[] {
    const patterns: string[] = [];
    
    // Form accessibility pattern
    const formViolations = violations.filter(v => 
      v.id.includes('label') || v.id.includes('input') || v.id.includes('form')
    );
    if (formViolations.length >= 3) {
      patterns.push('Systematic form accessibility issues detected');
    }

    // Navigation structure pattern
    const navViolations = violations.filter(v => 
      v.id.includes('landmark') || v.id.includes('heading') || v.id.includes('skip')
    );
    if (navViolations.length >= 2) {
      patterns.push('Page navigation and structure issues');
    }

    // Focus management pattern
    const focusViolations = violations.filter(v => 
      v.id.includes('focus') || v.id.includes('keyboard')
    );
    if (focusViolations.length >= 2) {
      patterns.push('Focus management and keyboard navigation issues');
    }

    return patterns;
  }

  private generateAlternatives(
    primaryDecision: keyof typeof DECISION_CATEGORIES,
    violations: ViolationResult[],
    confidence: number
  ): AlternativeDecision[] {
    const alternatives: AlternativeDecision[] = [];

    if (primaryDecision === 'CRITICAL' && confidence < 0.9) {
      alternatives.push({
        decision: 'CLAUDE_NEEDED',
        confidence: 0.7,
        rationale: 'Visual analysis could provide additional context for remediation'
      });
    }

    if (primaryDecision === 'CLAUDE_NEEDED' && violations.length < 3) {
      alternatives.push({
        decision: 'MINOR_ISSUES',
        confidence: 0.5,
        rationale: 'Limited violations might be addressable without visual analysis'
      });
    }

    return alternatives;
  }

  private buildContextualAnalysis(
    violations: ViolationResult[],
    criticalViolations: ViolationResult[],
    complexViolations: ViolationResult[]
  ): string {
    const totalElements = violations.reduce((sum, v) => sum + v.nodes.length, 0);
    const wcagCriteria = new Set(violations.flatMap(v => v.tags.filter(t => t.includes('wcag'))));
    
    let analysis = `Page has ${violations.length} violations affecting ${totalElements} elements`;
    
    if (criticalViolations.length > 0) {
      analysis += `, including ${criticalViolations.length} critical/serious issues`;
    }
    
    if (complexViolations.length > 0) {
      analysis += ` and ${complexViolations.length} complex violations requiring visual analysis`;
    }
    
    analysis += `. Violations span ${wcagCriteria.size} WCAG criteria.`;
    
    return analysis;
  }

  private calculatePriority(violations: ViolationResult[]): 'Low' | 'Medium' | 'High' | 'Critical' {
    const criticalCount = violations.filter(v => v.impact === 'critical').length;
    const seriousCount = violations.filter(v => v.impact === 'serious').length;
    
    if (criticalCount > 0) return 'Critical';
    if (seriousCount >= 3) return 'High';
    if (seriousCount >= 1 || violations.length >= 5) return 'Medium';
    return 'Low';
  }

  private estimateEffort(violations: ViolationResult[]): string {
    const criticalCount = violations.filter(v => v.impact === 'critical' || v.impact === 'serious').length;
    const totalNodes = violations.reduce((sum, v) => sum + v.nodes.length, 0);
    
    let hours = criticalCount * 2 + (violations.length - criticalCount) * 0.5 + (totalNodes * 0.1);
    
    if (hours <= 2) return '1-2 hours';
    if (hours <= 4) return '2-4 hours';
    if (hours <= 8) return '4-8 hours';
    if (hours <= 16) return '8-16 hours';
    return '16+ hours';
  }

  private generateSuggestions(violations: ViolationResult[], category: keyof typeof DECISION_CATEGORIES): string[] {
    const suggestions: string[] = [];
    
    if (category === 'CRITICAL') {
      suggestions.push('Prioritize fixing critical accessibility barriers immediately');
    }
    
    const autoFixable = violations.filter(v => 
      v.id.includes('image-alt') || v.id.includes('label') || v.id.includes('html-has-lang')
    );
    
    if (autoFixable.length > 0) {
      suggestions.push(`${autoFixable.length} violations can be fixed with automated tools`);
    }
    
    return suggestions;
  }

  private extractInsights(url: string, violations: ViolationResult[], category: keyof typeof DECISION_CATEGORIES): string[] {
    const insights: string[] = [];
    
    if (violations.length > 10) {
      insights.push('High violation count suggests systemic accessibility issues');
    }
    
    const domain = new URL(url).hostname;
    const history = this.learningMemory.patternHistory.get(domain);
    if (history && history.length > 0) {
      insights.push(`Domain has ${history.length} previous scans in history`);
    }
    
    return insights;
  }

  private updateLearningMemory(url: string, violations: ViolationResult[], decision: { decision: keyof typeof DECISION_CATEGORIES; confidence: number }): void {
    const domain = new URL(url).hostname;
    
    const patternHistory = this.learningMemory.patternHistory.get(domain) || [];
    patternHistory.push({
      url,
      timestamp: new Date().toISOString(),
      violationTypes: violations.map(v => v.id),
      decision: decision.decision
    });
    this.learningMemory.patternHistory.set(domain, patternHistory);
  }

  private createErrorDecision(url: string, error: string): EnhancedPageDecision {
    const reasoning: DecisionReasoning = {
      decision: 'CRITICAL',
      confidence: 1.0,
      factors: [{
        type: 'violation',
        description: `Scan failed: ${error}`,
        weight: 1.0,
        evidence: [error]
      }],
      contextualAnalysis: 'Page scan failed - manual review required',
      alternativeDecisions: [],
      learningInsights: ['Scan failure prevents automated assessment']
    };

    return {
      url,
      category: 'CRITICAL',
      reasoning,
      reason: `Scan error: ${error}`,
      priority: 'Critical',
      estimatedEffort: '2-4 hours',
      complexViolations: [],
      criticalViolations: ['scan-error'],
      adaptiveSuggestions: ['Investigate scan failure', 'Try manual accessibility audit'],
      uncertaintyFactors: ['Unable to determine actual accessibility status']
    };
  }

  private getCriticalViolations(violations: ViolationResult[]): ViolationResult[] {
    return violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
  }

  private getComplexViolations(violations: ViolationResult[]): ViolationResult[] {
    return violations.filter(v =>
      this.complexIssues.some(issue => 
        v.id.includes(issue) || v.tags.includes(issue)
      )
    );
  }

  public exportLearningInsights(): any {
    return {
      domainPatterns: Array.from(this.learningMemory.patternHistory.entries()),
      contextualPatterns: Array.from(this.learningMemory.contextualPatterns.values())
    };
  }
}