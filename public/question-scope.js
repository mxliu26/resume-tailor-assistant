// One answer can address nearby gaps in the same experience. Coverage is not
// evidence of ability, and a negative answer never authorizes all covered claims.
export const questionRequirementIds=q=>[...new Set([q.requirementId,...(q.relatedRequirementIds||[])].filter(Boolean))];
export const questionCovers=(q,requirementId,experienceId)=>q.experienceId===experienceId&&questionRequirementIds(q).includes(requirementId);
export const answerState=q=>q.status==='archived'?q.previousStatus:q.status;
