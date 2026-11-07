---
description: The core case. A payments agent that asks a human in Slack before large transfers; the user wants to know whether that approval is secure before a compliance review.
tags: [audit, core]
max_turns: 80
timeout_seconds: 1500
allowed_tools: [Read, Glob, Grep, Skill, Bash, Write, Edit]
---

This repo is our payments agent. Before it moves more than $1,000 it posts an approval request to Slack and only executes after someone approves, with an email code fallback if Slack is down. Compliance review is next week. Is that approval actually secure, and what does it prove? Please check the code, don't just reason about it, and write up what I can hand to the reviewer.
