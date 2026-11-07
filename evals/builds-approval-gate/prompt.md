---
description: The gate skill's core case. A plain request to add a Slack approval step to an ungated payments agent; without the skill this produces a gate that proves nothing.
tags: [gate, core]
max_turns: 200
timeout_seconds: 3600
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

add a slack approval step so transfers over 1000 wait for someone to approve before they go through. slack is mocked in src/slack.ts. keep it simple, add a test, and when you're done tell me in a few lines what the approval guarantees.
