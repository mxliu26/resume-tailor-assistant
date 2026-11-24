import test from 'node:test';
import assert from 'node:assert/strict';
import {createRewriteHighlighter,renderRewriteMarks,renderRewriteEditor} from '../public/rewrite-editor.js';

const marked=(diff,kind)=>diff.spans.filter(s=>s.kind===kind).map(s=>s.text).join('');
const text=diff=>diff.spans.map(s=>s.text).join('');

test('generated differences and subsequent user edits have independent provenance',()=>{
  const generated='负责数据清洗与可视化。';
  const diff=createRewriteHighlighter('负责数据清洗。',generated)('独立'+generated);
  assert.equal(marked(diff,'suggested'),'与可视化');
  assert.equal(marked(diff,'manual'),'独立');
  assert.equal(marked(diff,'unchanged'),'负责数据清洗。');
  assert.equal(text(diff),'独立'+generated);
});

test('replacing a generated change marks the replacement as user text and records deletions',()=>{
  const diff=createRewriteHighlighter('使用Excel整理数据。','使用SQL整理数据。')('使用Python整理数据。');
  assert.equal(marked(diff,'manual'),'Python');
  assert.equal(marked(diff,'suggested'),'');
  assert.deepEqual(diff.suggestedDeletions,['Excel']);
  assert.deepEqual(diff.manualDeletions,['SQL']);
});

test('unchanged text has no marks; undo restores generated marks without manual marks',()=>{
  const highlight=createRewriteHighlighter('完成报告。','完成项目报告。');
  highlight('我完成了项目报告。');
  const undone=highlight('完成项目报告。');
  assert.equal(marked(undone,'suggested'),'项目');
  assert.equal(marked(undone,'manual'),'');
  assert.deepEqual(undone.manualDeletions,[]);
  assert.deepEqual(createRewriteHighlighter('原文','原文')('原文').spans,[{kind:'unchanged',text:'原文'}]);
});

test('deletion-only edits remain visible in the comparison without injecting deleted text into the draft',()=>{
  const diff=createRewriteHighlighter('组织访谈，整理记录。','访谈，整理记录。')('访谈。');
  assert.equal(text(diff),'访谈。');
  assert.deepEqual(diff.suggestedDeletions,['组织']);
  assert.deepEqual(diff.manualDeletions,['，整理记录']);
  assert.equal(marked(diff,'manual'),'');
});

test('Unicode code points, tabs and trailing blank lines are retained',()=>{
  const generated='项目🧑‍💻\t访谈\n总结📊\n';
  const current='项目🧑‍💻\t访谈\n总结📊✅\n\n';
  const diff=createRewriteHighlighter('项目🧑‍💻\t访谈\n',generated)(current);
  assert.equal(text(diff),current);
  assert.equal(marked(diff,'suggested'),'总结📊\n');
  assert.equal(marked(diff,'manual'),'✅\n');
});

test('native textarea newline normalization does not produce false manual edits',()=>{
  const diff=createRewriteHighlighter('原文\r\n第二行','原文\r\n第二行')('原文\n第二行');
  assert.equal(marked(diff,'manual'),'');
  assert.equal(text(diff),'原文\n第二行');
});

test('markup-like user text is escaped in both the backdrop and the editable value',()=>{
  const value='</textarea><img src=x onerror="alert(1)">';
  const diff=createRewriteHighlighter('','')(value);
  assert.equal(text(diff),value);
  const html=renderRewriteMarks(diff.spans)+renderRewriteEditor({id:'s',text:value},'项目');
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
  assert.equal((html.match(/<textarea /g)||[]).length,1);
});

test('large rewritten resumes and repeated edits preserve every current character',()=>{
  const original=Array.from({length:200},(_,i)=>`第${i}项：调研并整理团队记录。\n`).join('');
  const generated=original.replaceAll('调研并整理','开展访谈，汇总');
  const highlight=createRewriteHighlighter(original,generated);
  for(let index=0;index<30;index++){
    const at=index*71,current=generated.slice(0,at)+'人工补充✅'+generated.slice(at+5);
    assert.equal(text(highlight(current)),current);
  }
});

test('emptying a draft records deletions; restoring it is identical to a fresh render',()=>{
  const highlight=createRewriteHighlighter('沟通记录','整理沟通记录');
  assert.deepEqual(highlight('').manualDeletions,['整理沟通记录']);
  const current='整理协作记录';
  assert.deepEqual(highlight(current),createRewriteHighlighter('沟通记录','整理沟通记录')(current));
});
