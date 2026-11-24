import {hasCurrentAnalysis} from './ai-state.js';
import {isContentUnit, originalSectionTitle} from './material-units.js';
import {unitPresentation} from './unit-presentation.js';
/** Deterministic, deliberately conservative demo engine. It is not an AI model. */
export const sample = {
  role: 'AI 产品实习生', company: '知序科技（虚构示例）',
  resume: `林予安
求职方向：产品实习生 | 示例简历，所有信息均为虚构
邮箱：lin.example@example.com

教育背景
海川大学 · 信息管理与信息系统 · 本科
2023.09—2027.06

校园自习室预约优化｜课程项目
2025.09—2025.12 · 产品方向成员
参与校园自习室预约流程研究，整理 12 位同学反馈，绘制预约流程图。
使用 Figma 制作预约页面原型，与 3 名组员共同完成课程汇报；项目尚未上线。

中文问答评测｜科研助理
2026.03—2026.06 · 研究助理
参与中文问答模型的离线评测，使用 Python 整理 1,200 条测试数据。
按答案正确性与完整性标注错误类型，整理评测记录；未开展线上 A/B 测试。

校园读书会｜社团经历
2024.09—2025.06 · 活动成员
参与策划 4 场线下读书分享活动，负责报名信息整理与现场签到。

技能
Figma、Python、Excel；英语 CET-6。`,
  jd: `知序科技｜AI 产品实习生（虚构示例）
岗位职责：
1. 参与用户需求整理与产品流程设计，协助输出原型与需求文档。
2. 协助整理模型评测数据，归纳问题并跟进改进。
任职要求：
3. 本科及以上在校生，专业不限。
4. 熟悉 Figma 或其他原型工具，具备清晰的沟通与文档表达能力。
5. 有线上 A/B 测试经验者优先。
6. 每周可到岗 3 天，连续实习 3 个月以上。`
};

const hash = value => {
  let n = 2166136261;
  for (const c of String(value)) { n ^= c.charCodeAt(0); n = Math.imul(n, 16777619); }
  return (n >>> 0).toString(36);
};
const clean = value => String(value ?? '').trim();
const factsFor = (task, id) => (task.facts || []).filter(f => f.experienceId === id);
const currentFacts = (task, id) => factsFor(task, id).filter(f => f.status === 'confirmed' && clean(f.text));
const sourceFor = exp => String(exp.text ?? exp.original ?? '');
const selectedIds = task => new Set(task.selected || []);
const adopted = suggestion => ['accepted', 'edited'].includes(suggestion?.status);
const contextTitle = /^(教育(?:背景|经历)?|学历|技能|专业技能|个人技能|证书|语言|基本信息|个人信息|联系方式|自我评价|兴趣爱好|个人优势|求职意向)\s*[:：]?/;
const experienceTitle = /(项目|科研|实习|工作|任职|竞赛|社团|志愿|研究助理|活动|实践|研究经历|课题)/;
const genericSection = /^(项目经历|项目经验|工作经历|实习经历|科研经历|实践经历|校园经历|任职要求|岗位职责|职位描述|岗位要求)\s*[:：]?$/;

/** Ignore presentation changes while retaining ASCII token boundaries and every
 * meaningful character (notably digits, decimal separators, signs and negation).
 * "使用 SQL" equals "使用SQL"; "SQL" never equals "S Q L"; "12" never equals "1 2".
 */
export function normalizeFormattingWithMap(value) {
  const input = String(value ?? ''), removed = new Set();
  const bullets = /(^|[\r\n])[\t \u3000]*(?:[•●▪◦‣⁃·][\t \u3000]*|[-*+][\t \u3000]+(?=[^\d\s+−-]))/g;
  for (const match of input.matchAll(bullets)) {
    for (let i=match.index+match[1].length;i<match.index+match[0].length;i++) removed.add(i);
  }
  const chars=[];
  for (let i=0;i<input.length;i++) if (!removed.has(i)) chars.push({char:input[i],start:i,end:i+1});
  let text='';const starts=[],ends=[];
  for(let i=0;i<chars.length;i++) {
    const current=chars[i];
    if (/[\s\u3000]/.test(current.char)) {
      const first=i;while(i+1<chars.length&&/[\s\u3000]/.test(chars[i+1].char))i++;
      if(/[A-Za-z0-9_]/.test(chars[first-1]?.char||'')&&/[A-Za-z0-9_]/.test(chars[i+1]?.char||'')) {
        text+=' ';starts.push(chars[first].start);ends.push(chars[i].end);
      }
    } else {text+=current.char;starts.push(current.start);ends.push(current.end);}
  }
  return {text,starts,ends};
}

export const normalizeFormatting = value => normalizeFormattingWithMap(value).text;
export const isFormattingOnly = (before, after) => normalizeFormatting(before) === normalizeFormatting(after);

const sectionKinds = new Map([
  ...['教育背景','教育经历','学习经历','专业技能','个人技能','技能特长','技术技能','技能与优势','技能与特长','技能与证书','技能与兴趣','自我评价','个人优势','基本信息','个人信息','联系方式','获奖情况','荣誉证书','资格证书','求职意向','技能','证书','语言','学历'].map(s => [s,'context']),
  ...['项目经历','项目经验','项目实践','工作经历','工作经验','实习经历','实习经验','科研经历','研究经历','科研项目','校园经历','社团经历','实践经历','竞赛经历','志愿经历'].map(s => [s,'experience'])
]);
const sectionPattern = new RegExp([...sectionKinds.keys()].sort((a,b) => b.length-a.length).map(s => [...s].join('[ \\t\\u3000]*')).join('|'), 'g');
const dateRange = /(?:19|20)\d{2}(?:\s*[.\/年-]\s*\d{1,2}(?:月)?)?\s*[-—–~～至]+\s*(?:(?:19|20)\d{2}(?:\s*[.\/年-]\s*\d{1,2}(?:月)?)?|至今|现在)/g;
const actionStart = /^(?:[-•▪●◦·]\s*)?(?:参与|负责|协助|使用|通过|完成|整理|制作|设计|开发|独立|主导|牵头|组织|搭建|推动|对接|输出|实现|提升|优化|收集|分析|编写|带领|工作内容|项目描述|主要职责|担任|期间|其中|基于)/;
const bodyCue = /[。；;]|(?:参与|负责|协助|使用|通过|完成|整理|制作|开发|输出|实现|收集|编写).{4}/;

function sectionMatches(text) {
  const matches = [];
  for (const match of text.matchAll(sectionPattern)) {
    const name = match[0].replace(/[ \t\u3000]/g, '');
    const left = text[match.index - 1] || '', right = text[match.index + match[0].length] || '';
    const boundaryLeft = !left || /[\s，,。；;：:|｜/]/.test(left);
    const boundaryRight = !right || /[\s：:|｜\dA-Z]/.test(right);
    const linePrefix = text.slice(text.lastIndexOf('\n',match.index-1)+1,match.index).trim();
    if (/[|｜]$/.test(linePrefix) && linePrefix.length < 45 && !/[\d。；;]/.test(linePrefix) && ![...sectionKinds.keys()].some(name=>linePrefix.includes(name))) continue;
    // Short terms such as 技能 inside ordinary prose are not section headings.
    if (name.length <= 2 ? !boundaryLeft || !boundaryRight : !boundaryLeft && !boundaryRight) continue;
    // A colon-led detail belongs to the enclosing skills/strengths section.
    // PDF extraction may wrap "AI 技能：…" into "AI\n技能：…"; that new
    // line is not a new section. Keep all original characters and source spans.
    // Standalone headings (and headings after a work/education section) still cut.
    const parent = matches.at(-1);
    const withinSkills = parent?.kind === 'context' && /技能|个人优势|自我评价/.test(parent.name);
    const skillDetail = /^(?:(?:专业|个人|技术)?技能|技能特长|语言|证书)$/.test(name);
    const colonDetail = /^[ \t\u3000]*[:：]/.test(text.slice(match.index + match[0].length));
    if (withinSkills && skillDetail && colonDetail) continue;
    const bulletPrefix = /^[•●▪◦‣⁃·-]\s*$/.test(linePrefix);
    const start = bulletPrefix ? text.lastIndexOf('\n',match.index-1)+1 : match.index;
    matches.push({ start, end: match.index + match[0].length, name, kind: sectionKinds.get(name) });
  }
  return matches;
}

function headingCue(line) {
  const text = line.trim();
  if (!text || text.length > 100 || /[。；;]/.test(text) || actionStart.test(text) || /^(?:姓名|求职|邮箱|电话|联系|简历|应聘|地址|生日|性别|年龄)/.test(text)) return false;
  if (/大学|学院|本科|硕士|博士|学士/.test(text) && !/项目|实习|科研|课题|实验室|课题组/.test(text)) return false;
  if (sectionKinds.has(text.replace(/\s|[:：]/g,''))) return false;
  return /(?:有限公司|有限责任公司|科技公司|研究所|实验室|工作室|课题组|实习生|工程师|项目成员|团队成员|项目负责人|科研助理|研究助理)/.test(text)
    || (experienceTitle.test(text) && text.length < 65)
    || (text.length < 50 && /系统|平台|小程序|网站|课程研究|课题|竞赛/.test(text))
    || /[|｜]/.test(text) && /产品|运营|分析|设计|开发|成员|助理|经理/.test(text);
}

function splitBlocks(text) {
  const paragraphs = [];
  const sections = sectionMatches(text);
  // Work on source indices throughout. A normalized copy must never drive offsets.
  const pattern = /[^\r\n][\s\S]*?(?=\r?\n[ \t]*\r?\n|$)/g;
  let m;
  while ((m = pattern.exec(text))) {
    if (m[0].trim()) paragraphs.push({ start: m.index, end: m.index + m[0].length });
    if (!m[0].length) pattern.lastIndex++;
  }
  const blocks = [];
  for (const paragraph of paragraphs) {
    const sectionCuts = [paragraph.start, ...sections.filter(s => s.start > paragraph.start && s.start < paragraph.end).map(s => s.start), paragraph.end];
    for (let si = 0; si < sectionCuts.length - 1; si++) {
      const segmentStart = sectionCuts[si], segmentEnd = sectionCuts[si + 1];
      const section = sections.findLast(s => s.start <= segmentStart);
      const ownSection = section?.start === segmentStart ? section : null;
      const segment = text.slice(segmentStart, segmentEnd);
      const cuts = [segmentStart];
      const lines = [...segment.matchAll(/[^\r\n]+/g)];
      let previousHeading = false;
      for (let index = 0; index < lines.length; index++) {
        const line = lines[index], trimmed = line[0].trim();
        const absolute = segmentStart + line.index;
        const range = [...trimmed.matchAll(dateRange)][0];
        const startsWithDate = range?.index === 0;
        const hint = headingCue(trimmed);
        const prior = text.slice(cuts.at(-1), absolute);
        const priorWithoutSection = ownSection && cuts.at(-1) === ownSection.start ? prior.slice(ownSection.end-ownSection.start).trim() : prior.trim();
        // A date following a title is metadata; a date after body text begins a new unit.
        // Company + role + date lines stay together until actual work text appears.
        const closesContext = section?.kind === 'context' && hint && cuts.at(-1) === segmentStart && !headingCue(lines[0]?.[0] || '');
        if (index > 0 && (hint || startsWithDate) && priorWithoutSection && (closesContext || !previousHeading || bodyCue.test(priorWithoutSection))) {
          const educationDates = section?.kind === 'context' && /教育|学习/.test(section.name) && !hint && !bodyCue.test(priorWithoutSection);
          if (!educationDates) cuts.push(absolute);
        }
        previousHeading = hint || startsWithDate || (ownSection && absolute === ownSection.start);
      }
      // Collapsed PDF paragraphs can contain several dated projects on one line.
      for (const date of segment.matchAll(dateRange)) {
        const absolute = segmentStart + date.index;
        if (date.index === 0 || cuts.includes(absolute) || !/[\s，,。；;]/.test(segment[date.index-1])) continue;
        const lastCut = [...cuts].sort((a,b) => a-b).findLast(c => c < absolute) ?? segmentStart;
        const before = text.slice(lastCut, absolute);
        const after = segment.slice(date.index + date[0].length, date.index + date[0].length + 75);
        if (bodyCue.test(before) && /公司|项目|系统|平台|成员|实习|助理|课题|竞赛/.test(after)) cuts.push(absolute);
      }
      const ordered = [...new Set(cuts)].sort((a,b) => a-b);
      for (let index = 0; index < ordered.length; index++) {
        const start = ordered[index];
        let end = ordered[index+1] ?? segmentEnd;
        while (end > start && /[\r\n]/.test(text[end-1])) end--;
        const source = text.slice(start,end);
        if (!source.trim()) continue;
        const localSection = sections.findLast(s => s.start <= start);
        const firstLine = source.split(/\r?\n/)[0].trim();
        const own = localSection?.start === start ? localSection : null;
        const sectionOnly = own && !source.slice(own.end-start).replace(/[:：\s]/g,'');
        // A strong work/project heading is allowed to end a preceding education section.
        const skillSection = localSection?.kind === 'context' && /技能|证书|语言|个人优势|自我评价/.test(localSection.name);
        const kindHint = sectionOnly || skillSection ? 'context' : headingCue(firstLine) ? 'experience' : localSection?.kind;
        const previous = blocks.at(-1);
        const sameSection = previous && previous.sectionStart === localSection?.start;
        const awaitingSectionContent = previous?.sectionName && !previous.text.slice(previous.sectionHeaderLength).replace(/[:：\s]/g,'');
        const metadataLine = [...firstLine.matchAll(dateRange)][0]?.index === 0 || /^(?:产品|运营|研究|数据|开发|设计|项目)?(?:成员|助理|实习生|工程师|经理|负责人)$/.test(firstLine);
        const continueExperience = previous?.kindHint === 'experience' && (actionStart.test(firstLine) || /^[•●▪◦‣⁃·]\s*/.test(firstLine) || metadataLine && !bodyCue.test(previous.text));
        const continueContext = sameSection && localSection?.kind === 'context' && previous.kindHint === 'context' && (skillSection || !headingCue(firstLine));
        if (!own && previous && (sameSection && awaitingSectionContent || continueExperience || continueContext) && /^\s*$/.test(text.slice(previous.end,start))) {
          previous.end=end;previous.text=text.slice(previous.start,end);
          if (awaitingSectionContent) previous.kindHint = localSection.kind;
        } else blocks.push({ start, end, text: source, kindHint, sectionName: own?.name, sectionTitle:kindHint==='context'&&localSection?.kind==='context'?localSection.name:undefined, sectionHeaderLength:own ? own.end-start : 0, sectionStart:localSection?.start });
      }
    }
  }
  return blocks;
}

export function parseMaterials(resume, jd) {
  const text = String(resume ?? '');
  const rawJD = String(jd ?? '');
  const warnings = [];
  const duplicateIds = new Map();
  const blocks = splitBlocks(text);
  let experiences = blocks.map((block, index) => {
    const titleSource = block.sectionName && block.kindHint === 'experience' ? block.text.slice(block.sectionHeaderLength).replace(/^[\s：:]*/,'') : block.text;
    const title = (titleSource.split(/\r?\n/)[0].trim() || block.sectionName || '未命名经历').slice(0,80);
    const contactHeader = index === 0 && !experienceTitle.test(title) && (
      /电话|邮箱|@|求职|简历|联系方式/.test(block.text) || title.length <= 8
    );
    const kind = block.kindHint || (contextTitle.test(title) || contactHeader || genericSection.test(block.text.trim()) ? 'context' : 'experience');
    const baseId = `exp_${hash(block.text)}`;
    const count = duplicateIds.get(baseId) || 0;
    duplicateIds.set(baseId, count + 1);
    return { id: count ? `${baseId}_${count}` : baseId, title, original: block.text, text: block.text,
      sourceText: block.text, kind, sectionTitle:block.sectionTitle, start: block.start, end: block.end };
  });
  // A single, unlabelled narrative remains usable rather than being called "no experience".
  if (experiences.length === 1 && !contextTitle.test(experiences[0].title) && !/@|电话|邮箱/.test(text)) experiences[0].kind = 'experience';
  if (!experiences.some(e => e.kind === 'experience')) warnings.push('规则解析暂未识别出独立经历，不代表材料中没有经历。请检查段落划分，或把需要处理的段落手动标记为经历。');
  if (experiences.some(e => e.kind === 'experience' && e.text.split(/\r?\n/).length === 1)) warnings.push('部分经历只有一行，可能缺少分段或职责信息。请校对后继续。');
  const reqLines = rawJD.split(/\r?\n/).map(clean).filter(Boolean).filter(line => !genericSection.test(line));
  const idCounts = new Map();
  const requirements = reqLines.filter((line, index) => !(index === 0 && reqLines.length > 1 && !/需要|必须|负责|要求|熟悉|具备|学历|本科|参与|协助/.test(line) && /招聘|实习生|经理|工程师|专员|｜|\|/.test(line))).map(line => {
    const base = `req_${hash(line)}`;
    const count = idCounts.get(base) || 0;
    idCounts.set(base, count + 1);
    return { id: count ? `${base}_${count}` : base, text: line, original: line,
      category: /本科|硕士|博士|大专|学历|毕业|在校|到岗|实习.*个月|每周|专业.*限/.test(line) ? '明确条件' : /优先|加分|更佳/.test(line) ? '加分项' : /工具|Figma|Python|SQL|Excel|原型|方法/i.test(line) ? '工具或方法' : '工作任务与能力',
      strength: /优先|加分|更佳/.test(line) ? '优先／加分' : /必须|须具备|需具备|要求|至少|不得|每周|本科及以上/.test(line) ? '明确要求' : '原文未强调强制',
      logic: /或|或者|任一/.test(line) && /且|并且|同时/.test(line) ? '同时含“或”与“且”，按原文核对' : /或|或者|任一/.test(line) ? '或（满足其中一项）' : /且|并且|同时/.test(line) ? '且（同时满足）' : '保留原文关系' };
  });
  if (!requirements.length) warnings.push('未读到岗位要求，请补充 JD 后再分析。');
  else if (rawJD.trim().length < 35) warnings.push('JD 信息较少，仅按已提供文字展示，未补造职责或硬性条件。');
  return { experiences, requirements, warnings };
}

/** Retain identities only where a material unit can be identified unambiguously.
 * Callers must invalidate facts/suggestions for changedIds and orphanedIds.
 * Never migrate facts by array position: reordering is not a new experience.
 */
export function reconcileExperiences(next, previous = []) {
  const incoming = Array.isArray(next) ? next : [];
  const old = Array.isArray(previous) ? previous : [];
  const assigned = new Map(), used = new Set();
  const source = e => String(e.sourceText ?? e.original ?? e.text ?? '');
  const exact = (a,b) => Boolean(normalizeFormatting(source(a))) && (isFormattingOnly(source(a),source(b)) || isFormattingOnly(source(a),b.text ?? ''));
  const titleMatches = (a,b) => clean(a.title) !== '' && isFormattingOnly(a.title,b.title) && ((a.kind || 'experience') === (b.kind || 'experience') || ['experience','context'].includes(b.kindOverride));
  // Two-way uniqueness prevents two new units from inheriting one old identity.
  for (let index = 0; index < incoming.length; index++) {
    const matches = old.filter(e => !used.has(e.id) && exact(incoming[index], e));
    if (matches.length !== 1) continue;
    const match = matches[0];
    if (incoming.filter(e => exact(e, match)).length !== 1) continue;
    assigned.set(index, match); used.add(match.id);
  }
  for (let index = 0; index < incoming.length; index++) {
    if (assigned.has(index)) continue;
    const matches = old.filter(e => !used.has(e.id) && titleMatches(incoming[index], e));
    if (matches.length !== 1) continue;
    const match = matches[0];
    // A duplicate title is intrinsically ambiguous, even if another one was matched.
    if (old.filter(e => titleMatches(incoming[index], e)).length !== 1 || incoming.filter(e => titleMatches(e, match)).length !== 1) continue;
    assigned.set(index, match); used.add(match.id);
  }
  const oldIds = new Set(old.map(e => e.id));
  const changedIds = [];
  const experiences = incoming.map((unit, index) => {
    const matched = assigned.get(index);
    if (matched) {
      const kindOverride = ['experience','context'].includes(matched.kindOverride) ? matched.kindOverride : undefined;
      if (!isFormattingOnly(source(unit),source(matched))) changedIds.push(matched.id);
      return { ...unit, id: matched.id, ...(kindOverride ? { kind:kindOverride, kindOverride } : {}) };
    }
    // Avoid accidentally resurrecting an orphan identity through parser hash collisions.
    const id = oldIds.has(unit.id) ? `exp_new_${globalThis.crypto?.randomUUID?.() || Math.random().toString(36).slice(2)}` : unit.id;
    return { ...unit, id };
  });
  return { experiences, orphanedIds: old.filter(e => !used.has(e.id)).map(e => e.id), changedIds };
}

/** A conservative guard for known contradictions, not a claim of semantic verification.
 * A new, unrelated metric may need clarification when its unit already occurs in source.
 */
export function detectFactConflicts(text, source) {
  const incoming = String(text ?? ''), original = String(source ?? '');
  const errors = [];
  const measures = value => {
    const values = new Map();
    const pattern = /(\d[\d,]*(?:\.\d+)?)\s*(个百分点|个月|亿元|万元|万人|小时|分钟|公里|％|%|人|名|位|条|份|次|个|页|万|天|周|月|年|元)/g;
    for (const match of value.matchAll(pattern)) {
      const unit = match[2] === '％' ? '%' : match[2];
      const number = String(Number(match[1].replaceAll(',', '')));
      if (!values.has(unit)) values.set(unit, new Set());
      values.get(unit).add(number);
    }
    return values;
  };
  const prior = measures(original), next = measures(incoming);
  for (const [unit, numbers] of next) {
    if (!prior.has(unit)) continue; // A genuinely new measure is allowed for explicit user confirmation.
    for (const number of numbers) if (!prior.get(unit).has(number)) {
      errors.push(`数字口径待核对：原材料为 ${[...prior.get(unit)].join('、')} ${unit}，当前写入 ${number} ${unit}。若是不同指标，请在材料中说明范围后再确认。`);
    }
  }
  if ((prior.has('%') && !prior.has('个百分点') && next.has('个百分点')) || (prior.has('个百分点') && !prior.has('%') && next.has('%'))) errors.push('百分比与百分点的单位发生变化，请核对原始口径。');
  const clauses = incoming.split(/[，,。；;\n]/);
  const negative = /尚未|未曾|没有|并未|尚无|未开展|未进行|未上线|未主导|未牵头|未独立|不曾|不具备|不涉及|并非|非本人/;
  const positiveClause = pattern => clauses.some(clause => pattern.test(clause) && !negative.test(clause));
  const personalLeadership = value => {
    // Only remove explicitly attributed third-party actions, not a whole clause.
    // A generic "负责人" is distinct only when the speaker states a limited role.
    const member = /(?:我|本人)(?:是|为)(?:活动)?(?:执行成员|参与成员|协助成员)/.test(value);
    const selfLeader = /(?:我|本人)[^，,。；;\n]{0,12}(?:是|为|担任|作为)[^，,。；;\n]{0,8}负责人|负责人(?:就是|是|为)(?:我|本人)/.test(value);
    return value.split(/[，,。；;\n]/).some(clause => {
      if (negative.test(clause)) return false;
      let own = clause.replace(/由(?:其他成员|另一位同学)\s*(?:主导|牵头|独立负责)/g, '');
      if (member && !selfLeader) own = own.replace(/由(?:项目|活动|团队)?负责人\s*(?:主导|牵头|独立负责)/g, '');
      return /主导|牵头|独立负责/.test(own);
    });
  };
  if (/(?:尚未|没有|并未|未曾|未)\s*(?:正式)?上线/.test(original) && positiveClause(/上线/)) errors.push('工作状态冲突：原材料说明尚未上线，当前表述包含已上线经历，请先纠正或澄清原材料。');
  if (/(?:尚未|没有|并未|未曾|未)[^，。；;\n]{0,16}线上\s*A\s*[\/／]\s*B/i.test(original) && positiveClause(/线上\s*A\s*[\/／]\s*B/i)) errors.push('工作类型冲突：原材料明确未开展线上 A/B 测试，当前表述不能改为已开展。');
  if (/参与|协助/.test(original) && !personalLeadership(original) && personalLeadership(incoming)) errors.push('职责边界待核对：原材料仅说明参与或协助，当前新增主导、牵头或独立负责，请先在原材料中澄清职责。');
  return [...new Set(errors)];
}

const groups = [
  ['用户', '需求', '访谈', '反馈'], ['产品', '流程', '原型', 'Figma', '需求文档'],
  ['数据', '评测', 'Python', 'SQL', '分析', '标注'], ['A/B', '线上', '实验'],
  ['沟通', '协作', '团队', '汇报', '文档', '讨论', '纪要', '协调', '报告', '论文', '总结'], ['活动', '策划', '报名', '运营'],
  ['开发', '代码', '编程', 'JavaScript'], ['设计', '视觉', 'UI'], ['销售', '客户', '商务']
];
const tokens = text => groups.flat().filter(word => String(text).toLowerCase().includes(word.toLowerCase()));
function relevance(requirement, exp, task) {
  const rt = tokens(requirement.text);
  const material = sourceFor(exp) + '\n' + currentFacts(task, exp.id).map(f => f.text).join('\n');
  let score = rt.filter(w => material.toLowerCase().includes(w.toLowerCase())).length * 2;
  for (const group of groups) if (rt.some(w => group.includes(w)) && group.some(w => material.toLowerCase().includes(w.toLowerCase()))) score++;
  // Concrete collaboration and deliverables are better candidates than a generic
  // self-description. This affects ranking only, never proof or factual status.
  if(exp.kind!=='context'&&/沟通|协作|文档|汇报|总结/.test(requirement.text)){
    const positive=material.split(/[。；;\n]/).filter(line=>!/未|没有|不具备/.test(line)).join('\n');
    if(/队长|组长|团队|协作|协调|讨论|汇报|沟通/.test(positive))score+=3;
    if(/(?:编写|输出|完成|撰写|交付|提交|整理|形成)[^\n。]{0,35}(?:文档|报告|论文|纪要|说明|结论)|(?:论文|文档).{0,8}(?:交付|提交)/.test(positive))score+=3;
  }
  return { score, material };
}
function conditionState(requirement, task) {
  const material = task.resumeCorrected || task.resumeOriginal || '';
  const text = requirement.text;
  // Only infer explicitly comparable education, with more complex mixed conditions left unknown.
  if (/到岗|每周|个月|专业|毕业|且|同时/.test(text)) return { status: '待确认', evidence: '', reason: '该明确条件需要用户核实；不会阻止继续修改，也不会改写经历以满足条件。' };
  if (/本科及以上/.test(text)) {
    const evidence = material.split(/\r?\n/).find(l => /本科|硕士|博士/.test(l));
    if (evidence && (!/在校/.test(text) || /在读|在校/.test(material))) return { status: '按已提供信息符合', evidence, reason: '原材料明确提供对应学历信息；仅判断这项条件，不代表整体符合岗位。' };
    if (/最高学历[^\n]*大专/.test(material)) return { status: '存在明确差异', evidence: material.split(/\r?\n/).find(l => /最高学历/.test(l)), reason: '已提供学历与原文条件存在差异，请核实。仍可继续修改真实经历。' };
  }
  return { status: '待确认', evidence: '', reason: '没有足够的明确材料核实该条件；保留未知。' };
}

const toolNames = /\b(?:Figma|Python|SQL|Excel|Axure|Tableau|PowerBI|JavaScript)\b/ig;
const needs = [
  [/需求(?:整理|分析|调研)|用户需求/, /(?:整理|收集|分析|梳理).{0,12}(?:需求|反馈)|(?:需求|反馈).{0,10}(?:整理|分析|梳理)/, '需求整理'],
  [/流程(?:设计|梳理)|产品流程/, /(?:绘制|设计|梳理|优化).{0,15}(?:流程|流程图)|流程.{0,8}(?:设计|梳理)/, '流程设计'],
  [/原型/, /(?:制作|绘制|设计|完成|输出|搭建).{0,15}原型|原型.{0,8}(?:制作|设计)/, '原型制作'],
  [/需求文档|需求说明|\bPRD\b/i, /(?:输出|编写|整理|完成).{0,15}(?:需求文档|需求说明|PRD)/i, '需求文档'],
  [/数据(?:整理|清洗|处理)|整理.{0,6}(?:数据|样本)|评测数据/, /(?:整理|清洗|标注|处理).{0,25}(?:数据|记录|样本)|(?:数据|记录|样本).{0,8}(?:整理|清洗|标注)/, '数据整理'],
  [/模型评测|离线评测|评测结果|效果评测/, /(?:开展|参与|完成|负责|进行|协助).{0,12}评测|评测.{0,8}(?:记录|错误|结果)/, '评测工作'],
  [/归纳问题|问题归纳|错误分析/, /(?:归纳|分类|整理|标注).{0,12}(?:问题|错误)|(?:问题|错误).{0,8}(?:分类|归纳)/, '问题归纳'],
  [/用户访谈/, /(?:开展|参与|组织|完成|负责).{0,12}(?:用户访谈|访谈)|访谈.{0,10}(?:提纲|记录)/, '用户访谈']
];
function materialSupport(req, material) {
  const text = String(req.text || '').replace(/^\s*\d+[.、)]\s*/, '');
  const positiveMaterial=material.split(/[，,。；;\n]/).filter(line=>!/尚未|未曾|未开展|未进行|未使用|未参与|未负责|未掌握|未接触|未制作|未完成|未输出|未上线|没有|不具备|不熟悉|不掌握|不涉及|不曾|尚无/.test(line)).join('\n');
  const named = [...text.matchAll(toolNames)].map(m => m[0]);
  const toolResults = named.map(tool => new RegExp(`\\b${tool}\\b`,'i').test(positiveMaterial));
  const supportsTools = named.length && (/或|任一/.test(text) ? toolResults.some(Boolean) : toolResults.every(Boolean));
  const simpleTool = /^(?:熟悉|掌握|会使用|使用|了解)\s*(?:Figma|Python|SQL|Excel|Axure|Tableau|PowerBI|JavaScript)(?:\s*(?:、|和|及|或)\s*(?:Figma|Python|SQL|Excel|Axure|Tableau|PowerBI|JavaScript|其他原型工具|其他数据工具))*\s*(?:等工具)?[。；;]?$/i.test(text);
  if (simpleTool && supportsTools) return { supported:true, missing:[], reason:'原材料已明确提供这项工具能力，可以保留现有表述，无需为此强制改写。' };
  const facets=needs.filter(([pattern])=>pattern.test(text));
  const missing=facets.filter(([,proof])=>!proof.test(positiveMaterial)).map(([, ,label])=>label);
  if(named.length&&!supportsTools)missing.push('工具使用');
  const uncovered=text.split(/[，；;、]|并且|同时|以及|且|并|(?<!参)与|及|和/).filter(clause=>clause.trim()).some(clause=>!needs.some(([pattern])=>pattern.test(clause))&&!clause.match(toolNames));
  const unresolvedMeaning=uncovered||/沟通|协作|跟进|业务|独立|精通|熟练|深入|优秀|高效|扎实|较强|良好|表达能力|项目管理|上线|A\s*\/\s*B/.test(text);
  const recognizedActions=facets.length>0;
  if(recognizedActions&&!missing.length&&!unresolvedMeaning) return {supported:true,missing:[],reason:'原材料明确写出了该项要求涉及的工作与产出，可直接保留；规则判断仍需用户核对。'};
  return {supported:false,missing:missing.length?missing:['与该项要求相关的本人职责、方法或实际产出'],reason:'有相关材料，但尚不足以完整支持这项要求；请补充对应事实，或如实保留未知。'};
}
function knownNone(task, requirementId, experienceId) {
  const questions=task.questions||[];
  return (task.facts||[]).find(f=>f.status==='none'&&f.experienceId===experienceId&&(f.requirementId||questions.find(q=>q.id===f.questionId)?.requirementId)===requirementId)
    || questions.find(q=>(q.status==='none'||q.status==='archived'&&q.previousStatus==='none')&&q.experienceId===experienceId&&q.requirementId===requirementId);
}
function confirmedRequirementDetail(task,req,exp) {
  const reqTokens=tokens(req.text);
  return currentFacts(task,exp.id).filter(f=>{
    const requirementId=f.requirementId||(task.questions||[]).find(q=>q.id===f.questionId)?.requirementId;
    if(requirementId!==req.id||detectFactConflicts(f.text,sourceFor(exp)).length)return false;
    const factTokens=tokens(f.text);
    const related=reqTokens.some(token=>factTokens.includes(token))||groups.some(group=>reqTokens.some(token=>group.includes(token))&&factTokens.some(token=>group.includes(token)));
    const concrete=f.text.trim().length>=12&&/(?:负责|参与|协助|整理|制作|完成|输出|绘制|记录|编写|分析|沟通|汇报|协调|访谈|标注|归纳|评测|清洗|使用).{3,}/.test(f.text)&&/文档|报告|记录|清单|纪要|原型|流程图|反馈|数据|样本|提纲|问题|方案|评测|测试|SQL|Figma|Python|Excel/i.test(f.text);
    return related&&concrete;
  });
}
function manualAssociation(a) { return a&&(a.manual===true||a.origin==='user'||/用户纠正|人工/.test(a.reason||'')); }
function retainsManualStatus(a) { return manualAssociation(a)&&(a.manualStatus===true||a.manualStatus===undefined); }

function associate(task) {
  const exps=(task.experiences||[]).filter(isContentUnit);
  const associations=(task.requirements||[]).map(req=>{
    const previous=(task.associations||[]).find(a=>a.requirementId===req.id);
    const manual=manualAssociation(previous);
    const model=hasCurrentAnalysis(task)?task.aiAnalysis.associations.find(a=>a.requirementId===req.id):null;
    if(model&&!manual)return {...model};
    if(task.aiAnalysis&&!hasCurrentAnalysis(task)&&!manual){
      const prior=task.aiAnalysis.associations.find(a=>a.requirementId===req.id);
      return {requirementId:req.id,experienceId:exps.some(e=>e.id===prior?.experienceId)?prior.experienceId:'',status:req.category==='明确条件'?'待确认':'尚未确认',origin:'ai-stale',reason:'材料或事实已变化，请更新 AI 对照。原分析未作为新的确定判断。',evidence:'',needsClarification:false};
    }
    if(req.category==='明确条件') {
      const state=conditionState(req,task);
      if(retainsManualStatus(previous)&&['按已提供信息符合','存在明确差异','待确认'].includes(previous.status))return {...previous,requirementId:req.id,experienceId:'',origin:'user',manual:true,status:previous.status,reason:previous.reason||'用户已核对这项明确条件；不将条件映射为经历。',needsClarification:false};
      return {requirementId:req.id,experienceId:'',origin:'rule',...state};
    }
    // Education/course names cannot automatically become evidence of actual work.
    // Users can still explicitly associate those sections for manual review.
    const candidates=exps.filter(exp=>manual||!/教育|学习|学历|证书|荣誉|获奖/.test(originalSectionTitle(exp))).map(exp=>({exp,...relevance(req,exp,task)})).sort((a,b)=>b.score-a.score);
    const retained=candidates.find(c=>c.exp.id===previous?.experienceId&&c.score>0);
    const best=manual ? candidates.find(c=>c.exp.id===previous.experienceId) : retained||candidates[0];
    if(!best||(!manual&&best.score===0)) {
      if(manual&&previous.manualStatus===true&&!previous.experienceId&&previous.status==='确认没有相关经历')return {...previous,requirementId:req.id,experienceId:'',origin:'user',manual:true,manualStatus:true,status:'确认没有相关经历',reason:previous.reason||'用户明确确认没有这项要求对应的经历；该结论不扩展到其他要求。',evidence:'',needsClarification:false};
      const context=(task.experiences||[]).filter(e=>e.kind==='context').map(sourceFor).join('\n');
      const support=materialSupport(req,context);
      const evidence=support.supported?context.split(/\r?\n/).find(line=>(req.text.match(toolNames)||[]).some(tool=>line.toLowerCase().includes(tool.toLowerCase())))||'':'';
      return {requirementId:req.id,experienceId:'',origin:manual?'user':'rule',...(manual?{manual:true,manualStatus:previous.manualStatus}:{}),status:evidence?'已有明确证据':'尚未确认',reason:evidence?'基础简历的技能信息已明确提供该项能力，可以保留；不据此推断新的项目经历。':'现有材料没有可可靠关联的经历；保留未知，不等于用户没有相关能力。',evidence,needsClarification:false};
    }
    const {exp,material}=best;
    const negative=knownNone(task,req.id,exp.id),conflict=factsFor(task,exp.id).some(f=>f.status==='conflict');
    const baseSupport=materialSupport(req,sourceFor(exp));
    const support=materialSupport(req,material);
    const confirmedDetail=confirmedRequirementDetail(task,req,exp);
    const usesConfirmedFacts=!baseSupport.supported&&(support.supported||confirmedDetail.length>0);
    let status=baseSupport.supported?'已有明确证据':usesConfirmedFacts?'表达不足':best.score===0?'尚未确认':'表达不足';
    let reason=baseSupport.supported?baseSupport.reason:usesConfirmedFacts?(support.supported?'该项所需信息已由用户补充并确认，尚未写入基础经历。可将已确认事实补入表达，无需重复补问。':'已确认补充与该项要求相关，且明确了实际工作或产出，可先补入表达；复合要求是否被完整支持仍需人工核对。'):support.reason;
    let needsClarification=!baseSupport.supported&&!usesConfirmedFacts;
    if(manual&&retainsManualStatus(previous)) {
      status=previous.status;
      if(status==='表达不足'&&(baseSupport.supported||usesConfirmedFacts))needsClarification=false;
      else {reason=previous.reason||reason;needsClarification=previous.needsClarification??['表达不足','尚未确认'].includes(status);}
    }
    const unequal=(/线上|A\s*\/\s*B/i.test(req.text)&&/离线|尚未上线|未开展线上|没有线上/.test(material))||(/用户访谈/.test(req.text)&&/文献/.test(material)&&!/用户访谈/.test(material));
    if(!retainsManualStatus(previous)&&unequal){status='相关但不等价';reason='材料支持的是相关但不同类型的工作。离线评测、未上线原型或文献调研不能改写为线上实验、上线产品或用户访谈。';needsClarification=false;}
    if(negative){status='确认没有相关经历';reason='用户已明确表示未做过这一项要求对应的工作；该结论不扩展到其他要求。';needsClarification=false;}
    if(conflict){status='尚未确认';reason='该经历存在尚未解决的事实冲突，请先处理；冲突信息不能用于改写。';needsClarification=true;}
    const evidence=material.split(/\r?\n/).filter(line=>tokens(req.text).some(t=>line.toLowerCase().includes(t.toLowerCase()))).join('\n')||sourceFor(exp);
    return {requirementId:req.id,experienceId:exp.id,status,reason,evidence,origin:manual?'user':'rule',...(manual?{manual:true,manualStatus:previous.manualStatus}:{}),needsClarification,conflict,missing:support.missing,usesConfirmedFacts,confirmedFactIds:usesConfirmedFacts?(support.supported?currentFacts(task,exp.id):confirmedDetail).map(f=>f.id):[]};
  });
  return associations;
}

import {questionCovers} from './question-scope.js';
const associationKey = value => String(value.requirementId || '') + ':' + String(value.experienceId || '');
function plainAssociation(value = {}) { const {links, experienceIds, ...rest} = value; return rest; }

function clarificationText(requirement,experience,association){
  const missing=(association.missing||[]).filter(x=>x!=='与该项要求相关的本人职责、方法或实际产出');
  const prompt=missing.length?'请补充'+missing.join('、')+'：你具体做了什么，用了什么方法或工具，留下了什么产出？'
    :/沟通|协作|团队|文档|总结|汇报/.test(requirement.text)?'请举一个沟通或文档协作的真实例子：你的职责、协作方式和交付内容分别是什么？'
    :/数据|分析/.test(requirement.text)?'请补充一次实际的数据处理：你负责哪部分，采用了什么方法，输出了什么结果？'
    :'请补充与这项要求相关的实际职责、方法或产出。';
  return `结合「${unitPresentation(experience).title}」，${prompt}`;
}

/** A requirement may draw on several resume sections. Facts stay bound to their own section. */
export function analyze(task) {
  const exps=(task.experiences||[]).filter(isContentUnit);
  const validIds=new Set(exps.map(e=>e.id));
  const associations=associate(task).map(primary=>{
    if(!primary.experienceId)return {...primary,experienceIds:[],links:[]};
    const prior=(task.associations||[]).find(a=>a.requirementId===primary.requirementId);
    const ids=[...new Set([primary.experienceId,...(manualAssociation(prior)?prior.experienceIds||[]:[])])].filter(id=>validIds.has(id));
    const req=task.requirements.find(r=>r.id===primary.requirementId);
    const links=ids.map(id=>{
      if(id===primary.experienceId)return plainAssociation(primary);
      const previous=prior?.links?.find(a=>a.experienceId===id);
      return plainAssociation(associate({...task,requirements:[req],associations:[{...plainAssociation(previous),requirementId:req.id,experienceId:id,manual:true,manualStatus:previous?.manualStatus||false} ]})[0]);
    });
    return {...plainAssociation(primary),experienceIds:ids,links};
  });
  const previous=task.questions||[];
  const actionable=associations.flatMap(a=>a.links||[]).filter(a=>a.needsClarification&&!a.conflict&&['表达不足','尚未确认'].includes(a.status))
    .filter(a=>!hasCurrentAnalysis(task)||a.origin!=='ai'||task.aiAnalysis.questions.some(q=>questionCovers(q,a.requirementId,a.experienceId)));
  const activeKeys=new Set(actionable.map(associationKey));
  const linkedKeys=new Set(associations.flatMap(a=>a.links||[]).map(associationKey));
  // Questions depend on the evidence gap, never on the separate rewrite selection.
  const questions=previous.map(q=>({...q}));
  for(const q of questions){
    const linked=linkedKeys.has(associationKey(q));
    if(q.status==='archived'&&linked&&q.previousStatus&&q.previousStatus!=='pending'){q.status=q.previousStatus;delete q.previousStatus;}
    if(q.status!=='archived'&&((q.requirementId&&!linked)||((!q.status||q.status==='pending')&&!activeKeys.has(associationKey(q))))){q.previousStatus=q.status||'pending';q.status='archived';}
  }
  // Share the limited batch across requirements before asking several questions
  // about different sources for just one requirement.
  const queues=[...new Set(actionable.map(a=>a.requirementId))].map(id=>actionable.filter(a=>a.requirementId===id));
  const ranked=[];
  for(let round=0;queues.some(queue=>round<queue.length);round++)for(const queue of queues)if(queue[round])ranked.push(queue[round]);
  ranked.sort((a,b)=>(associationKey(b)===task.requestedQuestionKey?1:0)-(associationKey(a)===task.requestedQuestionKey?1:0));
  const desired=[];
  for(const a of ranked){
    const generated=hasCurrentAnalysis(task)&&task.aiAnalysis.questions.find(q=>questionCovers(q,a.requirementId,a.experienceId));
    const key=associationKey(generated||a),known=questions.find(q=>questionCovers(q,a.requirementId,a.experienceId)&&q.status!=='archived');
    if(known&&known.status!=='pending')continue;
    if(desired.includes(key))continue;
    if(desired.length>=3)continue;
    desired.push(key);
    const exp=exps.find(e=>e.id===a.experienceId), req=task.requirements.find(r=>r.id===(generated?.requirementId||a.requirementId));
    const text=generated?generated.text:clarificationText(req,exp,a);
    // A question can be refreshed freely until the user has started an answer.
    // Never rewrite the question under an existing answer or editing draft.
    const refresh=q=>{if(!q.answer?.trim()&&!q.editing&&!q.draftAnswer?.trim()){q.text=text;q.purpose=generated?.purpose||q.purpose;delete q.relatedRequirementIds;if(generated?.relatedRequirementIds)q.relatedRequirementIds=[...generated.relatedRequirementIds];}};
    if(known){refresh(known);continue;}
    const archived=questions.find(q=>q.status==='archived'&&associationKey(q)===key);
    if(archived&&archived.previousStatus==='pending'){archived.status='pending';delete archived.previousStatus;refresh(archived);continue;}
    questions.push({id:'q_'+req.id+'_'+exp.id,requirementId:req.id,experienceId:exp.id,text,purpose:generated?.purpose||'只写真实信息；不确定可以稍后补充，不需要补造数字。',...(generated?.relatedRequirementIds?{relatedRequirementIds:[...generated.relatedRequirementIds]}:{}),status:'pending',answer:''});
  }
  for(const q of questions)if(q.status==='pending'&&!desired.includes(associationKey(q))){q.status='archived';q.previousStatus='pending';}
  return {associations,questions};
}

/** Recover original section captions for saved tasks without reparsing or moving their material. */
export function restoreSectionTitles(task) {
  const material=task.resumeCorrected||task.resumeOriginal||'';
  // AI 已按原文范围分段；不能再让规则解析的较大区间覆盖其栏目归属。
  if(task.parseMeta?.stage==='parse') {
    for(const unit of task.experiences||[]) {
      const source=unit.sourceText||unit.original||unit.text||'';
      const ownTitle=originalSectionTitle({title:source.split(/\r?\n/)[0],text:source});
      if(ownTitle)unit.sectionTitle=ownTitle;
      else delete unit.sectionTitle;
    }
    return;
  }
  const parsed=parseMaterials(material,task.jdCorrected||task.jdOriginal||'');
  for(const unit of task.experiences||[]) {
    const start=Number.isInteger(unit.start)?unit.start:material.indexOf(unit.sourceText||unit.original||unit.text);
    const containing=parsed.experiences.find(p=>p.start<=start&&p.end>start&&p.sectionTitle);
    if(containing)unit.sectionTitle=containing.sectionTitle;
    else if(originalSectionTitle(unit))unit.sectionTitle=originalSectionTitle(unit);
  }
}

function readableCopy(source) {
  const lines = source.trim().split(/\r?\n/);
  if (lines.length < 2) return source.trim();
  return lines.map((line, i) => {
    const t = line.trim();
    if (!t || i === 0 || /^\d{4}[.年/\-]/.test(t) || /^[-•·]/.test(t)) return t;
    return `• ${t}`;
  }).join('\n');
}

export function generateCandidates(task) {
  const selected = selectedIds(task);
  // Text is deterministic; each explicit generation is still a distinct candidate.
  const batchId = globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
  return (task.experiences || []).filter(exp => isContentUnit(exp) && selected.has(exp.id)).map(exp => {
    const source = sourceFor(exp);
    const facts = currentFacts(task, exp.id).filter(f => !source.includes(f.text.trim()));
    const associated = (task.associations || []).filter(a => a.experienceId === exp.id);
    const text = [readableCopy(source), ...facts.map(f => `• ${f.text.trim()}`)].filter(Boolean).join('\n');
    return { id: `suggestion_${exp.id}_${task.revision || 1}_${batchId}`, experienceId: exp.id,
      original: source, text, reason: facts.length ? '保留原有职责、数字与工作类型，按条目整理，并补入已明确确认且属于本经历的事实。规则模拟不会根据 JD 添加经历。' : '按条目整理已有内容，保留全部职责、数字与工作类型。原文已足够具体时可以直接保留。',
      sourceIds: [exp.id, ...facts.map(f => f.id)], requirementIds: associated.map(a => a.requirementId),
      changes: facts.length ? ['格式与信息层次调整', '补入用户已确认事实；请逐项核对'] : ['仅整理格式；未新增事实'],
      status: 'pending', revision: task.revision || 1, mode: 'mock' };
  });
}

export function composeText(task) {
  const base = String(task.resumeCorrected ?? task.resumeOriginal ?? '');
  const suggestions = task.suggestions || [];
  const selected = selectedIds(task);
  const replacements = [];
  let searchFrom = 0;
  for (const exp of task.experiences || []) {
    const suggestion = selected.has(exp.id) ? suggestions.find(s => s.experienceId === exp.id) : undefined;
    const replacement = exp.excluded ? '' : adopted(suggestion) ? String(suggestion.status === 'edited' ? suggestion.editedText ?? suggestion.text : suggestion.text) : sourceFor(exp);
    const source = String(exp.sourceText ?? exp.original ?? exp.text ?? '');
    let start = exp.start, end = exp.end;
    if (!(Number.isInteger(start) && Number.isInteger(end) && base.slice(start, end) === source)) {
      start = source ? base.indexOf(source, searchFrom) : -1;
      end = start + source.length;
    }
    if (start >= 0 && end >= start && !replacements.some(r => start < r.end && end > r.start)) {
      replacements.push({ start, end, text: replacement });
      searchFrom = end;
    }
  }
  return replacements.sort((a,b) => b.start - a.start).reduce((text, r) => text.slice(0, r.start) + r.text + text.slice(r.end), base);
}

export function validateFinal(task) {
  const errors = [];
  if (!clean(task.resumeCorrected ?? task.resumeOriginal)) errors.push('基础简历为空，无法确认岗位版本。');
  if (!clean(task.jdCorrected ?? task.jdOriginal)) errors.push('目标 JD 为空，请先补充。');
  const exps = task.experiences || [];
  const selected = selectedIds(task);
  const facts = task.facts || [];
  for (const fact of facts.filter(f => f.status === 'conflict')) {
    const exp = exps.find(e => e.id === fact.experienceId);
    if (exp && !exp.excluded) errors.push(`“${exp.title}”仍存在事实冲突。请解决冲突，或明确不纳入本版；保留原文也不能绕过已知冲突。`);
  }
  for (const suggestion of task.suggestions || []) {
    const exp = exps.find(e => e.id === suggestion.experienceId);
    if (!selected.has(suggestion.experienceId) || exp?.excluded || !adopted(suggestion)) continue;
    if (!exp) { errors.push('采用的建议引用了不存在的经历，请重新生成。'); continue; }
    if (suggestion.revision !== (task.revision || 1) || suggestion.stale) errors.push(`“${exp.title}”的建议基于旧材料，请重新生成或按当前材料重新核对。`);
    if (!Array.isArray(suggestion.sourceIds) || !suggestion.sourceIds.length || !suggestion.sourceIds.includes(exp.id)) errors.push(`“${exp.title}”的建议缺少原材料来源，请重新生成。`);
    for (const sourceId of suggestion.sourceIds || []) {
      if (sourceId === exp.id) continue;
      const fact = facts.find(f => f.id === sourceId);
      if (!fact || fact.experienceId !== exp.id || fact.status !== 'confirmed') errors.push(`“${exp.title}”引用了未确认、已删除或属于其他经历的事实，请重新核对。`);
    }
    if (suggestion.needsFactConfirmation || suggestion.hasUnconfirmedFacts || suggestion.validity === 'conflict') errors.push(`“${exp.title}”有待确认的新增事实或冲突，请先核对。`);
    if (!clean(suggestion.status === 'edited' ? suggestion.editedText ?? suggestion.text : suggestion.text)) errors.push(`“${exp.title}”采用的内容为空，请编辑或保留原文。`);
  }
  return [...new Set(errors)];
}
