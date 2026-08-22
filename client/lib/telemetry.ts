export interface CommandExecutionTelemetry {
  command: string;
  durationMs: number;
  exitCode: number;
  timestamp: string;
}

export function trackCommandExecution(telemetry: CommandExecutionTelemetry): void {
  const payload = {
    ...telemetry,
    environment: process.env.NODE_ENV || "development",
  };
  
  if (process.env.DEBUG_TELEMETRY === "true") {
    console.log(`[Telemetry] ${payload.command} exited with code ${payload.exitCode} in ${payload.durationMs}ms`);
  }
}
