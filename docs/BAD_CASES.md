# Four Representative Bad Cases and Their Fixes

These cases show how program defects and model-output errors were distinguished and checked against evidence. Historical requests, responses, and validation rules are preserved separately; responses were not manually rewritten to manufacture passes. Claims below are limited to the scope supported by targeted verification.

Evidence excerpts are described in English for readability. The linked original Chinese records remain unchanged.

## 1. Existing Availability Facts Were Omitted from the Model Request

**Issue: AE-BC-0002 · Type: program context assembly**

| Step | Finding |
| --- | --- |
| Observed problem | Availability was already in the resume, but the analysis request selected only rewritable experiences and omitted a separate basic-information source. |
| Cause | Sources for checking explicit conditions and sources for rewriting experiences shared the same filter. |
| Minimal fix | Separate condition sources from experience sources and provide source IDs and purposes. Condition information can support checks without becoming a rewritable experience. |
| Prompt vs. program | The historical v7 change also instructed the model to inspect condition sources. The showcase retains v21; this documentation change does not modify the prompt. |
| Verification | In targeted re-analysis, cases 0006 and 0008 correctly cited availability of five days per week for three months and three days per week for four consecutive months, respectively. These two facts were no longer requested again. |
| Scope of conclusion | Condition-source transmission and checks recovered for the target samples. This does not establish that every job-fit judgment is correct. |

Fix code: `de2a6a08348c65e3359f1058273f33f10ee7f69a`. Evidence: S08, S09.

## 2. Follow-Ups Without a Valid Experience Binding Blocked the Entire Result

**Issue: AE-BC-0001 · Type: model-generation constraints and request contract**

| Step | Finding |
| --- | --- |
| Observed problem | The model asked follow-ups for explicit conditions or requirements without an eligible experience ID. The program rejected the entire response, blocking rewriting. |
| Cause | Question generation did not sufficiently respect the allowed requirements, experiences, and states. |
| Minimal fix | Explicitly supply eligible follow-up scopes, states, and counts. Instruct the model to complete associations before checking question validity. Keep validation strict; do not silently delete invalid questions or replace source IDs. |
| Prompt vs. program | The historical fix changed the `analyze` prompt. It did not remove the error by weakening response validation. |
| Verification | Targeted runs for 0002 and 0006 completed the triggered follow-ups and subsequent rewriting, applying confirmed, not-done, and unknown states under the frozen protocol. The later full v8 regression generated suggestions for all 10 cases and 13 experience units. |
| Scope of conclusion | Workflow recovery and the semantic quality of questions are judged separately. 10/10 means suggestion generation, not unconditional usability of every suggestion. |

Fix code: `de2a6a08348c65e3359f1058273f33f10ee7f69a`. Later full regression: `a053e03b5f8fbb2277954f3c24a8b5cd96b64b83`. Evidence: S07, S08, S09.

## 3. PDF Spacing Made an Existing Tool Name Look Unsupported

**Issue: WEB-v21-BC-0004 · Type: program source matching**

| Step | Finding |
| --- | --- |
| Observed problem | PDF extraction produced `MA TLAB`; the model returned `MATLAB`. Contiguous-string matching failed and blocked the suggestion. |
| Cause | The source and normalized model wording differed by a verified layout space. The tool itself was not invented. |
| Minimal fix | Treat only the standalone `MA TLAB` form in a cited source as equivalent during matching. Retain negative qualifiers and attribution checks. Do not remove arbitrary spaces or join text across lines or sources. |
| Prompt vs. program | The v21 prompt, original material, and raw model response were unchanged. |
| Verification | All 25 related offline checks passed. Replaying the same failed response accepted all three suggestions. A subsequent call from the original browser task generated three suggestions; the draft was saved, refreshed, and reopened with matching text and sources. |
| Scope of conclusion | The browser check covered suggestions and draft persistence. It did not confirm adoption or save a final role-specific version on the user's behalf. Private resumes and full responses are excluded from showcase materials. |

Fix code: `0d1b96b`. Evidence: S10.

## 4. A Prompt Constraint Corrected Cross-Experience Evidence Citations

**Issue: AE-BC-0005 · Type: model output and prompt guidance on source attribution · Historical versions: v7 → v8**

| Step | Finding |
| --- | --- |
| Original error | In case 0010, the primary association was bound to image annotation quality checks but cited a separate skills section about checking records against rules and flagging items for confirmation. The existing validator rejected the result with HTTP 422. |
| Cause | The prompt required a global review of multiple sources without sufficiently restating the primary association's attribution boundary. Although the skills statement existed in the resume, it was not evidence for that specific quality-check experience. |
| Prompt change | v8 added a rule that each capability-association citation's `source.experienceId` must equal the current `experienceId`. Only that experience's original text and confirmed additions are allowed. Exceptions for condition sources do not apply to capability associations. |
| Change scope | Rules were appended only to `analyze`; `shared`, `parse`, and `rewrite` were unchanged, and the loader selected v8. Raw responses and factual-source validation were not modified. |
| Offline verification | The historical targeted run recorded 64 passes, 0 failures, and 0 skips. Invalid cross-source citations remained rejectable. |
| Real-model retest | A v8 analysis retest for 0010 cited only the same experience's evidence: the two tables disagreed on sample IMG-046, the discrepancy had not been reviewed, and neither result could be confirmed. It no longer cited the separate skills section, and existing source validation passed. |
| Scope of conclusion | This verifies source attribution for the case, not correct conflict resolution, personal responsibility attribution, or every subsequent call. The evidence review was AI-assisted; no new formal human rating is introduced here. |

Fix commit: `4de7daa3ffbd6ddc640c5ab0dcbd8ae8a4a3bf5d`.

- Failed run: `AE-CANDIDATE-P1-20261122-0010-01-analyze`
- Retest run: `AE-CANDIDATE-P1-20261122-0010-02-analyze`

[Actual evidence excerpts and prompt delta](evidence/prompt-fix-example.json). Sources: S08, S09, S25–S32. This is a historical case summary; the showcase product's v21 prompt is unchanged.

## Working Method

Identify whether a failure originates in input, assembled context, model output, or program validation. Reproduce it offline with the original failed response, change the component responsible, and make only the real-model retests needed. Record validation behavior separately from semantic quality, and keep conclusions within the verified scope.

See the [structured bad-case records](evidence/bad-case-records.json) and [source names and hashes](evidence/source-index.json).
