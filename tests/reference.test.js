import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REFERENCES, judgeNumber, judgeGrade, judgeRecord, describeRange } from '../js/reference.js';
import { NUMBER_KEYS } from '../js/items.js';

test('基準値: 数値13項目すべてにデフォルトがある', () => {
  for (const key of NUMBER_KEYS) {
    assert.ok(DEFAULT_REFERENCES[key], `${key} の基準値がある`);
  }
});

test('judgeNumber(上限型): 境界値ちょうどを含めて3段階判定', () => {
  const ref = DEFAULT_REFERENCES.fbs; // 70-99 / 100-125 / >=126
  assert.equal(judgeNumber(99, ref), 'normal');
  assert.equal(judgeNumber(100, ref), 'border');
  assert.equal(judgeNumber(125, ref), 'border');
  assert.equal(judgeNumber(126, ref), 'warning');
  assert.equal(judgeNumber(69, ref), 'warning'); // 下限割れ
  assert.equal(judgeNumber(null, ref), null);
});

test('judgeNumber(下限型): HDLは低いほど悪い', () => {
  const ref = DEFAULT_REFERENCES.hdl; // >=40 / 35-39 / <35
  assert.equal(judgeNumber(40, ref), 'normal');
  assert.equal(judgeNumber(39, ref), 'border');
  assert.equal(judgeNumber(35, ref), 'border');
  assert.equal(judgeNumber(34, ref), 'warning');
});

test('judgeNumber(下限なし上限型): ASTは低値でも正常', () => {
  const ref = DEFAULT_REFERENCES.ast; // <=30 / 31-35 / >=36
  assert.equal(judgeNumber(5, ref), 'normal');
  assert.equal(judgeNumber(31, ref), 'border');
  assert.equal(judgeNumber(36, ref), 'warning');
});

test('judgeGrade: 陰性のみ正常、±は境界、+以上は要注意', () => {
  assert.equal(judgeGrade('-'), 'normal');
  assert.equal(judgeGrade('+-'), 'border');
  assert.equal(judgeGrade('+'), 'warning');
  assert.equal(judgeGrade('++'), 'warning');
  assert.equal(judgeGrade(null), null);
});

test('judgeRecord: 全15項目の判定を返す', () => {
  const record = { fbs: 96, hba1c: 6.6, urineGlucose: '-', urineProtein: '+-', hdl: 34 };
  const j = judgeRecord(record, DEFAULT_REFERENCES);
  assert.equal(j.fbs, 'normal');
  assert.equal(j.hba1c, 'warning');
  assert.equal(j.urineGlucose, 'normal');
  assert.equal(j.urineProtein, 'border');
  assert.equal(j.hdl, 'warning');
  assert.equal(j.ldl, null); // 未入力
  assert.equal(Object.keys(j).length, 15);
});

test('judgeRecord: カスタム基準値が反映される', () => {
  const refs = { ...DEFAULT_REFERENCES, ldl: { kind: 'upper', low: 60, high: 99, borderHigh: 119 } };
  assert.equal(judgeRecord({ ldl: 110 }, refs).ldl, 'border');
});

test('describeRange: 範囲の説明文字列', () => {
  assert.equal(describeRange(DEFAULT_REFERENCES.fbs, 'mg/dL'), '70〜99 mg/dL');
  assert.equal(describeRange(DEFAULT_REFERENCES.hdl, 'mg/dL'), '40 mg/dL 以上');
  assert.equal(describeRange(DEFAULT_REFERENCES.ast, 'U/L'), '30 U/L 以下');
});
