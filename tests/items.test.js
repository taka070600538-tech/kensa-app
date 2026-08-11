import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, ITEM_MAP, GRADE_VALUES, GRADE_LABELS, NUMBER_KEYS, CATEGORIES } from '../js/items.js';

test('項目マスタ: 15項目(数値13+定性2)が定義されている', () => {
  assert.equal(ITEMS.length, 15);
  assert.equal(NUMBER_KEYS.length, 13);
  assert.equal(ITEMS.filter((i) => i.type === 'grade').length, 2);
});

test('項目マスタ: 期待するkeyがすべて存在する', () => {
  const keys = ITEMS.map((i) => i.key);
  for (const k of ['fbs', 'hba1c', 'urineGlucose', 'urineProtein', 'hdl', 'ldl', 'tc',
    'nonHdl', 'tg', 'ast', 'alt', 'ggt', 'cre', 'egfr', 'ua']) {
    assert.ok(keys.includes(k), `${k} がある`);
  }
});

test('項目マスタ: ITEM_MAPで引ける・カテゴリが5種', () => {
  assert.equal(ITEM_MAP.fbs.label, '空腹時血糖');
  assert.equal(ITEM_MAP.egfr.unit, 'mL/分/1.73m²');
  assert.deepEqual(CATEGORIES, ['糖代謝', '脂質代謝', '肝機能', '腎機能', '尿酸・その他']);
});

test('定性値: 4段階と表示名', () => {
  assert.deepEqual(GRADE_VALUES, ['-', '+-', '+', '++']);
  assert.equal(GRADE_LABELS['+-'], '擬陽性 (±)');
});
