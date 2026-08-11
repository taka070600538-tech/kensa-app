import { ITEMS, ITEM_MAP } from './items.js';
import { buildSeries, refLinesFor, buildChartSvg } from './chart.js';
import { loadRecords } from './records.js';
import { loadSettings } from './settings.js';
import { describeRange } from './reference.js';

let selectedKey = 'hba1c'; // タブ切替しても選択を保持(モジュール変数)

export function renderGraphView(container) {
  const records = loadRecords(localStorage);
  const settings = loadSettings(localStorage);

  if (!records.length) {
    container.innerHTML = `
      <section class="panel">
        <h2 class="panel-title">経時推移グラフ</h2>
        <p class="panel-note">検査データが登録されていません。「追加」タブから最初のレコードを登録してください。</p>
      </section>`;
    return;
  }

  const options = ITEMS.map((i) =>
    `<option value="${i.key}"${i.key === selectedKey ? ' selected' : ''}>${i.label}${i.unit ? ` (${i.unit})` : ''}</option>`
  ).join('');

  const item = ITEM_MAP[selectedKey];
  const points = buildSeries(records, selectedKey);
  const ref = settings.references[selectedKey];
  const isGrade = item.type === 'grade';

  let body;
  if (!points.length) {
    body = `<p class="panel-note">選択された項目「${item.label}」の記録がありません。この項目の数値を入力すると推移グラフが作成されます。</p>`;
  } else {
    const svg = buildChartSvg({
      points,
      refLines: isGrade ? [] : refLinesFor(ref),
      unit: item.unit,
    });
    const latest = points.at(-1);
    const prev = points.length > 1 ? points.at(-2) : null;
    const diff = prev == null ? null : Math.round((latest.value - prev.value) * 100) / 100;
    body = `
      ${svg}
      <p class="panel-note">
        ${isGrade
          ? 'グラフの値: 0=陰性 / 1=擬陽性 / 2=陽性 / 3=強陽性'
          : `基準範囲: ${describeRange(ref, item.unit)}`}
        ${diff != null ? ` ／ 直近の変動: ${diff > 0 ? '+' : ''}${diff}` : ''}
      </p>`;
  }

  container.innerHTML = `
    <section class="panel">
      <h2 class="panel-title">経時推移グラフ</h2>
      <label class="form-label">検査項目を選択
        <select class="form-select" id="graph-item">${options}</select>
      </label>
    </section>
    <section class="panel">
      <h2 class="panel-title">${item.label} の推移</h2>
      ${body}
    </section>
  `;

  container.querySelector('#graph-item').addEventListener('change', (e) => {
    selectedKey = e.target.value;
    renderGraphView(container);
  });
}
