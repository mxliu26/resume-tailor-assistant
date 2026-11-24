import {originalSectionTitle} from './material-units.js';
// Display labels only. Never write derived headings back into resume materials.
const tidy = value => String(value ?? '').replace(/^[\s•●▪◦‣⁃*+\-]+/, '').trim();
const compact = value => String(value ?? '').replace(/\s+/g, ' ').trim();
const shorten = (value, size) => {
  const text = compact(value), chars = [...text];
  return chars.length > size ? chars.slice(0, size - 1).join('') + '…' : text;
};
const urlPattern = /https?:\/\/[^\s，；。)）]+|www\.[^\s，；。)）]+|(?:github\.com|gitee\.com)\/[^\s，；。)）]+/gi;
const datePattern = /(?:19|20)\d{2}(?:\s*[.\/年-]\s*\d{1,2}(?:月)?)?(?:\s*[-—–~～至]+\s*(?:(?:19|20)\d{2}(?:\s*[.\/年-]\s*\d{1,2}(?:月)?)?|至今|现在))?/g;
const genericHeading = /^(?:项目经历|项目经验|项目实践|工作经历|工作经验|实习经历|科研经历|校园经历|社团经历|实践经历|教育背景|教育经历|专业技能|个人技能|技能|基本信息|个人信息)[：:]?$/;
const bodyStart = /^(?:参与|负责|协助|使用|通过|完成|整理|制作|开发|输出|实现|熟悉|熟练|掌握|了解|擅长|具备|能够|本人|主要职责|工作内容|项目描述)/;
const rolePattern = /^(?:(?:产品|开发|设计|运营|分析|技术|科研|研究|数据|项目|团队|活动|实验|测试|前端|后端|算法)(?:方向)?\s*)?(?:实习生|负责人|研究助理|科研助理|助理|成员|经理|工程师|组长|志愿者)$/;
const isRole = text => rolePattern.test(text) || /^(?:课程|科研|竞赛|个人|团队|毕业设计)项目$/.test(text) || /^(?:科研助理|研究助理|社团经历)$/.test(text);

function contextLabel(text) {
  const plain = tidy(text).replace(/\s+/g, ' ');
  const named = plain.match(/^(数据分析|数据处理|数据可视化|产品设计|原型设计|编程能力|语言能力|英语能力|办公技能|荣誉奖项|获奖情况|资格证书|自我评价|个人优势|求职意向)(?:[：:\s，,、]|$)/);
  if (named) return named[1];
  if (/^(?:教育|学习)(?:背景|经历)|^(?:学历|学位)/.test(plain)) return '教育背景';
  if (/^(?:专业技能|个人技能|技能特长|技术能力|技能|工具能力|核心技能)/.test(plain)) return '专业技能';
  if (/^(?:证书|荣誉证书)/.test(plain)) return '证书与荣誉';
  if (/^(?:语言|外语)/.test(plain)) return '语言能力';
  if (/^(?:基本信息|个人信息|联系方式|姓名|电话|手机|邮箱)/.test(plain)) return '基本信息';
  if (/大学|学院/.test(plain) && /本科|硕士|博士|大专|学士/.test(plain)) return '教育背景';
  if (/数据分析|数据清洗|统计分析|数据可视化/.test(plain)) return '数据分析';
  if (/Figma|Python|SQL|Excel|Axure|Office|JavaScript|Tableau|Power\s*BI|熟练|熟悉|掌握/i.test(plain)) return '专业技能';
  if (/CET[ -]?[46]|雅思|托福|英语|日语|法语/.test(plain)) return '语言能力';
  return '基本信息';
}

/** A compact semantic heading and optional metadata, derived without mutation.
 * The complete, unmodified material remains in the editor and source viewer.
 */
export function unitPresentation(exp = {}) {
  const source = String(exp.text ?? exp.original ?? exp.sourceText ?? '');
  const lines = source.split(/\r?\n/).map(tidy).filter(Boolean);
  const declared = tidy(exp.title);
  const headerLines = [...new Set([declared, ...lines.slice(0, 3)])].filter(Boolean);
  const dates = [...new Set(headerLines.filter(line => !bodyStart.test(line)).flatMap(line => [...line.matchAll(datePattern)]
    .filter(match => !/\d/.test(line[match.index - 1] || '') && !/^[\d条人份次个页万元]/.test(line.slice(match.index + match[0].length)))
    .map(match => compact(match[0]))))];
  const withoutNoise = text => tidy(text.replace(urlPattern, '').replace(datePattern, '').replace(/[｜|·]\s*$/g, ''));
  const candidates = [...new Set([declared, ...lines])].filter(Boolean);
  let title = '', chosenLine = '', roles = [];

  const originalHeading = originalSectionTitle(exp);
  if (originalHeading) {
    title = originalHeading;
  } else if (exp.kind === 'context') {
    title = contextLabel(declared || lines[0] || source);
  } else {
    for (const line of candidates) {
      const cleaned = withoutNoise(line);
      if (!cleaned || genericHeading.test(cleaned)) continue;
      const parts = cleaned.split(/\s*[|｜·]\s*|\s{2,}/).map(tidy).filter(Boolean);
      const names = parts.filter(part => !isRole(part) && !bodyStart.test(part) && !/[。；;]/.test(part));
      if (!names.length) continue;
      const first = names[0].split(/[：:]/)[0].trim();
      if (!first || bodyStart.test(first)) continue;
      title = first; chosenLine = line;
      roles = parts.filter(isRole);
      break;
    }
    if (!title) title = /科研|课题|研究/.test(declared) ? '科研经历' : /实习/.test(declared) ? '实习经历' : /社团|活动/.test(declared) ? '校园经历' : '项目经历';
  }

  for (const line of headerLines) {
    const parts = withoutNoise(line).split(/\s*[|｜·]\s*|\s{2,}/).map(tidy).filter(Boolean);
    roles.push(...parts.filter(isRole));
  }
  const metaParts = [...new Set([...dates, ...roles])].filter(item => item && item !== title);
  const fullTitle = title;
  title = shorten(title.replace(urlPattern, ''), 28) || (exp.kind === 'context' ? '基本信息' : '项目经历');
  const body = lines.filter(line => {
    if (line === chosenLine || genericHeading.test(line)) return false;
    const value = withoutNoise(line);
    return value && value !== fullTitle && !isRole(value);
  }).map(line => line.replace(urlPattern, '').trim());
  let preview = body.join(' ');
  if (preview.startsWith(fullTitle)) preview = preview.slice(fullTitle.length).replace(/^[\s：:|｜·]+/, '');
  if (preview === title) preview = '';
  return {title, meta:shorten(metaParts.join(' · '), 80), preview:shorten(preview, 96)};
}
