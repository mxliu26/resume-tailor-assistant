# Computer Vision Internship: Synthetic Example

[Original resume](resume.txt) · [Job description](job_description.txt) · [Tester reference](tester_notes.json) · [Full run record](outputs.json) · [Saved final resume](final_resume.txt)

## Recorded Browser Flow

Paste both texts → create a task and consent to parsing → review experiences and requirements → confirm matching → provide a preset answer and confirm the facts → enter rewriting and consent to generation → accept the suggestion → preview and confirm saving → refresh → reopen from the task list → view the saved version.

The actual follow-up asked whether the applicant participated in offline inference validation and organized reports or documentation. The supplied and confirmed answer is translated below; the original remains in the run record:

> I handled annotation cleaning, training-parameter records, and the organization of three sets of ablation results. My supervisor and another student made the backbone architecture improvements.

This answer confirms only the applicant's responsibilities defined in the synthetic case. It does not establish participation in offline inference validation; the model retained that item as unspecified.

The model generated one suggestion. After AI-agent review, it was adopted without editing the first draft. T0, first T1, saved T2, and sources remain in `outputs.json`. Unselected units retained their original text. After refresh, the saved version, suggestion, and factual states matched, and saved text displayed correctly.

## Review Priorities

- **Team metrics and definitions:** T1 retained team attribution, the fixed validation set, and AP50. It did not claim independent personal improvement or production accuracy.
- **Personal responsibilities and confirmed additions:** The browser answer was confirmed before integration under the same experience source. The applicant was not credited with the network architecture changes.
- **Deployment and unknown capability:** T1 retained the not-deployed qualifier. It did not add TensorRT/ONNX deployment, inference latency, or personal participation in offline inference validation.

The recorded outcome is completion of browser automation, with AI-assisted factual checks pending human review. It is not a formal human rating or a real-user trial.

Runtime source: `58a25be1097a7902058a3c0a78415a2c90408cc5`. Prompt: `precise-followup-v21`. Model: `deepseek-flash`, thinking disabled. Session: `SYN3-SHOWCASE-20261124-01`. This case used 4 calls and 16,684 tokens, with a conservative estimated cost of CNY 0.054812.
