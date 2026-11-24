# Phase 2: Real-Model Integration

Three planned synthetic cases completed basic integration acceptance, covering a normal flow, insufficient information, and factual boundaries. Acceptance combined valid historical steps, targeted real-model retests, and offline replay through the current validators. It was not a full browser rerun of every case on one code version.

## Versions and Configuration

| Item | Record |
| --- | --- |
| Provider and model | DeepSeek, `deepseek-flash` |
| Generation settings | Thinking disabled; temperature 0.2; max_tokens 4096 |
| Closeout prompt | `phase2-v6` |
| Closeout offline acceptance code | `ba8ec9435dac4235d913f4eb4a8c702fb30eb71b` |
| Subsequent evaluation baseline | `v0.2.0-eval-baseline` → `ca08ce659696d133fef9a950b65ea4ac4bf95a67` |

Each historical step retains its Run ID and actual code version; results are not relabeled as closeout-version runs. The response model name is a provider alias, not an immutable model-weight snapshot.

## Case Results

| Case | Scenario | Verified behavior |
| --- | --- | --- |
| AI-CASE-0001 | Normal flow | Valid parsing, association, and rewriting; no forced questions when facts were sufficient; preserved team-member status, numbers, and the not-launched qualifier. |
| AI-CASE-0002 | Insufficient information | Distinguished necessary questions from education conditions; answers moved from pending to confirmed; real-response evidence covered post-confirmation association and rewriting, plus skipped/unknown branches. |
| AI-CASE-0003 | Factual boundaries | Preserved separate experiences and sources; avoided repeating an already covered collaboration question; retained team percentages, negative facts, and prototype deployment limits; excluded non-factual instructions from suggestions. |

All three cases are fictional. Program checks, simulated user confirmation, and actual model responses have separate evidence. Simulated actions are not described as real-user acceptance.

## Verification and Repair Evidence

- Real responses and offline reproductions guided fixes for omitted identity placeholders, confusion between conditions and capability states, repeated follow-ups, and source handling.
- The historical ledger contains 12 deduplicated bad cases, closed within their respective targeted scopes in the original closeout report. This is not a correctness guarantee for all inputs.
- Closeout offline acceptance replayed 11 evaluated real responses, checked 35 source hashes, and separately verified rejection of unconfirmed facts.
- Original requests/responses, Run IDs, code SHAs, models, and prompt versions remain linked. Full originals stay in the development archive; this directory provides a concise source index.

## Historical Calls and Cost

| Item | Record |
| --- | --- |
| Calls with complete usage | 18, including integration failures and retests |
| Input / output tokens | 14,907 / 4,379 |
| Total tokens | 19,286 |
| Estimated cost for known usage | CNY 0.064846 |
| Earlier HTTP 402 attempt, recorded separately | 1; usage and actual charge unknown, with CNY 0.038114 reserved |
| Total request attempts | 19; estimate plus unknown-usage reserve: CNY 0.102960 |

The historical conservative estimate used CNY 2 per million input tokens and CNY 8 per million output tokens, without double-counting cache-hit tokens. These are historical estimates and budget reservations, not provider invoices, current prices, or spending from documentation preparation.

## Evidence Index

| Source | Supports |
| --- | --- |
| S36: original Phase 2 report | Three case conclusions, closure of 12 issues, and validation method |
| S37: CLOSEOUT_SUMMARY | 18 calls with usage, 19 attempts, token counts, and cost breakdown |
| S38: CLOSEOUT_ACCEPTANCE | Replay of 11 real responses, 35 hashes, unconfirmed-fact rejection, and Run IDs |

See the [evidence index](../../evidence/source-index.json) for source titles, commits, and SHA-256 hashes. Writing-quality comparison is covered in [Phase 3](../phase3/TEST_REPORT.md); reusable browser checks are in [qa/](../../../qa/README.md).
