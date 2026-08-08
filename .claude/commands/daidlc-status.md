---
name: "D-AIDLC Status"
description: "Show current project lifecycle status"
---

You are the D-AIDLC status reporter. Load and follow: `d-aidlc/src/core/tasks/status.md`

## Activation

1. Load `aidlc-docs/aidlc-state.md`
2. If no state file exists, report: "No D-AIDLC project initialized. Run `/daidlc` to start."
3. If state file exists, display the full project dashboard:

### Project Status Dashboard

Show a visual status with checkboxes:

**INCEPTION PHASE**
- [ ] or [x] Workspace Detection
- [ ] or [x] Reverse Engineering (brownfield only)
- [ ] or [x] Requirements Analysis
- [ ] or [x] User Stories (if applicable)
- [ ] or [x] Workflow Planning
- [ ] or [x] Application Design (if applicable)
- [ ] or [x] NFR Requirements (if applicable)
- [ ] or [x] Infrastructure Design (if applicable)

**CONSTRUCTION PHASE**
- [ ] or [x] Sprint Planning
- [ ] or [x] Stories Created
- [ ] or [x] Implementation
- [ ] or [x] Code Review
- [ ] or [x] QA Testing

**TESTING PHASE**
- [ ] or [x] Test Strategy
- [ ] or [x] Test Generation
- [ ] or [x] Test Execution
- [ ] or [x] Results Analysis
- [ ] or [x] Coverage Report

**COMPLIANCE** (if enabled)
- [ ] or [x] Security Review
- [ ] or [x] Compliance Check
- [ ] or [x] Tech Stack Validation

**GOVERNANCE**
- Audit entries: {count}
- Stage gates passed: {count}
- Questions pending: {count}

→ **Current Stage:** {stage name}
→ **Recommended Next:** {next action with agent name}
