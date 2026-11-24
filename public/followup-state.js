/** A revision replaces the current answer only on submit; cancellation keeps confirmed facts usable. */
export function beginAnswerEdit(task, id) {
  const question=task.questions.find(q=>q.id===id);
  if(!question)throw Error('补问已变化，请刷新后重试。');
  question.editing=true;
  question.draftAnswer=['confirmed','provided'].includes(question.status)?question.answer||'':question.status==='pending'?question.answer||'':question.savedDraft||'';
}
export function cancelAnswerEdit(task,id) {
  const q=task.questions.find(q=>q.id===id);
  if(q){delete q.editing;delete q.draftAnswer;}
}
export function replaceAnswer(task,id,{text='',status='provided'}={}) {
  const q=task.questions.find(q=>q.id===id);
  if(!q)throw Error('补问已变化，请刷新后重试。');
  const retired=(task.facts||[]).filter(f=>f.questionId===id);
  if(q.status&&q.status!=='pending')q.history=[...(q.history||[]),{status:q.status,answer:q.answer,facts:structuredClone(retired),at:new Date().toISOString()}];
  task.facts=(task.facts||[]).filter(f=>f.questionId!==id);
  if(q.draftAnswer?.trim()&&status!=='provided')q.savedDraft=q.draftAnswer;
  else if(q.status==='pending'&&q.answer?.trim()&&status!=='provided')q.savedDraft=q.answer;
  q.answer=text;q.status=status;delete q.editing;delete q.draftAnswer;
  return retired.map(f=>f.id);
}
