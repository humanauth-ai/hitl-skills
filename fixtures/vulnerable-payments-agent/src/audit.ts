import { appendFileSync } from "node:fs";

const AUDIT_PATH = process.env.AUDIT_PATH ?? "audit.log";

export function audit(event: string, detail: Record<string, unknown>): void {
  const line = JSON.stringify({ ts: new Date().toISOString(), event, ...detail });
  appendFileSync(AUDIT_PATH, line + "\n");
}
