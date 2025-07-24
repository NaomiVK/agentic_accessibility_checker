# Accessibility Testing Agentic Workflow - Detailed Flow

## Overview
An intelligent multi-agent system that combines automated accessibility scanning with AI-powered visual analysis to test web pages at scale. The system uses autonomous agents that communicate, reason, learn, and adapt to provide comprehensive accessibility testing.

## Architecture Benefits

### Why Agentic Architecture?
1. **Autonomous Decision Making**: Agents reason about complex issues rather than following rigid rules
2. **Scalability**: Process thousands of pages efficiently through parallel processing
3. **Adaptive Learning**: System improves over time by learning from patterns and outcomes
4. **Cost Optimization**: Only uses expensive Claude analysis when truly necessary
5. **Comprehensive Coverage**: Combines automated testing (axe-core) with visual AI analysis
6. **Transparency**: Every decision includes detailed reasoning and confidence scores

## Core Agents and Their Behaviors

### 1. Bulk Scanner Agent
**Package**: Puppeteer + @axe-core/puppeteer
**Behavior**:
- Launches headless Chrome instances in parallel
- Navigates to each URL and waits for page load
- Injects axe-core accessibility testing engine
- Runs WCAG 2.1 A/AA compliance tests (94 rules)
- Handles retries for failed pages
- Communicates scan progress to other agents

**Input**: List of URLs from `config/urls-to-test.json`
**Output**: Raw axe-core results with violations, passes, incomplete, and inapplicable tests

### 2. Enhanced Decision Agent
**Package**: Custom TypeScript implementation with reasoning engine
**Behavior**:
- Analyzes axe-core results using multi-factor reasoning
- Calculates confidence scores (0-1) for each decision
- Detects patterns (forms, navigation issues, ARIA misuse)
- Learns from historical decisions and outcomes
- Considers alternative decision paths
- Communicates decisions with detailed reasoning

**Decision Categories**:
- `PASSED`: No violations found (100% confidence)
- `MINOR_ISSUES`: Only auto-fixable violations
- `CLAUDE_NEEDED`: Complex issues requiring visual analysis
- `CRITICAL`: Severe accessibility barriers

**Input**: Axe-core scan results
**Output**: Categorized pages with reasoning and confidence scores

### 3. Claude Analysis Agent
**Package**: @anthropic-ai/claude-code SDK
**MCP Servers**: 
- @modelcontextprotocol/server-playwright (browser automation)
- mcp-accessibility-scanner (specialized accessibility testing)
**Behavior**:
- Takes screenshots of pages needing visual analysis
- Uses Claude's vision capabilities for:
  - Color contrast verification
  - Keyboard navigation testing
  - Focus order validation
  - Dynamic content assessment
  - Visual-only information detection
- Generates remediation recommendations with code examples
- Shares critical findings with other agents

**When MCP is Used**:
- During Claude analysis phase (Phase 3)
- Playwright: Browser control, screenshots, keyboard navigation
- Accessibility-scanner: Specialized WCAG testing beyond axe-core

**Why MCP is Used**:
- Playwright: Enables Claude to interact with web pages directly, take screenshots, test keyboard navigation
- Accessibility-scanner: Provides additional accessibility tests that axe-core might miss, specialized ARIA analysis

**Input**: URLs flagged as CLAUDE_NEEDED
**Output**: Detailed visual analysis with recommendations

### 4. Comprehensive Report Generator
**Package**: ExcelJS, custom HTML/JSON generators
**Behavior**:
- Aggregates results from all agents
- Calculates compliance scores
- Generates multiple report formats
- Creates prioritized remediation backlogs
- Tracks test coverage for all WCAG criteria

**Output Formats**:
1. **JSON**: Structured data with full test results
2. **HTML**: Interactive dashboard with visualizations
3. **Excel**: 6-sheet comprehensive workbook
4. **CSV**: Page-by-page results and violations

## Inter-Agent Communication

### Message Hub Architecture
**Package**: Custom TypeScript publish/subscribe system

**Message Types**:
- `insight`: Pattern discoveries shared between agents
- `request`/`response`: Coordination between agents
- `feedback`: Learning from outcomes
- `alert`: Critical accessibility barriers
- `coordination`: Resource management

**Example Communications**:
```typescript
// Scanner notifies progress
scanner.publish({
  type: 'coordination',
  data: { processed: 50, total: 100, criticalIssues: 3 }
});

// Decision agent requests Claude analysis
decisionAgent.publish({
  type: 'request',
  target: 'claude-agent',
  data: { urls: complexPages, reasoning: analysisReasons }
});
```

## Workflow Phases - Step by Step

### Phase 1: Intelligent Bulk Scanning
1. **Load URLs**: Read from `config/urls-to-test.json`
2. **Initialize Workers**: Spawn parallel Puppeteer instances (default: 5)
3. **Scan Pages**: 
   - Navigate to each URL
   - Run axe-core with WCAG 2.1 A/AA rules
   - Retry failed pages up to 3 times
4. **Communicate Progress**: Send updates to orchestrator
5. **Output**: `results/scan-results/bulk-scan-results.json`

### Phase 2: Enhanced Decision Making
1. **Analyze Results**: For each scanned page:
   - Count violations by severity
   - Detect complex patterns
   - Check historical decisions
   - Calculate confidence scores
2. **Reasoning Process**:
   - Apply multi-factor analysis
   - Consider violation impact
   - Evaluate page complexity
   - Generate alternative decisions
3. **Categorize Pages**:
   - PASSED: No further action
   - MINOR_ISSUES: Log for batch fixes
   - CLAUDE_NEEDED: Queue for visual analysis
   - CRITICAL: Flag for immediate attention
4. **Output**: `results/categorized-results.json` with reasoning

### Phase 3: Adaptive Claude Analysis (if needed)
1. **Setup MCP**: Initialize Playwright server for browser control
2. **For Each Complex Page**:
   - Launch browser via MCP
   - Navigate and take screenshots
   - Run visual analysis with Claude
   - Test keyboard navigation
   - Verify color contrast
   - Check dynamic content
3. **Generate Recommendations**: Code examples for fixes
4. **Share Insights**: Critical findings to other agents
5. **Output**: `results/claude-analysis/*.json`

### Phase 4: Comprehensive Reporting
1. **Aggregate All Results**: Combine scan, decision, and Claude data
2. **Calculate Metrics**:
   - Overall compliance rate
   - Test coverage percentage
   - Critical issue count
   - Page-by-page scores
3. **Generate Reports**:
   - **Excel Workbook** (6 sheets):
     - Summary metrics
     - Page-by-page results
     - All violations details
     - Test coverage tracking
     - Critical issues list
     - Developer backlog
   - **HTML Dashboard**: Visual charts and graphs
   - **JSON**: Complete structured data
   - **CSV**: Simplified views
4. **Output**: `results/final-reports/`

### Phase 5: Learning and Optimization
1. **Record Decisions**: Save to `results/decision-history.json`
2. **Extract Patterns**: Identify common issues by domain/page type
3. **Update Learning Data**: Improve future decision confidence
4. **Generate Insights**: Recommendations for process improvement
5. **Output**: `results/learning-data.json`

## How the Learning System Works

### Pattern Recognition and Storage
The Decision Agent maintains a `learningMemory` structure that tracks:
- **Pattern History by Domain**: Maps domains to arrays of pattern occurrences
- **Decision Outcomes**: Tracks which decisions led to successful analyses
- **Contextual Patterns**: Associates page types (forms, navigation, modals) with common issues

### Learning Process
1. **Pattern Detection**: During analysis, the agent identifies patterns like:
   - Multiple form accessibility issues
   - Navigation structure problems
   - ARIA implementation patterns
   - Recurring violation types

2. **Historical Analysis**: For each new page, the agent:
   - Checks domain history for previous patterns
   - Adjusts confidence scores based on past successes
   - Suggests similar remediation approaches

3. **Confidence Adjustment**: Learning affects decision confidence:
   ```typescript
   // If similar patterns were seen before and led to good outcomes
   confidence += 0.1 * historicalSuccessRate
   ```

4. **Pattern Storage**: After each analysis:
   ```typescript
   patternHistory.push({
     timestamp: new Date().toISOString(),
     patterns: detectedPatterns,
     violationCount: violations.length,
     decision: finalDecision,
     confidence: confidence
   });
   ```

5. **Insight Generation**: The system generates insights like:
   - "Domain X consistently has form accessibility issues"
   - "Pages with modals often need Claude analysis"
   - "ARIA misuse patterns cluster in navigation components"

### Adaptive Behavior
- **Threshold Adjustment**: If many pages from a domain need Claude analysis, the system lowers the threshold for that domain
- **Pattern-Based Routing**: Recognizes page types that historically need visual analysis
- **Efficiency Optimization**: Learns which violation combinations are auto-fixable vs. needing manual review

## Workflow Illustration Summary

```
[URLs Input] 
    ↓
[Bulk Scanner Agent] → (Parallel scanning with axe-core)
    ↓
[Raw Scan Results]
    ↓
[Decision Agent] → (Reasoning & Categorization)
    ↓
[Categorized Pages]
    ↓
[Claude Agent] → (Visual analysis via MCP/Playwright)
    ↓
[Enhanced Results]
    ↓
[Report Generator] → (6-sheet Excel, HTML, JSON, CSV)
    ↓
[Learning System] → (Pattern extraction & improvement)
    ↓
[Final Reports & Insights]
```

## Key Integration Points

### MCP Server Usage
- **When**: During Claude visual analysis phase
- **Why**: Enables browser automation for screenshot capture and interactive testing
- **How**: Claude uses Playwright commands to navigate, capture, and test pages

### Agent Communication Flow
- **Continuous**: Agents publish messages throughout workflow
- **Coordinated**: Hub ensures proper sequencing and resource management
- **Adaptive**: Agents adjust behavior based on shared insights

## Performance Characteristics
- **Scanning Speed**: 100-200 pages/hour with 2 workers
- **Decision Speed**: <50ms per page
- **Claude Analysis**: 30-60 seconds per page
- **Total Time**: ~2-4 hours for 1000 pages (with 5% needing Claude)
- **Cost**: ~$0.03-0.08 per Claude-analyzed page

## System Benefits Summary
1. **Intelligent Resource Usage**: Only uses expensive AI analysis when necessary
2. **Comprehensive Testing**: Combines automated and visual testing
3. **Continuous Improvement**: Learning system improves accuracy over time
4. **Transparency**: Every decision includes detailed reasoning
5. **Scalability**: Handles thousands of pages efficiently
6. **Actionable Output**: Prioritized remediation tasks with code examples