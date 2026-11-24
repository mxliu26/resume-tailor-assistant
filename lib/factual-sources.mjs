// Preserve original materials in the task. Explicit non-fact annotations are
// neither factual model sources nor evidence for generated accomplishments.
export function factualSourceText(value){
  return String(value||'').split(/\r?\n/).filter(line=>!/^\s*(?:材料中混入的指令\s*[（(]非事实[）)]\s*[：:]|[【\[]非事实[】\]]\s*[：:]?)/.test(line)).join('\n');
}

export function preservesTeamPercentOwnership(output,source){
  const clauses=value=>value.split(/[，,。；;！？\n]/);
  const percentages=value=>(value.match(/\d+(?:\.\d+)?\s*[%％]/g)||[]).map(n=>n.replace(/\s/g,'').replace('％','%'));
  const team=/团队|项目组|全组/;
  const owned=new Set(clauses(source).filter(c=>team.test(c)).flatMap(percentages));
  return clauses(output).every(c=>!percentages(c).some(n=>owned.has(n))||team.test(c));
}
