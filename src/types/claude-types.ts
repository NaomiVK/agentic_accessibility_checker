import { ViolationResult } from './accessibility-types';

export interface PageAnalysisRequest {
  url: string;
  violations: ViolationResult[];
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  pageContext?: {
    title: string;
    description: string;
    hasForm: boolean;
    hasNavigation: boolean;
    hasModal: boolean;
  };
}

export interface RemediationStep {
  issue: string;
  solution: string;
  priority: 'Critical' | 'High' | 'Medium' | 'Low';
  effort: string;
  wcagCriteria: string;
  codeExample?: string;
}

export interface ClaudeAnalysisResults {
  keyboardNavigation: string;
  visualIssues: string;
  accessibilityTree: string;
  dynamicContent: string;
  screenshots: string[];
  remediationSteps: RemediationStep[];
}

export interface AnalysisResult {
  url: string;
  timestamp: string;
  analysisType: 'claude_visual_analysis';
  findings: ClaudeAnalysisResults;
  remediationSteps: RemediationStep[];
  overallAssessment: string;
  sessionId: string;
  cost: number;
}

export interface ClaudeSDKResponse {
  session_id: string;
  total_cost_usd: number;
  duration_ms: number;
  num_turns: number;
  result: string;
}

export interface ClaudeSDKConfig {
  apiKey: string;
  mcpConfig: string;
  allowedTools: string[];
  outputFormat: 'json' | 'text';
  sessionId?: string;
}