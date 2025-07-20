#!/usr/bin/env node

import { program } from 'commander';
import { BulkScannerAgent } from './src/agents/bulk-scanner';
import { EnhancedDecisionAgentFixed } from './src/agents/enhanced-decision-agent-fixed';
import { ClaudeAnalysisAgent } from './src/agents/claude-analysis-agent';
import { ComprehensiveReportGenerator } from './src/agents/comprehensive-report-generator';
import { loadUrls, UrlsConfig } from './src/utils/config-loader';
import { 
  AgentCommunicationHub, 
  BulkScannerCommunicator,
  DecisionAgentCommunicator,
  ClaudeAnalystCommunicator,
  OrchestratorCommunicator
} from './src/agents/agent-communication';
import { PageScanResult, ViolationResult, ViolationNode } from './src/types/accessibility-types';
import { AnalysisResult } from './src/types/claude-types';
import * as fs from 'fs';
import * as path from 'path';

interface WorkflowMetrics {
  startTime: Date;
  endTime?: Date;
  phaseDurations: Map<string, number>;
  agentMetrics: Map<string, any>;
  insights: string[];
  recommendations: string[];
}

class EnhancedAccessibilityOrchestrator {
  private bulkScanner: BulkScannerAgent;
  private decisionAgent: EnhancedDecisionAgentFixed;
  private claudeAgent: ClaudeAnalysisAgent;
  private reportGenerator: ComprehensiveReportGenerator;
  private communicationHub: AgentCommunicationHub;
  
  // Communicators
  private bulkScannerComm: BulkScannerCommunicator;
  private decisionAgentComm: DecisionAgentCommunicator;
  private claudeAnalystComm: ClaudeAnalystCommunicator;
  private orchestratorComm: OrchestratorCommunicator;
  
  private metrics: WorkflowMetrics;
  private options: any;

  constructor(options: any, urlsConfig?: UrlsConfig) {
    this.options = options;
    
    // Initialize communication hub
    this.communicationHub = new AgentCommunicationHub();
    
    // Initialize agents
    const bulkScannerOptions = {
      maxWorkers: parseInt(options.workers),
      outputDirectory: `${options.output}/bulk-scan-results`,
      timeout: urlsConfig?.config?.timeout || 45000,
      retryAttempts: urlsConfig?.config?.retryAttempts || 3
    };
    
    this.bulkScanner = new BulkScannerAgent(bulkScannerOptions);
    this.decisionAgent = new EnhancedDecisionAgentFixed();
    this.claudeAgent = new ClaudeAnalysisAgent();
    this.reportGenerator = new ComprehensiveReportGenerator(`${options.output}/final-reports`);
    
    // Initialize communicators
    this.bulkScannerComm = new BulkScannerCommunicator(this.communicationHub);
    this.decisionAgentComm = new DecisionAgentCommunicator(this.communicationHub);
    this.claudeAnalystComm = new ClaudeAnalystCommunicator(this.communicationHub);
    this.orchestratorComm = new OrchestratorCommunicator(this.communicationHub);
    
    // Initialize metrics
    this.metrics = {
      startTime: new Date(),
      phaseDurations: new Map(),
      agentMetrics: new Map(),
      insights: [],
      recommendations: []
    };
    
    // Subscribe to critical alerts
    this.setupSubscriptions();
  }

  private setupSubscriptions(): void {
    // Subscribe to alerts
    this.communicationHub.subscribe('alert', (message) => {
      console.error(`[ALERT] ${message.fromAgent}: ${JSON.stringify(message.payload)}`);
    });
    
    // Subscribe to insights for learning
    this.communicationHub.subscribe('insight', (message) => {
      const payload = message.payload as { type?: string; confidence?: number; description?: string };
      if (payload.type === 'learning' || (payload.confidence && payload.confidence > 0.8)) {
        this.metrics.insights.push(`${message.fromAgent}: ${payload.description || 'No description'}`);
      }
    });
    
    // Subscribe to coordination requests
    this.communicationHub.subscribe('coordination', (message) => {
      const payload = message.payload as { action?: string };
      console.log(`[COORDINATION] ${message.fromAgent} requests ${payload.action || 'unknown action'}`);
    });
  }

  public async runWorkflow(urls: string[]): Promise<void> {
    console.log('Starting Enhanced Accessibility Testing Workflow');
    console.log(`Total URLs: ${urls.length}`);
    
    try {
      // Phase 1: Intelligent Bulk Scanning
      const scanResults = await this.performIntelligentScanning(urls);
      
      // Phase 2: Enhanced Decision Making with Reasoning
      const decisions = await this.makeEnhancedDecisions(scanResults);
      
      // Phase 3: Adaptive Claude Analysis
      const claudeResults = await this.performAdaptiveAnalysis(decisions);
      
      // Phase 4: Comprehensive Reporting with Insights
      await this.generateEnhancedReports(decisions, claudeResults);
      
      // Phase 5: Learning and Optimization
      await this.performLearningAndOptimization();
      
      // Final metrics and recommendations
      this.finalizeWorkflow();
      
    } catch (error) {
      console.error('Workflow error:', error);
      this.handleWorkflowError(error);
    }
  }

  private async performIntelligentScanning(urls: string[]): Promise<PageScanResult[]> {
    const phaseStart = Date.now();
    console.log('\n=== Phase 1: Intelligent Bulk Scanning ===');
    
    // Request prioritization from orchestrator
    const correlationId = this.bulkScannerComm.requestPrioritization(urls);
    
    // Process coordination response
    this.orchestratorComm.handleCoordinationRequests();
    
    // Wait for prioritization response
    await this.waitForResponse(correlationId);
    
    // Get prioritized URLs
    const messages = this.communicationHub.getMessages('bulk-scanner', ['response']);
    const responseMessage = messages.find(m => m.correlationId === correlationId);
    const prioritizedUrls = (responseMessage?.payload as { prioritized?: string[] })?.prioritized || urls;
    
    // Perform scanning with progress updates
    let lastProgress = 0;
    const progressInterval = setInterval(() => {
      const progress = this.bulkScanner.getProgress();
      if (progress.percentage > lastProgress + 10) {
        lastProgress = progress.percentage;
        this.bulkScannerComm.notifyScanProgress(
          progress.processed,
          progress.total,
          this.bulkScanner.getStats().violations
        );
      }
    }, 5000);
    
    const scanSummary = await this.bulkScanner.scanPages(prioritizedUrls);
    clearInterval(progressInterval);
    
    // Get scan results
    const categorized = this.bulkScanner.categorizeResults();
    const allResults = [
      ...categorized.passed,
      ...categorized.minorIssues,
      ...categorized.claudeNeeded,
      ...categorized.critical
    ];
    
    // Report any anomalies
    const anomalies = allResults
      .filter(r => r.error)
      .map(r => ({ url: r.url, issue: r.error || 'Unknown error' }));
    
    if (anomalies.length > 0) {
      this.bulkScannerComm.reportAnomalies(anomalies);
    }
    
    // Store phase metrics
    this.metrics.phaseDurations.set('scanning', Date.now() - phaseStart);
    this.metrics.agentMetrics.set('bulk-scanner', {
      summary: scanSummary,
      stats: this.bulkScanner.getStats()
    });
    
    console.log(`Scanning complete: ${allResults.length} pages processed`);
    return allResults;
  }

  private async makeEnhancedDecisions(scanResults: PageScanResult[]): Promise<any> {
    const phaseStart = Date.now();
    console.log('\n=== Phase 2: Enhanced Decision Making with Reasoning ===');
    
    // Make decisions with reasoning
    const enhancedDecisions = scanResults.map(result => 
      this.decisionAgent.makeDecisionWithReasoning(result)
    );
    
    // Share decision insights
    this.decisionAgentComm.shareDecisionInsights(enhancedDecisions);
    
    // Categorize by decision
    const categorized = {
      passed: enhancedDecisions.filter(d => d.category === 'PASSED'),
      minorIssues: enhancedDecisions.filter(d => d.category === 'MINOR_ISSUES'),
      claudeNeeded: enhancedDecisions.filter(d => d.category === 'CLAUDE_NEEDED'),
      critical: enhancedDecisions.filter(d => d.category === 'CRITICAL')
    };
    
    // Log decision breakdown with confidence
    console.log('\nDecision Breakdown:');
    console.log(`- Passed: ${categorized.passed.length}`);
    console.log(`- Minor Issues: ${categorized.minorIssues.length}`);
    console.log(`- Claude Analysis Needed: ${categorized.claudeNeeded.length} (Avg confidence: ${this.calculateAvgConfidence(categorized.claudeNeeded)})`);
    console.log(`- Critical: ${categorized.critical.length}`);
    
    // Identify low confidence decisions
    const lowConfidence = enhancedDecisions.filter(d => d.reasoning.confidence < 0.6);
    if (lowConfidence.length > 0) {
      console.warn(`\nWarning: ${lowConfidence.length} decisions with low confidence (<60%)`);
      this.metrics.recommendations.push(
        `Review decision criteria - ${lowConfidence.length} pages had low confidence scores`
      );
    }
    
    // Store enhanced decisions for learning
    this.storeDecisionsForLearning(enhancedDecisions);
    
    // Store phase metrics
    this.metrics.phaseDurations.set('decision-making', Date.now() - phaseStart);
    this.metrics.agentMetrics.set('decision-agent', {
      totalDecisions: enhancedDecisions.length,
      avgConfidence: this.calculateAvgConfidence(enhancedDecisions),
      lowConfidenceCount: lowConfidence.length,
      insights: this.communicationHub.getInsights('decision-agent')
    });
    
    return {
      decisions: enhancedDecisions,
      categorized,
      scanResults
    };
  }

  private async performAdaptiveAnalysis(decisionData: any): Promise<AnalysisResult[]> {
    const phaseStart = Date.now();
    console.log('\n=== Phase 3: Adaptive Claude Analysis ===');
    
    const { categorized, scanResults } = decisionData;
    
    if (this.options.skipClaude || categorized.claudeNeeded.length === 0) {
      console.log('Claude analysis skipped or not needed');
      return [];
    }
    
    // Convert to analysis requests with enhanced context
    const analysisRequests = categorized.claudeNeeded.map((decision: any) => {
      const scanResult = scanResults.find((r: PageScanResult) => r.url === decision.url);
      return {
        url: decision.url,
        violations: scanResult?.violations || [],
        priority: decision.priority,
        pageContext: {
          title: '',
          description: decision.reasoning.contextualAnalysis,
          hasForm: scanResult?.violations.some((v: ViolationResult) => v.nodes.some((n: ViolationNode) => n.html.includes('<form'))) || false,
          hasNavigation: scanResult?.violations.some((v: ViolationResult) => v.nodes.some((n: ViolationNode) => n.html.includes('nav'))) || false,
          hasModal: scanResult?.violations.some((v: ViolationResult) => v.nodes.some((n: ViolationNode) => n.html.includes('modal') || n.html.includes('dialog'))) || false
        },
        decisionReasoning: decision.reasoning,
        uncertaintyFactors: decision.uncertaintyFactors
      };
    });
    
    // Request batch optimization
    this.claudeAnalystComm.requestBatchOptimization(analysisRequests.map((r: any) => r.url));
    
    // Process coordination response
    this.orchestratorComm.handleCoordinationRequests();
    
    // Perform Claude analysis
    const results = await this.claudeAgent.processComplexIssues(analysisRequests);
    
    // Share analysis results
    this.claudeAnalystComm.shareAnalysisResults(results);
    
    // Store phase metrics
    this.metrics.phaseDurations.set('claude-analysis', Date.now() - phaseStart);
    this.metrics.agentMetrics.set('claude-analyst', {
      pagesAnalyzed: results.length,
      totalCost: results.reduce((sum, r) => sum + r.cost, 0),
      criticalFindings: results.filter(r => r.remediationSteps.some(s => s.priority === 'Critical')).length
    });
    
    console.log(`Claude analysis complete: ${results.length} pages analyzed`);
    return results;
  }

  private async generateEnhancedReports(decisionData: any, claudeResults: AnalysisResult[]): Promise<void> {
    const phaseStart = Date.now();
    console.log('\n=== Phase 4: Comprehensive Reporting with Insights ===');
    
    const { decisions, categorized, scanResults } = decisionData;
    
    // Convert enhanced decisions back to standard format for report generator
    const standardCategorized = {
      passed: scanResults.filter((r: PageScanResult) => 
        decisions.find((d: any) => d.url === r.url && d.category === 'PASSED')
      ),
      minorIssues: scanResults.filter((r: PageScanResult) => 
        decisions.find((d: any) => d.url === r.url && d.category === 'MINOR_ISSUES')
      ),
      claudeNeeded: scanResults.filter((r: PageScanResult) => 
        decisions.find((d: any) => d.url === r.url && d.category === 'CLAUDE_NEEDED')
      ),
      critical: scanResults.filter((r: PageScanResult) => 
        decisions.find((d: any) => d.url === r.url && d.category === 'CRITICAL')
      )
    };
    
    // Generate reports
    await this.reportGenerator.generateReport(
      standardCategorized,
      claudeResults,
      this.metrics.startTime,
      new Date()
    );
    
    // Export all formats
    this.reportGenerator.exportToJSON();
    this.reportGenerator.exportToHTML();
    this.reportGenerator.exportToExcel();
    this.reportGenerator.exportToCSV();
    
    // Generate enhanced insights report
    await this.generateInsightsReport(decisions, claudeResults);
    
    // Store phase metrics
    this.metrics.phaseDurations.set('reporting', Date.now() - phaseStart);
    
    console.log(`Reports generated in: ${this.options.output}/final-reports`);
  }

  private async performLearningAndOptimization(): Promise<void> {
    const phaseStart = Date.now();
    console.log('\n=== Phase 5: Learning and Optimization ===');
    
    // Get all insights from agents
    const allInsights = this.communicationHub.getInsights();
    console.log(`Collected ${allInsights.length} insights from agents`);
    
    // Analyze communication patterns
    const messageAnalysis = this.communicationHub.analyzeMessagePatterns();
    console.log('\nCommunication Analysis:');
    console.log(`- Message Volume:`, messageAnalysis.messageVolume);
    console.log(`- Bottlenecks:`, messageAnalysis.bottlenecks);
    console.log(`- Recommendations:`, messageAnalysis.recommendations);
    
    // Export learning data
    const learningData = this.decisionAgent.exportLearningInsights();
    await this.saveLearningData(learningData);
    
    // Generate optimization recommendations
    this.generateOptimizationRecommendations(allInsights, messageAnalysis);
    
    // Store phase metrics
    this.metrics.phaseDurations.set('learning', Date.now() - phaseStart);
  }

  private generateOptimizationRecommendations(insights: any[], messageAnalysis: any): void {
    // Based on insights, generate recommendations
    const highConfidenceInsights = insights.filter(i => i.confidence > 0.8);
    
    if (highConfidenceInsights.length > 0) {
      this.metrics.recommendations.push(
        ...highConfidenceInsights
          .filter(i => i.suggestedActions)
          .flatMap(i => i.suggestedActions)
      );
    }
    
    // Add message analysis recommendations
    if (messageAnalysis.recommendations.length > 0) {
      this.metrics.recommendations.push(...messageAnalysis.recommendations);
    }
    
    // Add workflow-specific recommendations
    const claudeMetrics = this.metrics.agentMetrics.get('claude-analyst');
    if (claudeMetrics && claudeMetrics.totalCost > 50) {
      this.metrics.recommendations.push(
        'Consider implementing pre-filtering to reduce Claude analysis costs'
      );
    }
  }

  private async generateInsightsReport(decisions: any[], claudeResults: AnalysisResult[]): Promise<void> {
    const insightsReport = {
      generatedAt: new Date().toISOString(),
      workflowMetrics: {
        totalDuration: Date.now() - this.metrics.startTime.getTime(),
        phaseDurations: Object.fromEntries(this.metrics.phaseDurations),
        agentMetrics: Object.fromEntries(this.metrics.agentMetrics)
      },
      decisionInsights: {
        totalPages: decisions.length,
        averageConfidence: this.calculateAvgConfidence(decisions),
        lowConfidencePages: decisions.filter(d => d.reasoning.confidence < 0.6).map(d => ({
          url: d.url,
          confidence: d.reasoning.confidence,
          uncertaintyFactors: d.uncertaintyFactors
        })),
        commonPatterns: this.extractCommonPatterns(decisions)
      },
      agentInsights: this.communicationHub.getInsights(),
      recommendations: [...new Set(this.metrics.recommendations)],
      learningOpportunities: this.identifyLearningOpportunities(decisions, claudeResults)
    };
    
    const insightsPath = path.join(this.options.output, 'final-reports', 'workflow-insights.json');
    await fs.promises.writeFile(insightsPath, JSON.stringify(insightsReport, null, 2));
    console.log(`Insights report saved to: ${insightsPath}`);
  }

  private extractCommonPatterns(decisions: any[]): any[] {
    const patternMap = new Map<string, number>();
    
    decisions.forEach(d => {
      d.reasoning.factors.forEach((f: any) => {
        if (f.type === 'pattern') {
          patternMap.set(f.description, (patternMap.get(f.description) || 0) + 1);
        }
      });
    });
    
    return Array.from(patternMap.entries())
      .filter(([_, count]) => count > 1)
      .map(([pattern, count]) => ({ pattern, occurrences: count }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  private identifyLearningOpportunities(decisions: any[], claudeResults: AnalysisResult[]): string[] {
    const opportunities: string[] = [];
    
    // High uncertainty decisions
    const uncertainDecisions = decisions.filter(d => d.uncertaintyFactors.length > 2);
    if (uncertainDecisions.length > 0) {
      opportunities.push(
        `${uncertainDecisions.length} pages had high uncertainty - review these cases to improve decision criteria`
      );
    }
    
    // Misaligned priorities
    const priorityMisalignment = decisions.filter(d => {
      const claudeResult = claudeResults.find(c => c.url === d.url);
      return claudeResult && 
        d.priority === 'Low' && 
        claudeResult.remediationSteps.some(s => s.priority === 'Critical');
    });
    
    if (priorityMisalignment.length > 0) {
      opportunities.push(
        `${priorityMisalignment.length} pages had priority misalignment between decision and Claude analysis`
      );
    }
    
    return opportunities;
  }

  private async saveLearningData(learningData: any): Promise<void> {
    const learningPath = path.join(this.options.output, 'learning-data.json');
    await fs.promises.writeFile(learningPath, JSON.stringify(learningData, null, 2));
    console.log(`Learning data saved to: ${learningPath}`);
  }

  private storeDecisionsForLearning(decisions: any[]): void {
    const decisionPath = path.join(this.options.output, 'decision-history.json');
    
    // Append to existing history if it exists
    let history: any[] = [];
    if (fs.existsSync(decisionPath)) {
      try {
        history = JSON.parse(fs.readFileSync(decisionPath, 'utf-8'));
      } catch (e) {
        console.warn('Could not read existing decision history');
      }
    }
    
    history.push({
      timestamp: new Date().toISOString(),
      decisions: decisions.map(d => ({
        url: d.url,
        category: d.category,
        confidence: d.reasoning.confidence,
        factors: d.reasoning.factors.length,
        alternativeDecisions: d.reasoning.alternativeDecisions.length
      }))
    });
    
    fs.writeFileSync(decisionPath, JSON.stringify(history, null, 2));
  }

  private calculateAvgConfidence(decisions: any[]): string {
    if (decisions.length === 0) return '0%';
    
    const avgConfidence = decisions.reduce((sum, d) => 
      sum + (d.reasoning?.confidence || d.confidence || 0), 0
    ) / decisions.length;
    
    return `${(avgConfidence * 100).toFixed(1)}%`;
  }

  private async waitForResponse(correlationId: string, timeout: number = 5000): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const messages = this.communicationHub.getMessages('bulk-scanner', ['response']);
      if (messages.some(m => m.correlationId === correlationId)) {
        return;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  private finalizeWorkflow(): void {
    this.metrics.endTime = new Date();
    const totalDuration = this.metrics.endTime.getTime() - this.metrics.startTime.getTime();
    
    console.log('\n=== Workflow Complete ===');
    console.log(`Total Duration: ${this.formatDuration(totalDuration)}`);
    console.log('\nPhase Durations:');
    this.metrics.phaseDurations.forEach((duration, phase) => {
      console.log(`- ${phase}: ${this.formatDuration(duration)}`);
    });
    
    console.log('\nKey Insights:');
    this.metrics.insights.slice(0, 5).forEach(insight => {
      console.log(`- ${insight}`);
    });
    
    console.log('\nRecommendations:');
    [...new Set(this.metrics.recommendations)].slice(0, 5).forEach(rec => {
      console.log(`- ${rec}`);
    });
    
    // Broadcast final status
    this.orchestratorComm.broadcastWorkflowStatus({
      phase: 'complete',
      progress: 100,
      estimatedCompletion: new Date().toISOString()
    });
  }

  private formatDuration(ms: number): string {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  }

  private handleWorkflowError(error: any): void {
    console.error('Workflow failed:', error);
    
    // Save error report
    const errorReport = {
      timestamp: new Date().toISOString(),
      error: error.message || String(error),
      stack: error.stack,
      metrics: Object.fromEntries(this.metrics.agentMetrics),
      phaseDurations: Object.fromEntries(this.metrics.phaseDurations)
    };
    
    const errorPath = path.join(this.options.output, 'workflow-error.json');
    fs.writeFileSync(errorPath, JSON.stringify(errorReport, null, 2));
    console.error(`Error report saved to: ${errorPath}`);
  }
}

async function main() {
  program
    .option('-i, --input <file>', 'Input file with URLs to test', 'config/urls-to-test.json')
    .option('-w, --workers <number>', 'Number of concurrent workers', '5')
    .option('-o, --output <directory>', 'Output directory for results', 'results')
    .option('--skip-claude', 'Skip Claude analysis and only run bulk scanning')
    .option('--learning-mode', 'Enable learning mode to improve future decisions')
    .parse();

  const options = program.opts();
  
  console.log('Enhanced Accessibility Testing Agent Workflow');
  console.log('============================================');
  console.log(`Input file: ${options.input}`);
  console.log(`Workers: ${options.workers}`);
  console.log(`Output directory: ${options.output}`);
  console.log(`Learning mode: ${options.learningMode ? 'Enabled' : 'Disabled'}`);
  
  try {
    // Load URLs
    const urlsConfig = await loadUrls(options.input);
    console.log(`\nLoaded ${urlsConfig.urls.length} URLs to test`);
    
    // Create orchestrator and run workflow
    const orchestrator = new EnhancedAccessibilityOrchestrator(options, urlsConfig);
    await orchestrator.runWorkflow(urlsConfig.urls);
    
    console.log('\n✅ Enhanced workflow completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Workflow failed:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}