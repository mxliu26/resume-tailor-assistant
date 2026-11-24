# Browser Regression QA

This directory checks actual browser clicks, input, page state, and local saving. It complements the program-rule tests in [tests/](../tests/README.md). It does not evaluate DeepSeek's writing quality and is not a real-user trial.

## Run

Use Node.js 20.12 or later. From the project root, install the separate test dependencies and browser on first use:

```powershell
npm --prefix qa install
npm --prefix qa exec -- playwright install chromium
npm --prefix qa test
```

Installation needs network access; running the tests needs no API key and sends no paid model requests. The product service does not need to be started beforehand. PDF scenarios also require Python and pypdf; see [requirements.txt](../requirements.txt). Extraction failures are reported rather than skipped.

To use an existing Chrome or Edge installation instead of downloading a browser:

```powershell
$env:QA_BROWSER_CHANNEL = 'chrome' # Or use msedge
npm --prefix qa test
```

Run one scenario:

```powershell
node qa/run.mjs phase2-flow
```

Set `QA_HEADED=1` to display the automated browser. `QA_BROWSER_PATH` selects a browser executable, and `QA_PLAYWRIGHT` selects an installed `playwright/index.mjs`. These are optional local environment variables, not changes to product configuration.

## Scope

| Script | Checks | Materials / model |
| --- | --- | --- |
| `comparison-feedback.mjs` | Review confirmation, manual associations, preservation of answers/facts, suggestion adoption, and state recovery | Synthetic text; mock mode |
| `comparison-navigation.mjs` | Scroll navigation, sidebar highlighting, rewrite selection/expansion, and narrow layouts | Synthetic text; mock mode |
| `rewrite-feedback.mjs` | Edit highlighting, undo, Chinese input, drafts, question navigation, and protection from new candidates | Constructed intermediate state in isolated storage; mock mode, not a complete end-to-end run |
| `review-reference.mjs` | Synthetic PDF upload/preview, JD switching, saving/reopening, backup, and deletion | Locally generated two-page fictional PDF; mock mode; includes old-task intermediate-state checks |
| `phase2-flow.mjs` | Input → parsing → matching → questions → confirmation → rewriting → final saving → refresh/reopen; failures preserve existing drafts | Live interface protocol with fixed local upstream responses, not DeepSeek calls |

## Isolation and Evidence

- Each scenario uses random local ports and a new temporary browser context. It does not connect to existing services or read/clear personal browser data. Deletion tests affect only that scenario's synthetic data.
- QA explicitly fixes the model address, mode, and fake key, without using the real endpoint in the product's `.env`. The Live-protocol scenario permits only a fixed-response upstream on `127.0.0.1`; external browser requests are blocked.
- Current v21 prompt loading, factual validation, and product code execute unchanged. Responses are not edited to obtain passes. The fixed upstream makes interface and frontend-state checks reproducible.
- Each run writes to `qa/output/<run-id>/`, including `summary.json`, per-scenario `report.json`, request status, screenshots, `trace.zip`, and isolated task snapshots. This directory and `node_modules` are excluded by `.gitignore`.
- Failures preserve screenshots, errors, and logs immediately. Unexecuted scenarios are listed separately. Passing a scenario does not establish model quality or acceptance of every feature.

See [SOURCES.json](SOURCES.json) for provenance and packaging changes, and [VERIFICATION.md](VERIFICATION.md) for the recorded execution. Original synthetic fixtures and source records retain their original language.
