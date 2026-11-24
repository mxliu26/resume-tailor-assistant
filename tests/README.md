# Offline Automated Tests

This directory checks program rules in the v21 showcase package: material fidelity, experience sources, follow-up states, factual boundaries, review/editing, and local interfaces. Source commit: `58a25be1097a7902058a3c0a78415a2c90408cc5`. Per-file hashes, packaging changes, and purposes are in [SOURCES.json](SOURCES.json).

## Run

Use Node.js 20.12 or later. The suite uses Node's built-in test runner, with no npm dependencies or API key required.

From the project root:

```powershell
npm test
```

Equivalent command:

```powershell
node --test
```

To check experience boundaries alone:

```powershell
node --test tests/experience-boundaries.test.mjs
```

PDF extraction tests also need Python and pypdf from `requirements.txt`. Run `python -m pip install -r requirements.txt` first. If automatic interpreter selection does not find the environment with those dependencies, set `$env:PYTHON` to that interpreter's path in the current terminal. Missing dependencies cause explicit test failures, not silent skips.

## Calls and Data Scope

- Model behavior uses fixed responses or test-constructed data. No requests go to DeepSeek or other external models, and no API cost is incurred.
- `server.test.mjs` and `ai-pipeline.test.mjs` use random available ports on `127.0.0.1` and close their own servers afterward. Existing demo ports are unaffected. Test branches named `live` connect to a local fake upstream to exercise the real interface-handling logic.
- `fixtures/` contains fictional material and necessary responses, not private resumes, real keys, browser task backups, or full execution logs. Phone numbers, emails, and key strings in tests are explicitly constructed placeholders.
- Some tests import `server.mjs`, which retains its existing configuration-loading behavior. Model calls are explicitly replaced with fixed responses, and local-interface subprocesses override the model URL and test key. No `.env` creation or modification is required.
- Tests do not read or write browser tasks. State changes use test-created in-memory objects. Normal execution does not change product source files.

## Test Inventory

| File | Checks |
| --- | --- |
| [ai-pipeline.test.mjs](ai-pipeline.test.mjs) | Original-text coverage, evidence and question validation, stale-response protection, and model-client errors. |
| [analysis-model.test.js](analysis-model.test.js) | Derived requirement judgments, association evidence, and rewrite selection. |
| [comparison-view.test.js](comparison-view.test.js) | Matching views, follow-up forms, user-text escaping, and rendering. |
| [domain.test.js](domain.test.js) | Material segmentation, fact conflicts, mock suggestions, final-text assembly, and pre-save checks. |
| [education-condition.test.mjs](education-condition.test.mjs) | Separation of education categories from preference strength; no mechanical reclassification of mixed requirements. |
| [evidence-scope-retry.test.mjs](evidence-scope-retry.test.mjs) | One correction attempt for cross-experience evidence, full revalidation, and the boundary between JD titles and actual requirements. |
| [experience-boundaries.test.mjs](experience-boundaries.test.mjs) | Independent experience boundaries, source IDs, original-text integrity, and preservation of multiple phases within one project. |
| [followup-state.test.js](followup-state.test.js) | Answer editing, cancellation, replacement, confirmation, and preservation of facts and sources. |
| [manual-followup-payload.test.mjs](manual-followup-payload.test.mjs) | Transmission of manual associations and answer states; old responses must not overwrite newer edits. |
| [pdf-evidence-quote.test.mjs](pdf-evidence-quote.test.mjs) | Equivalent Chinese PDF line breaks without weakening number, negation, or source-attribution checks. |
| [pdf-tool-spacing.test.mjs](pdf-tool-spacing.test.mjs) | Narrow MATLAB spacing equivalence; other unsupported tools and cross-source joins remain rejected. |
| [review-presentation.test.js](review-presentation.test.js) | Review-page grouping, requirement categories, and text-change presentation. |
| [review-state.test.js](review-state.test.js) | Material-review drafts, formatting changes, fact confirmation, and result invalidation. |
| [rewrite-editor.test.js](rewrite-editor.test.js) | Original/suggestion/manual-edit differences and text protection. |
| [role-attribution.test.js](role-attribution.test.js) | Leadership by another responsible person versus personal leadership, retaining other factual limits. |
| [server.test.mjs](server.test.mjs) | Local HTTP interfaces, authorization, privacy, concurrency, errors, PDF extraction, and static resources. |
| [unit-presentation.test.js](unit-presentation.test.js) | Experience titles, dates, section labels, and body-text preservation. |
| [condition-contract.test.mjs](condition-contract.test.mjs) | Separate states for explicit conditions and capability evidence; definite judgments need matching evidence. |
| [none-authorization.test.mjs](none-authorization.test.mjs) | Missing, unknown, or skipped information must not mean never done; negative claims stay within the original requirement/experience pair. |
| [resolved-questions.test.mjs](resolved-questions.test.mjs) | Answered, unknown, not-done, skipped, and archived states prevent repeated questions. |
| [parse-identity.test.mjs](parse-identity.test.mjs) | Identity placeholders and original offsets; missing key facts still cause rejection. |
| [factual-boundary.test.mjs](factual-boundary.test.mjs) | Team achievements, not-launched and no-interview facts, and exclusion of non-factual instructions from evidence. |
| [precise-followup.test.mjs](precise-followup.test.mjs) | The v21 follow-up contract, grouping related gaps within an experience, draft protection, and confirmation scope. |
| [job-targeting.test.mjs](job-targeting.test.mjs) | Sources and emphasis for different JDs, recommendation order, keeping the original, and factual boundaries. |

## Interpreting Results

A pass means the program assertions held for these fixed inputs. A test for unsupported facts can pass because the program correctly rejected the input. This does not establish that a model never produces errors.

These tests do not replace real browser interaction, AI writing-quality evaluation, or human review. They do not measure satisfaction, manual corrections, or human completion time. Historical development-set scores and five-case synthetic runs remain separate; offline replay is not relabeled as a new real-API test.

The recorded package verification is in [VERIFICATION.md](VERIFICATION.md). The original Chinese test fixtures and provenance records are retained unchanged.
