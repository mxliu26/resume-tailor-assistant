# Phase Test Reports

This directory summarizes existing tests and human review, from the local demo through real-model integration and fixed-case evaluation. Each phase retains its original code version, test scope, and result attribution.

| Phase | Goal and method | Recorded results | Details |
| --- | --- | --- | --- |
| Phase 1: local demo | Local rules and mock responses; check the five-step flow, saving, confirmation states, and interactions | Owner acceptance of four core functional areas; the last traceable full automated run passed 149/149 | [Phase 1](phase1/TEST_REPORT.md) |
| Phase 2: real-model integration | Three synthetic cases; real DeepSeek calls, necessary follow-ups, fact confirmation, and strict output validation | All three planned cases completed basic integration acceptance, using separately recorded valid steps, targeted retests, and offline replays | [Phase 2](phase2/TEST_REPORT.md) |
| Phase 3: AI evaluation and optimization | Ten fixed development cases and 13 experience units; four-dimension ratings and independent factual checks | Suggestion generation increased from v6's 8/10 to v21's 10/10; formal v21 human ratings totaled 85/13 = 6.54/8 | [Phase 3](phase3/TEST_REPORT.md) |

## Reading the Evidence

- **Execution results** establish what a particular code version completed with specified inputs and actions.
- **AI-assisted preliminary ratings** supply score suggestions and factual review evidence; they remain separate from human confirmation.
- **Formal human ratings** for v21 were confirmed by the project owner after AI-assisted review, not through an independent blind assessment.
- **Historical sources** are linked by ID to the [evidence index](../evidence/source-index.json), with source titles and SHA-256 hashes. The public package contains summaries and synthetic excerpts; complete originals remain in the development archive.

Suggestion generation is measured per case; rewrite quality is scored per experience unit; factual accuracy uses completed unit-level factual reviews as its denominator. Blocked, unreviewed, and unexecuted items are identified separately. They do not count as passes or enter averages as zeroes.

## Current Showcase Verification

The current runtime is `58a25be` with `precise-followup-v21`. Historical formal v21 ratings correspond to `ec6dff9`; these references remain distinct.

| Entry | Purpose |
| --- | --- |
| [tests/](../../tests/README.md) · [Verification](../../tests/VERIFICATION.md) | 336 offline program checks on the showcase package, with no external model calls |
| [qa/](../../qa/README.md) · [Verification](../../qa/VERIFICATION.md) | Five isolated browser scenarios using mock mode or fixed local upstream responses |
| [examples/](../../examples/README.md) | Two synthetic cases with real-model browser workflows, first suggestions, and saved text |
| [Evaluation summary](../EVALUATION_SUMMARY.md) | Confirmed metrics, 13 unit scores, and reporting conventions |
| [Bad cases](../BAD_CASES.md) | Selected problems, causes, changes, and verification |
| [Changelog](../../CHANGELOG.md) | Main iterations, prompt versions, and source commits |

Phase results, current program checks, and browser QA are reported separately; counts are not added across batches. Documentation preparation made 0 new API calls. Automated runtime and agent edits are not treated as real-user metrics.
