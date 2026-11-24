import {unitPresentation} from './unit-presentation.js';

// Shared by both review and comparison. Category colours describe the JD;
// rewrite priorities remain a separate, explicitly labelled colour system.
export const requirementCategories = ['明确条件','工作任务与能力','工具或方法','加分项'];
export function categoryStyle(category) {
  return ({'明确条件':'condition','工作任务与能力':'task','工具或方法':'method','加分项':'bonus'})[category] || 'condition';
}

/** Display-only partition of profile text. Source units and offsets are untouched.
 * An intent line may be followed by contact/availability on the same PDF line.
 * Only explicit labels in a personal-information unit can create partitions.
 */
export function profileParts(unit, index=0) {
  if(unit.kind!=='context')return [];
  const text=String(unit.text??unit.original??'');
  const first=text.trim().split(/\r?\n/)[0];
  if(/^(?:教育|学习|专业技能|个人技能|技能|技术|自我评价|个人优势|荣誉|获奖|证书|语言|兴趣)/.test(first))return [];
  const heading=/^(?:基本信息|个人信息|联系方式|姓名|电话|手机|邮箱|E-?mail|求职(?:意向|方向)|目标岗位|应聘(?:岗位|职位)|可实习|可到岗|到岗时间|实习时长)/i;
  const leadingName=first.split(/求职(?:意向|方向)\s*[:：]|电话\s*[:：]|手机\s*[:：]|邮箱\s*[:：]/)[0].trim();
  const name=index===0&&/^[\p{Script=Han}\s·]{2,12}$/u.test(leadingName)&&unitPresentation(unit).title==='基本信息';
  if(!heading.test(first)&&!name)return [];
  const markers=[...text.matchAll(/(?:求职(?:意向|方向)|目标岗位|应聘(?:岗位|职位))\s*[:：]|(?:姓名|电话|手机|邮箱|E-?mail|到岗时间|实习时长|实习时间)\s*[:：]|(?:可实习|可到岗|每周)\s*[:：]?/gi)];
  const cuts=[{start:0,type:'basic'}];
  for(const match of markers) {
    const type=/求职|目标岗位|应聘/.test(match[0])?'intent':'basic';
    if(match.index===0)cuts[0].type=type;
    else if(cuts.at(-1).type!==type)cuts.push({start:match.index,type});
  }
  return cuts.map((part,i)=>({unitId:unit.id,index:i,type:part.type,start:part.start,end:cuts[i+1]?.start??text.length,
    text:text.slice(part.start,cuts[i+1]?.start??text.length),
    label:part.type==='intent'?'求职意向':/电话|手机|邮箱|@|可实习|可到岗|每周|到岗时间|实习时长/.test(text.slice(part.start,cuts[i+1]?.start??text.length))?'联系方式与实习安排':'姓名与个人信息'}));
}

export function reviewSections(units) {
  const sections=[],profileGroups=new Map();
  units.forEach((unit,index)=>{
    const parts=profileParts(unit,index);
    if(!parts.length){sections.push({id:unit.id,type:'unit',unit});return;}
    for(const part of parts){
      if(!profileGroups.has(part.type)){
        const group={id:`profile-${part.type}`,type:'profile',profileType:part.type,title:part.type==='basic'?'基本信息':'求职意向',parts:[]};
        profileGroups.set(part.type,group);sections.push(group);
      }
      profileGroups.get(part.type).parts.push({...part,unit});
    }
  });
  return sections;
}

export function replaceProfilePart(text,start,end,value) {
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<0||end<start||end>text.length)throw Error('该字段已变化，请保存草稿并重新打开校对页。');
  return text.slice(0,start)+String(value)+text.slice(end);
}

function compactOps(ops) {
  const result=[];
  for(const op of ops){if(!op.text)continue;if(result.at(-1)?.type===op.type)result.at(-1).text+=op.text;else result.push({...op});}
  return result;
}

function lcs(a,b) {
  const table=Array.from({length:a.length+1},()=>new Uint32Array(b.length+1));
  for(let i=a.length-1;i>=0;i--)for(let j=b.length-1;j>=0;j--)table[i][j]=a[i]===b[j]?table[i+1][j+1]+1:Math.max(table[i+1][j],table[i][j+1]);
  const result=[];let i=0,j=0;
  while(i<a.length||j<b.length){
    if(i<a.length&&j<b.length&&a[i]===b[j]){result.push({type:'equal',text:a[i++]});j++;}
    else if(i<a.length&&(j===b.length||table[i+1][j]>=table[i][j+1]))result.push({type:'delete',text:a[i++]});
    else result.push({type:'insert',text:b[j++]});
  }
  return compactOps(result);
}

/** Bounded diff: precise for local edits; large changes align on whole lines.
 * Both versions can always be reconstructed exactly from these operations.
 */
export function textDiff(before,after) {
  const a=Array.from(String(before??'')),b=Array.from(String(after??''));
  let prefix=0,suffix=0;
  while(prefix<a.length&&prefix<b.length&&a[prefix]===b[prefix])prefix++;
  while(suffix<a.length-prefix&&suffix<b.length-prefix&&a[a.length-1-suffix]===b[b.length-1-suffix])suffix++;
  const left=a.slice(prefix,a.length-suffix),right=b.slice(prefix,b.length-suffix);
  let middle;
  if(left.length*right.length<=250000)middle=lcs(left,right);
  else {
    const lines=value=>value.join('').match(/[^\n]*\n|[^\n]+$/g)||[];
    const oldLines=lines(left),newLines=lines(right);
    middle=oldLines.length*newLines.length<=10000?lcs(oldLines,newLines):[{type:'delete',text:left.join('')},{type:'insert',text:right.join('')}];
  }
  return compactOps([{type:'equal',text:a.slice(0,prefix).join('')},...middle,{type:'equal',text:suffix?a.slice(-suffix).join(''):''}]);
}

export function renderTextDiff(before,after,esc) {
  if(String(before??'')===String(after??''))return '';
  const ops=textDiff(before,after);
  return `<div class="change-preview"><div class="diff-legend"><strong>修改对比</strong><span class="diff-add-key">新增</span><span class="diff-remove-key">删除</span></div><div class="diff-text" tabindex="0">${ops.map(op=>op.type==='insert'?`<ins aria-label="新增">${esc(op.text)}</ins>`:op.type==='delete'?`<del aria-label="删除">${esc(op.text)}</del>`:esc(op.text)).join('')}</div></div>`;
}

export function unitReviewBefore(task,unit) {
  const source=String(unit.sourceText??unit.original??'');
  if(source!==unit.text)return source;
  const previous=task.lastReviewChanges?.units?.[unit.id];
  return previous?.after===unit.text?previous.before:source;
}

export function materialReviewBefore(task,type,current) {
  const source=type==='resume'?task.resumeCorrected:task.jdCorrected;
  if(source!==current)return source;
  const previous=task.lastReviewChanges?.[type];
  return previous?.after===current?previous.before:source;
}
