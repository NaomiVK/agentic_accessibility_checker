# Accessibility Testing Agent Workflow - Enhanced Agentic System

## IMPORTANT: DO NOT ADD EMOJIS
This codebase should remain professional and emoji-free. Do not add emojis to any files, reports, or output.

## Overview
An intelligent, autonomous accessibility testing system that combines automated scanning with Claude's visual analysis capabilities. The system uses multiple cooperating agents with reasoning capabilities, learning mechanisms, and adaptive behavior to test thousands of web pages effectively.

## PROJECT STATUS - ENHANCED AND OPERATIONAL (Latest Updates)
- DONE: Bulk scanning with axe-core + Puppeteer
- DONE: Enhanced decision agent with reasoning and confidence scoring
- DONE: **FIXED**: Decision logic now properly triggers Claude analysis for complex issues
- DONE: **NEW**: Comprehensive test tracking showing all WCAG 2.1 A/AA tests run
- DONE: **NEW**: 6-sheet Excel reporting with page-by-page test results and scoring
- DONE: Agent communication framework for coordination
- DONE: Learning and adaptation mechanisms
- DONE: TypeScript implementation with full type safety
- DONE: Enhanced orchestrator with 5-phase workflow
- TODO: Claude vision-enabled analysis (functional, needs MCP config)

## Key Features
- **Autonomous Decision Making**: Agents make reasoned decisions with confidence scores
- **Inter-Agent Communication**: Real-time coordination and insight sharing
- **Adaptive Learning**: System improves decision-making over time
- **Transparency**: Detailed reasoning for every decision with alternatives

## Quick Start

### Basic Scan (Original)
```bash
npm run build
npm run scan-bulk-only    # Without Claude analysis
npm run scan               # With Claude analysis
```

### Enhanced Agentic Scan (Recommended)
```bash
npm run scan-enhanced              # Enhanced workflow
npm run scan-enhanced-learning     # With learning mode enabled
```

### Command Options
```bash
node dist/enhanced-orchestrator.js \
  --input config/urls-to-test.json \
  --workers 5 \
  --output ./results \
  --skip-claude \
  --learning-mode
```

## Architecture

### Core Agents

#### 1. Enhanced Decision Agent (`src/agents/enhanced-decision-agent-fixed.ts`)
**Capabilities**:
- Multi-factor reasoning with confidence scoring
- Pattern detection (forms, navigation, ARIA misuse)
- Historical pattern analysis
- Alternative decision paths
- Learning memory for continuous improvement
- **FIXED**: Clear criteria for Claude analysis triggers

**Decision Categories**:
- `PASSED`: No violations (100% confidence)
- `MINOR_ISSUES`: Auto-fixable violations only
- `CLAUDE_NEEDED`: Complex issues requiring visual analysis (properly triggered)
- `CRITICAL`: 5+ critical/serious violations requiring immediate attention

**Claude Analysis Triggers**:
- Complex violation types (color-contrast, focus-order-semantics, keyboard-navigation)
- 5+ incomplete axe-core results
- Visual verification rules (focus-visible, bypass, landmark-one-main)
- Multiple focus/keyboard issues
- 3+ ARIA implementation issues
- 1-4 critical violations that need review

**Reasoning Factors**:
- Violation severity and impact analysis
- Pattern recognition across violations
- Historical insights from domain history
- Heuristic rules for systemic issues
- Uncertainty quantification with confidence scoring

#### 2. Bulk Scanner Agent (`src/agents/bulk-scanner.ts`)
**Technology**: Puppeteer + @axe-core/puppeteer
**Features**:
- Parallel scanning with configurable workers
- Retry logic and error handling
- Progress tracking
- Anomaly detection
- WCAG 2.1 AA compliance scanning

#### 3. Claude Analysis Agent (`src/agents/claude-analysis-agent.ts`)
**Technology**: @anthropic-ai/claude-code SDK + MCP
**Features**:
- Visual accessibility analysis
- Keyboard navigation testing
- Color contrast verification
- Dynamic content assessment
- Remediation recommendations with code examples

#### 4. Comprehensive Report Generator (`src/agents/comprehensive-report-generator.ts`)
**Outputs**:
- JSON: Structured data with full test coverage tracking
- HTML: Visual dashboard with test results
- Excel: 6 comprehensive sheets
- CSV: Page results with scores and violations by test

**Excel Workbook Structure** (6 sheets):
1. **Summary**: Overall metrics, test coverage, compliance status
2. **Page-by-Page Results**: Test scores, pass/fail counts for each URL
3. **All Violations**: Detailed violations with WCAG criteria
4. **Test Coverage**: All WCAG tests run and their results
5. **Critical Issues**: Pages requiring immediate attention
6. **Dev Backlog**: Prioritized remediation tasks

**Key Features**:
- Tracks exactly which WCAG 2.1 A/AA tests were run
- Differentiates automated (axe-core) vs manual (Claude) tests
- Scoring system: PASS/WARNING/SERIOUS/CRITICAL
- Shows test coverage for each page
- Scalable for thousands of pages

### Communication Framework (`src/agents/agent-communication.ts`)

**Message Types**:
- `insight`: Share discoveries and patterns
- `request`/`response`: Coordinate actions
- `feedback`: Learn from outcomes
- `alert`: Critical issues
- `coordination`: Resource management

**Key Features**:
- Central message hub
- Publish/subscribe pattern
- Message history and analytics
- Coordination requests (prioritize, batch, sequence)

### Enhanced Orchestrator (`enhanced-orchestrator.ts`)

**5-Phase Workflow**:
1. **Intelligent Bulk Scanning**: Prioritized processing with progress monitoring
2. **Enhanced Decision Making**: Reasoning-based categorization
3. **Adaptive Claude Analysis**: Context-aware visual analysis
4. **Comprehensive Reporting**: Reports with insights and recommendations
5. **Learning and Optimization**: Continuous improvement

## Configuration

### Scan Configuration (`config/scan-config.ts`)
```typescript
axeOptions: {
  tags: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'],
  rules: { 'color-contrast': { enabled: true }, ... }
},
decisionThresholds: {
  criticalViolationsLimit: 5,
  incompleteResultsLimit: 5,
  complexIssuesForClaudeAnalysis: [
    'color-contrast', 'focus-order-semantics', 'keyboard-navigation', 
    'aria-hidden-focus', 'visual-only-information'
  ]
}
```

### MCP Configuration (`config/mcp-config.json`)
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["@modelcontextprotocol/server-playwright"]
    }
  }
}
```

## Output Files

### Comprehensive Reports (Latest)
- `results/final-reports/accessibility-comprehensive-report.json` - Full test coverage data
- `results/final-reports/accessibility-comprehensive-report.html` - Visual dashboard
- `results/final-reports/accessibility-comprehensive-report.xlsx` - 6-sheet workbook
- `results/final-reports/page-results-with-scores.csv` - Page-by-page scoring
- `results/final-reports/violations-by-test.csv` - Test-centric violation view

### Enhanced Workflow Reports
- `results/final-reports/workflow-insights.json` - Detailed workflow analysis
- `results/decision-history.json` - Historical decisions for learning
- `results/learning-data.json` - Pattern insights and recommendations

### Excel Report Structure (6 Sheets)
1. **Summary**: Overall metrics, WCAG test coverage, compliance rates
2. **Page Results**: Each URL with test counts, scores, and key failures
3. **All Violations**: Complete violation details with WCAG mappings
4. **Test Coverage**: All 94 WCAG tests run and their pass/fail status
5. **Critical Issues**: Pages needing immediate attention with reasoning
6. **Dev Backlog**: Prioritized fixes with effort estimates and impact

## Key Improvements in Enhanced Version

### 1. Reasoning-Based Decisions
```typescript
interface DecisionReasoning {
  decision: string;
  confidence: number; // 0-1 scale
  factors: ReasoningFactor[];
  contextualAnalysis: string;
  alternativeDecisions: AlternativeDecision[];
  learningInsights: string[];
}
```

### 2. Learning System
- Pattern history by domain
- Decision outcome tracking
- Contextual patterns by page type
- Feedback incorporation

### 3. Agent Communication
```typescript
// Example: Decision agent requests Claude analysis
decisionAgent.requestClaudeAnalysis(pages, reasoning);

// Example: Scanner reports progress
scanner.notifyScanProgress(processed, total, issuesFound);

// Example: Claude shares critical findings
claudeAgent.shareAnalysisResults(criticalFindings);
```

## Performance Metrics
- **Bulk scanning**: ~100-200 pages/hour (2 workers)
- **Decision making**: <50ms per page with reasoning
- **Claude analysis**: $0.03-0.08 per page
- **Memory usage**: ~200-500MB for 100 pages

## Development Guidelines

### Running Tests
```bash
npm run test           # Run all tests
npm run lint           # Check code quality
npm run qa             # Full quality check
```

### Adding New Agents
1. Create agent class in `src/agents/`
2. Add communicator in `agent-communication.ts`
3. Register in enhanced orchestrator
4. Define message types and coordination needs

### Extending Decision Logic
1. Add new reasoning factors in `analyzeViolationsInContext()`
2. Update confidence calculation in `calculateDecisionScores()`
3. Add patterns to `detectComplexPatterns()`
4. Update learning mechanisms

## Troubleshooting

### Common Issues
1. **Low confidence decisions**: Review decision thresholds in config
2. **High Claude costs**: Refine decision criteria to reduce false positives
3. **Slow performance**: Adjust worker count and batch sizes
4. **Memory issues**: Use `node --max-old-space-size=4096`

### Debug Mode
Set environment variables:
```bash
export LOG_LEVEL=debug
export NODE_ENV=development
```

## Environment Variables
```bash
ANTHROPIC_API_KEY=your-api-key  # Required for Claude analysis
NODE_ENV=development            # Optional
LOG_LEVEL=info                  # Optional
```

## Next Steps for Future Sessions

### High Priority
1. **Complete MCP Integration**: Finalize vision-enabled Playwright setup
2. **Feedback UI**: Build interface for decision feedback collection
3. **Real-time Dashboard**: Monitoring interface for workflow progress

### Medium Priority
1. **ML Models**: Implement machine learning for better decisions
2. **Auto-remediation**: Generate fix code for common violations
3. **CI/CD Integration**: GitHub Actions workflow

### Optimization Opportunities
1. **Batch Similar Pages**: Group pages by structure for efficiency
2. **Cache Decisions**: Reuse decisions for identical page structures
3. **Predictive Analysis**: Anticipate violations based on patterns

## Key Concepts for Claude

### Agent Autonomy
Each agent operates independently but coordinates through messages. Decision agent uses reasoning to determine actions rather than simple rules.

### Learning Mechanisms
System tracks patterns, decision outcomes, and contextual information to improve over time. Feedback can be provided to correct decisions.

### Communication Protocol
Agents communicate through structured messages with types, priorities, and payloads. Hub manages routing and analytics.

### Workflow Phases
Enhanced orchestrator manages 5 distinct phases with metrics, error handling, and progress tracking. Each phase can be monitored and optimized.

## Summary
This enhanced agentic system transforms accessibility testing from rule-based scanning to intelligent, adaptive analysis. The system learns, reasons, and improves continuously while maintaining transparency through detailed insights and recommendations.