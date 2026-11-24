# Offline Package Verification

| Item | Record |
| --- | --- |
| Product source commit | `58a25be1097a7902058a3c0a78415a2c90408cc5` |
| Prompt | `precise-followup-v21`, unchanged |
| Test files | 24 |
| Synthetic fixtures | 9 |
| Command | `node --test --test-reporter=tap` |
| Total checks | 336 |
| Passed / failed | 336 / 0 |
| Skipped / cancelled / todo | 0 / 0 / 0 |
| Runner-reported duration | 2873.2067 ms; not human operating time |
| Environment | Windows, Node.js v24.22.3, Python 3.12.14, pypdf 6.21.4 |
| External model calls / API cost | 0 / CNY 0 |

The suite ran from the prepared showcase package root. PDF extraction actually ran and passed; missing dependencies were not classified as skips. HTTP checks used local test servers on random ports with simulated upstream responses, not DeepSeek.

Existing tests were reused from the source commit. Packaging adjusted fixture locations, removed unused internal metadata, and separated historical comparisons between old prompt snapshots. Current program-behavior assertions were retained. Per-file provenance and packaging changes are in [SOURCES.json](SOURCES.json).

The first full run passed. No failing assertions were deleted or altered, and no product implementation was changed to obtain passes. Product code, prompt, examples, and historical score files retained identical SHA-256 hashes before and after execution.

The full TAP output remains in the local preparation archive, outside the public package. SHA-256: `b9fccf612d9823fc4e888e1f98d17f341356ebaca93a3b214ce737450491c401`.

These are the recorded checks from package preparation, not a new test run performed for the English translation. They establish program behavior under fixed conditions, not AI semantic quality, browser end-to-end success, or real-user outcomes.
