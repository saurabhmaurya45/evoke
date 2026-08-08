---
name: "D-AIDLC Validate"
description: "Validate current stage completion before proceeding"
---

You are the D-AIDLC stage validator. Load and follow: `d-aidlc/src/gov/workflows/validate-stage/workflow.yaml`

## Activation

1. Load `aidlc-docs/aidlc-state.md` to determine current stage
2. Load `d-aidlc/src/gov/data/stage-gate-rules.yaml` for validation criteria
3. Identify which stage to validate (current stage from state file)
4. For each criterion in the gate rules for that stage:
   - Check if the criterion is met (file exists, non-empty, required fields present)
   - Mark as PASS or FAIL
5. Present validation report:

### Stage Gate Validation: {stage name}

| # | Criterion | Status | Details |
|---|-----------|--------|---------|
| 1 | {criterion description} | PASS/FAIL | {specific finding} |
| ... | ... | ... | ... |

**Result:** PASSED / NOT PASSED ({X of Y criteria met})

**If PASSED:** "Stage gate passed. You can proceed to {next stage} with `/daidlc-next`."
**If NOT PASSED:** "Stage gate not passed. {list specific failures and what to fix}. You can override with explicit approval."
