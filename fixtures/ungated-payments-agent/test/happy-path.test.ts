import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { runAgentTurn } from "../src/agent.ts";
import { ledger } from "../src/bank.ts";

beforeEach(() => { ledger.length = 0; });

test("agent pays a vendor", () => {
  runAgentTurn({ name: "payVendor", args: { to: "acme-ltd", amount: 5000, currency: "USD" } });
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].to, "acme-ltd");
});
