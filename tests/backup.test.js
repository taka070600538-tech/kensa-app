import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackupPayload, validateBackupData } from '../js/backup.js';

test('buildBackupPayload: version/exportedAt/records/settingsを含む', () => {
  const now = new Date('2026-08-11T00:00:00Z');
  const payload = buildBackupPayload([{ id: 'a', date: '2026-06-20' }], { birthDate: '1976-09-29' }, now);
  assert.equal(payload.version, 1);
  assert.equal(payload.exportedAt, '2026-08-11T00:00:00.000Z');
  assert.equal(payload.records.length, 1);
  assert.equal(payload.settings.birthDate, '1976-09-29');
});

test('validateBackupData: 正常データはそのまま返す', () => {
  const data = { version: 1, records: [], settings: {} };
  assert.equal(validateBackupData(data), data);
});

test('validateBackupData: settingsなし(旧形式)も許容する', () => {
  assert.ok(validateBackupData({ version: 1, records: [] }));
});

test('validateBackupData: 不正データはthrow', () => {
  assert.throws(() => validateBackupData(null));
  assert.throws(() => validateBackupData({ version: 2, records: [] }));
  assert.throws(() => validateBackupData({ version: 1, records: 'x' }));
});
