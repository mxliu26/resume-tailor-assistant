import test from 'node:test';
import assert from 'node:assert/strict';
import { renderComparison } from '../public/comparison-view.js';
import { getRewritePlan } from '../public/analysis-model.js';

const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const btn=(text,action,cls='',extra='')=>`<button type="button" class="${cls}" data-action="${action}" ${extra}>${text}</button>`;
const badge=(text,type='')=>`<span class="badge ${type}">${esc(text)}</span>`;
const helpers={esc,btn,badge,config:{mode:'mock'}};

function fixture(){
  const experiences=[
    {id:'exp-a',kind:'experience',title:'课程项目甲',text:'课程项目甲\n参与数据整理，工作细节尚未提供。'},
    {id:'exp-b',kind:'experience',title:'科研项目乙',text:'科研项目乙\n参与离线评测，整理评测记录。'},
    {id:'exp-c',kind:'experience',title:'界面项目丙',text:'界面项目丙\n使用 Figma 绘制流程图。'},
  ];
  const requirements=[
    {id:'req-a',text:'负责数据整理。',category:'工作任务与能力',strength:'明确要求'},
    {id:'req-b',text:'有线上 A/B 测试经验者优先。',category:'加分项',strength:'优先／加分'},
    {id:'req-c',text:'熟悉 Figma。',category:'工具或方法',strength:'明确要求'},
  ];
  return {
    experiences,requirements,selected:experiences.map(e=>e.id),
    resumeCorrected:experiences.map(e=>e.text).join('\n\n'),jdCorrected:requirements.map(r=>r.text).join('\n'),
    facts:[],questions:[],orphanedFacts:[],
    associations:[
      {requirementId:'req-a',experienceId:'exp-a',status:'表达不足',needsClarification:true,evidence:experiences[0].text,reason:'本人职责仍待明确。'},
      {requirementId:'req-b',experienceId:'exp-b',status:'相关但不等价',needsClarification:false,evidence:experiences[1].text,reason:'离线评测不等同于线上实验。'},
      {requirementId:'req-c',experienceId:'exp-c',status:'已有明确证据',needsClarification:false,evidence:experiences[2].text,reason:'已有工具使用依据。'},
    ],
  };
}
function requirementArticle(html,id){
  const marker=html.indexOf(`id="requirement-${id}"`);
  const start=marker<0?-1:html.lastIndexOf('<article ',marker);
  assert.ok(start>=0,`requirement ${id} must exist`);
  return html.slice(start,html.indexOf('</article>',start)+10);
}

test('comparison escapes user materials and typed answers instead of rendering executable markup',()=>{
  const task=fixture();
  const attack='<img src=x onerror="globalThis.injected=true"> & "quoted"';
  task.requirements[0].text=attack;
  task.experiences[0].text+='\n'+attack;
  task.associations[0].evidence=task.experiences[0].text;
  task.jdCorrected=attack;
  task.extraFactDraft='</textarea><script>alert(1)</script>';
  task.questions=[{id:'q-a',requirementId:'req-a',experienceId:'exp-a',text:attack,purpose:attack,status:'pending',answer:attack}];
  task.facts=[{id:'f-a',experienceId:'exp-a',questionId:'q-a',text:attack,status:'pending'}];
  const html=renderComparison(task,helpers);
  assert.equal(html.includes(attack),false);
  assert.equal(html.includes('<img'),false);
  assert.equal(html.includes('<script>'),false);
  assert.ok(html.includes(esc(attack)));
  assert.ok(html.includes('&lt;/textarea&gt;&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('questions are rendered under exactly their current requirement and experience pair',()=>{
  const task=fixture();
  task.questions=[
    {id:'q-a',requirementId:'req-a',experienceId:'exp-a',text:'只属于要求甲的问题',purpose:'核实甲',status:'pending',answer:''},
    {id:'q-b',requirementId:'req-b',experienceId:'exp-b',text:'只属于要求乙的旧回答',purpose:'核实乙',status:'skipped',answer:'已跳过'},
    {id:'q-legacy',experienceId:'exp-a',text:'旧版未绑定的问题',status:'confirmed',answer:'旧记录保留'},
  ];
  const html=renderComparison(task,helpers);
  const first=requirementArticle(html,'req-a'),second=requirementArticle(html,'req-b');
  assert.ok(first.includes('question-q-a'));
  assert.equal(first.includes('question-q-b'),false);
  assert.ok(second.includes('question-q-b'));
  assert.equal(second.includes('question-q-a'),false);
  assert.equal(first.includes('question-q-legacy'),false);
  assert.ok(html.indexOf('question-q-legacy')>html.indexOf('class="card extra-facts"'));
  assert.equal((html.match(/id="question-q-a"/g)||[]).length,1);
});

test('a question from a previous association cannot appear under the new linked experience',()=>{
  const task=fixture();
  task.associations[0]={...task.associations[0],experienceId:'exp-b',evidence:task.experiences[1].text};
  task.questions=[{id:'q-old',requirementId:'req-a',experienceId:'exp-a',text:'旧经历问题',status:'archived',answer:'保留的未提交答案'}];
  task.facts=[{id:'f-old',questionId:'q-old',requirementId:'req-a',experienceId:'exp-a',text:'原经历的事实不迁移。',status:'pending'}];
  const html=renderComparison(task,helpers);
  assert.equal(requirementArticle(html,'req-a').includes('question-q-old'),false);
  assert.equal(requirementArticle(html,'req-a').includes('fact-f-old'),false);
  assert.ok(html.includes('fact-f-old'),'fact remains accessible even when its old question is not current');
  assert.ok(html.includes('data-fact-check="f-old"'));
});

test('pending confirmed and conflicting facts retain their distinct controls without duplicated fact cards',()=>{
  const task=fixture();
  task.questions=[{id:'q-a',requirementId:'req-a',experienceId:'exp-a',text:'补充具体职责',status:'provided',answer:'本人整理了分类记录。'}];
  task.facts=[
    {id:'f-pending',questionId:'q-a',experienceId:'exp-a',text:'本人整理了分类记录。',status:'pending'},
    {id:'f-confirmed',experienceId:'exp-b',text:'已确认的方法。',status:'confirmed'},
    {id:'f-conflict',experienceId:'exp-c',text:'存在数字口径差异。',status:'conflict'},
  ];
  const html=renderComparison(task,helpers);
  for(const fact of task.facts)assert.equal((html.match(new RegExp(`id="fact-${fact.id}"`,'g'))||[]).length,1);
  assert.ok(html.includes('data-fact-check="f-pending"'));
  assert.match(html,/data-action="confirm-fact"[^>]*data-id="f-pending"/);
  assert.equal(html.includes('data-fact-check="f-confirmed"'),false);
  assert.equal(html.includes('data-fact-check="f-conflict"'),false);
  assert.match(html,/data-action="discard-fact"[^>]*data-id="f-conflict"/);
});

test('rewrite cards use model priority order and keep every experience selectable exactly once',()=>{
  const task=fixture();
  const plan=getRewritePlan(task),before=structuredClone(task);
  const html=renderComparison(task,helpers);
  const cards=[...html.matchAll(/<article class="plan-card priority-([a-z]+)">/g)].map(m=>m[1]);
  assert.deepEqual(cards,plan.map(p=>p.priority));
  assert.deepEqual(cards,['clarify','polish','keep']);
  for(const e of task.experiences)assert.equal((html.match(new RegExp(`data-select="${e.id}"`,'g'))||[]).length,1);
  assert.ok(requirementArticle(html,'req-c').includes('已有明确证据'));
  assert.ok(requirementArticle(html,'req-b').includes('相关但不等价'));
  assert.deepEqual(task,before,'rendering may not mutate selection, evidence or materials');
});

test('unselected sections still show questions and summarize their pending facts',()=>{
  const task=fixture();task.selected=['exp-b'];
  task.questions=[{id:'q-a',requirementId:'req-a',experienceId:'exp-a',text:'未选择经历的问题',status:'pending',answer:'保存的草稿答案'}];
  task.facts=[{id:'f-a',questionId:'q-a',experienceId:'exp-a',text:'保留待确认补充',status:'pending'}];
  const html=renderComparison(task,helpers);
  assert.equal(html.includes('data-answer="q-a"'),true);
  assert.ok(html.includes('id="facts-summary"'));
  assert.ok(html.includes('data-fact-check="f-a"'));
  assert.equal((html.match(/id="fact-f-a"/g)||[]).length,1);
});

test('archived question history stays out of a currently sufficient requirement card',()=>{
  const task=fixture();
  task.questions=[{id:'q-old',requirementId:'req-c',experienceId:'exp-c',text:'旧的工具补问',status:'archived',previousStatus:'pending',answer:'未提交的旧答案'}];
  const html=renderComparison(task,helpers);
  assert.equal(requirementArticle(html,'req-c').includes('question-q-old'),false);
  assert.ok(requirementArticle(html,'req-c').includes('可保留原文'));
  assert.equal(html.includes('data-answer="q-old"'),false);
  assert.ok(html.includes('未提交的旧答案'),'archiving must retain user input in accessible history');
});
