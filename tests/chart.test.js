import test from 'node:test';
import assert from 'node:assert/strict';
import { buildSeries, refLinesFor, buildChartSvg, GRADE_NUMBER } from '../js/chart.js';
import { DEFAULT_REFERENCES } from '../js/reference.js';

test('buildSeries: date昇順、null除外、定性は段階値', () => {
  const records = [
    { date: '2026-06-20', ldl: 114, urineProtein: '-' },
    { date: '2025-06-10', ldl: 152, urineProtein: '+-' },
    { date: '2025-12-15', ldl: null, urineProtein: null },
  ];
  assert.deepEqual(buildSeries(records, 'ldl'), [
    { date: '2025-06-10', value: 152 },
    { date: '2026-06-20', value: 114 },
  ]);
  assert.deepEqual(buildSeries(records, 'urineProtein'), [
    { date: '2025-06-10', value: GRADE_NUMBER['+-'] },
    { date: '2026-06-20', value: GRADE_NUMBER['-'] },
  ]);
});

test('refLinesFor: 上限型はhigh/borderHigh、下限型はlow/borderLow', () => {
  assert.deepEqual(refLinesFor(DEFAULT_REFERENCES.ldl).map((l) => l.value), [119, 139]);
  assert.deepEqual(refLinesFor(DEFAULT_REFERENCES.egfr).map((l) => l.value), [60, 45]);
  assert.deepEqual(refLinesFor(undefined), []);
});

test('buildChartSvg: polyline・データ点・基準破線を含む', () => {
  const svg = buildChartSvg({
    points: [{ date: '2025-06-10', value: 152 }, { date: '2026-06-20', value: 114 }],
    refLines: refLinesFor(DEFAULT_REFERENCES.ldl),
    unit: 'mg/dL',
  });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(svg.includes('<polyline'));
  assert.equal([...svg.matchAll(/<circle/g)].length, 2);
  assert.equal([...svg.matchAll(/stroke-dasharray/g)].length, 2);
  assert.ok(svg.includes('06-20')); // x軸ラベル
});

test('buildChartSvg: データ1点でも壊れない', () => {
  const svg = buildChartSvg({ points: [{ date: '2026-06-20', value: 114 }], refLines: [], unit: '' });
  assert.ok(svg.includes('<circle'));
  assert.ok(!svg.includes('NaN'));
});

test('buildChartSvg: 0点(データ・基準線ともなし)でもNaNを含まない', () => {
  const svg = buildChartSvg({ points: [], refLines: [], unit: '' });
  assert.ok(svg.startsWith('<svg'));
  assert.ok(!svg.includes('NaN'));
  assert.ok(!svg.includes('<circle'));
});

test('buildChartSvg: 0点でも基準線があればNaNを含まない', () => {
  const svg = buildChartSvg({ points: [], refLines: refLinesFor(DEFAULT_REFERENCES.ldl), unit: 'mg/dL' });
  assert.ok(!svg.includes('NaN'));
  assert.equal([...svg.matchAll(/stroke-dasharray/g)].length, 2);
});
