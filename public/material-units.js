// Shared eligibility and original section names, independent of editable content type.
const sectionNames = ['技能与优势','技能与特长','技能与证书','技能与兴趣','专业技能','个人技能','技术技能','技能特长','技术能力','核心技能','个人优势','自我评价','教育背景','教育经历','学习经历','荣誉奖项','获奖情况','资格证书','荣誉证书','语言能力','技能','证书','语言'];
const strip = text => String(text || '').replace(/^[\s•●▪◦‣⁃·*-]+/, '').trim();
export function originalSectionTitle(unit = {}) {
  if (sectionNames.includes(unit.sectionTitle)) return unit.sectionTitle;
  const first = [unit.title, ...String(unit.text ?? unit.sourceText ?? unit.original ?? '').split(/\r?\n/).slice(0, 1)].map(strip);
  for (const line of first) for (const name of sectionNames) {
    if (line === name || line.startsWith(name + '：') || line.startsWith(name + ':')) return name;
  }
  return '';
}
export function isContentUnit(unit = {}) {
  if (unit.excluded) return false;
  if (unit.kind !== 'context') return true;
  if (originalSectionTitle(unit)) return true;
  const text = String(unit.text ?? unit.original ?? '');
  if (/^(?:基本信息|个人信息|联系方式|姓名|求职意向|求职方向|目标岗位)/.test(strip(unit.title)) || /电话[：:]|手机[：:]|邮箱[：:]|[\w.+-]+@[\w.-]+\./.test(text)) return false;
  return /技能|优势|熟悉|熟练|掌握|学历|大学|学院|本科|硕士|博士|CET|Python|SQL|Figma|获奖|证书/i.test(text);
}
