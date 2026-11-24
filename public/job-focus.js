// Presentation guidance from checked evidence, never new facts or a match score.
import {hasCurrentAnalysis} from './ai-state.js';
const usableStates = new Set(['已有明确证据', '表达不足', '相关但不等价']);
const core = category => category === '工作任务与能力' || category === '工具或方法';

export function jobFocusFor(task, experienceId) {
  const experience = (task.experiences || []).find(e => e.id === experienceId && !e.excluded);
  if (!experience || (task.facts || []).some(f => f.experienceId === experienceId && f.status === 'conflict')) return [];
  const sources = [experience.text || '', ...(task.facts || []).filter(f => f.experienceId === experienceId && f.status === 'confirmed').map(f => f.text)];
  return (task.requirements || []).flatMap((r, index) => {
    if (r.category === '明确条件') return [];
    const association = (task.associations || []).find(a => a.requirementId === r.id);
    const link = (association?.links || (association ? [association] : [])).find(a => a.experienceId === experienceId);
    if (!link || link.conflict || !usableStates.has(link.status)) return [];
    if (link.origin === 'ai' && !hasCurrentAnalysis(task)) return [];
    const quotes = String(link.evidence || '').split(/\r?\n/).filter(s => s.trim());
    if (!quotes.length || !quotes.every(q => sources.some(s => s.includes(q)))) return [];
    return [{requirementId:r.id, text:r.text, category:r.category, status:link.status, evidence:quotes.join('\n'), order:index}];
  }).sort((a,b) => Number(core(b.category))-Number(core(a.category)) || a.order-b.order)
    .map(({order, ...item}) => item);
}

// Same action priority: direct support for core work before adjacent or bonus-only evidence.
// No positive ranking credit for unknown, negated, conflicting or unsupported links.
export function compareJobFocus(a, b) {
  const groups = focus => [
    focus.filter(f => core(f.category) && f.status === '已有明确证据').length,
    focus.filter(f => core(f.category) && f.status === '表达不足').length,
    focus.filter(f => core(f.category) && f.status === '相关但不等价').length,
    focus.filter(f => !core(f.category) && f.status === '已有明确证据').length,
    focus.length,
  ];
  const x=groups(a), y=groups(b);
  for (let i=0; i<x.length; i++) if (x[i]!==y[i]) return y[i]-x[i];
  return 0;
}
