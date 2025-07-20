import { describe, it, expect, beforeEach } from '@jest/globals';
import { DecisionAgent } from '../src/agents/decision-agent';
import { PageScanResult, ViolationResult } from '../src/types/accessibility-types';

describe('DecisionAgent', () => {
  let decisionAgent: DecisionAgent;

  beforeEach(() => {
    decisionAgent = new DecisionAgent();
  });

  describe('makeDecision', () => {
    it('should categorize page with no violations as PASSED', () => {
      const scanResult: PageScanResult = {
        url: 'https://example.com',
        timestamp: '2023-01-01T00:00:00.000Z',
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 1000,
      };

      const decision = decisionAgent.makeDecision(scanResult);

      expect(decision.category).toBe('PASSED');
      expect(decision.priority).toBe('Low');
      expect(decision.estimatedEffort).toBe('0 hours');
    });

    it('should categorize page with many critical violations as CRITICAL', () => {
      const criticalViolations: ViolationResult[] = [
        {
          id: 'missing-alt-text',
          impact: 'critical',
          tags: ['wcag2aa'],
          description: 'Critical alt text issue',
          help: 'Add alt text',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
        {
          id: 'missing-heading',
          impact: 'critical',
          tags: ['wcag2aa'],
          description: 'Critical heading issue',
          help: 'Add headings',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
        {
          id: 'missing-labels',
          impact: 'critical',
          tags: ['wcag2aa'],
          description: 'Critical label issue',
          help: 'Add labels',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
        {
          id: 'missing-landmarks',
          impact: 'critical',
          tags: ['wcag2aa'],
          description: 'Critical landmark issue',
          help: 'Add landmarks',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
        {
          id: 'missing-roles',
          impact: 'critical',
          tags: ['wcag2aa'],
          description: 'Critical role issue',
          help: 'Add roles',
          helpUrl: 'https://example.com/help',
          nodes: [],
        },
      ];

      const scanResult: PageScanResult = {
        url: 'https://example.com',
        timestamp: '2023-01-01T00:00:00.000Z',
        violations: criticalViolations,
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 1000,
      };

      const decision = decisionAgent.makeDecision(scanResult);

      expect(decision.category).toBe('CRITICAL');
      expect(decision.priority).toBe('Critical');
      expect(decision.criticalViolations).toContain('missing-alt-text');
    });

    it('should categorize page with complex issues as CLAUDE_NEEDED', () => {
      const complexViolation: ViolationResult = {
        id: 'focus-order-semantics',
        impact: 'serious',
        tags: ['wcag2aa'],
        description: 'Focus order issue',
        help: 'Fix focus order',
        helpUrl: 'https://example.com/help',
        nodes: [],
      };

      const scanResult: PageScanResult = {
        url: 'https://example.com',
        timestamp: '2023-01-01T00:00:00.000Z',
        violations: [complexViolation],
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 1000,
      };

      const decision = decisionAgent.makeDecision(scanResult);

      expect(decision.category).toBe('CLAUDE_NEEDED');
      expect(decision.complexViolations).toContain('focus-order-semantics');
    });

    it('should handle scan errors correctly', () => {
      const scanResult: PageScanResult = {
        url: 'https://example.com',
        timestamp: '2023-01-01T00:00:00.000Z',
        violations: [],
        passes: [],
        incomplete: [],
        inapplicable: [],
        scanDuration: 0,
        error: 'Network timeout',
      };

      const decision = decisionAgent.makeDecision(scanResult);

      expect(decision.category).toBe('CRITICAL');
      expect(decision.reason).toContain('Scan failed: Network timeout');
    });
  });

  describe('categorizePages', () => {
    it('should categorize multiple pages correctly', () => {
      const scanResults: PageScanResult[] = [
        {
          url: 'https://example.com/1',
          timestamp: '2023-01-01T00:00:00.000Z',
          violations: [],
          passes: [],
          incomplete: [],
          inapplicable: [],
          scanDuration: 1000,
        },
        {
          url: 'https://example.com/2',
          timestamp: '2023-01-01T00:00:00.000Z',
          violations: [{
            id: 'color-contrast',
            impact: 'serious',
            tags: ['wcag2aa'],
            description: 'Complex color contrast issue',
            help: 'Fix color contrast',
            helpUrl: 'https://example.com/help',
            nodes: [],
          }],
          passes: [],
          incomplete: [],
          inapplicable: [],
          scanDuration: 1000,
        },
      ];

      const result = decisionAgent.categorizePages(scanResults);

      expect(result.passed).toHaveLength(1);
      expect(result.claudeNeeded).toHaveLength(1);
      expect(result.minorIssues).toHaveLength(0);
      expect(result.critical).toHaveLength(0);
    });
  });
});