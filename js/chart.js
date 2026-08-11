import { ITEM_MAP } from './items.js';

// 定性値をグラフ用の段階値に変換する。
export const GRADE_NUMBER = { '-': 0, '+-': 1, '+': 2, '++': 3 };

export function buildSeries(records, key) {
  const item = ITEM_MAP[key];
  return [...records]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((r) => {
      const raw = r[key];
      if (raw == null || raw === '') return null;
      const value = item.type === 'grade' ? GRADE_NUMBER[raw] : raw;
      return value == null ? null : { date: r.date, value };
    })
    .filter(Boolean);
}

export function refLinesFor(ref) {
  if (!ref) return [];
  if (ref.kind === 'lower') {
    return [
      { value: ref.low, label: `正常下限 ${ref.low}` },
      { value: ref.borderLow, label: `要注意 ${ref.borderLow}未満` },
    ];
  }
  return [
    { value: ref.high, label: `正常上限 ${ref.high}` },
    { value: ref.borderHigh, label: `境界上限 ${ref.borderHigh}` },
  ];
}

// 折れ線グラフのSVG文字列を生成する(DOM非依存の純関数)。
export function buildChartSvg({ points, refLines = [], unit = '', width = 360, height = 240 }) {
  // データ・基準線とも0件の場合は座標計算(NaN)を避け、空のSVGを返す。
  if (!points.length && !refLines.length) {
    return `<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" class="trend-chart"></svg>`;
  }
  const pad = { top: 14, right: 12, bottom: 34, left: 46 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const values = points.map((p) => p.value).concat(refLines.map((l) => l.value));
  let min = Math.min(...values);
  let max = Math.max(...values);
  if (min === max) { min -= 1; max += 1; }
  const span = max - min;
  min -= span * 0.12;
  max += span * 0.12;
  const x = (i) => pad.left + (points.length === 1 ? plotW / 2 : (plotW * i) / (points.length - 1));
  const y = (v) => pad.top + plotH - ((v - min) / (max - min)) * plotH;
  const fmt = (v) => (Math.abs(v) >= 100 ? Math.round(v) : Math.round(v * 10) / 10);

  const parts = [];
  parts.push(`<svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" class="trend-chart">`);
  // y軸目盛(4分割)
  for (let t = 0; t <= 4; t++) {
    const v = min + ((max - min) * t) / 4;
    parts.push(`<line x1="${pad.left}" y1="${y(v)}" x2="${width - pad.right}" y2="${y(v)}" class="grid-line"/>`);
    parts.push(`<text x="${pad.left - 6}" y="${y(v) + 4}" text-anchor="end" class="axis-label">${fmt(v)}</text>`);
  }
  // 基準破線
  for (const line of refLines) {
    parts.push(`<line x1="${pad.left}" y1="${y(line.value)}" x2="${width - pad.right}" y2="${y(line.value)}" class="ref-line" stroke-dasharray="5 4"/>`);
    parts.push(`<text x="${width - pad.right}" y="${y(line.value) - 4}" text-anchor="end" class="ref-label">${line.label}</text>`);
  }
  // 折れ線とデータ点
  if (points.length > 1) {
    const pts = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
    parts.push(`<polyline points="${pts}" fill="none" class="trend-line"/>`);
  }
  points.forEach((p, i) => {
    parts.push(`<circle cx="${x(i)}" cy="${y(p.value)}" r="4" class="trend-dot" data-date="${p.date}" data-value="${p.value}"/>`);
  });
  // x軸ラベル(最大6個に間引き)
  const stride = Math.max(1, Math.ceil(points.length / 6));
  points.forEach((p, i) => {
    if (i % stride !== 0 && i !== points.length - 1) return;
    parts.push(`<text x="${x(i)}" y="${height - 10}" text-anchor="middle" class="axis-label">${p.date.slice(5)}</text>`);
  });
  if (unit) parts.push(`<text x="${pad.left}" y="${pad.top - 2}" class="axis-label">${unit}</text>`);
  parts.push('</svg>');
  return parts.join('');
}
