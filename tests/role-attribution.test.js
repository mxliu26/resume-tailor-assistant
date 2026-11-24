import test from 'node:test';
import assert from 'node:assert/strict';
import {detectFactConflicts} from '../public/domain.js';

// Minimal synthetic excerpt of the SYN5-BC-004 failure, without private material.
const original = '活动执行成员。协助举办3场活动，负责报名表单、现场签到和活动后反馈汇总；参与整理活动流程，未形成付费转化或用户留存统计。';
const answer = '我是执行成员，负责报名表、签到和反馈整理，整体策划由负责人主导。';
const roleErrors = (text, source = original) => detectFactConflicts(text, source).filter(e => e.includes('职责'));

test('SYN5-BC-004: member duties and explicit third-party leadership are compatible', () => {
  assert.deepEqual(detectFactConflicts(answer, original), []);
  assert.deepEqual(roleErrors('本人为参与成员，整体策划由团队负责人牵头。'), []);
  assert.deepEqual(roleErrors('参与报名整理，活动由另一位同学主导。'), []);
});

for (const text of [
  '本人主导整体策划。',
  '我独立负责活动策划。',
  '我是执行成员，整体策划由负责人主导，我也主导了活动。',
  '我是执行成员，整体策划由负责人主导并由我牵头实施。',
  '我是执行成员，整体策划由负责人主导且独立负责运营。',
  '我作为负责人主导整体策划。',
  '我是执行成员，我也是负责人，整体策划由负责人主导。',
  '我是执行成员，我现在是负责人，整体策划由负责人主导。',
  '我是执行成员，负责人就是我，整体策划由负责人主导。',
  '我是导师，整体策划由导师主导。',
  '整体策划由负责人主导。',
  '可能由负责人主导，也可能由我主导。',
]) test('unsupported or ambiguous personal leadership remains blocked: ' + text, () => {
  assert.ok(roleErrors(text).length);
});

test('third-party leadership in a confirmed source cannot authorize personal leadership', () => {
  const source = original + '\n' + answer;
  assert.ok(roleErrors('本人主导整体策划。', source).length);
  assert.deepEqual(roleErrors(answer, source), []);
  assert.deepEqual(roleErrors('本人主导策划。', '本人主导策划，协助整理反馈。'), []);
});

test('attribution correction does not exempt changed counts, launch states or A/B claims', () => {
  assert.ok(detectFactConflicts(answer + '共举办8场、汇总250人记录。', original + '汇总180人记录。').some(e => e.includes('数字')));
  assert.ok(detectFactConflicts(answer + '产品已上线。', original + '产品尚未上线。').some(e => e.includes('工作状态')));
  assert.ok(detectFactConflicts(answer + '开展线上A/B测试。', original + '未开展线上A/B测试。').some(e => e.includes('工作类型')));
  assert.deepEqual(roleErrors('参与策划，未主导活动。'), []);
});
