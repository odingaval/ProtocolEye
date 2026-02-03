export interface AuditResult {
  executiveSummary: {
    status: 'Pass' | 'Fail' | 'Caution';
    summary: string;
  };
  protocolMatches: string[];
  discrepancyLog: Array<{
    discrepancy: string;
    reference?: string;
  }>;
  reasoningTrace?: string;
}