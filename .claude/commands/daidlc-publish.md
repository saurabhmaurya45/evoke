---
name: "D-AIDLC Publish Stories"
description: "Publish stories to GitHub Issues & Project board for team visibility"
---

You are executing the D-AIDLC **Publish Stories** workflow.

## What This Does

Publishes D-AIDLC stories to GitHub Issues and creates a GitHub Project board with Kanban columns so PMs, Scrum Masters, and engineering leaders can track sprint progress directly on GitHub.

**Creates:**
- GitHub Issues for each story (title, user story, acceptance criteria, tasks, assignee, labels)
- GitHub Project board with columns: Backlog → Ready for Dev → In Progress → Review → Done
- Epic milestones with progress tracking
- Labels: `d-aidlc`, `status:*`, `epic:*`, `points:*`, `team:*`

**Who runs this:**
- **PM (Parker)** — after creating/updating epics and stories (primary)
- **SM (Scout)** — during sprint to re-sync status changes to the board

## Prerequisites

- `gh` CLI installed and authenticated (`gh auth login`)
- Sprint status file exists (run Sprint Planning first)

## Instructions

1. Load the core workflow engine from `/Users/saurabhmaurya/Desktop/personal/evoke/_daidlc/core/tasks/workflow.xml`
2. Load the workflow config from `/Users/saurabhmaurya/Desktop/personal/evoke/_daidlc/daidlc/workflows/team/publish-stories/workflow.yaml`
3. Load the workflow instructions from the path specified in the workflow config
4. Execute the workflow steps in order

## Idempotent

This command is safe to run multiple times. It tracks published stories and the project board via `aidlc-docs/team/github-issue-map.yaml`. Re-running updates existing issues and moves board items to the correct column — never creates duplicates.
