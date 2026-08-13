import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDaySection, upsertSection, datesToTranscribe } from '../tools/transcribe.mjs';

const records = [
  {
    date: '2026-08-10',
    facility: '谷田内科クリニック',
    postMealHours: 2,
    fbs: 149,
    hba1c: null,
    hdl: 31,
    ldl: 57,
    tc: null,
    nonHdl: null,
    tg: 929,
    ast: 59,
    alt: 115,
    ggt: 85,
    cre: 1.11,
    egfr: 56.6,
    ua: 5.9,
    urineGlucose: null,
    urineProtein: null,
    currentTreatment: '',
    newTreatment: '',
    memo: '年齢: 49',
  },
  {
    date: '2026-08-11',
    facility: '',
    postMealHours: null,
    fbs: null,
    hba1c: null,
    hdl: null,
    ldl: null,
    tc: null,
    nonHdl: null,
    tg: null,
    ast: null,
    alt: null,
    ggt: null,
    cre: null,
    egfr: null,
    ua: 7.5,
    urineGlucose: null,
    urineProtein: null,
    currentTreatment: '',
    newTreatment: '',
    memo: '',
  },
  {
    date: '2026-08-12',
    facility: '',
    postMealHours: null,
    fbs: null,
    hba1c: null,
    hdl: null,
    ldl: null,
    tc: null,
    nonHdl: null,
    tg: null,
    ast: null,
    alt: null,
    ggt: null,
    cre: null,
    egfr: null,
    ua: null,
    urineGlucose: null,
    urineProtein: null,
    currentTreatment: '',
    newTreatment: '',
    memo: '',
  },
];

// 同一日に2件目のrecordを追加(複数record出力の確認用)
const multiRecords = [
  records[0],
  {
    date: '2026-08-10',
    facility: '',
    postMealHours: null,
    fbs: null,
    hba1c: null,
    hdl: null,
    ldl: null,
    tc: null,
    nonHdl: null,
    tg: null,
    ast: null,
    alt: null,
    ggt: null,
    cre: null,
    egfr: null,
    ua: 6.1,
    urineGlucose: '-',
    urineProtein: '+',
    currentTreatment: '',
    newTreatment: '',
    memo: '',
  },
];

test('buildDaySection: 施設・数値項目・メモをラベル付きで出す(null/空文字は省略)', () => {
  assert.equal(
    buildDaySection(records, '2026-08-10'),
    [
      '## 検査記録',
      '',
      '- 施設: 谷田内科クリニック',
      '- 食後: 2時間',
      '- 血糖: 149 mg/dL',
      '- HDL: 31 mg/dL',
      '- LDL: 57 mg/dL',
      '- 中性脂肪: 929 mg/dL',
      '- AST: 59 U/L',
      '- ALT: 115 U/L',
      '- γ-GT: 85 U/L',
      '- クレアチニン: 1.11 mg/dL',
      '- eGFR: 56.6',
      '- 尿酸: 5.9 mg/dL',
      '- メモ: 年齢: 49',
    ].join('\n')
  );
});

test('buildDaySection: 尿酸のみでも1行だけ出す', () => {
  assert.equal(buildDaySection(records, '2026-08-11'), '## 検査記録\n\n- 尿酸: 7.5 mg/dL');
});

test('buildDaySection: 全項目null・空文字、または記録が無ければnull', () => {
  assert.equal(buildDaySection(records, '2026-08-12'), null);
  assert.equal(buildDaySection(records, '2026-01-01'), null);
});

test('buildDaySection: 同一日に複数recordがあれば空行1つで区切って全て出す', () => {
  assert.equal(
    buildDaySection(multiRecords, '2026-08-10'),
    [
      '## 検査記録',
      '',
      '- 施設: 谷田内科クリニック',
      '- 食後: 2時間',
      '- 血糖: 149 mg/dL',
      '- HDL: 31 mg/dL',
      '- LDL: 57 mg/dL',
      '- 中性脂肪: 929 mg/dL',
      '- AST: 59 U/L',
      '- ALT: 115 U/L',
      '- γ-GT: 85 U/L',
      '- クレアチニン: 1.11 mg/dL',
      '- eGFR: 56.6',
      '- 尿酸: 5.9 mg/dL',
      '- メモ: 年齢: 49',
      '',
      '- 尿酸: 6.1 mg/dL',
      '- 尿糖: -',
      '- 尿蛋白: +',
    ].join('\n')
  );
});

test('datesToTranscribe: 当日を除いた日付昇順', () => {
  assert.deepEqual(datesToTranscribe(records, '2026-08-12'), ['2026-08-10', '2026-08-11']);
});

test('upsertSection: マーカーが無ければ末尾に追記', () => {
  const out = upsertSection('既存の本文\n', 'セクション');
  assert.equal(out, '既存の本文\n\n<!-- kensa-app:start -->\nセクション\n<!-- kensa-app:end -->\n');
});

test('upsertSection: 既存マーカー区間だけを置換し他は触らない', () => {
  const before = '前文\n\n<!-- kensa-app:start -->\n古い内容\n<!-- kensa-app:end -->\n後文\n';
  const out = upsertSection(before, '新しい内容');
  assert.equal(out, '前文\n\n<!-- kensa-app:start -->\n新しい内容\n<!-- kensa-app:end -->\n後文\n');
});

test('upsertSection: CRLFの日記ではCRLFを保つ', () => {
  const out = upsertSection('本文\r\n', 'A\nB');
  assert.equal(out, '本文\r\n\r\n<!-- kensa-app:start -->\r\nA\r\nB\r\n<!-- kensa-app:end -->\r\n');
});

test('upsertSection: 空ファイルにはブロックのみ', () => {
  assert.equal(upsertSection('', 'S'), '<!-- kensa-app:start -->\nS\n<!-- kensa-app:end -->\n');
});
