import { ITEMS, ITEM_MAP, NUMBER_KEYS } from './items.js';
import { DEFAULT_REFERENCES } from './reference.js';
import { loadSettings, saveSettings } from './settings.js';
import { loadRecords, saveRecords } from './records.js';
import { buildBackupPayload, validateBackupData } from './backup.js';
import { formatDate } from './calc.js';

function refEditorRows(references) {
  return NUMBER_KEYS.map((key) => {
    const item = ITEM_MAP[key];
    const ref = references[key];
    if (ref.kind === 'lower') {
      return `<div class="ref-editor-row" data-key="${key}">
        <div>${item.short}<br><span class="item-ref">${item.unit}(下限型)</span></div>
        <input type="number" step="any" data-field="low" value="${ref.low}" aria-label="正常下限">
        <input type="number" step="any" data-field="borderLow" value="${ref.borderLow}" aria-label="境界下限">
        <span class="ref-editor-head">未満で要注意</span>
      </div>`;
    }
    return `<div class="ref-editor-row" data-key="${key}">
      <div>${item.short}<br><span class="item-ref">${item.unit}</span></div>
      <input type="number" step="any" data-field="low" value="${ref.low ?? ''}" placeholder="—" aria-label="正常下限">
      <input type="number" step="any" data-field="high" value="${ref.high}" aria-label="正常上限">
      <input type="number" step="any" data-field="borderHigh" value="${ref.borderHigh}" aria-label="境界上限">
    </div>`;
  }).join('');
}

export function renderSettingsView(container) {
  const settings = loadSettings(localStorage);

  container.innerHTML = `
    <section class="panel">
      <h2 class="panel-title">個人情報</h2>
      <label class="form-label">生年月日(満年齢の自動計算に使います)
        <input class="form-input" type="date" id="birth-date" value="${settings.birthDate}">
      </label>
    </section>
    <section class="panel">
      <h2 class="panel-title">基準値(参考値)のカスタマイズ</h2>
      <p class="panel-note">上限型は「正常下限・正常上限・境界上限」、下限型(HDL・eGFR)は「正常下限・境界下限」を編集できます。
      正常範囲を外れて境界域内なら「境界値」、境界域も外れると「要注意」と判定されます。</p>
      <div class="ref-editor-row ref-editor-head"><div>項目</div><div>正常下限</div><div>正常上限</div><div>境界上限</div></div>
      ${refEditorRows(settings.references)}
      <button type="button" class="save-btn" id="save-settings">設定を保存する</button>
      <button type="button" class="save-btn ghost-btn" id="reset-references">基準値を初期値に戻す</button>
      <p class="save-message" id="settings-message" role="status"></p>
    </section>
    <section class="panel">
      <h2 class="panel-title">データについて</h2>
      <p class="panel-note">記録はこの端末(ブラウザ)に保存され、1日1回GitHubにも自動バックアップされます。
      機種変更のときは、新しい端末でトークンを設定して「GitHubから復元」してください。</p>
    </section>
    <section class="panel" id="backup-section"></section>
    <section class="panel">
      <h2 class="panel-title">ファイルへのバックアップ</h2>
      <p class="panel-note">記録と設定をJSONファイルに書き出したり、ファイルから復元したりできます。</p>
      <button type="button" class="save-btn" id="export-file-btn">ファイルにエクスポート</button>
      <button type="button" class="save-btn ghost-btn" id="import-file-btn">ファイルからインポート</button>
      <input type="file" id="import-file-input" accept="application/json" hidden>
      <p class="save-message" id="file-backup-message" role="status"></p>
    </section>
  `;

  const $ = (id) => container.querySelector(`#${id}`);
  const message = $('settings-message');

  $('save-settings').addEventListener('click', () => {
    const references = {};
    let error = null;
    container.querySelectorAll('.ref-editor-row[data-key]').forEach((row) => {
      const key = row.dataset.key;
      const def = DEFAULT_REFERENCES[key];
      const read = (field, nullable) => {
        const input = row.querySelector(`input[data-field="${field}"]`);
        if (!input) return undefined;
        if (input.value.trim() === '') {
          if (nullable) return null;
          error = error || `${ITEM_MAP[key].short} の${input.getAttribute('aria-label')}を入力してください。`;
          return undefined;
        }
        const v = Number(input.value);
        if (!Number.isFinite(v)) {
          error = error || `${ITEM_MAP[key].short} の値が数値ではありません。`;
          return undefined;
        }
        return v;
      };
      references[key] = def.kind === 'lower'
        ? { kind: 'lower', low: read('low', false), borderLow: read('borderLow', false) }
        : { kind: 'upper', low: read('low', true), high: read('high', false), borderHigh: read('borderHigh', false) };
    });
    if (error) {
      message.textContent = error;
      return;
    }
    const birthDate = $('birth-date').value;
    if (!birthDate) {
      message.textContent = '生年月日を入力してください。';
      return;
    }
    saveSettings(localStorage, { birthDate, references });
    message.textContent = '設定を保存しました。判定にただちに反映されます。';
  });

  $('reset-references').addEventListener('click', () => {
    if (!confirm('すべての基準値を初期値に戻しますか？')) return;
    saveSettings(localStorage, { birthDate: $('birth-date').value || settings.birthDate, references: DEFAULT_REFERENCES });
    renderSettingsView(container);
  });

  // ファイル入出力
  const fileMessage = $('file-backup-message');
  $('export-file-btn').addEventListener('click', () => {
    const payload = buildBackupPayload(loadRecords(localStorage), loadSettings(localStorage));
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kensa-app-backup-${formatDate(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  $('import-file-btn').addEventListener('click', () => $('import-file-input').click());
  $('import-file-input').addEventListener('change', async () => {
    const input = $('import-file-input');
    const file = input.files[0];
    input.value = '';
    if (!file) return;
    try {
      const data = validateBackupData(JSON.parse(await file.text()));
      const current = loadRecords(localStorage).length;
      if (!confirm(`${data.records.length}件を取り込みます。現在の${current}件は置き換えられます。よろしいですか？`)) return;
      saveRecords(localStorage, data.records);
      if (data.settings) saveSettings(localStorage, data.settings);
      fileMessage.textContent = `${data.records.length}件を取り込みました。`;
    } catch {
      fileMessage.textContent = 'ファイルの形式が正しくありません。';
    }
  });

  // GitHubバックアップUI(app-sync)
  import('https://taka070600538-tech.github.io/app-sync/v1/sync.js')
    .then((sync) => sync.renderSyncSettings($('backup-section')))
    .catch(() => {
      $('backup-section').innerHTML =
        '<p class="panel-note">バックアップ機能は現在利用できません(オフラインの可能性)。</p>';
    });
}
