"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __asyncValues = (this && this.__asyncValues) || function (o) {
    if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AccessibilityTestingOrchestrator = exports.ClaudeAnalysisAgent = void 0;
const claude_code_1 = require("@anthropic-ai/claude-code");
const fs = __importStar(require("fs/promises"));
const path = __importStar(require("path"));
const dotenv = __importStar(require("dotenv"));
// Load environment variables
dotenv.config();
/**
 * Claude Analysis Agent for accessibility testing
 *
 * This agent uses the @anthropic-ai/claude-code package to perform
 * human-level accessibility analysis on web pages with complex issues
 * that require visual inspection and contextual understanding.
 */
class ClaudeAnalysisAgent {
    constructor(apiKey) {
        this.analysisDelay = 5000; // 5 seconds between analyses
        this.maxRetries = 3;
        this.retryDelay = 10000; // 10 seconds retry delay
        // Load .env file if present
        try {
            dotenv.config();
        }
        catch (error) {
            console.warn('Could not load .env file:', error);
        }
        this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
        if (!this.apiKey) {
            throw new Error('ANTHROPIC_API_KEY environment variable is required. Please set it in your .env file or environment.');
        }
        console.log('INITIALIZED: Claude Code SDK with API key');
    }
    /**
     * Analyze a page with complex accessibility issues using Claude Code
     */
    analyzeWithClaude(pageData) {
        return __awaiter(this, void 0, void 0, function* () {
            const sessionId = this.generateSessionId(pageData.url);
            console.log(`STARTING: Claude analysis for ${pageData.url}`);
            console.log(`FOUND: ${pageData.violations.length} violations requiring human analysis`);
            let attempt = 0;
            while (attempt < this.maxRetries) {
                try {
                    const prompt = this.buildAccessibilityPrompt(pageData);
                    // Note: Using placeholder for claude-code SDK integration
                    // In actual implementation, this would use the @anthropic-ai/claude-code package
                    const response = yield this.invokeClaudeCode(prompt, sessionId);
                    const result = this.parseClaudeResponse(response, pageData);
                    console.log(`✅ Claude analysis completed for: ${pageData.url}`);
                    console.log(`COST: Analysis $${result.cost.toFixed(4)}`);
                    console.log(`STEPS: Found ${result.remediationSteps.length} remediation steps`);
                    return result;
                }
                catch (error) {
                    attempt++;
                    console.error(`ERROR: Claude analysis failed (attempt ${attempt}/${this.maxRetries}): ${error}`);
                    if (attempt >= this.maxRetries) {
                        throw new Error(`Failed to analyze ${pageData.url} after ${this.maxRetries} attempts: ${error}`);
                    }
                    // Exponential backoff for retries
                    const delay = this.retryDelay * Math.pow(2, attempt - 1);
                    console.log(`RETRYING: In ${delay / 1000} seconds...`);
                    yield this.delay(delay);
                }
            }
            throw new Error(`Unexpected error: exceeded retry attempts for ${pageData.url}`);
        });
    }
    /**
     * Process multiple pages requiring Claude analysis with rate limiting
     */
    processComplexIssues(flaggedPages) {
        return __awaiter(this, void 0, void 0, function* () {
            const results = [];
            console.log(`PROCESSING: ${flaggedPages.length} pages requiring Claude analysis`);
            for (let i = 0; i < flaggedPages.length; i++) {
                const pageData = flaggedPages[i];
                const progress = `[${i + 1}/${flaggedPages.length}]`;
                console.log(`${progress} ANALYZING: ${pageData.url}`);
                try {
                    const result = yield this.analyzeWithClaude(pageData);
                    results.push(result);
                    // Save individual result for progress tracking
                    yield this.saveAnalysisResult(result);
                    console.log(`${progress} COMPLETED: ${pageData.url}`);
                }
                catch (error) {
                    console.error(`${progress} FAILED: ${pageData.url} - ${error}`);
                    // Create a failed analysis result for tracking
                    const failedResult = this.createFailedAnalysisResult(pageData, error);
                    results.push(failedResult);
                }
                // Rate limiting - avoid overwhelming the API
                if (i < flaggedPages.length - 1) {
                    console.log(`RATE LIMIT: Waiting ${this.analysisDelay / 1000} seconds...`);
                    yield this.delay(this.analysisDelay);
                }
            }
            console.log(`ANALYSIS COMPLETE: ${results.length} pages processed`);
            return results;
        });
    }
    /**
     * Build comprehensive accessibility analysis prompt for Claude
     */
    buildAccessibilityPrompt(pageData) {
        const violationSummary = this.summarizeViolations(pageData.violations);
        const contextInfo = this.buildContextInfo(pageData);
        return `
# Accessibility Analysis Request

## Page Information
- **URL**: ${pageData.url}
- **Priority**: ${pageData.priority}
- **Context**: ${contextInfo}

## Automated Violations Found
${violationSummary}

## Analysis Tasks

Please use the available MCP tools to perform a comprehensive accessibility analysis:

### 1. Initial Setup
- Use \`mcp__playwright__browser_navigate\` to navigate to: ${pageData.url}
- Take initial screenshot with \`mcp__playwright__browser_take_screenshot\`
- Capture accessibility snapshot with \`mcp__playwright__browser_snapshot\`

### 2. Visual Inspection
For each violation location:
- Navigate to the specific element
- Take targeted screenshots showing the issue
- Analyze visual context and surrounding elements
- Document visual accessibility barriers

### 3. Keyboard Navigation Testing
- Test systematic tab navigation through all interactive elements
- Verify focus indicators are visible with minimum 3:1 contrast ratio
- Check for keyboard traps and focus management issues
- Test skip navigation links and landmark navigation
- Document focus order and logical tab sequence

### 4. Color and Contrast Analysis
- Identify color-only information indicators
- Test color contrast ratios visually
- Check for sufficient contrast on focus states
- Analyze color accessibility for color-blind users

### 5. Dynamic Content Testing
- Test modal dialogs for focus management
- Verify dropdown and menu accessibility
- Check form error states and validation messages
- Test dynamic content updates and announcements

### 6. ARIA Implementation Analysis
- Compare accessibility tree structure to visual layout
- Verify ARIA labels and descriptions are meaningful
- Check for proper semantic markup vs ARIA overrides
- Validate roles, properties, and states

## Required Response Format

Return a structured JSON response with this exact format:

\`\`\`json
{
  "url": "${pageData.url}",
  "analysisResults": {
    "keyboardNavigation": "detailed findings about tab order, focus indicators, keyboard traps, and navigation patterns",
    "visualIssues": "visual accessibility barriers, color contrast issues, focus visibility problems",
    "accessibilityTree": "comparison of semantic structure vs visual layout, ARIA implementation quality",
    "dynamicContent": "modal dialogs, dropdowns, error states, and dynamic content accessibility",
    "screenshots": ["screenshot1.png", "screenshot2.png", "screenshot3.png"],
    "remediationSteps": [
      {
        "issue": "specific accessibility problem identified",
        "solution": "detailed fix with implementation guidance",
        "priority": "Critical|High|Medium|Low",
        "effort": "estimated hours or complexity level",
        "wcagCriteria": "WCAG 2.1 success criteria reference",
        "codeExample": "HTML/CSS/JavaScript code example for the fix"
      }
    ]
  },
  "overallAssessment": "summary of accessibility status, compliance level, and key recommendations"
}
\`\`\`

## Important Notes
- Focus on actionable, specific recommendations
- Provide code examples for each remediation step
- Prioritize fixes based on impact and WCAG compliance
- Consider both technical and user experience aspects
- Document all screenshots taken for reference

Begin the analysis now.
`;
    }
    /**
     * Real Claude Code SDK integration
     * Uses @anthropic-ai/claude-code package for accessibility analysis
     */
    invokeClaudeCode(prompt, sessionId) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, e_1, _b, _c;
            var _d, _e;
            console.log(`INVOKING: Claude Code SDK with session: ${sessionId}`);
            console.log(`PROMPT: Length ${prompt.length} characters`);
            try {
                // Set up environment for Claude Code SDK
                process.env.ANTHROPIC_API_KEY = this.apiKey;
                // Read MCP configuration
                const mcpConfigPath = path.join(process.cwd(), 'config', 'mcp-config.json');
                let mcpServers = {};
                try {
                    const mcpConfigContent = yield fs.readFile(mcpConfigPath, 'utf-8');
                    const mcpConfig = JSON.parse(mcpConfigContent);
                    mcpServers = mcpConfig.mcpServers || {};
                    console.log(`LOADED: MCP servers ${Object.keys(mcpServers).join(', ')}`);
                }
                catch (error) {
                    console.warn('WARNING: Could not load MCP config, using default configuration:', error);
                    // Fallback MCP configuration
                    mcpServers = {
                        "playwright": {
                            "command": "npx",
                            "args": ["@modelcontextprotocol/server-playwright"]
                        }
                    };
                }
                // Configure Claude Code SDK options
                const options = {
                    mcpServers,
                    allowedTools: [
                        'mcp__playwright__browser_navigate',
                        'mcp__playwright__browser_take_screenshot',
                        'mcp__playwright__browser_snapshot',
                        'mcp__playwright__browser_click',
                        'mcp__playwright__browser_type',
                        'mcp__playwright__browser_press_key',
                        'mcp__playwright__browser_hover',
                        'mcp__playwright__browser_wait_for'
                    ],
                    maxTurns: 10,
                    permissionMode: 'bypassPermissions',
                    cwd: process.cwd()
                };
                console.log(`CONFIGURED: SDK with ${options.allowedTools.length} allowed tools`);
                // Execute Claude Code analysis
                const messages = [];
                let resultMessage = null;
                console.log(`STARTING: Claude Code analysis...`);
                const startTime = Date.now();
                try {
                    for (var _f = true, _g = __asyncValues((0, claude_code_1.query)({ prompt, options })), _h; _h = yield _g.next(), _a = _h.done, !_a; _f = true) {
                        _c = _h.value;
                        _f = false;
                        const message = _c;
                        messages.push(message);
                        // Log progress
                        if (message.type === 'assistant') {
                            console.log(`ASSISTANT: ${((_e = (_d = message.message.content) === null || _d === void 0 ? void 0 : _d[0]) === null || _e === void 0 ? void 0 : _e.type) === 'text' ?
                                message.message.content[0].text.substring(0, 100) + '...' : '[non-text content]'}`);
                        }
                        else if (message.type === 'result') {
                            resultMessage = message;
                            console.log(`ANALYSIS COMPLETED: ${message.subtype}`);
                            break;
                        }
                        else if (message.type === 'system') {
                            console.log(`SYSTEM: ${message.subtype}`);
                        }
                    }
                }
                catch (e_1_1) { e_1 = { error: e_1_1 }; }
                finally {
                    try {
                        if (!_f && !_a && (_b = _g.return)) yield _b.call(_g);
                    }
                    finally { if (e_1) throw e_1.error; }
                }
                const endTime = Date.now();
                console.log(`TIMING: Analysis completed in ${endTime - startTime}ms`);
                if (!resultMessage || resultMessage.subtype !== 'success') {
                    throw new Error(`Claude Code analysis failed: ${(resultMessage === null || resultMessage === void 0 ? void 0 : resultMessage.subtype) || 'Unknown error'}`);
                }
                const response = {
                    session_id: resultMessage.session_id,
                    total_cost_usd: resultMessage.total_cost_usd,
                    duration_ms: resultMessage.duration_ms,
                    num_turns: resultMessage.num_turns,
                    result: resultMessage.result,
                    usage: resultMessage.usage
                };
                console.log(`COST: Analysis $${response.total_cost_usd.toFixed(4)}`);
                console.log(`STATS: Turns ${response.num_turns}, Duration: ${response.duration_ms}ms`);
                return response;
            }
            catch (error) {
                console.error('ERROR: Claude Code SDK error:', error);
                throw new Error(`Claude Code SDK failed: ${error instanceof Error ? error.message : String(error)}`);
            }
        });
    }
    /**
     * Parse Claude's structured response into AnalysisResult
     */
    parseClaudeResponse(response, pageData) {
        try {
            const claudeResult = JSON.parse(response.result);
            // Validate response structure
            if (!claudeResult.analysisResults || !claudeResult.overallAssessment) {
                throw new Error('Invalid Claude response structure');
            }
            const findings = {
                keyboardNavigation: claudeResult.analysisResults.keyboardNavigation || 'No keyboard navigation analysis provided',
                visualIssues: claudeResult.analysisResults.visualIssues || 'No visual issues analysis provided',
                accessibilityTree: claudeResult.analysisResults.accessibilityTree || 'No accessibility tree analysis provided',
                dynamicContent: claudeResult.analysisResults.dynamicContent || 'No dynamic content analysis provided',
                screenshots: claudeResult.analysisResults.screenshots || [],
                remediationSteps: claudeResult.analysisResults.remediationSteps || []
            };
            // Validate and normalize remediation steps
            const remediationSteps = this.validateRemediationSteps(findings.remediationSteps);
            return {
                url: pageData.url,
                timestamp: new Date().toISOString(),
                analysisType: 'claude_visual_analysis',
                findings,
                remediationSteps,
                overallAssessment: claudeResult.overallAssessment,
                sessionId: response.session_id,
                cost: response.total_cost_usd || 0
            };
        }
        catch (error) {
            console.error('Failed to parse Claude response:', error);
            throw new Error(`Failed to parse Claude response for ${pageData.url}: ${error}`);
        }
    }
    /**
     * Validate and normalize remediation steps
     */
    validateRemediationSteps(steps) {
        if (!Array.isArray(steps)) {
            console.warn('Remediation steps is not an array, returning empty array');
            return [];
        }
        return steps.map((step, index) => {
            try {
                return {
                    issue: step.issue || `Unspecified issue ${index + 1}`,
                    solution: step.solution || 'No solution provided',
                    priority: this.validatePriority(step.priority) || 'Medium',
                    effort: step.effort || 'Not specified',
                    wcagCriteria: step.wcagCriteria || 'Not specified',
                    codeExample: step.codeExample || undefined
                };
            }
            catch (error) {
                console.warn(`Invalid remediation step at index ${index}:`, error);
                return {
                    issue: `Invalid remediation step ${index + 1}`,
                    solution: 'Manual review required',
                    priority: 'Medium',
                    effort: 'Unknown',
                    wcagCriteria: 'Unknown'
                };
            }
        });
    }
    /**
     * Validate priority level
     */
    validatePriority(priority) {
        const validPriorities = ['Critical', 'High', 'Medium', 'Low'];
        return validPriorities.includes(priority) ? priority : 'Medium';
    }
    /**
     * Create failed analysis result for error tracking
     */
    createFailedAnalysisResult(pageData, error) {
        return {
            url: pageData.url,
            timestamp: new Date().toISOString(),
            analysisType: 'claude_visual_analysis',
            findings: {
                keyboardNavigation: 'Analysis failed due to error',
                visualIssues: 'Analysis failed due to error',
                accessibilityTree: 'Analysis failed due to error',
                dynamicContent: 'Analysis failed due to error',
                screenshots: [],
                remediationSteps: []
            },
            remediationSteps: [{
                    issue: 'Claude analysis failed',
                    solution: 'Manual accessibility review required',
                    priority: 'High',
                    effort: 'Manual review needed',
                    wcagCriteria: 'All applicable criteria',
                    codeExample: undefined
                }],
            overallAssessment: `Analysis failed with error: ${error.message}`,
            sessionId: this.generateSessionId(pageData.url),
            cost: 0
        };
    }
    /**
     * Generate session ID for Claude analysis
     */
    generateSessionId(url) {
        const cleanUrl = url.replace(/[^a-zA-Z0-9]/g, '-');
        const timestamp = Date.now();
        return `accessibility-${cleanUrl}-${timestamp}`;
    }
    /**
     * Summarize violations for prompt
     */
    summarizeViolations(violations) {
        if (!violations.length) {
            return 'No violations found in automated scan.';
        }
        const summary = violations.map(violation => {
            var _a;
            const nodeCount = ((_a = violation.nodes) === null || _a === void 0 ? void 0 : _a.length) || 0;
            return `- **${violation.id}** (${violation.impact}): ${violation.description}
  - Help: ${violation.help}
  - Affected elements: ${nodeCount}
  - Tags: ${violation.tags.join(', ')}
  - More info: ${violation.helpUrl}`;
        }).join('\n\n');
        return `Found ${violations.length} violations requiring analysis:\n\n${summary}`;
    }
    /**
     * Build context information for prompt
     */
    buildContextInfo(pageData) {
        if (!pageData.context) {
            return 'No additional context provided';
        }
        const { title, description, hasForm, hasNavigation, hasModal } = pageData.context;
        return `
- Title: ${title}
- Description: ${description}
- Contains form: ${hasForm ? 'Yes' : 'No'}
- Contains navigation: ${hasNavigation ? 'Yes' : 'No'}
- Contains modal: ${hasModal ? 'Yes' : 'No'}`;
    }
    /**
     * Save individual analysis result for progress tracking
     */
    saveAnalysisResult(result) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const outputDir = path.join(process.cwd(), 'results', 'claude-analysis');
                yield fs.mkdir(outputDir, { recursive: true });
                const filename = `${result.sessionId}.json`;
                const filepath = path.join(outputDir, filename);
                yield fs.writeFile(filepath, JSON.stringify(result, null, 2));
                console.log(`SAVED: Analysis result to ${filepath}`);
            }
            catch (error) {
                console.error('Failed to save analysis result:', error);
                // Don't throw - this is not critical for the analysis
            }
        });
    }
    /**
     * Calculate priority based on violation data
     */
    calculatePriority(violations) {
        if (!violations.length)
            return 'Low';
        const hasCritical = violations.some(v => v.impact === 'critical');
        const hasSerious = violations.some(v => v.impact === 'serious');
        const hasModerate = violations.some(v => v.impact === 'moderate');
        if (hasCritical)
            return 'Critical';
        if (hasSerious)
            return 'High';
        if (hasModerate)
            return 'Medium';
        return 'Low';
    }
    /**
     * Utility function for delays
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}
exports.ClaudeAnalysisAgent = ClaudeAnalysisAgent;
/**
 * Accessibility Testing Orchestrator
 *
 * Manages the overall workflow including Claude analysis integration
 */
class AccessibilityTestingOrchestrator {
    constructor(apiKey) {
        this.claudeAgent = new ClaudeAnalysisAgent(apiKey);
    }
    /**
     * Process pages flagged for complex issue analysis
     */
    processComplexIssues(flaggedPages) {
        return __awaiter(this, void 0, void 0, function* () {
            console.log(`STARTING: Complex issue analysis for ${flaggedPages.length} pages`);
            const results = yield this.claudeAgent.processComplexIssues(flaggedPages);
            // Generate summary statistics
            const stats = this.generateProcessingStats(results);
            console.log('SUMMARY: Processing results:', stats);
            return results;
        });
    }
    /**
     * Generate processing statistics
     */
    generateProcessingStats(results) {
        const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
        const successCount = results.filter(r => !r.overallAssessment.includes('failed')).length;
        const failureCount = results.length - successCount;
        const priorityCounts = results.reduce((counts, result) => {
            result.remediationSteps.forEach(step => {
                counts[step.priority] = (counts[step.priority] || 0) + 1;
            });
            return counts;
        }, {});
        return {
            totalPages: results.length,
            successfulAnalyses: successCount,
            failedAnalyses: failureCount,
            totalCost: `$${totalCost.toFixed(4)}`,
            avgCostPerPage: `$${(totalCost / results.length).toFixed(4)}`,
            remediationStepsByPriority: priorityCounts,
            totalRemediationSteps: results.reduce((sum, r) => sum + r.remediationSteps.length, 0)
        };
    }
}
exports.AccessibilityTestingOrchestrator = AccessibilityTestingOrchestrator;
