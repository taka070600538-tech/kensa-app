import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadRecords, saveRecords, upsertRecord, deleteRecord,
  searchRecords, latestRecord, sortByDateDesc,
} from '../js/records.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const rec = (id, date, extra = {}) => ({ id, date, createdAt: `${date}T09:00:00.000Z`, ...extra });

test('upsertRecord: 新規追加はdate昇順に並ぶ', () => {
  const records = upsertRecord(upsertRecord([], rec('b', '2026-06-20')), rec('a', '2025-12-15'));
  assert.deepEqual(records.map((r) => r.id), ['a', 'b']);
});

test('upsertRecord: 同じidは置換される(同日複数レコードは共存できる)', () => {
  let records = [rec('a', '2026-06-20', { fbs: 96 }), rec('b', '2026-06-20', { fbs: 104 })];
  records = upsertRecord(records, rec('a', '2026-06-20', { fbs: 99 }));
  assert.equal(records.length, 2);
  assert.equal(records.find((r) => r.id === 'a').fbs, 99);
});

test('deleteRecord: idで削除', () => {
  const records = deleteRecord([rec('a', '2026-06-20'), rec('b', '2026-06-21')], 'a');
  assert.deepEqual(records.map((r) => r.id), ['b']);
});

test('load/saveRecords: 往復できる。壊れたJSONは空配列', () => {
  const storage = fakeStorage();
  saveRecords(storage, [rec('a', '2026-06-20')]);
  assert.equal(loadRecords(storage).length, 1);
  assert.deepEqual(loadRecords(fakeStorage({ 'kensa-app:records': '{broken' })), []);
});

test('searchRecords: 日付・施設・治療内容・備考の部分一致(大文字小文字無視)', () => {
  const records = [
    rec('a', '2026-06-20', { facility: '丸の内健診センター', currentTreatment: '', newTreatment: '', memo: '' }),
    rec('b', '2025-12-15', { facility: '', currentTreatment: 'メトホルミン250mg', newTreatment: '', memo: '' }),
    rec('c', '2025-06-10', { facility: '', currentTreatment: '', newTreatment: '', memo: '運動を継続' }),
  ];
  assert.deepEqual(searchRecords(records, '丸の内').map((r) => r.id), ['a']);
  assert.deepEqual(searchRecords(records, 'メトホルミン').map((r) => r.id), ['b']);
  assert.deepEqual(searchRecords(records, '2025').map((r) => r.id), ['b', 'c']);
  assert.deepEqual(searchRecords(records, '運動').map((r) => r.id), ['c']);
  assert.equal(searchRecords(records, '').length, 3);
});

test('latestRecord: 最新日付を返す。同日ならcreatedAtが新しい方', () => {
  assert.equal(latestRecord([]), null);
  const records = [
    rec('a', '2026-06-20'),
    { id: 'b', date: '2026-06-20', createdAt: '2026-06-20T12:00:00.000Z' },
    rec('c', '2025-12-15'),
  ];
  assert.equal(latestRecord(records).id, 'b');
});

test('sortByDateDesc: 降順コピーを返し元配列を壊さない', () => {
  const records = [rec('a', '2025-12-15'), rec('b', '2026-06-20')];
  assert.deepEqual(sortByDateDesc(records).map((r) => r.id), ['b', 'a']);
  assert.deepEqual(records.map((r) => r.id), ['a', 'b']);
});
