import { PageScanResult, ViolationResult } from '../types/accessibility-types';
import { SCAN_CONFIG, DECISION_CATEGORIES } from '../../config/scan-config';

export interface DecisionReasoning {
  decision: keyof typeof DECISION_CATEGORIES;
  confidence: number; // 0-1 scale
  factors: ReasoningFactor[];
  contextualAnalysis: string;
  alternativeDecisions: AlternativeDecision[];
  learningInsights: string[];
}

export interface ReasoningFactor {
  type: 'violation' | 'pattern' | 'context' | 'historical' | 'heuristic';
  description: string;
  weight: number; // How much this factor influenced the decision
  evidence: string[];
  impact?: 'critical' | 'serious' | 'moderate' | 'minor'; // Optional impact level
}

export interface AlternativeDecision {
  decision: keyof typeof DECISION_CATEGORIES;
  confidence: number;
  rationale: string;
}

export interface EnhancedPageDecision {
  url: string;
  category: keyof typeof DECISION_CATEGORIES;
  reasoning: DecisionReasoning;
  reason: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedEffort: string;
  complexViolations: string[];
  criticalViolations: string[];
  adaptiveSuggestions: string[];
  uncertaintyFactors: string[];
  isHighPriority?: boolean; // For critical pages needing urgent Claude analysis
}

export interface LearningMemory {
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

export class EnhancedDecisionAgent {
  private readonly complexIssues: string[];
  private readonly criticalThreshold: number;
  private readonly incompleteThreshold: number;
  private learningMemory: LearningMemory;
  private decisionHistory: Map<string, EnhancedPageDecision[]>;

  constructor() {
    this.complexIssues = SCAN_CONFIG.decisionThresholds.complexIssuesForClaudeAnalysis;
    this.criticalThreshold = SCAN_CONFIG.decisionThresholds.criticalViolationsLimit;
    this.incompleteThreshold = SCAN_CONFIG.decisionThresholds.incompleteResultsLimit;

    // Initialize learning and memory systems
    this.learningMemory = {
      patternHistory: new Map(),
      decisionOutcomes: new Map(),
      contextualPatterns: new Map(),
    };
    this.decisionHistory = new Map();
  }

  /**
   * Enhanced decision making with reasoning and adaptive logic
   */
  public makeDecisionWithReasoning(scanResult: PageScanResult): EnhancedPageDecision {
    const { url, violations, incomplete, error } = scanResult;

    // Collect reasoning factors
    const reasoningFactors: ReasoningFactor[] = [];

    // Handle scan errors with reasoning
    if (error) {
      return this.createErrorDecision(url, error);
    }

    // Analyze violations with contextual understanding
    const violationAnalysis = this.analyzeViolationsInContext(violations, incomplete);
    reasoningFactors.push(...violationAnalysis.factors);

    // Check historical patterns
    const historicalInsights = this.analyzeHistoricalPatterns(url, violations);
    reasoningFactors.push(...historicalInsights.factors);

    // Apply heuristic reasoning
    const heuristicAnalysis = this.applyHeuristicReasoning(violations, incomplete);
    reasoningFactors.push(...heuristicAnalysis.factors);

    // Calculate decision confidence scores
    const decisionScores = this.calculateDecisionScores(reasoningFactors, violations, incomplete);

    // Make primary decision with alternatives
    const primaryDecision = this.selectBestDecision(decisionScores);
    const alternatives = this.getAlternativeDecisions(decisionScores, primaryDecision.decision);

    // Generate contextual analysis
    const contextualAnalysis = this.generateContextualAnalysis(violations, reasoningFactors);

    // Learn from this decision
    const learningInsights = this.extractLearningInsights(url, violations, primaryDecision);
    this.updateLearningMemory(url, violations, primaryDecision);

    // Create reasoning object
    const reasoning: DecisionReasoning = {
      decision: primaryDecision.decision,
      confidence: primaryDecision.confidence,
      factors: reasoningFactors,
      contextualAnalysis,
      alternativeDecisions: alternatives,
      learningInsights,
    };

    // Generate adaptive suggestions
    const adaptiveSuggestions = this.generateAdaptiveSuggestions(violations, reasoning);

    // Identify uncertainty factors
    const uncertaintyFactors = this.identifyUncertaintyFactors(violations, incomplete, reasoning);

    // Check if this is a high-priority critical case
    const isHighPriority = reasoningFactors.some(
      f => f.evidence?.includes('high-priority') && f.description.includes('urgent Claude analysis')
    );

    // Build comprehensive decision
    const decision: EnhancedPageDecision = {
      url,
      category: primaryDecision.decision,
      reasoning,
      reason: this.generateEnhancedReason(primaryDecision, reasoningFactors),
      priority: this.calculateEnhancedPriority(violations, reasoning),
      estimatedEffort: this.estimateEffortWithLearning(violations, historicalInsights),
      complexViolations: this.getComplexViolations(violations).map(v => v.id),
      criticalViolations: this.getCriticalViolations(violations).map(v => v.id),
      adaptiveSuggestions,
      uncertaintyFactors,
      isHighPriority, // Add priority flag for critical pages
    };

    // Store decision for future learning
    this.storeDecision(url, decision);

    return decision;
  }

  /**
   * Analyze violations with contextual understanding
   */
  private analyzeViolationsInContext(
    violations: ViolationResult[],
    incomplete: ViolationResult[]
  ): { factors: ReasoningFactor[] } {
    const factors: ReasoningFactor[] = [];

    // Critical violations analysis
    const criticalViolations = this.getCriticalViolations(violations);
    if (criticalViolations.length > 0) {
      factors.push({
        type: 'violation',
        description: `Found ${criticalViolations.length} critical violations requiring immediate attention`,
        weight: 0.9,
        evidence: criticalViolations.map(v => `${v.id}: ${v.help}`),
      });
    }

    // Complex pattern detection
    const complexPatterns = this.detectComplexPatterns(violations);
    if (complexPatterns.length > 0) {
      factors.push({
        type: 'pattern',
        description: 'Detected complex accessibility patterns requiring human analysis',
        weight: 0.8,
        evidence: complexPatterns,
      });
    }

    // Incomplete results analysis
    if (incomplete.length > this.incompleteThreshold) {
      factors.push({
        type: 'context',
        description: `High number of incomplete results (${incomplete.length}) suggests dynamic content issues`,
        weight: 0.7,
        evidence: incomplete.slice(0, 5).map(i => i.id),
      });
    }

    // Cross-violation relationships
    const relationships = this.analyzeViolationRelationships(violations);
    if (relationships.length > 0) {
      factors.push({
        type: 'pattern',
        description: 'Detected interrelated violations that compound accessibility barriers',
        weight: 0.75,
        evidence: relationships,
      });
    }

    return { factors };
  }

  /**
   * Detect complex patterns in violations
   */
  private detectComplexPatterns(violations: ViolationResult[]): string[] {
    const patterns: string[] = [];

    // Focus management pattern
    const focusViolations = violations.filter(
      v => v.id.includes('focus') || v.id.includes('keyboard')
    );
    if (focusViolations.length >= 3) {
      patterns.push('Systemic focus management issues detected across multiple components');
    }

    // ARIA misuse pattern
    const ariaViolations = violations.filter(v => v.id.includes('aria'));
    const semanticViolations = violations.filter(
      v => v.id.includes('semantic') || v.id.includes('role')
    );
    if (ariaViolations.length > 0 && semanticViolations.length > 0) {
      patterns.push('ARIA overuse pattern - native semantic elements may be more appropriate');
    }

    // Form accessibility pattern
    const formRelated = violations.filter(
      v =>
        v.id.includes('label') ||
        v.id.includes('input') ||
        v.id.includes('form') ||
        v.nodes.some(n => n.html.includes('<form') || n.html.includes('<input'))
    );
    if (formRelated.length >= 4) {
      patterns.push('Comprehensive form accessibility issues requiring holistic review');
    }

    // Navigation pattern
    const navRelated = violations.filter(
      v =>
        v.id.includes('landmark') ||
        v.id.includes('heading') ||
        v.id.includes('bypass') ||
        v.id.includes('navigation')
    );
    if (navRelated.length >= 3) {
      patterns.push('Page navigation and structure issues affecting user orientation');
    }

    return patterns;
  }

  /**
   * Analyze relationships between violations
   */
  private analyzeViolationRelationships(violations: ViolationResult[]): string[] {
    const relationships: string[] = [];

    // Color contrast + focus indicators
    const hasColorContrast = violations.some(v => v.id.includes('color-contrast'));
    const hasFocusVisible = violations.some(v => v.id.includes('focus-visible'));
    if (hasColorContrast && hasFocusVisible) {
      relationships.push(
        'Color contrast and focus visibility issues may share root cause in design system'
      );
    }

    // Missing labels + ARIA
    const hasLabelIssues = violations.some(v => v.id.includes('label'));
    const hasAriaIssues = violations.some(v => v.id.includes('aria-label'));
    if (hasLabelIssues && hasAriaIssues) {
      relationships.push('Labeling strategy inconsistency between native and ARIA approaches');
    }

    // Keyboard navigation + skip links
    const hasKeyboardIssues = violations.some(v => v.id.includes('keyboard'));
    const hasSkipIssues = violations.some(v => v.id.includes('skip') || v.id.includes('bypass'));
    if (hasKeyboardIssues && !hasSkipIssues) {
      relationships.push(
        'Keyboard navigation issues without proper skip mechanisms compounds barriers'
      );
    }

    return relationships;
  }

  /**
   * Apply heuristic reasoning based on patterns and best practices
   */
  private applyHeuristicReasoning(
    violations: ViolationResult[],
    _incomplete: ViolationResult[]
  ): { factors: ReasoningFactor[] } {
    const factors: ReasoningFactor[] = [];

    // Heuristic: High impact-to-node ratio suggests systemic issues
    // const highImpactViolations = violations.filter(v => v.impact === 'critical' || v.impact === 'serious');
    const totalNodes = violations.reduce((sum, v) => sum + v.nodes.length, 0);
    const avgNodesPerViolation = totalNodes / violations.length;

    if (avgNodesPerViolation > 5) {
      factors.push({
        type: 'heuristic',
        description: 'High node-per-violation ratio suggests systemic implementation issues',
        weight: 0.6,
        evidence: [`Average ${avgNodesPerViolation.toFixed(1)} elements affected per violation`],
      });
    }

    // Heuristic: Certain violation combinations indicate poor accessibility foundation
    const foundationalIssues = violations.filter(
      v =>
        v.id.includes('html-has-lang') ||
        v.id.includes('document-title') ||
        v.id.includes('landmark') ||
        v.id.includes('heading-order')
    );

    if (foundationalIssues.length >= 2) {
      factors.push({
        type: 'heuristic',
        description: 'Foundational accessibility issues suggest need for comprehensive review',
        weight: 0.7,
        evidence: foundationalIssues.map(v => v.id),
      });
    }

    // Heuristic: Interactive element violations clustered together
    const interactiveViolations = violations.filter(v =>
      v.nodes.some(
        n =>
          n.html.includes('button') ||
          n.html.includes('link') ||
          n.html.includes('input') ||
          n.html.includes('select')
      )
    );

    if (interactiveViolations.length / violations.length > 0.6) {
      factors.push({
        type: 'heuristic',
        description:
          'Majority of violations on interactive elements indicates UX accessibility gaps',
        weight: 0.65,
        evidence: [
          `${interactiveViolations.length} of ${violations.length} violations affect interactive elements`,
        ],
      });
    }

    return { factors };
  }

  /**
   * Calculate decision scores based on all factors
   */
  private calculateDecisionScores(
    factors: ReasoningFactor[],
    violations: ViolationResult[],
    _incomplete: ViolationResult[]
  ): Map<keyof typeof DECISION_CATEGORIES, number> {
    const scores = new Map<keyof typeof DECISION_CATEGORIES, number>();

    // Initialize scores
    scores.set('PASSED', violations.length === 0 ? 1.0 : 0.0);
    scores.set('MINOR_ISSUES', 0.3);
    scores.set('CLAUDE_NEEDED', 0.2);
    scores.set('CRITICAL', 0.1);

    // Check for critical violations threshold
    const criticalViolations = this.getCriticalViolations(violations);
    if (criticalViolations.length >= this.criticalThreshold) {
      // IMPORTANT: Critical pages should go to Claude for comprehensive analysis
      scores.set('CLAUDE_NEEDED', 0.98); // Very high score for Claude analysis
      scores.set('CRITICAL', 0.0); // Don't bypass Claude
      scores.set('MINOR_ISSUES', 0.0);
      scores.set('PASSED', 0.0);

      // Add high priority flag to factors
      factors.push({
        type: 'violation',
        description: `${criticalViolations.length} critical violations require urgent Claude analysis`,
        weight: 1.0,
        evidence: ['high-priority'],
        impact: 'critical',
      });

      return scores;
    }

    // Adjust scores based on factors
    for (const factor of factors) {
      const weight = factor.weight;

      if (factor.type === 'violation' && factor.description.includes('critical')) {
        scores.set('CRITICAL', (scores.get('CRITICAL') || 0) + weight);
        scores.set('CLAUDE_NEEDED', (scores.get('CLAUDE_NEEDED') || 0) + weight * 0.5);
      } else if (factor.type === 'pattern' || factor.description.includes('complex')) {
        scores.set('CLAUDE_NEEDED', (scores.get('CLAUDE_NEEDED') || 0) + weight);
        scores.set('MINOR_ISSUES', (scores.get('MINOR_ISSUES') || 0) - weight * 0.3);
      } else if (factor.type === 'heuristic') {
        scores.set('CLAUDE_NEEDED', (scores.get('CLAUDE_NEEDED') || 0) + weight * 0.7);
        scores.set('CRITICAL', (scores.get('CRITICAL') || 0) + weight * 0.3);
      }
    }

    // Normalize scores
    const total = Array.from(scores.values()).reduce((sum, score) => sum + score, 0);
    if (total > 0) {
      for (const [key, value] of scores.entries()) {
        scores.set(key, value / total);
      }
    }

    return scores;
  }

  /**
   * Select best decision based on scores and confidence
   */
  private selectBestDecision(scores: Map<keyof typeof DECISION_CATEGORIES, number>): {
    decision: keyof typeof DECISION_CATEGORIES;
    confidence: number;
  } {
    let bestDecision: keyof typeof DECISION_CATEGORIES = 'MINOR_ISSUES';
    let highestScore = 0;

    for (const [decision, score] of scores.entries()) {
      if (score > highestScore) {
        highestScore = score;
        bestDecision = decision;
      }
    }

    // Calculate confidence based on score distribution
    const sortedScores = Array.from(scores.values()).sort((a, b) => b - a);
    const confidence = sortedScores[0] - sortedScores[1]; // Gap between top two choices

    return { decision: bestDecision, confidence: Math.min(confidence * 2, 1) }; // Scale confidence to 0-1
  }

  /**
   * Get alternative decisions with reasoning
   */
  private getAlternativeDecisions(
    scores: Map<keyof typeof DECISION_CATEGORIES, number>,
    primaryDecision: keyof typeof DECISION_CATEGORIES
  ): AlternativeDecision[] {
    const alternatives: AlternativeDecision[] = [];

    for (const [decision, score] of scores.entries()) {
      if (decision !== primaryDecision && score > 0.2) {
        alternatives.push({
          decision,
          confidence: score,
          rationale: this.generateAlternativeRationale(decision, score),
        });
      }
    }

    return alternatives.sort((a, b) => b.confidence - a.confidence).slice(0, 2);
  }

  /**
   * Generate rationale for alternative decisions
   */
  private generateAlternativeRationale(
    decision: keyof typeof DECISION_CATEGORIES,
    score: number
  ): string {
    const rationales: Record<keyof typeof DECISION_CATEGORIES, string> = {
      PASSED: 'No significant violations detected that would fail WCAG criteria',
      MINOR_ISSUES: 'Violations are primarily auto-fixable with clear remediation paths',
      CLAUDE_NEEDED:
        'Complex patterns suggest human-level analysis would provide valuable insights',
      CRITICAL: 'Severity and scope of violations may warrant immediate attention',
    };

    return `${rationales[decision]} (confidence: ${(score * 100).toFixed(0)}%)`;
  }

  /**
   * Generate contextual analysis narrative
   */
  private generateContextualAnalysis(
    violations: ViolationResult[],
    factors: ReasoningFactor[]
  ): string {
    const criticalCount = violations.filter(v => v.impact === 'critical').length;
    const seriousCount = violations.filter(v => v.impact === 'serious').length;
    const patternFactors = factors.filter(f => f.type === 'pattern');

    let analysis = `Page exhibits ${violations.length} accessibility violations`;

    if (criticalCount > 0 || seriousCount > 0) {
      analysis += ` including ${criticalCount} critical and ${seriousCount} serious issues`;
    }

    if (patternFactors.length > 0) {
      analysis += `. Detected ${patternFactors.length} complex patterns: ${patternFactors.map(f => f.description).join('; ')}`;
    }

    const affectedElements = violations.reduce((sum, v) => sum + v.nodes.length, 0);
    analysis += `. Total ${affectedElements} page elements affected`;

    const wcagCategories = new Set(violations.flatMap(v => v.tags.filter(t => t.includes('wcag'))));
    if (wcagCategories.size > 0) {
      analysis += `, spanning ${wcagCategories.size} WCAG criteria categories`;
    }

    return analysis + '.';
  }

  /**
   * Extract learning insights from decision
   */
  private extractLearningInsights(
    url: string,
    violations: ViolationResult[],
    decision: { decision: keyof typeof DECISION_CATEGORIES; confidence: number }
  ): string[] {
    const insights: string[] = [];

    // Pattern recognition insights
    const domain = new URL(url).hostname;
    const domainHistory = this.learningMemory.patternHistory.get(domain) || [];

    if (domainHistory.length > 0) {
      const commonViolations = this.findCommonViolations(domainHistory);
      if (commonViolations.length > 0) {
        insights.push(`Recurring violations on ${domain}: ${commonViolations.join(', ')}`);
      }
    }

    // Decision confidence insights
    if (decision.confidence < 0.6) {
      insights.push('Low decision confidence suggests edge case - good candidate for human review');
    } else if (decision.confidence > 0.9) {
      insights.push('High confidence decision based on clear violation patterns');
    }

    // Violation clustering insights
    const violationClusters = this.identifyViolationClusters(violations);
    if (violationClusters.length > 0) {
      insights.push(`Violations cluster around: ${violationClusters.join(', ')}`);
    }

    return insights;
  }

  /**
   * Update learning memory with new decision
   */
  private updateLearningMemory(
    url: string,
    violations: ViolationResult[],
    decision: { decision: keyof typeof DECISION_CATEGORIES; confidence: number }
  ): void {
    const domain = new URL(url).hostname;

    // Update pattern history
    const patternHistory = this.learningMemory.patternHistory.get(domain) || [];
    patternHistory.push({
      url,
      timestamp: new Date().toISOString(),
      violationTypes: violations.map(v => v.id),
      decision: decision.decision,
    });
    this.learningMemory.patternHistory.set(domain, patternHistory);

    // Update decision outcomes
    const decisionKey = `${domain}-${decision.decision}`;
    const outcomes = this.learningMemory.decisionOutcomes.get(decisionKey) || [];
    outcomes.push({
      url,
      predictedCategory: decision.decision,
      timestamp: new Date().toISOString(),
    });
    this.learningMemory.decisionOutcomes.set(decisionKey, outcomes);

    // Update contextual patterns
    this.updateContextualPatterns(url, violations, decision.decision);
  }

  /**
   * Update contextual patterns for page types
   */
  private updateContextualPatterns(
    url: string,
    violations: ViolationResult[],
    decision: string
  ): void {
    const pageType = this.identifyPageType(url, violations);
    const patterns = this.learningMemory.contextualPatterns.get(pageType) || [];

    const existingPattern = patterns.find(p => p.pageType === pageType);
    if (existingPattern) {
      // Update existing pattern
      existingPattern.commonViolations = this.mergeViolationTypes(
        existingPattern.commonViolations,
        violations.map(v => v.id)
      );
      existingPattern.confidence = Math.min(existingPattern.confidence + 0.05, 1);
    } else {
      // Create new pattern
      patterns.push({
        pageType,
        commonViolations: violations.map(v => v.id),
        typicalDecision: decision,
        confidence: 0.5,
      });
    }

    this.learningMemory.contextualPatterns.set(pageType, patterns);
  }

  /**
   * Identify page type based on URL and violations
   */
  private identifyPageType(url: string, violations: ViolationResult[]): string {
    const urlPath = new URL(url).pathname.toLowerCase();

    if (
      urlPath.includes('form') ||
      violations.some(v => v.nodes.some(n => n.html.includes('<form')))
    ) {
      return 'form-page';
    } else if (urlPath.includes('search') || urlPath.includes('results')) {
      return 'search-page';
    } else if (urlPath === '/' || urlPath.includes('home') || urlPath.includes('index')) {
      return 'homepage';
    } else if (urlPath.includes('product') || urlPath.includes('item')) {
      return 'product-page';
    } else if (urlPath.includes('cart') || urlPath.includes('checkout')) {
      return 'checkout-page';
    } else if (
      urlPath.includes('article') ||
      urlPath.includes('blog') ||
      urlPath.includes('post')
    ) {
      return 'content-page';
    }

    return 'generic-page';
  }

  /**
   * Generate adaptive suggestions based on patterns and learning
   */
  private generateAdaptiveSuggestions(
    violations: ViolationResult[],
    reasoning: DecisionReasoning
  ): string[] {
    const suggestions: string[] = [];

    // Suggest automated fixes for common patterns
    const autoFixableViolations = violations.filter(
      v => v.id.includes('image-alt') || v.id.includes('label') || v.id.includes('html-has-lang')
    );

    if (autoFixableViolations.length > 0) {
      suggestions.push(
        `${autoFixableViolations.length} violations can be auto-remediated with simple fixes`
      );
    }

    // Suggest design system improvements
    const designSystemIssues = violations.filter(
      v => v.nodes.length > 10 && (v.id.includes('color') || v.id.includes('focus'))
    );

    if (designSystemIssues.length > 0) {
      suggestions.push('Consider updating design system components to address systemic issues');
    }

    // Suggest testing improvements based on patterns
    if (reasoning.confidence < 0.7) {
      suggestions.push(
        'Add automated accessibility tests to catch these issues earlier in development'
      );
    }

    // Context-aware suggestions
    if (reasoning.factors.some(f => f.type === 'pattern' && f.description.includes('form'))) {
      suggestions.push('Implement form accessibility checklist for consistent form handling');
    }

    return suggestions;
  }

  /**
   * Identify factors contributing to decision uncertainty
   */
  private identifyUncertaintyFactors(
    violations: ViolationResult[],
    incomplete: ViolationResult[],
    reasoning: DecisionReasoning
  ): string[] {
    const factors: string[] = [];

    if (reasoning.confidence < 0.6) {
      factors.push('Low confidence score indicates ambiguous violation patterns');
    }

    if (incomplete.length > violations.length * 0.5) {
      factors.push(
        'High ratio of incomplete to complete violations suggests dynamic content complexity'
      );
    }

    if (reasoning.alternativeDecisions.some(a => a.confidence > 0.4)) {
      factors.push('Multiple viable decision paths with similar confidence levels');
    }

    const mixedImpacts = new Set(violations.map(v => v.impact)).size;
    if (mixedImpacts >= 3) {
      factors.push('Wide range of violation severities makes prioritization challenging');
    }

    return factors;
  }

  /**
   * Helper methods from original implementation
   */
  private getCriticalViolations(violations: ViolationResult[]): ViolationResult[] {
    return violations.filter(
      violation => violation.impact === 'critical' || violation.impact === 'serious'
    );
  }

  private getComplexViolations(violations: ViolationResult[]): ViolationResult[] {
    return violations.filter(violation =>
      this.complexIssues.some(
        complexIssue => violation.id.includes(complexIssue) || violation.tags.includes(complexIssue)
      )
    );
  }

  private findCommonViolations(history: PatternOccurrence[]): string[] {
    const violationCounts = new Map<string, number>();

    history.forEach(occurrence => {
      occurrence.violationTypes.forEach(type => {
        violationCounts.set(type, (violationCounts.get(type) || 0) + 1);
      });
    });

    return Array.from(violationCounts.entries())
      .filter(([_, count]) => count >= history.length * 0.5)
      .map(([type, _]) => type);
  }

  private identifyViolationClusters(violations: ViolationResult[]): string[] {
    const clusters: string[] = [];

    const formCluster = violations.filter(
      v => v.id.includes('label') || v.id.includes('input') || v.id.includes('form')
    ).length;

    if (formCluster >= 3) clusters.push('form accessibility');

    const navigationCluster = violations.filter(
      v => v.id.includes('landmark') || v.id.includes('heading') || v.id.includes('skip')
    ).length;

    if (navigationCluster >= 3) clusters.push('navigation structure');

    const interactiveCluster = violations.filter(
      v => v.id.includes('focus') || v.id.includes('keyboard') || v.id.includes('click')
    ).length;

    if (interactiveCluster >= 3) clusters.push('interactive elements');

    return clusters;
  }

  private mergeViolationTypes(existing: string[], new_: string[]): string[] {
    const merged = new Set([...existing, ...new_]);
    return Array.from(merged);
  }

  private generateEnhancedReason(
    decision: { decision: keyof typeof DECISION_CATEGORIES; confidence: number },
    factors: ReasoningFactor[]
  ): string {
    const topFactors = factors
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(f => f.description);

    return `${DECISION_CATEGORIES[decision.decision]} (${(decision.confidence * 100).toFixed(0)}% confidence). Key factors: ${topFactors.join('; ')}`;
  }

  private calculateEnhancedPriority(
    violations: ViolationResult[],
    reasoning: DecisionReasoning
  ): 'Low' | 'Medium' | 'High' | 'Critical' {
    const criticalCount = violations.filter(v => v.impact === 'critical').length;
    const seriousCount = violations.filter(v => v.impact === 'serious').length;

    // Factor in reasoning confidence
    if (reasoning.confidence < 0.5 && (criticalCount > 0 || seriousCount > 2)) {
      return 'Critical'; // Low confidence + serious issues = needs immediate attention
    }

    if (criticalCount > 0) return 'Critical';
    if (seriousCount >= 3 || (seriousCount >= 1 && violations.length >= 10)) return 'High';
    if (seriousCount >= 1 || violations.length >= 5) return 'Medium';

    return 'Low';
  }

  private estimateEffortWithLearning(
    violations: ViolationResult[],
    historicalInsights: { factors: ReasoningFactor[] }
  ): string {
    const baseEstimate = this.calculateBaseEffort(violations);

    // Adjust based on historical patterns
    const hasRecurringIssues = historicalInsights.factors.some(
      f => f.type === 'historical' && f.description.includes('recurring')
    );

    if (hasRecurringIssues) {
      // Increase estimate for recurring issues
      return this.adjustEffortEstimate(baseEstimate, 1.5);
    }

    return baseEstimate;
  }

  private calculateBaseEffort(violations: ViolationResult[]): string {
    const totalNodes = violations.reduce((sum, v) => sum + v.nodes.length, 0);
    const complexViolations = this.getComplexViolations(violations);
    const criticalViolations = this.getCriticalViolations(violations);

    let hours = 0;
    hours += criticalViolations.length * 2;
    hours += complexViolations.length * 3;
    hours += (violations.length - criticalViolations.length - complexViolations.length) * 0.5;
    hours += Math.max(0, totalNodes - violations.length) * 0.25;

    if (hours <= 1) return '0.5-1 hours';
    if (hours <= 2) return '1-2 hours';
    if (hours <= 4) return '2-4 hours';
    if (hours <= 8) return '4-8 hours';
    if (hours <= 16) return '8-16 hours';
    return '16+ hours';
  }

  private adjustEffortEstimate(baseEstimate: string, multiplier: number): string {
    const ranges: Record<string, [number, number]> = {
      '0.5-1 hours': [0.5, 1],
      '1-2 hours': [1, 2],
      '2-4 hours': [2, 4],
      '4-8 hours': [4, 8],
      '8-16 hours': [8, 16],
      '16+ hours': [16, 32],
    };

    const range = ranges[baseEstimate] || [1, 2];
    // const adjustedMin = range[0] * multiplier;
    const adjustedMax = range[1] * multiplier;

    if (adjustedMax <= 1) return '0.5-1 hours';
    if (adjustedMax <= 2) return '1-2 hours';
    if (adjustedMax <= 4) return '2-4 hours';
    if (adjustedMax <= 8) return '4-8 hours';
    if (adjustedMax <= 16) return '8-16 hours';
    return '16+ hours';
  }

  private createErrorDecision(url: string, error: string): EnhancedPageDecision {
    const reasoning: DecisionReasoning = {
      decision: 'CRITICAL',
      confidence: 1.0,
      factors: [
        {
          type: 'violation',
          description: `Scan failed with error: ${error}`,
          weight: 1.0,
          evidence: [error],
        },
      ],
      contextualAnalysis: 'Page scan failed, preventing accessibility assessment',
      alternativeDecisions: [],
      learningInsights: ['Scan failures require manual investigation'],
    };

    return {
      url,
      category: 'CRITICAL',
      reasoning,
      reason: `Scan failed: ${error}`,
      priority: 'Critical',
      estimatedEffort: '2-4 hours',
      complexViolations: [],
      criticalViolations: ['scan-error'],
      adaptiveSuggestions: [
        'Investigate scan failure cause',
        'Consider manual accessibility review',
      ],
      uncertaintyFactors: ['Unable to assess actual accessibility status due to scan failure'],
    };
  }

  private storeDecision(url: string, decision: EnhancedPageDecision): void {
    const domain = new URL(url).hostname;
    const decisions = this.decisionHistory.get(domain) || [];
    decisions.push(decision);
    this.decisionHistory.set(domain, decisions);
  }

  private analyzeHistoricalPatterns(
    url: string,
    _violations: ViolationResult[]
  ): { factors: ReasoningFactor[] } {
    const factors: ReasoningFactor[] = [];
    const domain = new URL(url).hostname;

    const history = this.learningMemory.patternHistory.get(domain) || [];
    if (history.length > 0) {
      const commonViolations = this.findCommonViolations(history);
      if (commonViolations.length > 0) {
        factors.push({
          type: 'historical',
          description: `Domain shows recurring violations: ${commonViolations.slice(0, 3).join(', ')}`,
          weight: 0.5,
          evidence: [`${history.length} previous scans analyzed`],
        });
      }
    }

    return { factors };
  }

  /**
   * Public method to update decision outcome with feedback
   */
  public provideFeedback(
    url: string,
    actualCategory: keyof typeof DECISION_CATEGORIES,
    feedback: string
  ): void {
    const domain = new URL(url).hostname;
    const decisions = this.decisionHistory.get(domain) || [];
    const lastDecision = decisions[decisions.length - 1];

    if (lastDecision && lastDecision.url === url) {
      const decisionKey = `${domain}-${lastDecision.category}`;
      const outcomes = this.learningMemory.decisionOutcomes.get(decisionKey) || [];
      const lastOutcome = outcomes[outcomes.length - 1];

      if (lastOutcome) {
        lastOutcome.actualCategory = actualCategory;
        lastOutcome.feedback = feedback;

        // Update pattern history with correctness
        const patternHistory = this.learningMemory.patternHistory.get(domain) || [];
        const lastPattern = patternHistory[patternHistory.length - 1];
        if (lastPattern) {
          lastPattern.wasCorrect = actualCategory === lastDecision.category;
        }
      }
    }
  }

  /**
   * Export learning insights for analysis
   */
  public exportLearningInsights(): {
    domainPatterns: Array<{ domain: string; patterns: PatternOccurrence[] }>;
    decisionAccuracy: Array<{ decision: string; accuracy: number }>;
    contextualPatterns: ContextPattern[];
  } {
    const domainPatterns = Array.from(this.learningMemory.patternHistory.entries()).map(
      ([domain, patterns]) => ({
        domain,
        patterns,
      })
    );

    const decisionAccuracy = Array.from(this.learningMemory.decisionOutcomes.entries()).map(
      ([key, outcomes]) => {
        const correct = outcomes.filter(o => o.actualCategory === o.predictedCategory).length;
        const total = outcomes.filter(o => o.actualCategory !== undefined).length;
        return {
          decision: key,
          accuracy: total > 0 ? correct / total : 0,
        };
      }
    );

    const contextualPatterns = Array.from(this.learningMemory.contextualPatterns.values()).flat();

    return { domainPatterns, decisionAccuracy, contextualPatterns };
  }
}

export default EnhancedDecisionAgent;
