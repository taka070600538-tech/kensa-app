import { ITEMS } from './items.js';

// 基準値定義。上限型: { kind:'upper', low, high, borderHigh } — low〜highが正常、
// high超〜borderHighが境界、borderHigh超が要注意。low(null可)を下回るのも要注意。
// 下限型: { kind:'lower', low, borderLow } — low以上が正常、borderLow以上lowが境界、
// borderLow未満が要注意。デフォルトは男性基準(設定タブで編集可能)。
export const DEFAULT_REFERENCES = {
  fbs: { kind: 'upper', low: 70, high: 99, borderHigh: 125 },
  hba1c: { kind: 'upper', low: 4.6, high: 5.5, borderHigh: 6.4 },
  hdl: { kind: 'lower', low: 40, borderLow: 35 },
  ldl: { kind: 'upper', low: 60, high: 119, borderHigh: 139 },
  tc: { kind: 'upper', low: 140, high: 199, borderHigh: 219 },
  nonHdl: { kind: 'upper', low: 90, high: 149, borderHigh: 169 },
  tg: { kind: 'upper', low: 30, high: 149, borderHigh: 299 },
  ast: { kind: 'upper', low: null, high: 30, borderHigh: 35 },
  alt: { kind: 'upper', low: null, high: 30, borderHigh: 40 },
  ggt: { kind: 'upper', low: null, high: 50, borderHigh: 100 },
  cre: { kind: 'upper', low: 0.65, high: 1.0, borderHigh: 1.29 },
  egfr: { kind: 'lower', low: 60, borderLow: 45 },
  ua: { kind: 'upper', low: 2.1, high: 7.0, borderHigh: 8.9 },
};

export function judgeNumber(value, ref) {
  if (value == null || !ref) return null;
  if (ref.kind === 'lower') {
    if (value >= ref.low) return 'normal';
    if (value >= ref.borderLow) return 'border';
    return 'warning';
  }
  if (ref.low != null && value < ref.low) return 'warning';
  if (value <= ref.high) return 'normal';
  if (value <= ref.borderHigh) return 'border';
  return 'warning';
}

export function judgeGrade(value) {
  if (value == null || value === '') return null;
  if (value === '-') return 'normal';
  if (value === '+-') return 'border';
  return 'warning';
}

export function judgeRecord(record, references) {
  const result = {};
  for (const item of ITEMS) {
    result[item.key] = item.type === 'grade'
      ? judgeGrade(record[item.key])
      : judgeNumber(record[item.key], references[item.key]);
  }
  return result;
}

export function describeRange(ref, unit) {
  const u = unit ? ` ${unit}` : '';
  if (ref.kind === 'lower') return `${ref.low}${u} 以上`;
  if (ref.low == null) return `${ref.high}${u} 以下`;
  return `${ref.low}〜${ref.high}${u}`;
}
