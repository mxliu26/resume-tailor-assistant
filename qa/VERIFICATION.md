# Browser Regression Verification

Product source: `58a25be1097a7902058a3c0a78415a2c90408cc5`. Prompt: `precise-followup-v21`. All five scenarios used the same runtime; code and prompt hashes were unchanged before and after execution.

| Scenario | Result | Duration |
| --- | --- | --- |
| comparison-feedback | Pass | 9128 ms |
| comparison-navigation | Pass | 7197 ms |
| rewrite-feedback | Pass | 5720 ms |
| review-reference | Pass | 8882 ms |
| phase2-flow | Pass | 4747 ms |

Environment: Windows, Node.js v24.22.3, Playwright 1.62.1, Chrome 157.0.8103.79. PDF checks used Python 3.12.14 and pypdf 6.21.4; extraction and preview actually ran and passed. Durations measure automation, not human operation.

Four scenarios used mock mode. `phase2-flow` used the Live protocol against a local fixed-response service, making six local upstream requests, including intentionally invalid JSON for parsing/regeneration failure checks. Browser actions covered answering, fact confirmation, accepting suggestions, final saving, refresh/reopen, and viewing saved text. Upstream `usage` fields were test values, not DeepSeek token consumption, and did not enter the API ledger. External model calls: 0. API cost: CNY 0.

The first run passed `comparison-feedback` but failed `comparison-navigation` because the historical script hard-coded font weight 600. The current `ui-polish.css:485` used 500 for emphasis and 400 for ordinary items. The script was adapted to check relative weight, distinct text color, and `is-current` highlighting, while retaining all navigation assertions. Only that scenario was retested, followed by the three unexecuted scenarios; all four passed. No failed scenario was deleted, and the first failure's trace and report were preserved.

The five results come from two runs, without repeating the already valid scenario:

- `2026-11-24T07-04-39-721Z-267efcf9`: one pass, one incompatible visual assertion, three unexecuted scenarios.
- `2026-11-24T07-06-29-834Z-478849d4`: adapted navigation and the remaining three scenarios all passed.

The runner normally writes full evidence to `qa/output/`. These records were archived locally; screenshots, task snapshots, and `trace.zip` are not included in the public package. The report hashes identify the recorded evidence:

| Scenario | report.json SHA-256 |
| --- | --- |
| comparison-feedback | `cf5a79334e1a5148439e5e1f1bb1567d9bd3e90806884aecffc4cfc9fa4a5a3b` |
| comparison-navigation | `3acf964b30fea545dada2c7daf9c8237c28fda655152b872bc01d0a5304d0558` |
| rewrite-feedback | `b99536f53f7e08c5813ec8c0745d7f4029112213c91dae632b4ab7ed5dac3086` |
| review-reference | `369b726de4e94b4fb7086315b3533f7f123ea0561d4cb469541405d2cd681e92` |
| phase2-flow | `49428eb23e76fcc70a52098bb68975499645cf3aa7e7cabc39462a6af86b2a78` |

These historical results cover specified browser interactions and protocol states. They are not a new real-model evaluation and do not establish untested behavior or real-user outcomes. Translating this record did not rerun the browser tests.
