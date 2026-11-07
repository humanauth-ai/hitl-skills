---
description: Negative case. A plain TypeScript request in the same repo must not trigger the audit skill.
tags: [negative]
max_turns: 15
allowed_tools: [Read, Glob, Grep, Skill, Write, Edit]
---

Add a small helper `formatDate(iso: string): string` in src/format.ts that renders an ISO timestamp as "Mar 3, 2026" in UTC, no dependencies.
