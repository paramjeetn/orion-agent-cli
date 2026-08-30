export interface AuditEntry {
  action: string;
  user: string;
  timestamp: string;
}

export function logSecurityAudit(entry: AuditEntry): void {
  if (process.env.NODE_ENV !== "test") {
    console.info(`[SecurityAudit] ${entry.timestamp} | ${entry.user} -> ${entry.action}`);
  }
}
