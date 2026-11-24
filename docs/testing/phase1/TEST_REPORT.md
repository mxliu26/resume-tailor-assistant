# Phase 1: Local Demo Testing

Phase 1 checked the basic path from material input through parsing review, matching and follow-ups, rewrite review, and saved role-specific versions. The project owner accepted four core functional areas. This phase primarily used local rules and mock responses; its conclusions concern functionality and interaction.

## Version and Method

| Item | Record |
| --- | --- |
| Historical baseline tag | `v0.1.0-demo` |
| Tagged commit | `6dd64d095c02b761ebb74b2b4b7ff4374d1c3b5f` |
| Environment | Local Windows, Node.js, browser storage; desktop and 390 px narrow-screen checks |
| Materials and interfaces | Synthetic materials and a two-page Chinese test PDF; Live-protocol checks connected to fixed local responses |
| Evidence | Historical execution output, browser action records, update notes, and owner acceptance |

The tag preserves the phase baseline. It does not imply a separate Git commit for every earlier development round. Test batches retain their own run references.

## Accepted Scope

| Functional area | Checks | Historical evidence |
| --- | --- | --- |
| Pages, buttons, uploads, and navigation | Text/PDF input, review references, visible errors, desktop and narrow layouts | ACCEPT-01; RUN-07–RUN-13 |
| Task creation, saving, reopening, and deletion | Save/restore, role-specific versions, local backup, and material cleanup | ACCEPT-01; RUN-07/08, RUN-12, and earlier browser records |
| Follow-ups, confirmation, rejection, and returning to edit | Editable answers, fact confirmation, accept/reject/keep actions, and draft protection | ACCEPT-01; RUN-04, RUN-07/08, RUN-11 |
| State handling after upstream changes | Distinguish formatting from factual changes; flag affected results for update | ACCEPT-01; RUN-01, RUN-12 |

These are four acceptance areas, not a claim that only four automated test cases were executed.

## Historical Test and Issue Counts

| Item | Count and definition |
| --- | --- |
| Deduplicated issues | 36: 21 functional defects, 1 environment issue, 4 functional gaps, and 10 usability issues |
| Iteration entries | One initial entry plus 13 later batches, totaling 14; not 14 releases or Git commits |
| Last traceable full automated suite | RUN-08: 149/149 passed |
| Later PDF checks | RUN-12: 38/38 and 19/19 passed, totaling 57 targeted assertions |

The batches overlap substantially, so 149 and 57 are not added as independent coverage. The 36 deduplicated issues include usability and environment concerns; they are not described as 36 repaired code bugs. This report summarizes acceptance and recorded execution without assuming every historical issue has a separate retest.

## Representative Checks

- **Separate formatting and factual changes:** Preserve identity and confirmation states after line-break, whitespace, or list-format edits; require review after changes to numbers, responsibilities, or JD content.
- **Update questions with associations:** Refresh pending follow-ups after association changes while preserving answers, drafts, and fact attribution.
- **Keep rewrites reviewable and recoverable:** Show suggestion and manual-edit differences; check Chinese input, undo, acceptance state, and recovery after refresh.
- **Review PDFs alongside extracted text:** Check two-page extraction, original-page preview, navigation, zoom, saving, and reopening.

## Evidence and Limits

This summary is based on the original Phase 1 report, source **S35**. Its title, source commit, and SHA-256 are in the [evidence index](../../evidence/source-index.json). ACCEPT-01 and RUN identifiers retain their original meanings.

This phase supports usability of the specified local workflow. Real-model integration is covered in [Phase 2](../phase2/TEST_REPORT.md). Current showcase checks are reported separately in [offline verification](../../../tests/VERIFICATION.md); later counts are not reassigned to Phase 1.
