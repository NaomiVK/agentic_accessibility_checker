"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DECISION_CATEGORIES = exports.SCAN_CONFIG = void 0;
exports.SCAN_CONFIG = {
    // Axe-core configuration
    axeOptions: {
        tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
        rules: {
            'color-contrast': { enabled: true },
            'keyboard-navigation': { enabled: true },
            'focus-order-semantics': { enabled: true },
            'aria-hidden-focus': { enabled: true },
            'visual-only-information': { enabled: true }
        }
    },
    // Playwright configuration
    playwrightOptions: {
        headless: true,
        viewport: { width: 1920, height: 1080 },
        timeout: 30000,
        browsers: ['chromium', 'firefox', 'webkit']
    },
    // Decision thresholds
    decisionThresholds: {
        criticalViolationsLimit: 5,
        incompleteResultsLimit: 5,
        complexIssuesForClaudeAnalysis: [
            'color-contrast',
            'focus-order-semantics',
            'keyboard-navigation',
            'aria-hidden-focus',
            'visual-only-information'
        ]
    },
    // Rate limiting
    rateLimiting: {
        maxConcurrentScans: 5,
        delayBetweenScans: 1000,
        claudeAnalysisDelay: 5000
    }
};
exports.DECISION_CATEGORIES = {
    PASSED: 'No violations found',
    MINOR_ISSUES: 'Auto-fixable violations only',
    CLAUDE_NEEDED: 'Complex issues requiring human analysis',
    CRITICAL: 'Immediate attention required'
};
