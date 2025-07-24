import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { EnhancedDecisionAgent } from '../../src/agents/enhanced-decision-agent-fixed';
import { PageScanResult, ViolationResult } from '../../src/types/accessibility-types';
import { DecisionCategory } from '../../src/types/claude-types';

describe('EnhancedDecisionAgent', () => {
  let agent: EnhancedDecisionAgent;

  beforeEach(() => {
    agent = new EnhancedDecisionAgent();
    // Clear any previous learning memory
    agent['learningMemory'] = {
      patternHistory: new Map(),
      decisionOutcomes: [],
      contextualPatterns: new Map()
    };
  });

  describe('makeEnhancedDecision', () => {
    it('should categorize page with no violations as PASSED with 100% confidence', () => {
      const scanResult: PageScanResult = {
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 1000,
      };

      const decision = agent.makeEnhancedDecision(scanResult);

      expect(decision.decision).toBe('PASSED');
      expect(decision.confidence).toBe(1.0);
      expect(decision.reasoning.factors).toHaveLength(1);
      expect(decision.reasoning.factors[0].description).toContain('No violations found');
    });

    it('should categorize page with color contrast issues as CLAUDE_NEEDED', () => {
      const colorContrastViolation: ViolationResult = {
        id: 'color-contrast',
        impact: 'serious',
        tags: ['wcag2aa', 'wcag143'],
        description: 'Elements must have sufficient color contrast',
        help: 'Ensures the contrast between foreground and background colors meets WCAG 2 AA contrast ratio thresholds',
        helpUrl: 'https://dequeuniversity.com/rules/axe/4.4/color-contrast',
        nodes: [
          {
            any: [],
            all: [{
              id: 'color-contrast',
              data: { fgColor: '#666666', bgColor: '#ffffff', contrastRatio: 4.5 },
              relatedNodes: [],
              impact: 'serious',
              message: 'Element has insufficient color contrast'
            }],
            none: [],
            impact: 'serious',
            html: '<p>Sample text</p>',
            target: ['p']
          }
        ],
      };

      const scanResult: PageScanResult = {
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        violations: [colorContrastViolation],
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 1000,
      };

      const decision = agent.makeEnhancedDecision(scanResult);

      expect(decision.decision).toBe('CLAUDE_NEEDED');
      expect(decision.confidence).toBeGreaterThan(0.5);
      expect(decision.reasoning.contextualAnalysis).toContain('color contrast');
    });

    it('should categorize page with 5+ critical violations as CRITICAL', () => {
      const criticalViolations: ViolationResult[] = Array(6).fill(null).map((_, i) => ({
        id: `critical-issue-${i}`,
        impact: 'critical',
        tags: ['wcag2aa'],
        description: `Critical issue ${i}`,
        help: `Fix critical issue ${i}`,
        helpUrl: 'https://example.com/help',
        nodes: [],
      }));

      const scanResult: PageScanResult = {
        url: 'https://example.com',
        timestamp: new Date().toISOString(),
        violations: criticalViolations,
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 1000,
      };

      const decision = agent.makeEnhancedDecision(scanResult);

      expect(decision.decision).toBe('CRITICAL');
      expect(decision.reasoning.factors.some(f => f.impact === 'critical')).toBe(true);
    });

    it('should detect form accessibility patterns', () => {
      const formViolations: ViolationResult[] = [
        {
          id: 'label',
          impact: 'critical',
          tags: ['wcag2a'],
          description: 'Form elements must have labels',
          help: 'Form elements must have labels',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
        {
          id: 'aria-input-field-name',
          impact: 'serious',
          tags: ['wcag2a'],
          description: 'ARIA input fields must have an accessible name',
          help: 'ARIA input fields must have an accessible name',
          helpUrl: 'https://example.com/help',
          nodes: [],
        }
      ];

      const scanResult: PageScanResult = {
        url: 'https://example.com/form',
        timestamp: new Date().toISOString(),
        violations: formViolations,
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 1000,
      };

      const decision = agent.makeEnhancedDecision(scanResult);
      const patterns = agent['detectComplexPatterns'](formViolations);

      expect(patterns).toContain('form-accessibility-issues');
      expect(decision.decision).toBe('CLAUDE_NEEDED');
    });

    it('should use learning history to adjust confidence', () => {
      // Simulate previous pattern history
      const domain = 'example.com';
      agent['learningMemory'].patternHistory.set(domain, [
        {
          timestamp: new Date().toISOString(),
          patterns: ['color-contrast-issues'],
          violationCount: 3,
          decision: 'CLAUDE_NEEDED' as DecisionCategory,
          confidence: 0.8
        }
      ]);

      const scanResult: PageScanResult = {
        url: `https://${domain}/page2`,
        timestamp: new Date().toISOString(),
        violations: [{
          id: 'color-contrast',
          impact: 'serious',
          tags: ['wcag2aa'],
          description: 'Color contrast issue',
          help: 'Fix color contrast',
          helpUrl: 'https://example.com/help',
          nodes: [],
        }],
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 1000,
      };

      const decision = agent.makeEnhancedDecision(scanResult);

      // Should have learning insights based on history
      expect(decision.reasoning.learningInsights.length).toBeGreaterThan(0);
      expect(decision.reasoning.learningInsights[0]).toContain('Previous patterns detected');
    });
  });

  describe('categorizeEnhancedPages', () => {
    it('should categorize multiple pages and track patterns', () => {
      const scanResults: PageScanResult[] = [
        {
          url: 'https://example.com/1',
          timestamp: new Date().toISOString(),
          violations: [],
          passes: [],
          incomplete: [],
          inapplicable: [],
          scanDuration: 1000,
        },
        {
          url: 'https://example.com/2',
          timestamp: new Date().toISOString(),
          violations: [{
            id: 'focus-visible',
            impact: 'serious',
            tags: ['wcag2aa'],
            description: 'Focus must be visible',
            help: 'Ensure focus is visible',
            helpUrl: 'https://example.com/help',
            nodes: [],
          }],
          passes: [],
          incomplete: [],
          inapplicable: [],
          scanDuration: 1000,
        },
      ];

      const result = agent.categorizeEnhancedPages(scanResults);

      expect(result.passed).toHaveLength(1);
      expect(result.claudeNeeded).toHaveLength(1);
      expect(result.summary.overallConfidence).toBeGreaterThan(0);
      
      // Check that patterns were recorded
      const patterns = agent['learningMemory'].patternHistory.get('example.com');
      expect(patterns).toBeDefined();
      expect(patterns!.length).toBeGreaterThan(0);
    });
  });

  describe('detectComplexPatterns', () => {
    it('should detect navigation structure issues', () => {
      const navViolations: ViolationResult[] = [
        {
          id: 'landmark-one-main',
          impact: 'moderate',
          tags: ['wcag2a'],
          description: 'Document should have one main landmark',
          help: 'Document should have one main landmark',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
        {
          id: 'region',
          impact: 'moderate',
          tags: ['wcag2a'],
          description: 'All page content should be contained by landmarks',
          help: 'All page content should be contained by landmarks',
          helpUrl: 'https://example.com/help',
          nodes: [],
        }
      ];

      const patterns = agent['detectComplexPatterns'](navViolations);

      expect(patterns).toContain('navigation-structure-issues');
    });

    it('should detect ARIA misuse patterns', () => {
      const ariaViolations: ViolationResult[] = [
        {
          id: 'aria-valid-attr',
          impact: 'critical',
          tags: ['wcag2a'],
          description: 'ARIA attributes must conform to valid names',
          help: 'ARIA attributes must conform to valid names',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
        {
          id: 'aria-allowed-role',
          impact: 'serious',
          tags: ['wcag2a'],
          description: 'ARIA role must be valid for element',
          help: 'ARIA role must be valid for element',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
        {
          id: 'aria-hidden-focus',
          impact: 'serious',
          tags: ['wcag2a'],
          description: 'ARIA hidden element must not be focusable',
          help: 'ARIA hidden element must not be focusable',
          helpUrl: 'https://example.com/help',
          nodes: [],
        }
      ];

      const patterns = agent['detectComplexPatterns'](ariaViolations);

      expect(patterns).toContain('aria-misuse');
    });
  });
});