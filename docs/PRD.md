# ResumeTailor: Product Requirements Summary

ResumeTailor helps job seekers who already have a resume and a target role select relevant experience, clarify necessary facts, and review and save a tailored version. The core deliverable is a revised draft confirmed by the user.

## Users and Problems

The initial audience is applicants for internships and entry-level roles, including people explaining research, coursework, or competition projects and applying to several related roles. The product addresses three tasks: understand the job requirements, explain what the applicant actually did, and check whether AI changed the facts.

These scenarios come from the original PRD's assumptions and later case-based validation. They are not presented as findings from large-scale user research.

## Goals and Scope

| Goal | Design response |
| --- | --- |
| Find relevant experience | Match JD requirements to resume sources, with user-adjustable associations and judgments. |
| Clarify necessary information | Ask about responsibilities, methods, and outputs; allow confirmation, editing, skipping, or an unknown state. |
| Make wording reviewable | Compare original and suggested text, with explanations, factual sources, and edit differences. |
| Keep versions for different roles | Save tasks, drafts, and confirmed versions separately, with reuse of existing material. |

A task pairs one resume with one JD. Resume input can be text or a PDF with extractable text; the JD is text. The output is editable, copyable, and savable resume text. Scanned-document OCR, automatic applications, hiring-probability predictions, and formatted document export are outside this summary's scope.

## Five-Step Workflow

| Page | User task | Main actions |
| --- | --- | --- |
| Material input | Provide the correct resume and JD | Paste text, upload a PDF, create a task. |
| Parsing review | Confirm the experience and requirements were read correctly | Inspect source material, correct content, confirm review. |
| Matching and follow-ups | Understand relevance and clarify facts that affect wording | Adjust associations, answer or skip, confirm facts, select rewrite scope. |
| Rewrite workspace | Decide whether suggestions are factual and useful | Inspect differences and sources; edit, accept, reject, or keep the original. |
| Role-specific version | Save a result for later use | Confirm saving, copy, reopen, or create a task for another role. |

## Functional Requirements

| ID | Area | Key requirements |
| --- | --- | --- |
| FR-01 | Materials and tasks | Preserve original input; create separate tasks for different JDs; retain entered content when input fails. |
| FR-02 | Parsing and review | Make experiences, dates, and sources reviewable; separate originals from reviewed text; update affected results after corrections. |
| FR-03 | Experience matching | Distinguish explicit job conditions from capability evidence; support multiple sources; selecting an association does not confirm a fact. |
| FR-04 | Follow-ups and facts | Ask questions that support rewriting; require confirmation of additions; never convert unknown, not-done, skipped, or conflicting states into affirmative facts. |
| FR-05 | Per-experience rewriting | Use only eligible sources for that experience; retain responsibilities, metric definitions, and negative qualifiers; allow suitable original text to remain. |
| FR-06 | Saving and reuse | Save drafts and role-specific versions; preserve text and confirmation states on reopening; review affected facts again when sources change. |
| FR-07 | Errors and privacy | Failed model calls must not overwrite existing work; support manual retry and material deletion; read keys only in the local backend. |

## Required Factual Boundaries

1. Reviewed original text and confirmed additions support rewriting. A JD cannot establish what the applicant has done.
2. A team achievement must not become personal leadership. Missing evidence must not automatically become a claim that the applicant has never done something.
3. Numbers must retain their subject, unit, and definition. Conflicting evidence must not be resolved by choosing one side without support.
4. Unselected content is preserved by default. Users may keep the original; the number of edits is not a success metric.
5. After upstream changes, existing associations and suggestions must be checked against the current materials. They must not silently overwrite user edits.

These are product requirements and validation goals, not a claim that every model response automatically satisfies them.

## Data and Responsibilities

The user reviews materials, confirms new facts, and selects the final wording. The model parses materials, proposes associations and follow-ups, and drafts suggestions. The program validates structure, sources, state, and selected factual boundaries. Tasks and versions are stored locally in the browser, with original PDFs in browser storage. The backend reads local configuration and calls an OpenAI-compatible model service.

## Validation Criteria

Suggestion generation, review, and saving are checked separately. Writing quality is rated for job relevance, specificity, clarity, and conciseness, each from 0 to 2. Factual consistency is an independent gate. Scores cannot offset factual errors, and clicking accept does not by itself prove a suggestion is correct.

Sources: S01, S15–S19, S22, S23. See the [evidence index](evidence/source-index.json).
