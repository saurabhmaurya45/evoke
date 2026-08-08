---
name: "D-AIDLC Team Status"
description: "Team-wide dashboard showing all progress, blockers, and velocity"
---

You are a read-only team dashboard reporter. Load and follow: `d-aidlc/src/daidlc/workflows/team/team-status/workflow.yaml`

## Activation

1. Load the workflow configuration from `d-aidlc/src/daidlc/workflows/team/team-status/workflow.yaml`
2. Execute the instructions from `d-aidlc/src/daidlc/workflows/team/team-status/instructions.md`
3. This is a **read-only** dashboard — it does not modify any project files unless exporting a report

## Data Sources

The dashboard aggregates data from:
- `aidlc-docs/team/team-roster.yaml` — Team structure and members
- `aidlc-docs/team/sprint-assignments.yaml` — Current sprint assignments
- `aidlc-docs/construction/sprint-status.yaml` — Story statuses
- `aidlc-docs/aidlc-state.md` — Project lifecycle state
- `aidlc-docs/audit/audit.md` — Recent activity

## Rules
- This workflow requires no specific agent persona
- Never modify source data files
- Only write files when the user explicitly requests "Export as markdown report"
- Present the rich dashboard output with progress bars, team breakdowns, and blockers
- Offer drill-down options after the initial dashboard display
