// Fingerprints include drafts and edits: revision alone cannot detect unsaved changes.
export const taskSnapshot=task=>JSON.stringify(task);
export const analysisKey=task=>JSON.stringify({experiences:task.experiences,requirements:task.requirements,facts:task.facts,answers:(task.questions||[]).filter(q=>q.status!=='pending'&&!(q.status==='archived'&&q.previousStatus==='pending')).map(q=>({requirementId:q.requirementId,relatedRequirementIds:q.relatedRequirementIds,experienceId:q.experienceId,status:q.status,previousStatus:q.previousStatus,text:q.text,answer:q.answer})),manual:(task.associations||[]).filter(a=>a.manual||a.origin==='user')});
export const hasCurrentAnalysis=task=>!!task.aiAnalysis&&task.aiAnalysis.key===analysisKey(task);
export function assertCurrentTask(task,snapshot,currentId){
  if(!task||task.id!==currentId||taskSnapshot(task)!==snapshot)throw Error('材料或编辑稿已变化，旧结果已忽略，请按当前内容重试。');
}
export async function requestAI(stage,payload,timeout=130000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeout);
  try{
    const response=await fetch('/api/'+stage,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:controller.signal});
    const data=await response.json();
    if(!response.ok)throw Error(data.error||'模型处理失败，已保留现有内容。');
    return data;
  }catch(e){if(controller.signal.aborted)throw Error('请求超时，已保留当前材料，请重试。');throw e;}
  finally{clearTimeout(timer);}
}
