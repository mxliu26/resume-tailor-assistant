# Data Analyst Internship: Synthetic Example

[Original resume](resume.txt) · [Job description](job_description.txt) · [Tester reference](tester_notes.json) · [Full run record](outputs.json) · [Saved final resume](final_resume.txt)

## Recorded Browser Flow

Paste both texts → create a task and consent to parsing → review experiences and requirements → confirm matching → skip an unsupported follow-up → enter rewriting and consent to generation → accept each suggestion → preview and confirm saving → refresh → reopen from the task list → view the saved version.

The actual follow-up asked whether the applicant communicated data needs with operations staff or requesters. The preset material did not support this fact, so the agent skipped the question without supplying hidden answers about other topics. Suggestions then used only the current facts.

The model generated two suggestions. After AI-agent review, both were adopted without editing the model's first draft. T0, first T1, saved T2, and individual sources remain in `outputs.json`. Unselected units retained their original text. After refresh, the saved version, suggestions, and factual states matched, and saved text displayed correctly.

## Review Priorities

- **Team, coursework samples, and business scope:** T1 retained the original statements and changed only their order. It did not add the 860-record or six-product-category facts, which were not asked about and confirmed in this run.
- **Tools and scope of use:** The original wording remained intact. Classroom SQL knowledge was not turned into production-database experience.

The recorded outcome is completion of browser automation, with AI-assisted factual checks pending human review. It is not a formal human rating or a real-user trial.

Runtime source: `58a25be1097a7902058a3c0a78415a2c90408cc5`. Prompt: `precise-followup-v21`. Model: `deepseek-flash`, thinking disabled. Session: `SYN3-SHOWCASE-20261124-01`. This case used 4 calls and 16,284 tokens, with a conservative estimated cost of CNY 0.052110.
