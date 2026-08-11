import { ITEMS, GRADE_LABELS, CATEGORIES } from './items.js';
import { judgeRecord, describeRange } from './reference.js';
import { loadRecords, saveRecords, deleteRecord, searchRecords, sortByDateDesc } from './records.js';
import { loadSettings } from './settings.js';
import { calcAge } from './calc.js';
import { escapeHtml } from './html.js';

function cellClass(judgment) {
  if (judgment === 'border') return ' class="cell-border"';
  if (judgment === 'warning') return ' class="cell-warning"';
  return '';
}

function cellText(item, record) {
  const value = record[item.key];
  if (value == null || value === '') return '—';
  return item.type === 'grade' ? GRADE_LABELS[value] : String(value);
}

function detailHtml(record, settings) {
  const judgments = judgeRecord(record, settings.references);
  const age = calcAge(settings.birthDate, record.date);
  const badge = { normal: '基準内', border: '境界値', warning: '要注意' };
  const sections = CATEGORIES.map((cat) => {
    const rows = ITEMS.filter((i) => i.category === cat).map((i) => {
      const j = judgments[i.key];
      const ref = i.type === 'grade' ? '陰性 (-)' : describeRange(settings.references[i.key], i.unit);
      return `<div class="item-row">
        <div><div class="item-name">${i.label}</div><div class="item-ref">基準値: ${ref}</div></div>
        <div class="item-value${j === 'warning' ? ' cell-warning' : j === 'border' ? ' cell-border' : ''}">${cellText(i, record)}${i.type === 'number' && record[i.key] != null ? `<span class="unit"> ${i.unit}</span>` : ''}</div>
        <span class="badge badge-${j ?? 'none'}">${badge[j] ?? '未入力'}</span>
      </div>`;
    }).join('');
    return `<h3 class="panel-title">${cat}</h3>${rows}`;
  }).join('');
  return `
    <p class="panel-note">
      ${record.date} の結果 ／ ${age != null ? `満年齢: ${age} 歳 ／ ` : ''}
      ${record.facility ? escapeHtml(record.facility) : '検査施設未設定'} ／
      ${record.postMealHours != null ? `食後 ${record.postMealHours} 時間` : '空腹時'}
    </p>
    ${sections}
    ${record.currentTreatment ? `<h3 class="panel-title">現治療内容</h3><p class="panel-note">${escapeHtml(record.currentTreatment)}</p>` : ''}
    ${record.newTreatment ? `<h3 class="panel-title">変更後治療内容</h3><p class="panel-note">${escapeHtml(record.newTreatment)}</p>` : ''}
    ${record.memo ? `<h3 class="panel-title">備考</h3><p class="panel-note">${escapeHtml(record.memo)}</p>` : ''}
    <button type="button" class="save-btn ghost-btn" id="detail-edit">この記録を編集</button>
    <button type="button" class="save-btn danger-btn" id="detail-delete">この記録を削除</button>
  `;
}

export function renderHistoryView(container) {
  const settings = loadSettings(localStorage);
  let selectedId = null;
  let query = '';

  const draw = () => {
    const all = sortByDateDesc(searchRecords(loadRecords(localStorage), query));
    const headers = ['検査日', ...ITEMS.map((i) => i.short), ''].map((h) => `<th>${h}</th>`).join('');
    const rows = all.map((r) => {
      const judgments = judgeRecord(r, settings.references);
      const cells = ITEMS.map((i) => `<td${cellClass(judgments[i.key])}>${cellText(i, r)}</td>`).join('');
      return `<tr data-id="${r.id}"${r.id === selectedId ? ' class="is-selected"' : ''}>
        <td>${r.date}${r.facility ? `<br><span class="item-ref">${escapeHtml(r.facility)}</span>` : ''}</td>${cells}<td></td>
      </tr>`;
    }).join('');

    const selected = all.find((r) => r.id === selectedId) || null;
    container.innerHTML = `
      <section class="panel">
        <h2 class="panel-title">検査履歴一覧 (${all.length}件)</h2>
        <input class="form-input" type="search" id="history-search" placeholder="日付、検査施設、治療内容で検索..." value="${escapeHtml(query)}">
        <p class="panel-note">行をタップすると詳細を表示します。</p>
        <div class="table-wrap">
          <table class="history-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>
        </div>
      </section>
      <section class="panel" id="history-detail">
        <h2 class="panel-title">検査値の詳細情報</h2>
        ${selected ? detailHtml(selected, settings) : '<p class="panel-note">履歴の行をタップすると、全項目の詳細と治療内容をここで確認できます。</p>'}
      </section>
    `;

    const search = container.querySelector('#history-search');
    search.addEventListener('input', () => {
      query = search.value;
      const pos = search.selectionStart;
      draw();
      const again = container.querySelector('#history-search');
      again.focus();
      again.setSelectionRange(pos, pos);
    });

    container.querySelectorAll('tbody tr').forEach((tr) => {
      tr.addEventListener('click', () => {
        selectedId = tr.dataset.id === selectedId ? null : tr.dataset.id;
        draw();
        container.querySelector('#history-detail').scrollIntoView({ behavior: 'smooth' });
      });
    });

    if (selected) {
      container.querySelector('#detail-edit').addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('kensa:edit', { detail: { id: selected.id } }));
      });
      container.querySelector('#detail-delete').addEventListener('click', () => {
        if (!confirm('本当にこの検査レコードを削除しますか？この操作は取り消せません。')) return;
        saveRecords(localStorage, deleteRecord(loadRecords(localStorage), selected.id));
        selectedId = null;
        draw();
      });
    }
  };

  draw();
}
