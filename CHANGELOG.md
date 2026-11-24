# Changelog

This file summarizes changes from the development records. Prompt versions identify instructions; Git SHAs identify source code in the original development repository. These entries do not represent formal Releases or newly created historical commits.

## English Documentation

- Translated the repository's 20 Markdown documents, workflow diagrams, and file descriptions into English.
- Preserved metric definitions, rating status, version references, and the limits of each result. The interface, prompt, synthetic inputs, original outputs, and evidence records remain unchanged.
- Updated document anchors and the file index. This is a documentation change, with no new model calls or product changes.

## Manual Correction Records and Counting Rules

- Added the project owner's manual records for the same 10 fixed cases: v6 totaled 38 corrections, averaging 3.8; v21 totaled 20, averaging 2.0, approximately 47% fewer.
- Distinguished parsing, matching, rewrite review, and final editing. Normal follow-up answers and necessary factual additions are excluded; final editing distinguishes corrections from personal preferences.
- Added a separate evidence record while preserving earlier score confirmations and runs. Missing event logs and category breakdowns were not reconstructed, and counts were not converted into human time. No new model calls were made.

## Phase Test Documentation

- Summarized the local demo, real-model integration, and fixed development-set evaluation in a testing index and three concise reports.
- Identified historical test code, current showcase code, observed execution results, and human ratings separately, retaining the owner-confirmed reporting conventions.
- Registered source SHA-256 hashes for the historical summaries and updated links and the file index. Documentation only; no new calls or product changes.

## Browser Regression Tooling

- Reused five browser scripts from `58a25be`, adding separate dependencies, random local ports, and temporary browser contexts. Removed dependencies on old ports and internal material paths.
- Retained review, follow-up, matching, editing, PDF, and mobile checks; added final-version saving and refresh/reopen checks. Adapted historical visual assertions to the current typography.
- Verified all five scenarios with mock mode or fixed local responses. Paid model calls: 0. See `qa/SOURCES.json` and `qa/VERIFICATION.md`. Product code and the v21 prompt were unchanged.

## Offline Regression Test Packaging

- Selected 24 existing test files and nine synthetic fixtures from runtime source `58a25be`, covering parsing, sources, follow-up state, job targeting, review/editing, and local interfaces.
- Removed dependencies on internal evaluation tools, material directories, and historical prompt snapshots not included in this package. Retained assertions for current behavior; per-file provenance and changes are in `tests/SOURCES.json`.
- Ran 336 offline checks in the showcase package: all passed, with no skips or external model calls. Product code and the v21 prompt were unchanged.

## Runtime and Showcase Packaging

- Packaged the runtime from `58a25be` with `precise-followup-v21`.
- Added a PRD summary, user and AI workflow diagrams, synthetic-material screenshots, an evaluation summary, and four representative bad cases.
- Completed startup instructions, the repository guide, and the file index. Public statistics use owner-confirmed aggregates; original test records remain preserved.

## Page Readability and Parsing Boundaries

- Unified the warm cream and sage palette, typography, and core-page reading layout. Related commits: `b5535bc`, `3dbbfde`.
- Added one correction attempt for cross-experience citations, supplying the allowed evidence scope and rerunning full validation. Recognized standalone JD titles without discarding actual requirements. Commit: `d231d8c`.
- Distinguished leadership by another responsible person from the applicant's own leadership. Commit: `b2bbc7d`.
- Refined clearly independent experience boundaries while preserving original text and source IDs; avoided mechanically splitting phases of the same project. Commit: `58a25be`.

## Prompt v21 and Browser Review

- Incorporated explicit requirements, answer states, and conflict boundaries into follow-up planning to reduce requests for already covered facts. Evaluation code: `ec6dff9`.
- All 10 original development cases generated suggestions. The 13 experience units received formal human ratings totaling 85, averaging 6.54/8; rewrite-text factual checks passed 13/13. See the evaluation summary for scope.
- Fixed a source-matching false positive between PDF-extracted `MA TLAB` and `MATLAB`, retaining other factual checks. Commit: `0d1b96b`.
- Improved the presentation of matching, follow-ups, and rewrite review. Commit: `6af670c`.

## Prompt v14: Job Targeting

- Adjusted emphasis for different JDs while retaining metric definitions, unknown states, and limits on personal responsibility.
- The project owner accepted the targeting differences between cases 0003/0004, which use the same resume for different roles. Evaluation code: `ab83a07`.

## Prompt v8: Workflow and Source Handling

- Separated sources for eligibility conditions, such as availability, from rewritable experience units to prevent valid context from being omitted.
- Constrained invalid follow-ups and evidence attribution for primary associations while retaining strict response validation. Commits: `de2a6a0`, `4de7daa`.
- On the same 10 development cases, suggestion generation recovered from v6's 8/10 to 10/10, and evaluable units increased from 11 to 13. Full regression code: `a053e03`.

## Prompt v6: Real-Model Baseline

- Integrated an OpenAI-compatible API while retaining mock mode, connecting parsing, matching, fact confirmation, and per-experience rewriting.
- Added structure, source, error, and stale-result protection. Completed basic integration acceptance with three synthetic cases. Baseline code: `ca08ce6`.

These SHAs identify sources in the original development repository. See the [evaluation summary](docs/EVALUATION_SUMMARY.md) for results and definitions, and [bad cases](docs/BAD_CASES.md) for selected repair evidence.
