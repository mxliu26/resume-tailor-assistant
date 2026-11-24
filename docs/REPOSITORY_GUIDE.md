# Repository and File Guide

This guide explains directory responsibilities and each first-party file. The complete inventory is in [FILE_INDEX.json](FILE_INDEX.json).

## Directory Responsibilities

| Directory | Description |
| --- | --- |
| `public/` | Frontend pages, task interactions, review/editing, and browser-local storage. |
| `public/vendor/pdfjs/` | Bundled PDF preview dependencies and original third-party licenses. |
| `lib/` | Model interfaces, material parsing, experience sources, and factual validation. |
| `prompts/` | Fixed v21 instructions for parsing, matching/follow-ups, and per-experience rewriting. |
| `scripts/` | Local helpers such as PDF text extraction. |
| `examples/` | Two synthetic cases with verified browser actions, answer protocols, first suggestions, and saved versions. |
| `tests/` | Offline program checks, synthetic fixtures, and verification notes for the current v21 runtime. |
| `qa/` | Isolated browser regression for interaction, editing, PDF handling, and save/restore, with no paid model calls. |
| `docs/` | Product design, workflows, screenshots, evaluation, and representative fixes. |
| `docs/figures/` | SVG diagrams and editable Mermaid sources for user and AI workflows. |
| `docs/images/` | Synthetic-material screenshots and the product walkthrough. |
| `docs/evidence/` | Concise evidence for scoring conventions, unit results, and selected cases. |
| `docs/testing/` | Three concise phase reports and navigation to their evidence. |

English documentation explains the product. Runtime prompts, interface text, test fixtures, original model outputs, and evidence records retain their original language and content.

## Root Files

| File | Contents and purpose |
| --- | --- |
| [.env.example](../.env.example) | Example configuration for mock/live mode, ports, model, timeouts, and PDF extraction; the API key is blank. |
| [.gitignore](../.gitignore) | Excludes secrets, private materials, user data, and runtime logs; allows only specified showcase images. |
| [CHANGELOG.md](../CHANGELOG.md) | Major changes by iteration, prompt versions, and source SHAs from the development repository. |
| [README.md](../README.md) | Repository homepage: product, workflow, screenshots, evaluation highlights, setup, and documentation links. |
| [package.json](../package.json) | Node module type, runtime requirements, and startup commands; retains the original project metadata. |
| [requirements.txt](../requirements.txt) | Python dependencies and versions for PDF text extraction. |
| [server.mjs](../server.mjs) | Local HTTP service, frontend assets, PDF extraction, AI parsing/matching/rewriting interfaces, and output validation. |
| [start-demo.cmd](../start-demo.cmd) | Windows double-click launcher that delegates to the PowerShell startup script. |
| [start.ps1](../start.ps1) | Finds and checks Node, then starts the local service. |

## Backend and Prompt

| File | Contents and purpose |
| --- | --- |
| [lib/evidence-quote.mjs](../lib/evidence-quote.mjs) | Matches contiguous source evidence with narrowly defined equivalence for Chinese PDF line breaks. |
| [lib/factual-sources.mjs](../lib/factual-sources.mjs) | Extracts eligible factual content and checks attribution of numerical team achievements. |
| [lib/material-pipeline.mjs](../lib/material-pipeline.mjs) | Assembles parsing and matching context; handles de-identification, experience boundaries, and source checks. |
| [lib/model-client.mjs](../lib/model-client.mjs) | Loads the v21 prompt, calls an OpenAI-compatible API, and handles timeouts, responses, and call errors. |
| [prompts/precise-followup-v21.json](../prompts/precise-followup-v21.json) | The shared, parse, analyze, and rewrite instructions; contains no API key. |
| [scripts/pdf_extract.py](../scripts/pdf_extract.py) | Extracts PDF text with pypdf and returns JSON. |

## First-Party Frontend Files

| File | Contents and purpose |
| --- | --- |
| [public/ai-state.js](../public/ai-state.js) | Identifies task and association snapshots so stale AI results cannot overwrite newer edits. |
| [public/analysis-model.js](../public/analysis-model.js) | Derives requirement judgments, next-step suggestions, and rewrite selection. |
| [public/app.js](../public/app.js) | Page routing, actions, task/version storage, and backend request orchestration. |
| [public/comparison-navigation.js](../public/comparison-navigation.js) | Requirement navigation and scroll positioning on the matching page. |
| [public/comparison-view.js](../public/comparison-view.js) | Renders job matching, experience evidence, judgments, follow-ups, and rewrite selection. |
| [public/domain.js](../public/domain.js) | Task rules, material and fact handling, final-text assembly, and the mock-mode rule engine. |
| [public/followup-state.js](../public/followup-state.js) | Starts, cancels, and submits answer edits while retaining relevant confirmation states. |
| [public/index.html](../public/index.html) | Page entry point, application mount, styles, and scripts. |
| [public/job-focus.js](../public/job-focus.js) | Builds job emphasis and experience recommendations from reviewed associations without creating facts. |
| [public/material-units.js](../public/material-units.js) | Identifies processable material units while preserving original section headings. |
| [public/pdf-source.js](../public/pdf-source.js) | Loads PDF.js, renders previews, and stores original PDFs in the browser. |
| [public/question-scope.js](../public/question-scope.js) | Manages requirement coverage and answer states, limiting question scope and fact attribution. |
| [public/review-presentation.js](../public/review-presentation.js) | Groups parsing-review content and displays requirement categories and text differences. |
| [public/review-reference.js](../public/review-reference.js) | Displays the source resume PDF or JD during review and preserves navigation position. |
| [public/review-state.js](../public/review-state.js) | Manages review drafts, change detection, applying changes, and reconfirmation rules. |
| [public/review-view.js](../public/review-view.js) | Renders material-review pages and change notices. |
| [public/rewrite-editor.js](../public/rewrite-editor.js) | Shows original, suggestion, and user-edit differences and manages editor interactions. |
| [public/style.css](../public/style.css) | Base layouts, components, typography, and responsive styles. |
| [public/ui-polish.css](../public/ui-polish.css) | Warm cream styling, typography hierarchy, navigation, and core-page refinements. |
| [public/unit-presentation.js](../public/unit-presentation.js) | Builds display titles and supporting labels without rewriting source content. |
| [public/visual-assets.js](../public/visual-assets.js) | Consistent line icons and small header/sidebar illustrations. |

## Showcase Documents and Evidence

| File | Contents and purpose |
| --- | --- |
| [docs/BAD_CASES.md](BAD_CASES.md) | Four cases: omitted availability, invalid follow-ups, PDF tool-name matching, and a prompt fix for cross-experience citations. |
| [docs/EVALUATION_SUMMARY.md](EVALUATION_SUMMARY.md) | Historical workflow, quality, factual metrics, and owner-recorded manual corrections with counting rules. |
| [docs/FILE_INDEX.json](FILE_INDEX.json) | Complete file paths, categories, and purposes for maintenance and upload checks. |
| [docs/PRD.md](PRD.md) | Product requirements summary: users, problems, scope, five-step flow, and factual constraints. |
| [docs/README.md](README.md) | Documentation entry point with the purpose of each showcase document. |
| [docs/REPOSITORY_GUIDE.md](REPOSITORY_GUIDE.md) | Readable directory guide and descriptions of every first-party file. |
| [docs/SCREENSHOTS.md](SCREENSHOTS.md) | Homepage walkthrough, three core screenshots, and their synthetic/mock-mode provenance. |
| [docs/WORKFLOW.md](WORKFLOW.md) | User and AI workflow diagrams and the responsibilities of the model, program, and user. |
| [docs/evidence/bad-case-records.json](evidence/bad-case-records.json) | Structured causes, fixes, verification scope, and version references for four representative issues. |
| [docs/evidence/manual-corrections.json](evidence/manual-corrections.json) | Owner-supplied manual correction counts for 10 cases per version, counting scope, calculations, and evidence limits. |
| [docs/evidence/metrics.json](evidence/metrics.json) | Metric values, denominators, rating status, versions, and manually recorded correction aggregates. |
| [docs/evidence/product-overview.json](evidence/product-overview.json) | Walkthrough image hash, runtime source, capture provenance, and mock-interaction checks. |
| [docs/evidence/prompt-fix-example.json](evidence/prompt-fix-example.json) | The v7-to-v8 prompt delta and actual before/after citations from the same synthetic case. |
| [docs/evidence/review-confirmation.json](evidence/review-confirmation.json) | Owner-confirmed v6/v21 aggregates and relative-change conventions, without private conversation transcripts. |
| [docs/evidence/source-index.json](evidence/source-index.json) | Source titles, SHA-256 hashes, and public-excerpt references, without local absolute paths. |
| [docs/evidence/unit-scores.json](evidence/unit-scores.json) | Formal four-dimension v21 ratings, rewrite-text factual verdicts, and Run IDs for 13 experience units. |
| [docs/figures/ai-workflow.mmd](figures/ai-workflow.mmd) | Editable Mermaid source for the AI workflow. |
| [docs/figures/ai-workflow.svg](figures/ai-workflow.svg) | Display-ready diagram of model tasks, validation, and fact confirmation. |
| [docs/figures/user-flow.mmd](figures/user-flow.mmd) | Editable Mermaid source for the five-step user flow. |
| [docs/figures/user-flow.svg](figures/user-flow.svg) | Display-ready diagram of the five-step user flow. |
| [docs/images/01-matching.jpg](images/01-matching.jpg) | Desktop matching and follow-up screenshot using fictional material. |
| [docs/images/02-rewrite.jpg](images/02-rewrite.jpg) | Original/suggestion comparison and difference-review screenshot using fictional material. |
| [docs/images/03-mobile.jpg](images/03-mobile.jpg) | Mobile screenshot using fictional material. |
| [docs/images/product-overview.png](images/product-overview.png) | Homepage walkthrough of four workflow sections, captured with synthetic materials in mock mode. |

## Synthetic Examples

Only cases 02 and 03, which completed saving, refresh, and reopening in the recorded run, are included. Original failed runs and browser data remain in the internal test archive.

| File | Contents and purpose |
| --- | --- |
| [examples/README.md](../examples/README.md) | Two completed synthetic browser workflows, usage protocol, and file descriptions. |
| [examples/case-02-data-analyst/README.md](../examples/case-02-data-analyst/README.md) | Observed browser steps, answer handling, save/reopen verification, and factual-review priorities. |
| [examples/case-02-data-analyst/final_resume.txt](../examples/case-02-data-analyst/final_resume.txt) | Complete synthetic resume retrieved directly from the saved browser version. |
| [examples/case-02-data-analyst/job_description.txt](../examples/case-02-data-analyst/job_description.txt) | Original target JD text used as initial input. |
| [examples/case-02-data-analyst/outputs.json](../examples/case-02-data-analyst/outputs.json) | Actual real-model browser run: parsing, associations, T0/T1/T2, sources, confirmation states, versions, and usage. |
| [examples/case-02-data-analyst/resume.txt](../examples/case-02-data-analyst/resume.txt) | Original synthetic resume text used as initial input. |
| [examples/case-02-data-analyst/tester_notes.json](../examples/case-02-data-analyst/tester_notes.json) | Tester-only synthetic facts, preset answers, and actual questions/actions; not supplied to the model in advance. |
| [examples/case-03-algorithm-engineer/README.md](../examples/case-03-algorithm-engineer/README.md) | Observed browser steps, answer handling, save/reopen verification, and factual-review priorities. |
| [examples/case-03-algorithm-engineer/final_resume.txt](../examples/case-03-algorithm-engineer/final_resume.txt) | Complete synthetic resume retrieved directly from the saved browser version. |
| [examples/case-03-algorithm-engineer/job_description.txt](../examples/case-03-algorithm-engineer/job_description.txt) | Original target JD text used as initial input. |
| [examples/case-03-algorithm-engineer/outputs.json](../examples/case-03-algorithm-engineer/outputs.json) | Actual real-model browser run: parsing, associations, T0/T1/T2, sources, confirmation states, versions, and usage. |
| [examples/case-03-algorithm-engineer/resume.txt](../examples/case-03-algorithm-engineer/resume.txt) | Original synthetic resume text used as initial input. |
| [examples/case-03-algorithm-engineer/tester_notes.json](../examples/case-03-algorithm-engineer/tester_notes.json) | Tester-only synthetic facts, preset answers, and actual questions/actions; not supplied to the model in advance. |

## Offline Automated Tests

Run with `npm test` using Node's built-in runner. Responses are fixed or constructed; interface checks use temporary local services. These tests originate from the current runtime's development source. Historical snapshot comparisons and internal batch tooling remain separately in the development repository.

| File | Contents and purpose |
| --- | --- |
| [tests/README.md](../tests/README.md) | Offline test commands, dependencies, coverage, and result interpretation. |
| [tests/SOURCES.json](../tests/SOURCES.json) | Source commits, original and packaged hashes, and packaging changes for tests and synthetic fixtures. |
| [tests/VERIFICATION.md](../tests/VERIFICATION.md) | Recorded results, environment, and TAP-log hash for 336 offline checks. |
| [tests/ai-pipeline.test.mjs](../tests/ai-pipeline.test.mjs) | Original-text coverage, evidence and question validation, stale-response protection, and model-client errors. |
| [tests/analysis-model.test.js](../tests/analysis-model.test.js) | Derived requirement judgments, association evidence, and rewrite selection. |
| [tests/comparison-view.test.js](../tests/comparison-view.test.js) | Matching views, follow-up forms, user-text escaping, and rendering. |
| [tests/condition-contract.test.mjs](../tests/condition-contract.test.mjs) | Separate states for explicit conditions and capability evidence; definite judgments need matching evidence. |
| [tests/domain.test.js](../tests/domain.test.js) | Material segmentation, fact conflicts, mock suggestions, final-text assembly, and pre-save checks. |
| [tests/education-condition.test.mjs](../tests/education-condition.test.mjs) | Separation of education categories from preference strength; no mechanical reclassification of mixed requirements. |
| [tests/evidence-scope-retry.test.mjs](../tests/evidence-scope-retry.test.mjs) | One correction attempt for cross-experience evidence, full revalidation, and the boundary between JD titles and actual requirements. |
| [tests/experience-boundaries.test.mjs](../tests/experience-boundaries.test.mjs) | Independent experience boundaries, source IDs, original-text integrity, and preservation of multiple phases within one project. |
| [tests/factual-boundary.test.mjs](../tests/factual-boundary.test.mjs) | Team achievements, not-launched and no-interview facts, and exclusion of non-factual instructions from evidence. |
| [tests/fixtures/ai-bc-0006.json](../tests/fixtures/ai-bc-0006.json) | Synthetic request and historical response illustrating incorrect condition-state usage. |
| [tests/fixtures/ai-bc-0007-0008.json](../tests/fixtures/ai-bc-0007-0008.json) | Synthetic inputs and states for education misclassification and repeated questions after confirmation. |
| [tests/fixtures/ai-bc-0011.json](../tests/fixtures/ai-bc-0011.json) | Synthetic task and response confusing missing evidence with no experience. |
| [tests/fixtures/factual-boundary.json](../tests/fixtures/factual-boundary.json) | Fictional material for team achievements, negative facts, and non-factual instruction boundaries. |
| [tests/fixtures/job-targeting-v9.json](../tests/fixtures/job-targeting-v9.json) | Historical fixed responses and source hashes for one synthetic resume against two JDs; used to replay current rules. |
| [tests/fixtures/parse-identity.json](../tests/fixtures/parse-identity.json) | Fictional resume and JD for identity-placeholder and original-text fidelity checks. |
| [tests/fixtures/precise-followup-v18-duplicate.json](../tests/fixtures/precise-followup-v18-duplicate.json) | Synthetic task and historical response with duplicate question coverage. |
| [tests/fixtures/precise-followup-v18.json](../tests/fixtures/precise-followup-v18.json) | Synthetic tasks and fixed responses for related versus distinct factual gaps. |
| [tests/fixtures/precise-followup-v20-rejections.json](../tests/fixtures/precise-followup-v20-rejections.json) | Rejection samples for invalid condition binding and questions on conflicting experiences. |
| [tests/followup-state.test.js](../tests/followup-state.test.js) | Answer editing, cancellation, replacement, confirmation, and preservation of facts and sources. |
| [tests/job-targeting.test.mjs](../tests/job-targeting.test.mjs) | Sources and emphasis for different JDs, recommendation order, keeping the original, and factual boundaries. |
| [tests/manual-followup-payload.test.mjs](../tests/manual-followup-payload.test.mjs) | Transmission of manual associations and answer states; old responses must not overwrite newer edits. |
| [tests/none-authorization.test.mjs](../tests/none-authorization.test.mjs) | Missing, unknown, or skipped information must not mean never done; negative claims stay within the original requirement/experience pair. |
| [tests/parse-identity.test.mjs](../tests/parse-identity.test.mjs) | Identity placeholders and original offsets; missing key facts still cause rejection. |
| [tests/pdf-evidence-quote.test.mjs](../tests/pdf-evidence-quote.test.mjs) | Equivalent Chinese PDF line breaks without weakening number, negation, or source-attribution checks. |
| [tests/pdf-tool-spacing.test.mjs](../tests/pdf-tool-spacing.test.mjs) | Narrow MATLAB spacing equivalence; other unsupported tools and cross-source joins remain rejected. |
| [tests/precise-followup.test.mjs](../tests/precise-followup.test.mjs) | The v21 follow-up contract, grouping related gaps within an experience, draft protection, and confirmation scope. |
| [tests/resolved-questions.test.mjs](../tests/resolved-questions.test.mjs) | Answered, unknown, not-done, skipped, and archived states prevent repeated questions. |
| [tests/review-presentation.test.js](../tests/review-presentation.test.js) | Review-page grouping, requirement categories, and text-change presentation. |
| [tests/review-state.test.js](../tests/review-state.test.js) | Material-review drafts, formatting changes, fact confirmation, and result invalidation. |
| [tests/rewrite-editor.test.js](../tests/rewrite-editor.test.js) | Original/suggestion/manual-edit differences and text protection. |
| [tests/role-attribution.test.js](../tests/role-attribution.test.js) | Leadership by another responsible person versus personal leadership, retaining other factual limits. |
| [tests/server.test.mjs](../tests/server.test.mjs) | Local HTTP interfaces, authorization, privacy, concurrency, errors, PDF extraction, and static resources. |
| [tests/unit-presentation.test.js](../tests/unit-presentation.test.js) | Experience titles, dates, section labels, and body-text preservation. |

## Browser Regression Tooling

These checks complement `tests/` with actual browser actions. Four scenarios use mock mode; one uses the Live protocol against fixed local responses. None calls a real model. `qa/output/` and installed dependencies are excluded by `.gitignore`.

| File | Contents and purpose |
| --- | --- |
| [qa/README.md](../qa/README.md) | Browser-test commands, five scenarios, isolation, and limits of the results. |
| [qa/SOURCES.json](../qa/SOURCES.json) | Browser-script source commits, original/packaged hashes, and adaptation notes. |
| [qa/VERIFICATION.md](../qa/VERIFICATION.md) | Recorded outcomes, environment, evidence hashes, and scope for five browser scenarios. |
| [qa/comparison-feedback.mjs](../qa/comparison-feedback.mjs) | Review-confirmation gates; association changes and answer/fact retention; long-text editing alignment; accept/edit/reject/keep states; mobile layout. |
| [qa/comparison-navigation.mjs](../qa/comparison-navigation.mjs) | Main/sidebar scrolling, reverse navigation and redraw after saving, rewrite selection/expansion, and mobile horizontal navigation. |
| [qa/fixtures/materials.json](../qa/fixtures/materials.json) | Fictional resume, JD, and answers used only after questions are triggered in the local protocol flow. |
| [qa/package.json](../qa/package.json) | Separate browser-test dependencies and commands; does not add product runtime dependencies. |
| [qa/phase2-flow.mjs](../qa/phase2-flow.mjs) | Browser actions through parsing, questions, confirmation, rewriting, and saving against fixed local upstream responses, not a real model. |
| [qa/review-reference.mjs](../qa/review-reference.mjs) | Two-page synthetic PDF upload/rendering, navigation/zoom, JD reference, review and PDF reopening, invalid-file protection, backup, and isolated deletion. |
| [qa/rewrite-feedback.mjs](../qa/rewrite-feedback.mjs) | Difference highlighting, editing, undo, Chinese composition input, persistent per-experience drafts, question/fact navigation, and candidate-overwrite protection. |
| [qa/run.mjs](../qa/run.mjs) | Runs five browser scenarios sequentially, stops on failure, and preserves logs and unexecuted counts. |
| [qa/runtime.mjs](../qa/runtime.mjs) | Starts isolated services and browsers on random ports, blocks external page requests, and records requests, screenshots, traces, and code hashes. |

## Phase Test Documentation

Historical results retain their test scope, code versions, and rating status. Complete originals remain in the development archive; these are concise summaries for repository readers.

| File | Contents and purpose |
| --- | --- |
| [docs/testing/README.md](testing/README.md) | Index of three historical phase reports, distinguishing evaluation, current offline checks, and browser regression. |
| [docs/testing/phase1/TEST_REPORT.md](testing/phase1/TEST_REPORT.md) | Four local-demo acceptance areas, historical test batches, and concise evidence notes. |
| [docs/testing/phase2/TEST_REPORT.md](testing/phase2/TEST_REPORT.md) | Three-case real-model integration, versions, call usage, and acceptance evidence. |
| [docs/testing/phase3/TEST_REPORT.md](testing/phase3/TEST_REPORT.md) | Fixed development-set v6/v21 comparison, formal human ratings, factual-review denominators, and regression calls. |

## Third-Party PDF.js Files

`public/vendor/pdfjs/` contains 199 original resources: the parsing library and worker, character maps, standard fonts, WebAssembly decoding resources, and licenses. Every file is listed in `FILE_INDEX.json`; this guide groups them by purpose rather than repeating all font and character-map names.

## Maintenance

Update this guide and `FILE_INDEX.json` when adding or removing files. Record code and prompt changes through Git commits and the changelog. Private source materials, user tasks, keys, full runtime logs, and internal review pages are excluded from the public package. Published synthetic examples and selected evidence extracts are identified explicitly.
