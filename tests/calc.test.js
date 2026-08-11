import test from 'node:test';
import assert from 'node:assert/strict';
import { calcNonHdl, estimateEgfr, calcAge, formatDate } from '../js/calc.js';

test('calcNonHdl: 総コレ−HDL。どちらか欠けたらnull', () => {
  assert.equal(calcNonHdl(198, 45), 153);
  assert.equal(calcNonHdl(null, 45), null);
  assert.equal(calcNonHdl(198, null), null);
});

test('estimateEgfr: 日本腎臓学会式(男性)で小数1桁', () => {
  // 194 * 0.89^-1.094 * 49^-0.287 = 71.5前後
  const v = estimateEgfr(0.89, 49);
  assert.ok(Math.abs(v - 71.7) < 1.0, `計算値 ${v} が想定範囲`);
  assert.equal(v, Math.round(v * 10) / 10);
  assert.equal(estimateEgfr(null, 49), null);
  assert.equal(estimateEgfr(0.89, null), null);
});

test('calcAge: 誕生日前後で満年齢が変わる', () => {
  assert.equal(calcAge('1976-09-29', '2026-09-28'), 49);
  assert.equal(calcAge('1976-09-29', '2026-09-29'), 50);
  assert.equal(calcAge('1976-09-29', '2026-06-20'), 49);
  assert.equal(calcAge('', '2026-06-20'), null);
  assert.equal(calcAge('invalid', '2026-06-20'), null);
});

test('formatDate: ローカル日付をYYYY-MM-DDに', () => {
  assert.equal(formatDate(new Date(2026, 7, 11)), '2026-08-11');
  assert.equal(formatDate(new Date(2026, 0, 5)), '2026-01-05');
});
