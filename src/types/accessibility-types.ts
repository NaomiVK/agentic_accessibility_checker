export interface ViolationResult {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  description: string;
  help: string;
  helpUrl: string;
  nodes: ViolationNode[];
  tags: string[];
}

export interface ViolationNode {
  any: CheckResult[];
  all: CheckResult[];
  none: CheckResult[];
  html: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  target: string[];
}

export interface CheckResult {
  id: string;
  impact: 'minor' | 'moderate' | 'serious' | 'critical';
  message: string;
  data: unknown;
  relatedNodes: RelatedNode[];
}

export interface RelatedNode {
  target: string[];
  html: string;
}

export interface PageScanResult {
  url: string;
  timestamp: string;
  violations: ViolationResult[];
  passes: ViolationResult[];
  incomplete: ViolationResult[];
  inapplicable: ViolationResult[];
  scanDuration: number;
  error?: string;
}

export interface PageData {
  url: string;
  violations: ViolationResult[];
  pageContext?: {
    title: string;
    description: string;
    hasForm: boolean;
    hasNavigation: boolean;
    hasModal: boolean;
  };
}

export interface DecisionResult {
  passed: PageScanResult[];
  minorIssues: PageScanResult[];
  claudeNeeded: PageScanResult[];
  critical: PageScanResult[];
}

export interface BulkScanOptions {
  maxWorkers: number;
  outputDirectory: string;
  timeout?: number;
  retryAttempts?: number;
}