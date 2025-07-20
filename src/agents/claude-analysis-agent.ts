import { 
  PageAnalysisRequest, 
  AnalysisResult, 
  ClaudeAnalysisResults, 
  RemediationStep 
} from '../types/claude-types';
import { ViolationResult } from '../types/accessibility-types';
import { query, SDKMessage, SDKResultMessage, Options } from '@anthropic-ai/claude-code';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Claude Analysis Agent for accessibility testing
 * 
 * This agent uses the @anthropic-ai/claude-code package to perform
 * human-level accessibility analysis on web pages with complex issues
 * that require visual inspection and contextual understanding.
 */
export class ClaudeAnalysisAgent {
  private readonly apiKey: string;
  private readonly analysisDelay: number = 5000; // 5 seconds between analyses
  private readonly maxRetries: number = 3;
  private readonly retryDelay: number = 10000; // 10 seconds retry delay

  constructor(apiKey?: string) {
    // Load .env file if present
    try {
      dotenv.config();
    } catch (error) {
      console.warn('Could not load .env file:', error);
    }
    
    this.apiKey = apiKey || process.env.ANTHROPIC_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required. Please set it in your .env file or environment.');
    }
    
    // Validate API key format (should start with 'sk-ant-' and have reasonable length)
    if (!this.apiKey.startsWith('sk-ant-') || this.apiKey.length < 40) {
      throw new Error('Invalid ANTHROPIC_API_KEY format. API key should start with "sk-ant-" and be properly formatted');
    }
    
    console.log('SUCCESS: Claude Code SDK initialized with API key');
  }

  /**
   * Analyze a page with complex accessibility issues using Claude Code
   */
  async analyzeWithClaude(pageData: PageAnalysisRequest): Promise<AnalysisResult> {
    // Input validation
    if (!pageData?.url) {
      throw new Error('PageAnalysisRequest must include a valid URL');
    }
    
    if (!pageData.violations || !Array.isArray(pageData.violations)) {
      console.warn('No violations array provided, proceeding with empty violations list');
      pageData.violations = [];
    }
    
    const sessionId = this.generateSessionId(pageData.url);
    
    console.log(`Claude Starting analysis for: ${pageData.url}`);
    console.log(`Stats: Found ${pageData.violations.length} violations requiring human analysis`);
    
    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const prompt = this.buildAccessibilityPrompt(pageData);
        
        // Use Claude Code SDK for accessibility analysis
        const response = await this.invokeClaudeCode(prompt, sessionId);
        
        const result = this.parseClaudeResponse(response, pageData);
        
        console.log(`SUCCESS: Claude analysis completed for: ${pageData.url}`);
        console.log(`Cost: $${result.cost.toFixed(4)}`);
        console.log(`Found ${result.remediationSteps.length} remediation steps`);
        
        return result;
        
      } catch (error) {
        attempt++;
        console.error(`ERROR: Claude analysis failed (attempt ${attempt}/${this.maxRetries}): ${error}`);
        
        if (attempt >= this.maxRetries) {
          throw new Error(`Failed to analyze ${pageData.url} after ${this.maxRetries} attempts: ${error}`);
        }
        
        // Exponential backoff for retries
        const delay = this.retryDelay * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay/1000} seconds...`);
        await this.delay(delay);
      }
    }
    
    throw new Error(`Unexpected error: exceeded retry attempts for ${pageData.url}`);
  }

  /**
   * Process multiple pages requiring Claude analysis with rate limiting
   */
  async processComplexIssues(flaggedPages: PageAnalysisRequest[]): Promise<AnalysisResult[]> {
    // Input validation
    if (!Array.isArray(flaggedPages)) {
      throw new Error('flaggedPages must be an array of PageAnalysisRequest objects');
    }
    
    if (flaggedPages.length === 0) {
      console.log('WARNING: No pages flagged for Claude analysis');
      return [];
    }
    
    const results: AnalysisResult[] = [];
    
    console.log(`Processing ${flaggedPages.length} pages requiring Claude analysis`);
    
    for (let i = 0; i < flaggedPages.length; i++) {
      const pageData = flaggedPages[i];
      const progress = `[${i + 1}/${flaggedPages.length}]`;
      
      console.log(`${progress} Analyzing: ${pageData.url}`);
      
      try {
        const result = await this.analyzeWithClaude(pageData);
        results.push(result);
        
        // Save individual result for progress tracking
        await this.saveAnalysisResult(result);
        
        console.log(`${progress} SUCCESS: Completed: ${pageData.url}`);
        
      } catch (error) {
        console.error(`${progress} ERROR: Failed: ${pageData.url} - ${error}`);
        
        // Create a failed analysis result for tracking
        const failedResult = this.createFailedAnalysisResult(pageData, error as Error);
        results.push(failedResult);
      }
      
      // Rate limiting - avoid overwhelming the API
      if (i < flaggedPages.length - 1) {
        console.log(`Rate limiting: waiting ${this.analysisDelay/1000} seconds...`);
        await this.delay(this.analysisDelay);
      }
    }
    
    console.log(`Claude analysis completed: ${results.length} pages processed`);
    return results;
  }

  /**
   * Build comprehensive accessibility analysis prompt for Claude
   */
  private buildAccessibilityPrompt(pageData: PageAnalysisRequest): string {
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

CRITICAL: You MUST respond with ONLY valid JSON matching the exact format shown above. Do not include any explanatory text, comments, or markdown outside the JSON structure. Begin your response with { and end with }.
`;
  }

  /**
   * Real Claude Code SDK integration
   * Uses @anthropic-ai/claude-code package for accessibility analysis
   */
  private async invokeClaudeCode(prompt: string, sessionId: string): Promise<{
    session_id: string;
    total_cost_usd: number;
    duration_ms: number;
    num_turns: number;
    result: string;
    usage: unknown;
  }> {
    console.log(`Invoking Claude Code SDK with session: ${sessionId}`);
    console.log(`Prompt length: ${prompt.length} characters`);
    
    try {
      // Set up environment for Claude Code SDK
      process.env.ANTHROPIC_API_KEY = this.apiKey;
      
      // Read MCP configuration
      const mcpConfigPath = path.join(process.cwd(), 'config', 'mcp-config.json');
      let mcpServers = {};
      
      try {
        const mcpConfigContent = await fs.readFile(mcpConfigPath, 'utf-8');
        const mcpConfig = JSON.parse(mcpConfigContent);
        mcpServers = mcpConfig.mcpServers || {};
        console.log(`Loaded MCP servers: ${Object.keys(mcpServers).join(', ')}`);
      } catch (error) {
        console.warn('WARNING: Could not load MCP config, using default configuration:', error instanceof Error ? error.message : String(error));
        // Fallback MCP configuration with accessibility tools
        mcpServers = {
          "playwright": {
            "command": "npx",
            "args": ["@modelcontextprotocol/server-playwright"]
          },
          "accessibility-scanner": {
            "command": "npx",
            "args": ["-y", "mcp-accessibility-scanner"]
          }
        };
      }
      
      // Configure Claude Code SDK options
      const options: Options = {
        mcpServers,
        // Allow Claude to use all playwright and accessibility-scanner tools
        allowedTools: [
          'mcp__playwright__*',
          'mcp__accessibility-scanner__*'
        ],
        maxTurns: 20, // Increased from 10 to allow more complex analyses
        permissionMode: 'bypassPermissions',
        cwd: process.cwd()
      };
      
      console.log(`SDK options configured with playwright and accessibility-scanner tools only`);
      
      // Execute Claude Code analysis
      const messages: SDKMessage[] = [];
      let resultMessage: SDKResultMessage | null = null;
      
      console.log(`Starting Claude Code analysis...`);
      const startTime = Date.now();
      
      for await (const message of query({ prompt, options })) {
        messages.push(message);
        
        // Log progress with detailed information
        if (message.type === 'assistant') {
          const content = message.message.content?.[0];
          if (content?.type === 'text') {
            console.log(`Assistant: ${content.text.substring(0, 150)}${content.text.length > 150 ? '...' : ''}`);
          } else if (content?.type === 'tool_use') {
            console.log(`Tool used: ${content.name}`);
          } else {
            console.log(`Assistant: [${content?.type || 'unknown'} content]`);
          }
        } else if (message.type === 'result') {
          resultMessage = message;
          console.log(`SUCCESS: Analysis completed: ${message.subtype}`);
          if (message.subtype === 'success') {
            console.log(`Cost: $${message.total_cost_usd.toFixed(4)}, Turns: ${message.num_turns}`);
          }
          break;
        } else if (message.type === 'system') {
          console.log(`System: ${message.subtype}`);
          if (message.subtype === 'init') {
            console.log(`Tools available: ${message.tools.length}, MCP servers: ${message.mcp_servers.map(s => s.name).join(', ')}`);
          }
        } else if (message.type === 'user') {
          console.log(`User input processed`);
        }
      }
      
      const endTime = Date.now();
      console.log(`Analysis completed in ${endTime - startTime}ms`);
      
      if (!resultMessage || resultMessage.subtype !== 'success') {
        throw new Error(`Claude Code analysis failed: ${resultMessage?.subtype || 'Unknown error'}`);
      }
      
      const response = {
        session_id: resultMessage.session_id,
        total_cost_usd: resultMessage.total_cost_usd,
        duration_ms: resultMessage.duration_ms,
        num_turns: resultMessage.num_turns,
        result: resultMessage.result,
        usage: resultMessage.usage
      };
      
      console.log(`Cost: $${response.total_cost_usd.toFixed(4)}`);
      console.log(`Stats: Turns: ${response.num_turns}, Duration: ${response.duration_ms}ms`);
      
      return response;
      
    } catch (error) {
      console.error('ERROR: Claude Code SDK error:', error);
      
      // Provide more specific error messages based on error type
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error(`Claude Code SDK authentication failed: ${error.message}`);
        } else if (error.message.includes('rate limit')) {
          throw new Error(`Claude Code SDK rate limit exceeded: ${error.message}`);
        } else if (error.message.includes('timeout')) {
          throw new Error(`Claude Code SDK timeout: ${error.message}`);
        } else {
          throw new Error(`Claude Code SDK failed: ${error.message}`);
        }
      } else {
        throw new Error(`Claude Code SDK failed with unknown error: ${String(error)}`);
      }
    }
  }

  /**
   * Parse Claude's structured response into AnalysisResult
   */
  private parseClaudeResponse(response: {
    session_id: string;
    total_cost_usd: number;
    duration_ms: number;
    num_turns: number;
    result: string;
    usage: unknown;
  }, pageData: PageAnalysisRequest): AnalysisResult {
    try {
      // Extract JSON from Claude's response if it contains explanatory text
      let jsonStr = response.result;
      
      // If response contains a JSON code block, extract it
      const jsonMatch = jsonStr.match(/```json\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      } else {
        // If response starts with non-JSON text, try to find the JSON part
        const jsonStartIndex = jsonStr.indexOf('{');
        if (jsonStartIndex > 0) {
          console.warn('Claude response contains non-JSON prefix, extracting JSON part');
          jsonStr = jsonStr.substring(jsonStartIndex);
        }
      }
      
      // Try to parse the JSON
      let claudeResult;
      try {
        claudeResult = JSON.parse(jsonStr);
      } catch (parseError) {
        // If JSON parsing fails, create a fallback response from the text
        console.warn('Failed to parse JSON, creating fallback response from text analysis');
        return this.createFallbackResponse(response, pageData);
      }
      
      // Validate response structure
      if (!claudeResult.analysisResults || !claudeResult.overallAssessment) {
        throw new Error('Invalid Claude response structure');
      }
      
      const findings: ClaudeAnalysisResults = {
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
      
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
      console.error('Response preview:', response.result.substring(0, 200) + '...');
      throw new Error(`Failed to parse Claude response for ${pageData.url}: ${error}`);
    }
  }

  /**
   * Validate and normalize remediation steps
   */
  private validateRemediationSteps(steps: unknown[]): RemediationStep[] {
    if (!Array.isArray(steps)) {
      console.warn('Remediation steps is not an array, returning empty array');
      return [];
    }
    
    return steps.map((step, index) => {
      try {
        const stepObj = step as Record<string, unknown>;
        return {
          issue: (stepObj.issue as string) || `Unspecified issue ${index + 1}`,
          solution: (stepObj.solution as string) || 'No solution provided',
          priority: this.validatePriority(stepObj.priority as string) || 'Medium',
          effort: (stepObj.effort as string) || 'Not specified',
          wcagCriteria: (stepObj.wcagCriteria as string) || 'Not specified',
          codeExample: (stepObj.codeExample as string) || undefined
        };
      } catch (error) {
        console.warn(`Invalid remediation step at index ${index}:`, error);
        return {
          issue: `Invalid remediation step ${index + 1}`,
          solution: 'Manual review required',
          priority: 'Medium' as const,
          effort: 'Unknown',
          wcagCriteria: 'Unknown'
        };
      }
    });
  }

  /**
   * Validate priority level
   */
  private validatePriority(priority: string): 'Critical' | 'High' | 'Medium' | 'Low' {
    const validPriorities = ['Critical', 'High', 'Medium', 'Low'];
    return validPriorities.includes(priority) ? priority as ('Critical' | 'High' | 'Medium' | 'Low') : 'Medium';
  }

  /**
   * Create fallback response when JSON parsing fails
   */
  private createFallbackResponse(response: {
    session_id: string;
    total_cost_usd: number;
    duration_ms: number;
    num_turns: number;
    result: string;
    usage: unknown;
  }, pageData: PageAnalysisRequest): AnalysisResult {
    const resultText = response.result;
    
    // Extract key information from the text if possible
    const violationsMatch = resultText.match(/(\d+)\s+(?:color contrast|violations?|issues?)/i);
    const violationCount = violationsMatch ? parseInt(violationsMatch[1]) : 0;
    
    // Extract any mentioned issues
    const issuePatterns = [
      /color contrast/gi,
      /keyboard navigation/gi,
      /focus indicator/gi,
      /ARIA/gi,
      /screen reader/gi,
      /alt text/gi
    ];
    
    const mentionedIssues = issuePatterns
      .filter(pattern => pattern.test(resultText))
      .map(pattern => pattern.source.replace(/[\\\/]/g, ''));
    
    return {
      url: pageData.url,
      timestamp: new Date().toISOString(),
      analysisType: 'claude_visual_analysis',
      findings: {
        keyboardNavigation: resultText.includes('keyboard') ? 'Keyboard navigation issues detected - see full analysis' : 'Analysis completed',
        visualIssues: resultText.includes('contrast') ? 'Color contrast issues detected - see full analysis' : 'Analysis completed',
        accessibilityTree: 'Analysis completed - JSON parsing failed, see raw results',
        dynamicContent: 'Analysis completed - JSON parsing failed, see raw results',
        screenshots: [],
        remediationSteps: [{
          issue: `Claude detected ${violationCount || 'multiple'} accessibility issues`,
          solution: `Full analysis text: ${resultText.substring(0, 500)}...`,
          priority: violationCount > 3 ? 'High' : 'Medium',
          effort: 'Manual review required',
          wcagCriteria: mentionedIssues.join(', ') || 'Various',
          codeExample: 'See full analysis for code examples'
        }]
      },
      overallAssessment: `Claude analysis completed but response was not in expected JSON format. ${violationCount || 'Multiple'} issues detected. Issues mentioned: ${mentionedIssues.join(', ') || 'Various accessibility concerns'}.`,
      remediationSteps: [{
        issue: 'Non-JSON Claude Response',
        solution: 'Manual review of full Claude analysis required',
        priority: 'High',
        effort: 'Variable',
        wcagCriteria: 'Multiple'
      }],
      sessionId: response.session_id,
      cost: response.total_cost_usd || 0
    };
  }

  /**
   * Create failed analysis result for error tracking
   */
  private createFailedAnalysisResult(pageData: PageAnalysisRequest, error: Error): AnalysisResult {
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
  private generateSessionId(url: string): string {
    const cleanUrl = url.replace(/[^a-zA-Z0-9]/g, '-');
    const timestamp = Date.now();
    return `accessibility-${cleanUrl}-${timestamp}`;
  }

  /**
   * Summarize violations for prompt
   */
  private summarizeViolations(violations: ViolationResult[]): string {
    if (!violations.length) {
      return 'No violations found in automated scan.';
    }
    
    const summary = violations.map(violation => {
      const nodeCount = violation.nodes?.length || 0;
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
  private buildContextInfo(pageData: PageAnalysisRequest): string {
    if (!pageData.pageContext) {
      return 'No additional context provided';
    }
    
    const { title, description, hasForm, hasNavigation, hasModal } = pageData.pageContext;
    
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
  private async saveAnalysisResult(result: AnalysisResult): Promise<void> {
    try {
      const outputDir = path.join(process.cwd(), 'results', 'claude-analysis');
      await fs.mkdir(outputDir, { recursive: true });
      
      const filename = `${result.sessionId}.json`;
      const filepath = path.join(outputDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(result, null, 2));
      console.log(`Saved analysis result: ${filepath}`);
      
    } catch (error) {
      console.error('Failed to save analysis result:', error);
      // Don't throw - this is not critical for the analysis
    }
  }


  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Accessibility Testing Orchestrator
 * 
 * Manages the overall workflow including Claude analysis integration
 */
export class AccessibilityTestingOrchestrator {
  private claudeAgent: ClaudeAnalysisAgent;
  
  constructor(apiKey?: string) {
    this.claudeAgent = new ClaudeAnalysisAgent(apiKey);
  }
  
  /**
   * Process pages flagged for complex issue analysis
   */
  async processComplexIssues(flaggedPages: PageAnalysisRequest[]): Promise<AnalysisResult[]> {
    console.log(`Starting complex issue analysis for ${flaggedPages.length} pages`);
    
    const results = await this.claudeAgent.processComplexIssues(flaggedPages);
    
    // Generate summary statistics
    const stats = this.generateProcessingStats(results);
    console.log('Stats: Processing Summary:', stats);
    
    return results;
  }
  
  /**
   * Generate processing statistics
   */
  private generateProcessingStats(results: AnalysisResult[]) {
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const successCount = results.filter(r => !r.overallAssessment.includes('failed')).length;
    const failureCount = results.length - successCount;
    
    const priorityCounts = results.reduce((counts, result) => {
      result.remediationSteps.forEach(step => {
        counts[step.priority] = (counts[step.priority] || 0) + 1;
      });
      return counts;
    }, {} as Record<string, number>);
    
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