import { ITEMS, GRADE_LABELS, CATEGORIES } from './items.js';
import { judgeRecord, describeRange } from './reference.js';
import { buildComments } from './comments.js';
import { loadRecords, latestRecord } from './records.js';
import { loadSettings } from './settings.js';
import { calcAge } from './calc.js';

const BADGE = {
  normal: '<span class="badge badge-normal">基準内</span>',
  border: '<span class="badge badge-border">境界値</span>',
  warning: '<span class="badge badge-warning">要注意</span>',
  none: '<span class="badge badge-none">未入力</span>',
};

function itemRow(item, record, judgments, references) {
  const value = record[item.key];
  const judgment = judgments[item.key];
  const display = value == null || value === ''
    ? '<span class="unit">—</span>'
    : item.type === 'grade'
      ? GRADE_LABELS[value]
      : `${value}<span class="unit"> ${item.unit}</span>`;
  const ref = item.type === 'grade' ? '陰性 (-)' : describeRange(references[item.key], item.unit);
  return `
    <div class="item-row">
      <div><div class="item-name">${item.label}</div><div class="item-ref">基準値: ${ref}</div></div>
      <div class="item-value">${display}</div>
      ${BADGE[judgment ?? 'none']}
    </div>`;
}

export function renderDashboardView(container) {
  const records = loadRecords(localStorage);
  const latest = latestRecord(records);
  if (!latest) {
    container.innerHTML = `
      <section class="panel">
        <h2 class="panel-title">検査記録アプリへようこそ！</h2>
        <p class="panel-note">「追加」タブから、健康診断や血液検査の結果を入力して記録をスタートしましょう。</p>
        <button type="button" class="save-btn" id="goto-add">検査データを追加</button>
      </section>`;
    container.querySelector('#goto-add').addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('kensa:goto', { detail: { view: 'add' } }));
    });
    return;
  }

  const settings = loadSettings(localStorage);
  const judgments = judgeRecord(latest, settings.references);
  const comments = buildComments(latest, settings.references);
  const age = calcAge(settings.birthDate, latest.date);

  const meta = [
    `検査日: ${latest.date}`,
    age != null ? `満年齢: ${age} 歳` : null,
    latest.facility ? `受診施設: ${latest.facility}` : null,
    latest.postMealHours != null ? `食後 ${latest.postMealHours} 時間` : '空腹時',
  ].filter(Boolean).join(' ／ ');

  const sections = CATEGORIES.map((cat) => {
    const rows = ITEMS.filter((i) => i.category === cat)
      .map((i) => itemRow(i, latest, judgments, settings.references))
      .join('');
    return `<section class="panel"><h2 class="panel-title">${cat}</h2>${rows}</section>`;
  }).join('');

  const treatment = (latest.currentTreatment || latest.newTreatment) ? `
    <section class="panel">
      <h2 class="panel-title">治療状況・指示事項</h2>
      ${latest.currentTreatment ? `<p class="panel-note"><strong>現治療・処方:</strong> ${latest.currentTreatment}</p>` : ''}
      ${latest.newTreatment ? `<p class="panel-note"><strong>変更後治療・指示:</strong> ${latest.newTreatment}</p>` : ''}
    </section>` : '';

  container.innerHTML = `
    <section class="panel">
      <h2 class="panel-title">最新の検査結果</h2>
      <p class="panel-note">${meta}</p>
    </section>
    <section class="panel">
      <h2 class="panel-title">検査結果への所見</h2>
      <ul class="comment-list">${comments.map((c) => `<li>${c}</li>`).join('')}</ul>
    </section>
    ${sections}
    ${treatment}
    ${latest.memo ? `<section class="panel"><h2 class="panel-title">備考・メモ</h2><p class="panel-note">${latest.memo}</p></section>` : ''}
  `;
}
