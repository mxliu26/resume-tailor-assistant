# AI Evaluation Summary

Across the same 10 fixed synthetic development cases, resume suggestion generation increased from 8/10 in v6 to 10/10 in v21, and evaluable experience units increased from 11 to 13. The 13 v21 units received human-confirmed scores totaling 85, averaging 6.54/8. The real-model integration and evaluation baseline, v6, scored approximately 5.41/8 according to the aggregate confirmed by the project owner. Comparing these aggregate means gives an increase of approximately 21%. Factual accuracy checks on v21 rewrite text passed 13/13.

Separately, the project owner's manual records for the same 10 cases show average manual corrections per resume falling from 3.8 to 2.0, approximately 47% fewer. Counting rules and per-case values are below.

## Data Scope and Rating Status

- The evaluation uses the fixed v2 development set and `AE-RUBRIC-v2`. Cases 0003/0004 pair the same resume with different JDs. They are scored separately but are not two independent source samples.
- The v21 scores are **human ratings confirmed by the project owner after AI-assisted review, not an independent blind assessment**. The approximately 5.41 v6 mean is an owner-confirmed aggregate.
- The approximately 21% figure uses the displayed means: `(6.54 - 5.41) / 5.41 ≈ 20.9%`. It is a relative change in aggregate means, not a paired improvement across experience units.
- Unit-level v6 scores, their total, and the effective scoring denominator for 5.41 were not supplied with this correction. They are not reconstructed. The 11 evaluable v6 outputs are not automatically the denominator of that aggregate. The v21 scoring denominator is explicitly 13 experience units.
- The model was DeepSeek `deepseek-flash`, with thinking disabled. v6 evaluation code: `ca08ce6`; v21 formal ratings: `ec6dff9`. Showcase runtime `58a25be` still uses the v21 prompt. This summary combines historical evaluation and owner-confirmed reporting corrections; it is not a new evaluation of the current runtime.

## Core Metrics

| Metric and definition | v6 | v21 |
| --- | --- | --- |
| Resume suggestion generation success rate: cases that generated suggestions / planned cases | 8/10 = 80% | 10/10 = 100% |
| Evaluable experience units: units with reviewable suggestions | 11 | 13 |
| Average rewrite quality score: four dimensions, maximum 8 | Approximately 5.41/8; owner-confirmed aggregate without unit-level scores | 85/13 = 6.54/8; formal human ratings for 13 units |
| Relative change in aggregate mean | Comparison baseline | Approximately +1.13 points, or +21% based on aggregate means |
| Factual accuracy checks: passing rewrite units / completed factual reviews | Not included in this comparison | 13/13 = 100% |
| Rewrite-text factual review coverage: reviewed units / planned units | Unit-level review detail not supplied | 13/13 |
| Blocked units that could not be evaluated | 2 | 0 |
| Manual corrections per resume: total manual corrections / recorded cases | 38/10 = 3.8 | 20/10 = 2.0; approximately 47% fewer |

A factual pass means the evaluated rewrite text was consistent with its allowed sources. It does not establish that every upstream parsing result, association, follow-up, or use case was correct. Missing unit-level data is not converted into a paired comparison or a zero score.

## Four-Dimension, Eight-Point Rubric

| Dimension | 0 points | 1 point | 2 points |
| --- | --- | --- | --- |
| Job relevance | Ignores important content or merely inserts keywords | Main content is relevant, with some secondary material | Makes clear choices and naturally addresses the role |
| Specificity | Vague; actual work is difficult to identify | Describes a clear action and an evidenced method or output | Responsibilities, actions, and outputs are appropriately concrete |
| Clarity | Material ambiguity or unclear responsibilities | Generally clear, with minor adjustments needed | Direct structure and easy to understand |
| Conciseness | Repetitive wording or removal of important facts | Generally concise | Compact while retaining the necessary facts |

Scores apply to experience units; factual review is separate. Use a null score only when a unit genuinely cannot be evaluated. Blocked and unreviewed units do not count as factual passes and are not entered as zeroes in the average.

## Formal v21 Ratings: 13 Experience Units

Dimension order: **job relevance / specificity / clarity / conciseness**. The table contains the confirmed v21 ratings. For v6, only the owner-confirmed aggregate mean is reported. Experience titles below are English descriptions of the original Chinese records.

| Case / unit | Experience | v21 dimensions | Total | Rewrite-text facts |
| --- | --- | --- | --- | --- |
| 0001/U01 | Order quality dashboard | 2 / 2 / 2 / 2 | 8 | Pass |
| 0002/U01 | Requirements organization for a reading tool | 1 / 2 / 1 / 1 | 5 | Pass |
| 0003/U01 | Campus event registration improvements | 2 / 2 / 2 / 1 | 7 | Pass |
| 0003/U02 | Campus guide cards | 1 / 2 / 2 / 2 | 7 | Pass |
| 0004/U01 | Campus event registration improvements | 2 / 2 / 2 / 1 | 7 | Pass |
| 0004/U02 | Campus guide cards | 1 / 2 / 2 / 2 | 7 | Pass |
| 0005/U01 | Booking system testing | 2 / 2 / 2 / 2 | 8 | Pass |
| 0006/U01 | Warehouse stockout records | 2 / 2 / 2 / 1 | 7 | Pass |
| 0007/U01 | Store operations materials | 1 / 1 / 1 / 1 | 4 | Pass |
| 0008/U01 | Student club ticket organization | 1 / 2 / 1 / 1 | 5 | Pass |
| 0009/U01 | Event page review | 2 / 2 / 2 / 1 | 7 | Pass |
| 0010/U01 | Image annotation quality checks | 1 / 2 / 1 / 1 | 5 | Pass |
| 0010/U02 | Glossary maintenance | 2 / 2 / 2 / 2 | 8 | Pass |

## Targeting Different JDs with the Same Resume

Case 0003 targets community operations and leads with recurring inquiries, pinned guidance, and coordination with organizers. Case 0004 targets interaction design and leads with form-flow sketches, clickable Figma prototypes, and field descriptions. Both preserve the limits that another student implemented the software, the applicant did not write the production code, reminders remained a discussion, and registration conversion was not recorded.

This shows a change in role-specific emphasis. Quality is not judged by word count or ordering alone. Both U01 units received formal v21 scores of 7/8. No paired score comparison is reported without the corresponding unit-level baseline detail.

## Manual Corrections per Resume

Definition: the number of manual corrections needed between initial resume input and the final version. The project owner recorded these counts manually and supplied them during documentation preparation. They are not system telemetry, and AI-agent actions are not substituted for human corrections.

### Counting Scope

| Product step | Possible manual action | Included? |
| --- | --- | --- |
| Material input and parsing review | Correct PDF extraction or misidentified project names, dates, and responsibilities | Yes: parsing correction |
| Requirement-to-experience matching | Correct associations or judgments, such as an unrelated experience being treated as relevant | Yes: matching correction |
| Follow-ups and fact confirmation | Answer normal model questions or provide additional true experience | No: necessary information gathering |
| Rewrite review | Correct factual errors, omissions, inaccurate wording, or unclear expression | Yes: rewrite correction |
| Final editing | Refine the generated draft for accuracy, clarity, and relevance | Yes; distinguish error correction from personal preference |

### Per-Case Records and Calculation

The sequence follows the 10 fixed cases as supplied by the owner. It excludes the separate five-case synthetic test set and does not infer an additional run-batch mapping.

| Case order | v6 manual corrections | v21 manual corrections |
| --- | ---: | ---: |
| 01 | 5 | 4 |
| 02 | 3 | 1 |
| 03 | 4 | 1 |
| 04 | 2 | 1 |
| 05 | 3 | 2 |
| 06 | 1 | 1 |
| 07 | 6 | 3 |
| 08 | 5 | 3 |
| 09 | 4 | 2 |
| 10 | 5 | 2 |
| Total | 38 | 20 |
| Mean, 10 cases each | 3.8 | 2.0 |

The mean decreased by 1.8 corrections per resume. Relative reduction: `(3.8 - 2.0) / 3.8 × 100% ≈ 47.4%`, summarized as approximately 47% fewer corrections. Both denominators are 10 recorded cases.

### Evidence Limits

- Values and arithmetic were checked during documentation preparation; the human actions were not observed again. The supplied records and counting rules are in the [structured record](evidence/manual-corrections.json), source S40.
- Per-edit logs, stage-level breakdowns, and a convention for merging consecutive edits to the same problem were not supplied. No event detail is reconstructed. Final edits are included, but the aggregate cannot separate corrections from personal preferences.
- This metric is independent of suggestion generation success. It does not change blocked v6 results to successful runs or reconstruct missing T1/T2 text.
- Fewer corrections do not establish lower human completion time, fewer factual errors in rewrite text, or higher satisfaction.

## Follow-Ups and Usage Metrics

v21 produced seven actual follow-up questions; six were accepted in human review. Users still supplied seven answers, so these counts do not establish improved follow-up efficiency. The five held-out validation cases were not run and are excluded. Results from other versions of the separate five-case synthetic test set are not mixed in.

Automated runtime and AI-agent edit counts cannot stand in for real-user completion time or human correction counts. Without comparable human timing or satisfaction data, no time-saving rate or satisfaction score is reported.

[Formal v21 score extract](evidence/unit-scores.json) · [Metric records](evidence/metrics.json) · [Owner-confirmed scoring conventions](evidence/review-confirmation.json)

Sources: S01, S04–S07, S20, S21, S24, S33, S34, S40. Denominators, rating status, and version provenance remain separate.
