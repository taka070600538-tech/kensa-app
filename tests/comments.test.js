import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComments } from '../js/comments.js';
import { DEFAULT_REFERENCES } from '../js/reference.js';

const refs = DEFAULT_REFERENCES;

test('すべて基準内なら良好メッセージ1件', () => {
  const record = { fbs: 96, hba1c: 5.4, hdl: 45, ldl: 114, tg: 98, alt: 21, egfr: 71.5, ua: 6.1 };
  assert.deepEqual(buildComments(record, refs), ['すべての主要項目が良好です！']);
});

test('糖代謝: 糖尿病域(fbs>=126またはhba1c>=6.5)', () => {
  assert.ok(buildComments({ fbs: 130 }, refs).includes('糖代謝：糖尿病域の数値です'));
  assert.ok(buildComments({ hba1c: 6.5 }, refs).includes('糖代謝：糖尿病域の数値です'));
});

test('糖代謝: 境界型(fbs 100-125またはhba1c 5.6-6.4)', () => {
  assert.ok(buildComments({ fbs: 112 }, refs).includes('糖代謝：境界型（糖尿病予備軍）'));
});

test('低血糖(fbs<70)では糖尿病域コメントを出さない', () => {
  const comments = buildComments({ fbs: 60 }, refs);
  assert.ok(!comments.includes('糖代謝：糖尿病域の数値です'));
  assert.ok(comments.includes('糖代謝：空腹時血糖が基準値未満です'));
});

test('脂質代謝: LDLと中性脂肪', () => {
  assert.ok(buildComments({ ldl: 152 }, refs).includes('脂質代謝：高LDLコレステロール血症'));
  assert.ok(buildComments({ ldl: 132 }, refs).includes('脂質代謝：軽度高コレステロール'));
  assert.ok(buildComments({ tg: 320 }, refs).includes('脂質代謝：高トリグリセリド（中性脂肪）血症'));
  assert.ok(buildComments({ tg: 185 }, refs).includes('脂質代謝：中性脂肪軽度高値（境界域）'));
});

test('肝機能: ALT', () => {
  assert.ok(buildComments({ alt: 41 }, refs).includes('肝機能：ALT（GPT）上昇'));
  assert.ok(buildComments({ alt: 34 }, refs).includes('肝機能：ALT軽度高値'));
});

test('腎機能と尿酸', () => {
  assert.ok(buildComments({ egfr: 55 }, refs).includes('腎機能：eGFRの低下'));
  assert.ok(buildComments({ ua: 7.2 }, refs).includes('尿酸値：高尿酸血症'));
});

test('複数該当なら複数件返る', () => {
  const comments = buildComments({ fbs: 112, ldl: 152, ua: 7.2 }, refs);
  assert.equal(comments.length, 3);
});
