# ResumeTailor

Tailor a resume to a target role using real experience.

ResumeTailor compares a resume with a job description, asks for the facts needed to improve the wording, and lets the user review and save a role-specific version. The user decides which facts to confirm and which suggestions to use.

> **Language note:** Repository documentation is in English. The product interface, synthetic resumes, job descriptions, and original evaluation evidence remain in Chinese because the initial target users are Chinese-speaking job seekers. English descriptions of evidence are translations; the original records remain unchanged.

[Synthetic examples](examples/README.md) · [Product requirements](docs/PRD.md) · [Workflows](docs/WORKFLOW.md) · [Screenshots](docs/SCREENSHOTS.md) · [Evaluation](docs/EVALUATION_SUMMARY.md) · [Phase reports](docs/testing/README.md) · [Bad cases](docs/BAD_CASES.md) · [Repository guide](docs/REPOSITORY_GUIDE.md)

![ResumeTailor: material input, job matching and fact confirmation, rewrite review, and saved versions](docs/images/product-overview.png)

This walkthrough uses synthetic material in mock mode to show the interface and actual interactions. [View individual screenshots](docs/SCREENSHOTS.md). Real-model results are documented in the evaluation summary.

## Product Flow

Add materials → Review parsing → Match experience and answer follow-ups → Review rewrites → Save a role-specific version.

- **Understand the match:** Keep job requirements, experience sources, and reasoning visible. Users can adjust the associations.
- **Clarify factual gaps:** Users can confirm, edit, answer that something is unknown, or skip. Additional facts require confirmation before they can support a rewrite.
- **Review each suggestion:** Compare the original, suggestion, explanation, and sources. Edit the text or keep the original.
- **Keep separate versions:** Save tasks and results for different roles, reopen them, or export a local backup.

The JD determines what to emphasize; it is not evidence that the applicant has done something. Program checks and user review protect tool names, numbers, responsibilities, and attribution to the correct experience.

## My Role and Key Product Decisions

I defined the problem, scope, priorities, PRD, and core interactions. I also set evaluation criteria, reviewed results, and made iteration acceptance decisions. AI coding assistants supported implementation, automated testing, and evidence organization; I reviewed and confirmed product decisions and formal scores.

| Decision | Reason and trade-off |
| --- | --- |
| Separate parsing, matching/follow-ups, and rewriting into reviewable steps | Incorrect experience boundaries or associations can affect every later suggestion. Reviewing materials first makes errors easier to locate and correct. |
| Separate job relevance from factual sources, with explicit confirmation after answers | The JD sets priorities but cannot establish the applicant's experience. Rewrites use the relevant original text and confirmed additions, preserving unknown states, responsibilities, metric definitions, and negative facts. |
| Show originals and suggestions side by side, with an option to keep the original | Users need to decide whether a rewrite is useful. Differences, explanations, and sources support that decision; the number of changes is not a success metric. |
| Use fixed cases and assess factual accuracy separately from writing quality | Consistent inputs and criteria distinguish workflow completion, expression quality, and factual consistency. Passing program checks still requires semantic review, and a high writing score cannot offset a factual error. |

See the [PRD](docs/PRD.md) and [workflow](docs/WORKFLOW.md) for the design, and [bad cases](docs/BAD_CASES.md) for examples of diagnosis, changes, and verification.

## Evaluation Highlights

These figures summarize historical tests on 10 fixed synthetic development cases and aggregate records confirmed by the project owner.

| Metric | Result |
| --- | --- |
| Resume suggestion generation success rate | v6: 8/10 → v21: 10/10 |
| Average rewrite quality score | v6: approximately 5.41/8 → v21: 85 ÷ 13 = 6.54/8; approximately 21% higher based on the aggregate means |
| Factual accuracy checks | v21 rewrite text: 13/13 passed; review coverage: 13/13 |
| Manual corrections per resume | v6: 3.8 on average → v21: 2.0; approximately 47% fewer, across the same 10 cases, manually recorded by the project owner |

The v21 scores are human ratings confirmed by the project owner after AI-assisted review, not an independent blind assessment. The v6 mean is an owner-confirmed aggregate without accompanying unit-level scores; the approximately 21% change is not a paired comparison. Passing factual checks on rewrite text does not establish that all upstream judgments were correct. See the [evaluation summary](docs/EVALUATION_SUMMARY.md) for denominators, scoring rules, and code versions.

### How Manual Corrections Are Counted

The count covers the process from initial resume input to the final version. It was recorded manually by the project owner, not automatically by the system.

| Product step | Counting rule |
| --- | --- |
| Material input and parsing review | Count corrections to extraction, project names, dates, responsibilities, and similar parsing errors. |
| Requirement-to-experience matching | Count manual corrections to associations or judgments. |
| Follow-up answers and fact confirmation | Do not count normal answers or the addition of necessary factual information. |
| Rewrite review | Count corrections to factual errors, omissions, inaccurate wording, or unclear expression. |
| Final editing | Count edits, while distinguishing error correction from personal preferences. |

The totals are 38 and 20, each divided by 10 recorded cases. This metric is not the number of factual errors in rewrite text or a measure of human time. See the [per-case records and evidence limits](docs/EVALUATION_SUMMARY.md#manual-corrections-per-resume).

## Quick Start

Use Node.js 20.12 or later. No npm runtime dependencies are required. PDF extraction also requires Python and pypdf:

```powershell
python -m pip install -r requirements.txt
```

Open a terminal in the project directory. On first use, copy the example configuration:

```powershell
Copy-Item .env.example .env
```

If `.env` already exists, edit it instead of overwriting it. The default `AI_MODE=mock` lets you try the local workflow without a model key.

To use DeepSeek, set `AI_API_KEY` in your local `.env` and change `AI_MODE` to `live`. The example uses `deepseek-flash` with thinking `disabled`. Restart the service after changing the configuration. The local backend reads the key; it does not belong in frontend files or Git.

```powershell
node server.mjs
```

On Windows, you can also double-click `start-demo.cmd`. Keep the terminal open and visit [http://127.0.0.1:4392](http://127.0.0.1:4392). If the port is occupied, change `PORT` in `.env` and use the address printed at startup.

Live calls require explicit consent in the webpage to send the materials. Charges apply to the account associated with the configured key. Ordinary editing, copying, and saving do not call the model.

## Offline Tests

Run from the project root:

```powershell
npm test
```

The tests use Node's built-in test runner and require no API key or paid model calls. Interface tests connect to local mock services; PDF tests need Python and pypdf. The recorded verification of this package passed 336 checks. See [tests/README.md](tests/README.md) for prerequisites, scope, and evidence.

## Browser Regression Tests

[qa/README.md](qa/README.md) describes five isolated browser checks covering PDF review, matching and follow-ups, rewrite editing, saving, and reopening after refresh. Install the separate test dependencies, then run `npm --prefix qa test`. These checks use mock mode or fixed local upstream responses, with no paid model calls.

## Use and Storage

1. Paste a resume and JD, or upload a PDF with extractable text.
2. Review the parsed materials, experience boundaries, and job requirements.
3. Review associations, answer necessary follow-ups, and confirm additional facts.
4. Select what to rewrite, then edit, accept, or keep the original text.
5. Save a role-specific version and reopen it from the task or version list.

Tasks and versions are stored in the current browser. Use the same browser, address, and port to return to them. The data and privacy page provides a local backup export. For scanned PDFs, paste the text instead.

## Repository and Version References

| Path | Contents |
| --- | --- |
| `public/` | Pages, interaction state, styles, icons, and PDF preview resources |
| `lib/` | Model calls, material parsing, source validation, and factual checks |
| `prompts/` | The fixed `precise-followup-v21` prompt |
| `scripts/` | PDF text extraction |
| `tests/` | Offline checks, synthetic fixtures, provenance, and verification records |
| `qa/` | Reusable browser regression scripts, isolation runner, and verification notes |
| `examples/` | Two synthetic cases with real-model browser workflows, answers, and saved results |
| `docs/` | Product design, phase reports, evaluation, screenshots, cases, and file descriptions |
| `server.mjs` | Local backend entry point |

Runtime source: `58a25be1097a7902058a3c0a78415a2c90408cc5`. Prompt: `precise-followup-v21`. Historical evaluation code and current runtime code are identified separately; past results are not presented as new tests of the current package.

[File descriptions](docs/REPOSITORY_GUIDE.md) · [Complete file index](docs/FILE_INDEX.json) · [Changelog](CHANGELOG.md)

Third-party licenses for PDF.js, fonts, character maps, and decoding components are retained under `public/vendor/pdfjs/`.
