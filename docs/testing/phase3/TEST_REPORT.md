# Phase 3: AI Evaluation and Optimization

A fixed synthetic development set was used to compare suggestion generation, writing quality, and factual consistency. All 10 v21 cases reached suggestion generation, and 13 experience units received formal human ratings. This report retains the archived scores and introduces no new ratings.

## Data and Method

| Item | Fixed convention |
| --- | --- |
| Development set | 10 cases, 13 experience units; `AE-DATASET-v2` |
| Other cases | Five held-out cases were not executed and are excluded |
| Scoring rules | `AE-RUBRIC-v2`; job relevance, specificity, clarity, and conciseness, each 0–2, totaling 8 |
| Factual review | Separate from writing scores; check numbers, tools, responsibilities, sources, and necessary qualifiers per experience unit |
| Model | DeepSeek `deepseek-flash`, thinking disabled |
| Baseline | `ca08ce6` + `phase2-v6`, tagged `v0.2.0-eval-baseline` |
| v21 evaluation code | `ec6dff9` + `precise-followup-v21` |
| Current showcase runtime | `58a25be` + `precise-followup-v21`, identified separately from the historical evaluation |

Only the resume and JD were initially supplied. Answers, confirmation, or skipping followed the fixed simulated-user protocol only after questions were triggered. Raw model outputs, program-accepted results, AI preliminary scores, and formal human ratings remain separate.

Cases 0003/0004 share one resume but use different JDs. They are scored separately and belong to the same source-material family. A paired difference requires aligned units that are evaluable in both versions. The current v6 aggregate lacks unit-level scores, so no paired improvement is calculated.

## Confirmed Metrics

| Metric and denominator | v6 | v21 |
| --- | --- | --- |
| Resume suggestion generation success rate: cases with suggestions / planned cases | 8/10 = 80% | 10/10 = 100% |
| Evaluable experience units | 11 | 13 |
| Average rewrite quality score: total four-dimension points / rated units | Approximately 5.41/8; owner-confirmed aggregate, detailed scoring denominator not supplied | 85/13 = 6.54/8; formal human ratings for 13 units |
| Factual accuracy checks: passing rewrite units / completed reviews | No baseline factual-rate comparison in this report | 13/13 = 100% |
| Rewrite-text review coverage: reviewed units / planned units | No baseline coverage comparison in this report | 13/13 = 100% |
| Blocked experience units | 2 | 0 |
| Manual corrections per resume: total corrections / recorded cases | 38/10 = 3.8 | 20/10 = 2.0, approximately 47% fewer; manually recorded by the owner |

v21 scores are **human ratings confirmed by the project owner after AI-assisted review, not an independent blind assessment**. Using the owner-confirmed reporting convention, `(6.54 - 5.41) / 5.41` gives approximately 21% growth in aggregate means. The effective scoring populations differ; this is not a paired unit-level improvement. The 11 evaluable baseline outputs are not automatically the scoring denominator for 5.41.

Suggestion generation, factual accuracy of rewrite text, correctness of upstream judgments, and final usability are different dimensions. The 13/13 factual pass covers the evaluated text against its allowed sources, not every parsing result, association, or question.

## What the Evaluation and Iterations Show

- **Workflow and sources:** Repairs addressed question binding, omitted valid facts, and source citations so the planned cases could reach suggestion generation. Changes and source SHAs are in the [changelog](../../../CHANGELOG.md).
- **Job targeting:** Case 0003 targets community operations and emphasizes inquiry organization, pinned guidance, and organizer follow-up. Case 0004 targets interaction design and emphasizes flow sketches, Figma prototypes, and field descriptions. Both retain the limits that another person implemented the software, reminders were only discussed, and conversion was not recorded.
- **Traceable ratings:** Each of the 13 units retains its `experienceId`, dimension scores, rewrite-text factual verdict, and rewrite Run ID. See the [formal score extract](../../evidence/unit-scores.json) and [evaluation summary](../../EVALUATION_SUMMARY.md).

Follow-ups are counted separately: six of seven actual questions were accepted in human review, with seven answers supplied. These figures alone do not establish an efficiency gain. The owner separately supplied manual correction counts for the 10 cases from input to final version: 38 in v6 and 20 in v21. Normal questions and necessary factual additions are excluded; final edits distinguish corrections from preferences. See the [counting rules and records](../../EVALUATION_SUMMARY.md#manual-corrections-per-resume).

No per-edit logs were supplied, so stage-level detail is not reconstructed and model execution results are not changed. Automated runtime, agent edits, and API latency are not converted into human time or satisfaction.

## v21 Full-Regression Call Record

| Item | This batch |
| --- | --- |
| Batch | `AE-PRECISE-v21-20261123` |
| Real API calls | 35 |
| Input / output / total tokens | 68,553 / 12,739 / 81,292 |
| Historical conservative cost estimate | CNY 0.239018 |

This cost covers only the full v21 regression on 10 cases, not all historical iterations. Targeted runs and failed experiments remain in the original ledger. Documentation preparation made no API calls. Historical estimates are not current prices or provider invoices.

## Sources

| Source IDs | Supports |
| --- | --- |
| S04, S05, S06 | Formal v21 ratings, owner confirmation, and code/case freeze |
| S24 | Four-dimension rubric and separate factual gate |
| S33, S34 | Owner-confirmed reporting convention and actual v6 generation results |
| S39 | Full v21 batch calls, tokens, costs, and attribution; its original AI preliminary scores do not replace the human results in S04/S05 |
| S40 | Owner-supplied manual correction counts for 10 cases per version and their scope; not system telemetry |

[Evidence index](../../evidence/source-index.json) · [Metrics](../../evidence/metrics.json) · [Scoring confirmation](../../evidence/review-confirmation.json) · [Bad cases](../../BAD_CASES.md)
