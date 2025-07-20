import { PageScanResult } from '../types/accessibility-types';
import { AnalysisResult } from '../types/claude-types';
import { EnhancedPageDecision, DecisionReasoning } from './enhanced-decision-agent';

/**
 * Agent Communication Protocol
 * Enables agents to share insights, coordinate actions, and learn from each other
 */

export interface AgentMessage {
  id: string;
  timestamp: string;
  fromAgent: AgentType;
  toAgent: AgentType | 'broadcast';
  messageType: MessageType;
  priority: MessagePriority;
  payload: unknown;
  requiresResponse: boolean;
  correlationId?: string;
}

export type AgentType = 'bulk-scanner' | 'decision-agent' | 'claude-analyst' | 'report-generator' | 'orchestrator';
export type MessageType = 'insight' | 'request' | 'response' | 'feedback' | 'alert' | 'coordination';
export type MessagePriority = 'low' | 'medium' | 'high' | 'critical';

export interface AgentInsight {
  type: 'pattern' | 'anomaly' | 'optimization' | 'learning';
  description: string;
  evidence: unknown[];
  confidence: number;
  actionable: boolean;
  suggestedActions?: string[];
}

export interface CoordinationRequest {
  action: 'prioritize' | 'batch' | 'sequence' | 'parallelize';
  resources: string[];
  constraints: Record<string, unknown>;
  deadline?: string;
}

export interface FeedbackMessage {
  targetAction: string;
  outcome: 'success' | 'failure' | 'partial';
  metrics: Record<string, number>;
  learnings: string[];
  improvements?: string[];
}

export class AgentCommunicationHub {
  private messageQueue: Map<AgentType, AgentMessage[]>;
  private subscribers: Map<MessageType, Set<(message: AgentMessage) => void>>;
  private messageHistory: AgentMessage[];
  private insightCache: Map<string, AgentInsight[]>;
  private coordinationState: Map<string, CoordinationRequest>;

  constructor() {
    this.messageQueue = new Map();
    this.subscribers = new Map();
    this.messageHistory = [];
    this.insightCache = new Map();
    this.coordinationState = new Map();
    
    // Initialize queues for each agent
    const agents: AgentType[] = ['bulk-scanner', 'decision-agent', 'claude-analyst', 'report-generator', 'orchestrator'];
    agents.forEach(agent => this.messageQueue.set(agent, []));
  }

  /**
   * Send a message between agents
   */
  public sendMessage(message: Omit<AgentMessage, 'id' | 'timestamp'>): string {
    const fullMessage: AgentMessage = {
      ...message,
      id: this.generateMessageId(),
      timestamp: new Date().toISOString()
    };

    // Add to history
    this.messageHistory.push(fullMessage);

    // Route message
    if (message.toAgent === 'broadcast') {
      // Broadcast to all agents
      for (const [agent, queue] of this.messageQueue.entries()) {
        if (agent !== message.fromAgent) {
          queue.push(fullMessage);
        }
      }
    } else {
      // Direct message
      const targetQueue = this.messageQueue.get(message.toAgent);
      if (targetQueue) {
        targetQueue.push(fullMessage);
      }
    }

    // Notify subscribers
    const subscribers = this.subscribers.get(message.messageType);
    if (subscribers) {
      subscribers.forEach(callback => callback(fullMessage));
    }

    this.logMessage(fullMessage);
    
    return fullMessage.id;
  }

  /**
   * Retrieve messages for an agent
   */
  public getMessages(agent: AgentType, messageTypes?: MessageType[]): AgentMessage[] {
    const queue = this.messageQueue.get(agent) || [];
    
    if (messageTypes) {
      return queue.filter(msg => messageTypes.includes(msg.messageType));
    }
    
    return [...queue];
  }

  /**
   * Clear processed messages
   */
  public clearMessages(agent: AgentType, messageIds: string[]): void {
    const queue = this.messageQueue.get(agent);
    if (queue) {
      const remaining = queue.filter(msg => !messageIds.includes(msg.id));
      this.messageQueue.set(agent, remaining);
    }
  }

  /**
   * Subscribe to specific message types
   */
  public subscribe(messageType: MessageType, callback: (message: AgentMessage) => void): () => void {
    const subscribers = this.subscribers.get(messageType) || new Set();
    subscribers.add(callback);
    this.subscribers.set(messageType, subscribers);

    // Return unsubscribe function
    return () => {
      subscribers.delete(callback);
    };
  }

  /**
   * Share insight between agents
   */
  public shareInsight(fromAgent: AgentType, insight: AgentInsight): void {
    // Cache insight
    const key = `${fromAgent}-${insight.type}`;
    const insights = this.insightCache.get(key) || [];
    insights.push(insight);
    this.insightCache.set(key, insights);

    // Broadcast high-confidence insights
    if (insight.confidence > 0.7 && insight.actionable) {
      this.sendMessage({
        fromAgent,
        toAgent: 'broadcast',
        messageType: 'insight',
        priority: insight.confidence > 0.9 ? 'high' : 'medium',
        payload: insight,
        requiresResponse: false
      });
    }
  }

  /**
   * Request coordination between agents
   */
  public requestCoordination(fromAgent: AgentType, request: CoordinationRequest): string {
    const correlationId = this.generateCorrelationId();
    
    this.coordinationState.set(correlationId, request);

    this.sendMessage({
      fromAgent,
      toAgent: 'orchestrator',
      messageType: 'coordination',
      priority: 'high',
      payload: request,
      requiresResponse: true,
      correlationId
    });

    return correlationId;
  }

  /**
   * Send feedback on completed actions
   */
  public sendFeedback(fromAgent: AgentType, toAgent: AgentType, feedback: FeedbackMessage): void {
    this.sendMessage({
      fromAgent,
      toAgent,
      messageType: 'feedback',
      priority: feedback.outcome === 'failure' ? 'high' : 'medium',
      payload: feedback,
      requiresResponse: false
    });

    // Store learnings for future reference
    if (feedback.learnings.length > 0) {
      this.shareInsight(fromAgent, {
        type: 'learning',
        description: `Feedback from ${feedback.targetAction}: ${feedback.learnings.join('; ')}`,
        evidence: [feedback],
        confidence: 0.8,
        actionable: true,
        suggestedActions: feedback.improvements
      });
    }
  }

  /**
   * Get insights by type and agent
   */
  public getInsights(agent?: AgentType, type?: AgentInsight['type']): AgentInsight[] {
    const insights: AgentInsight[] = [];
    
    for (const [key, cachedInsights] of this.insightCache.entries()) {
      const [cachedAgent, cachedType] = key.split('-') as [AgentType, AgentInsight['type']];
      
      if ((!agent || cachedAgent === agent) && (!type || cachedType === type)) {
        insights.push(...cachedInsights);
      }
    }
    
    return insights.sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Analyze message patterns for optimization
   */
  public analyzeMessagePatterns(): {
    messageVolume: Record<AgentType, number>;
    averageResponseTime: Record<string, number>;
    bottlenecks: string[];
    recommendations: string[];
  } {
    const messageVolume: Record<AgentType, number> = {} as Record<AgentType, number>;
    const responseTime: Map<string, number[]> = new Map();
    const bottlenecks: string[] = [];
    const recommendations: string[] = [];

    // Analyze message volume
    for (const msg of this.messageHistory) {
      messageVolume[msg.fromAgent] = (messageVolume[msg.fromAgent] || 0) + 1;
    }

    // Analyze response times
    const requests = this.messageHistory.filter(m => m.requiresResponse);
    const responses = this.messageHistory.filter(m => m.correlationId);

    for (const request of requests) {
      const response = responses.find(r => r.correlationId === request.id);
      if (response) {
        const time = new Date(response.timestamp).getTime() - new Date(request.timestamp).getTime();
        const key = `${request.fromAgent}-${request.toAgent}`;
        const times = responseTime.get(key) || [];
        times.push(time);
        responseTime.set(key, times);
      }
    }

    // Calculate average response times
    const averageResponseTime: Record<string, number> = {};
    for (const [key, times] of responseTime.entries()) {
      averageResponseTime[key] = times.reduce((a, b) => a + b, 0) / times.length;
    }

    // Identify bottlenecks
    for (const [agent] of Object.entries(messageVolume)) {
      const queueSize = this.messageQueue.get(agent as AgentType)?.length || 0;
      if (queueSize > 10) {
        bottlenecks.push(`${agent} has ${queueSize} unprocessed messages`);
      }
    }

    // Generate recommendations
    if (bottlenecks.length > 0) {
      recommendations.push('Consider increasing processing capacity for bottlenecked agents');
    }

    const slowResponses = Object.entries(averageResponseTime).filter(([_, time]) => time > 5000);
    if (slowResponses.length > 0) {
      recommendations.push(`Optimize response time for: ${slowResponses.map(([k]) => k).join(', ')}`);
    }

    return { messageVolume, averageResponseTime, bottlenecks, recommendations };
  }

  private generateMessageId(): string {
    return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateCorrelationId(): string {
    return `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private logMessage(message: AgentMessage): void {
    const logLevel = message.priority === 'critical' ? 'error' : 
                     message.priority === 'high' ? 'warn' : 'info';
    
    console[logLevel](`[AGENT-COMM] ${message.fromAgent} → ${message.toAgent}: ${message.messageType}`, {
      id: message.id,
      priority: message.priority,
      payloadSize: JSON.stringify(message.payload).length
    });
  }
}

/**
 * Agent-specific communication interfaces
 */

export class BulkScannerCommunicator {
  constructor(private hub: AgentCommunicationHub) {}

  public notifyScanProgress(processed: number, total: number, pagesWithIssues: number): void {
    this.hub.sendMessage({
      fromAgent: 'bulk-scanner',
      toAgent: 'orchestrator',
      messageType: 'insight',
      priority: 'low',
      payload: {
        type: 'progress',
        processed,
        total,
        pagesWithIssues,
        percentComplete: (processed / total) * 100
      },
      requiresResponse: false
    });
  }

  public reportAnomalies(anomalies: { url: string; issue: string }[]): void {
    if (anomalies.length > 0) {
      this.hub.shareInsight('bulk-scanner', {
        type: 'anomaly',
        description: `Detected ${anomalies.length} scanning anomalies`,
        evidence: anomalies,
        confidence: 0.9,
        actionable: true,
        suggestedActions: ['Review scan configuration', 'Check network stability']
      });
    }
  }

  public requestPrioritization(urls: string[]): string {
    return this.hub.requestCoordination('bulk-scanner', {
      action: 'prioritize',
      resources: urls,
      constraints: { maxConcurrent: 5, timeLimit: '1h' }
    });
  }
}

export class DecisionAgentCommunicator {
  constructor(private hub: AgentCommunicationHub) {}

  public shareDecisionInsights(decisions: EnhancedPageDecision[]): void {
    // Aggregate patterns
    const patterns = this.identifyDecisionPatterns(decisions);
    
    patterns.forEach(pattern => {
      this.hub.shareInsight('decision-agent', {
        type: 'pattern',
        description: pattern.description,
        evidence: pattern.evidence,
        confidence: pattern.confidence,
        actionable: true,
        suggestedActions: pattern.actions
      });
    });
  }

  public requestClaudeAnalysis(pages: PageScanResult[], reasoning: DecisionReasoning[]): string {
    return this.hub.sendMessage({
      fromAgent: 'decision-agent',
      toAgent: 'claude-analyst',
      messageType: 'request',
      priority: 'high',
      payload: {
        pages,
        reasoning,
        focusAreas: reasoning.flatMap(r => r.factors.filter(f => f.weight > 0.7).map(f => f.description))
      },
      requiresResponse: true
    });
  }

  private identifyDecisionPatterns(decisions: EnhancedPageDecision[]): Array<{
    description: string;
    evidence: unknown[];
    confidence: number;
    actions: string[];
  }> {
    const patterns = [];
    
    // Low confidence decisions pattern
    const lowConfidence = decisions.filter(d => d.reasoning.confidence < 0.6);
    if (lowConfidence.length > decisions.length * 0.3) {
      patterns.push({
        description: 'High percentage of low-confidence decisions indicates need for refined criteria',
        evidence: lowConfidence.map(d => ({ url: d.url, confidence: d.reasoning.confidence })),
        confidence: 0.8,
        actions: ['Review decision thresholds', 'Gather more training data']
      });
    }
    
    // Recurring violation patterns
    const violationCounts = new Map<string, number>();
    decisions.forEach(d => {
      d.complexViolations.forEach(v => {
        violationCounts.set(v, (violationCounts.get(v) || 0) + 1);
      });
    });
    
    const recurringViolations = Array.from(violationCounts.entries())
      .filter(([_, count]) => count > decisions.length * 0.5)
      .map(([violation]) => ({ violation, count: violationCounts.get(violation)! }));
    
    if (recurringViolations.length > 0) {
      patterns.push({
        description: 'Systemic violations detected across multiple pages',
        evidence: recurringViolations,
        confidence: 0.9,
        actions: ['Create targeted remediation guide', 'Update development standards']
      });
    }
    
    return patterns;
  }
}

export class ClaudeAnalystCommunicator {
  constructor(private hub: AgentCommunicationHub) {}

  public shareAnalysisResults(results: AnalysisResult[]): void {
    // Share critical findings
    const criticalFindings = results.filter(r => 
      r.remediationSteps.some(step => step.priority === 'Critical')
    );

    if (criticalFindings.length > 0) {
      this.hub.sendMessage({
        fromAgent: 'claude-analyst',
        toAgent: 'broadcast',
        messageType: 'alert',
        priority: 'critical',
        payload: {
          message: `${criticalFindings.length} pages with critical accessibility issues requiring immediate attention`,
          pages: criticalFindings.map(f => f.url),
          topIssues: this.extractTopIssues(criticalFindings)
        },
        requiresResponse: false
      });
    }

    // Share cost optimization insights
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    if (totalCost > 10) {
      this.hub.shareInsight('claude-analyst', {
        type: 'optimization',
        description: `High analysis cost detected: $${totalCost.toFixed(2)}`,
        evidence: [{ totalPages: results.length, avgCost: totalCost / results.length }],
        confidence: 1.0,
        actionable: true,
        suggestedActions: [
          'Refine decision criteria to reduce false positives',
          'Batch similar pages for combined analysis'
        ]
      });
    }
  }

  public requestBatchOptimization(pages: string[]): void {
    this.hub.requestCoordination('claude-analyst', {
      action: 'batch',
      resources: pages,
      constraints: { 
        maxBatchSize: 10,
        similarityThreshold: 0.8,
        costLimit: 5.0
      }
    });
  }

  private extractTopIssues(results: AnalysisResult[]): string[] {
    const issueCounts = new Map<string, number>();
    
    results.forEach(result => {
      result.remediationSteps.forEach(step => {
        issueCounts.set(step.issue, (issueCounts.get(step.issue) || 0) + 1);
      });
    });
    
    return Array.from(issueCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);
  }
}

export class OrchestratorCommunicator {
  constructor(private hub: AgentCommunicationHub) {}

  public handleCoordinationRequests(): void {
    const messages = this.hub.getMessages('orchestrator', ['coordination']);
    
    messages.forEach(msg => {
      const request = msg.payload as CoordinationRequest;
      
      switch (request.action) {
        case 'prioritize':
          this.handlePrioritization(msg);
          break;
        case 'batch':
          this.handleBatching(msg);
          break;
        case 'sequence':
          this.handleSequencing(msg);
          break;
        case 'parallelize':
          this.handleParallelization(msg);
          break;
      }
    });

    // Clear processed messages
    this.hub.clearMessages('orchestrator', messages.map(m => m.id));
  }

  private handlePrioritization(message: AgentMessage): void {
    const request = message.payload as CoordinationRequest;
    const prioritized = this.prioritizeResources(request.resources, request.constraints);
    
    this.hub.sendMessage({
      fromAgent: 'orchestrator',
      toAgent: message.fromAgent,
      messageType: 'response',
      priority: 'medium',
      payload: { prioritized },
      requiresResponse: false,
      correlationId: message.id
    });
  }

  private prioritizeResources(resources: string[], _constraints: Record<string, unknown>): string[] {
    // Simple prioritization logic - can be enhanced
    return resources.sort((a, b) => {
      // Prioritize shorter URLs (likely homepages)
      return a.length - b.length;
    });
  }

  private handleBatching(message: AgentMessage): void {
    const request = message.payload as CoordinationRequest;
    const batches = this.createBatches(request.resources, request.constraints);
    
    this.hub.sendMessage({
      fromAgent: 'orchestrator',
      toAgent: message.fromAgent,
      messageType: 'response',
      priority: 'medium',
      payload: { batches },
      requiresResponse: false,
      correlationId: message.id
    });
  }

  private createBatches(resources: string[], constraints: Record<string, unknown>): string[][] {
    const maxBatchSize = (constraints.maxBatchSize as number) || 10;
    const batches: string[][] = [];
    
    for (let i = 0; i < resources.length; i += maxBatchSize) {
      batches.push(resources.slice(i, i + maxBatchSize));
    }
    
    return batches;
  }

  private handleSequencing(_message: AgentMessage): void {
    // Implement sequencing logic
  }

  private handleParallelization(_message: AgentMessage): void {
    // Implement parallelization logic
  }

  public broadcastWorkflowStatus(status: {
    phase: string;
    progress: number;
    estimatedCompletion: string;
  }): void {
    this.hub.sendMessage({
      fromAgent: 'orchestrator',
      toAgent: 'broadcast',
      messageType: 'insight',
      priority: 'low',
      payload: status,
      requiresResponse: false
    });
  }
}