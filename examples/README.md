# Synthetic Job-Seeking Examples

These two fictional cases completed browser-based verification with the fixed v21 runtime and real DeepSeek suggestions, including review, saving, refresh, and reopening. An AI agent automated the interactions; this was not a real-user trial.

| Example | Focus | Recorded outcome |
| --- | --- | --- |
| [Case 02: data analysis](case-02-data-analyst/README.md) | Skip a question without supporting facts; adjust presentation order | Saved and reopened after refresh |
| [Case 03: algorithm engineering](case-03-algorithm-engineer/README.md) | Confirm personal responsibilities while preserving team metrics and deployment limits | Saved and reopened after refresh |

## Try an Example

1. Start the webpage using the [quick start](../README.md#quick-start). Real-model mode requires your own local API key and incurs charges.
2. Paste only `resume.txt` and `job_description.txt` into a new task, then review the materials before matching.
3. Consult `tester_notes.json` only when a relevant follow-up is actually asked. Use the corresponding synthetic answer; skip or retain an unknown state when unsupported. Do not provide all hidden answers to the model at the start.
4. Review original text, suggestions, and sources; accept, edit, or keep the text. Save, refresh, and reopen the task to verify the result.

## Files

| File | Contents |
| --- | --- |
| `resume.txt` / `job_description.txt` | Original synthetic inputs used in the run, without rewriting the input material |
| `tester_notes.json` | Tester-only facts, preset answers, and actual actions; not initial model input |
| `outputs.json` | Actual parsing, associations, questions, confirmations, per-unit T0/T1/T2, factual-review evidence, versions, and calls |
| `final_resume.txt` | Complete text retrieved from the version saved in the webpage |
| `README.md` | Reproduction steps, observed flow, and review priorities for the case |

T0 is the original segment retained by parsing, with line endings normalized. T1 is the first unedited model suggestion. T2 is the text saved in the webpage after agent review. Unselected units have T1 set to null and retain their original text. Neither example edited T1; T2 adopted the suggestions. These runs do not measure human correction counts or quality improvement.

Version: `58a25be1097a7902058a3c0a78415a2c90408cc5` / `precise-followup-v21` / `deepseek-flash`, thinking disabled. Factual checks are AI-assisted and pending human review. Workflow completion does not establish that every upstream judgment was correct. Model outputs can vary; these records document the actual runs without promising identical future text.

Inputs, answers, original outputs, and saved resumes remain in Chinese. English case descriptions explain the records without replacing them.
