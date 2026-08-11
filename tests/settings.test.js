import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings, DEFAULT_BIRTH_DATE } from '../js/settings.js';
import { DEFAULT_REFERENCES } from '../js/reference.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('loadSettings: 空ストレージならデフォルト設定', () => {
  const s = loadSettings(fakeStorage());
  assert.equal(s.birthDate, DEFAULT_BIRTH_DATE);
  assert.deepEqual(s.references, DEFAULT_REFERENCES);
});

test('loadSettings: 保存済み基準値がデフォルトとマージされる', () => {
  const storage = fakeStorage({
    'kensa-app:settings': JSON.stringify({
      birthDate: '1980-01-01',
      references: { ldl: { kind: 'upper', low: 60, high: 99, borderHigh: 119 } },
    }),
  });
  const s = loadSettings(storage);
  assert.equal(s.birthDate, '1980-01-01');
  assert.equal(s.references.ldl.high, 99);
  assert.deepEqual(s.references.fbs, DEFAULT_REFERENCES.fbs); // 未保存項目はデフォルト
});

test('loadSettings: 壊れたJSONはデフォルトに戻す', () => {
  const s = loadSettings(fakeStorage({ 'kensa-app:settings': '{broken' }));
  assert.equal(s.birthDate, DEFAULT_BIRTH_DATE);
});

test('saveSettings→loadSettingsで往復できる', () => {
  const storage = fakeStorage();
  saveSettings(storage, { birthDate: '1976-09-29', references: DEFAULT_REFERENCES });
  assert.deepEqual(loadSettings(storage).references, DEFAULT_REFERENCES);
});
