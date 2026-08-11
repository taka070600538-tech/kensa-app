import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHtml } from '../js/html.js';

test('escapeHtml: タグを無害化する', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
});

test('escapeHtml: 二重引用符・シングルクォートをエスケープする', () => {
  assert.equal(escapeHtml(`"onmouseover='x'`), '&quot;onmouseover=&#39;x&#39;');
});

test('escapeHtml: &をエスケープする(他の置換より先に処理される)', () => {
  assert.equal(escapeHtml('A&B <C>'), 'A&amp;B &lt;C&gt;');
});

test('escapeHtml: null/undefinedは空文字列になる', () => {
  assert.equal(escapeHtml(null), '');
  assert.equal(escapeHtml(undefined), '');
});

test('escapeHtml: 数値や通常の日本語文字列はそのまま(記号以外は不変)', () => {
  assert.equal(escapeHtml(123), '123');
  assert.equal(escapeHtml('通常のメモ文章'), '通常のメモ文章');
});
