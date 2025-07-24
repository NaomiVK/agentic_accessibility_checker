# Accessibility Testing Agentic Workflow - Visual Diagram

## Simplified Workflow Visualization

```mermaid
graph TB
    %% Input
    URLs["URLs Input<br/>(config/urls-to-test.json)"]
    
    %% Phase 1: Bulk Scanning
    URLs --> Scanner["Bulk Scanner Agent<br/>━━━━━━━━━━━━━━━━<br/>Puppeteer + axe-core<br/>WCAG 2.1 A/AA tests"]
    
    Scanner --> ScanResults["Raw Scan Results<br/>━━━━━━━━━━━━━━━━<br/>Violations & Passes"]
    
    %% Phase 2: Decision Making
    ScanResults --> Decision["Decision Agent<br/>━━━━━━━━━━━━━━━━<br/>Reasoning & Scoring<br/>Pattern Detection"]
    
    Decision --> Categories{{"Categorization"}}
    
    Categories -->|No issues| Passed["PASSED"]
    Categories -->|Simple fixes| Minor["MINOR ISSUES"]
    Categories -->|Complex| Claude["NEEDS CLAUDE"]
    Categories -->|5+ Critical| ClaudeHP["NEEDS CLAUDE<br/>(High Priority)"]
    
    %% Phase 3: Claude Analysis
    Claude --> ClaudeAgent["Claude Analysis<br/>━━━━━━━━━━━━━━━━<br/>Visual Testing<br/>MCP Integration"]
    ClaudeHP --> ClaudeAgent
    
    ClaudeAgent --> Enhanced["Enhanced Results"]
    
    %% Phase 4: Reporting
    Passed --> Report
    Minor --> Report
    Enhanced --> Report
    
    Report["Report Generator<br/>━━━━━━━━━━━━━━━━<br/>Excel, HTML, JSON"]
    
    Report --> Outputs["Final Reports"]
    
    %% Phase 5: Learning
    Decision -.->|Patterns| Learning["Learning System"]
    Learning -.->|Improved decisions| Decision
    
    %% Styling with better contrast
    classDef input fill:#004d00,stroke:#000,stroke-width:2px,color:#fff
    classDef agent fill:#003d82,stroke:#000,stroke-width:2px,color:#fff
    classDef data fill:#ff6600,stroke:#000,stroke-width:2px,color:#fff
    classDef decision fill:#6a1b9a,stroke:#000,stroke-width:2px,color:#fff
    classDef output fill:#c2185b,stroke:#000,stroke-width:2px,color:#fff
    classDef learning fill:#1b5e20,stroke:#000,stroke-width:2px,color:#fff
    
    class URLs input
    class Scanner,Decision,ClaudeAgent,Report agent
    class ScanResults,Enhanced,Outputs data
    class Categories decision
    class Passed,Minor,Claude,ClaudeHP output
    class Learning learning
```

## Detailed Flow Steps

### 1. **Input Phase**
- Load URLs from configuration file
- Can handle thousands of URLs

### 2. **Bulk Scanning Phase**
- **Agent**: Bulk Scanner
- **Tools**: Puppeteer + axe-core
- **Process**: 
  - Parallel scanning (5 workers)
  - 94 WCAG 2.1 A/AA tests per page
  - ~100-200 pages/hour
- **Output**: Raw accessibility violations

### 3. **Intelligent Decision Phase**
- **Agent**: Enhanced Decision Agent
- **Process**:
  - Analyzes each page's violations
  - Applies reasoning factors
  - Calculates confidence scores
  - Learns from historical patterns
- **Decisions**:
  - PASSED: No issues (skip further analysis)
  - MINOR: Auto-fixable (log for batch processing)
  - CLAUDE_NEEDED: Complex visual/interaction issues
  - CLAUDE_NEEDED (High Priority): 5+ critical violations needing urgent analysis

### 4. **Claude Analysis Phase** (Only for complex issues)
- **Agent**: Claude Analysis Agent
- **MCP Integration**:
  - **Playwright**: Browser control, screenshots, keyboard testing
  - **Accessibility-scanner**: Advanced WCAG testing
- **Analysis**:
  - Visual contrast verification
  - Keyboard navigation testing
  - Dynamic content assessment
  - ARIA implementation review
- **Cost**: $0.03-0.08 per page

### 5. **Comprehensive Reporting Phase**
- **Agent**: Report Generator
- **Outputs**:
  - **Excel**: 6-sheet workbook with full details
  - **HTML**: Interactive dashboard
  - **JSON**: Structured data for integration
  - **CSV**: Simplified page-by-page results

### 6. **Learning & Optimization Phase**
- **System**: Continuous learning loop
- **Process**:
  - Records all decisions and outcomes
  - Identifies patterns by domain/page type
  - Adjusts confidence thresholds
  - Improves future decision accuracy

## Inter-Agent Communication

```mermaid
graph LR
    Scanner["Scanner<br/>Agent"] -->|Progress Updates| Hub["Message<br/>Hub"]
    Decision["Decision<br/>Agent"] -->|Analysis Requests| Hub
    Claude["Claude<br/>Agent"] -->|Critical Findings| Hub
    Hub -->|Coordination| Scanner
    Hub -->|Prioritization| Decision
    Hub -->|Task Queue| Claude
    
    style Hub fill:#e0f2f1,stroke:#009688,stroke-width:2px
    style Scanner fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    style Decision fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
    style Claude fill:#e3f2fd,stroke:#2196f3,stroke-width:2px
```

## Key Benefits Visualization

```mermaid
graph TD
    System["Agentic Accessibility<br/>Testing System"] --> B1["Scalability<br/>1000s of pages"]
    System --> B2["Cost Efficiency<br/>Only analyze complex issues"]
    System --> B3["Intelligence<br/>Reasoning not rules"]
    System --> B4["Improvement<br/>Learns over time"]
    System --> B5["Accuracy<br/>Visual + automated"]
    System --> B6["Transparency<br/>Detailed reasoning"]
    
    style System fill:#4a148c,stroke:#000,stroke-width:3px,color:#fff
    style B1,B2,B3,B4,B5,B6 fill:#1b5e20,stroke:#000,stroke-width:2px,color:#fff
```

## Performance Metrics

| Phase | Speed | Cost |
|-------|-------|------|
| Bulk Scanning | 100-200 pages/hour | Infrastructure only |
| Decision Making | <50ms per page | Negligible |
| Claude Analysis | 30-60 seconds/page | $0.03-0.08/page |
| Report Generation | <30 seconds total | None |

## Example Flow for 1000 Pages

1. **Scan**: 1000 pages → 5-10 hours
2. **Decide**: 1000 decisions → <1 minute
3. **Analyze**: ~50 complex pages → 30-60 minutes
4. **Report**: Complete reports → <1 minute
5. **Total**: ~6-11 hours, ~$2-4 in Claude costs

## Notes for Presentation

- **Emphasize**: Only ~5% of pages need expensive Claude analysis
- **Highlight**: Learning system improves accuracy over time
- **Show**: Real-time agent communication enables coordination
- **Mention**: 94 WCAG tests provide comprehensive coverage
- **Note**: Excel report has 6 detailed sheets for different audiences