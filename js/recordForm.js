import { ITEMS, GRADE_VALUES, GRADE_LABELS, CATEGORIES } from './items.js';
import { calcNonHdl, estimateEgfr, calcAge, formatDate } from './calc.js';
import { loadRecords, saveRecords, upsertRecord } from './records.js';
import { loadSettings } from './settings.js';

let editingId = null;

export function startEdit(id) {
  editingId = id;
}

export function consumeEditingId() {
  const id = editingId;
  editingId = null;
  return id;
}

function numberField(item) {
  return `
    <label class="form-label">${item.label}${item.unit ? `(${item.unit})` : ''}
      <input class="form-input" type="number" inputmode="decimal" step="${item.step}"
        id="f-${item.key}" placeholder="例: ${item.example}">
    </label>`;
}

function gradeField(item) {
  const options = ['<option value="">未入力</option>']
    .concat(GRADE_VALUES.map((v) => `<option value="${v}">${GRADE_LABELS[v]}</option>`))
    .join('');
  return `
    <label class="form-label">${item.label}
      <select class="form-select" id="f-${item.key}">${options}</select>
    </label>`;
}

export function renderRecordForm(container) {
  const records = loadRecords(localStorage);
  const settings = loadSettings(localStorage);
  const editId = consumeEditingId();
  const editing = records.find((r) => r.id === editId) || null;

  const itemFields = CATEGORIES.map((cat) => {
    const fields = ITEMS.filter((i) => i.category === cat)
      .map((i) => (i.type === 'grade' ? gradeField(i) : numberField(i)))
      .join('');
    return `<section class="panel"><h2 class="panel-title">${cat}</h2><div class="input-grid">${fields}</div></section>`;
  }).join('');

  container.innerHTML = `
    <section class="panel">
      <h2 class="panel-title">${editing ? '検査データの編集' : '新規検査データの追加'}</h2>
      <p class="panel-note">健康診断や血液検査の結果表を見ながら入力してください。未入力の項目は空欄のままで構いません。</p>
      <label class="form-label">検査日(必須)
        <input class="form-input" type="date" id="f-date">
      </label>
      <p class="panel-note" id="age-note"></p>
      <label class="form-label">検査施設
        <input class="form-input" type="text" id="f-facility" placeholder="例: 〇〇健診センター">
      </label>
      <label class="form-label">食後時間(空腹時は空欄)
        <input class="form-input" type="number" inputmode="decimal" step="0.5" id="f-postMealHours" placeholder="例: 2.5">
      </label>
    </section>
    ${itemFields}
    <section class="panel">
      <h2 class="panel-title">治療・メモ</h2>
      <label class="form-label">現在の治療・処方内容
        <textarea class="form-textarea" id="f-currentTreatment" placeholder="例: メトホルミン250mg 朝夕服用"></textarea>
      </label>
      <label class="form-label">変更後治療・指示
        <textarea class="form-textarea" id="f-newTreatment" placeholder="例: 生活習慣改善(ウォーキング・食事コントロール)"></textarea>
      </label>
      <label class="form-label">備考・メモ
        <textarea class="form-textarea" id="f-memo" placeholder="体調や医師のコメントなど"></textarea>
      </label>
    </section>
    <section class="panel">
      <button type="button" class="save-btn" id="save-btn">データを保存</button>
      <p class="save-message" id="save-message" role="status"></p>
      <p class="panel-note">non-HDLは総コレとHDLから、eGFRは未入力ならクレアチニンと年齢から自動計算されます。</p>
    </section>
  `;

  const $ = (id) => container.querySelector(`#${id}`);
  const dateInput = $('f-date');
  const ageNote = $('age-note');

  const updateAge = () => {
    const age = calcAge(settings.birthDate, dateInput.value);
    ageNote.textContent = age == null
      ? '満年齢: 検査日を入力すると自動計算されます'
      : `満年齢(検査日時点): ${age} 歳`;
  };
  dateInput.addEventListener('input', updateAge);

  // non-HDL自動計算: ユーザーが手入力したら以後は上書きしない
  const nonHdlInput = $('f-nonHdl');
  let nonHdlTouched = false;
  nonHdlInput.addEventListener('input', () => { nonHdlTouched = true; });
  const autoNonHdl = () => {
    if (nonHdlTouched) return;
    const tc = $('f-tc').value === '' ? null : Number($('f-tc').value);
    const hdl = $('f-hdl').value === '' ? null : Number($('f-hdl').value);
    const v = calcNonHdl(tc, hdl);
    if (v != null) nonHdlInput.value = v;
  };
  $('f-tc').addEventListener('input', autoNonHdl);
  $('f-hdl').addEventListener('input', autoNonHdl);

  // 編集時: 既存値を流し込む
  if (editing) {
    dateInput.value = editing.date;
    $('f-facility').value = editing.facility || '';
    $('f-postMealHours').value = editing.postMealHours ?? '';
    for (const item of ITEMS) $(`f-${item.key}`).value = editing[item.key] ?? '';
    $('f-currentTreatment').value = editing.currentTreatment || '';
    $('f-newTreatment').value = editing.newTreatment || '';
    $('f-memo').value = editing.memo || '';
    nonHdlTouched = editing.nonHdl != null;
  } else {
    dateInput.value = formatDate(new Date());
  }
  updateAge();

  $('save-btn').addEventListener('click', () => {
    const message = $('save-message');
    if (!dateInput.value) {
      message.textContent = '検査日を入力してください。';
      return;
    }
    const num = (key) => {
      const raw = $(`f-${key}`).value.trim();
      if (raw === '') return null;
      const v = Number(raw);
      return Number.isFinite(v) ? v : NaN;
    };
    const values = {};
    for (const item of ITEMS) {
      if (item.type === 'grade') {
        values[item.key] = $(`f-${item.key}`).value || null;
      } else {
        values[item.key] = num(item.key);
        if (Number.isNaN(values[item.key])) {
          message.textContent = `${item.label} は半角数値で入力してください。`;
          return;
        }
      }
    }
    if (ITEMS.every((item) => values[item.key] == null)) {
      message.textContent = '検査値を1つ以上入力してください。';
      return;
    }
    // eGFR自動推算(未入力時のみ)
    const age = calcAge(settings.birthDate, dateInput.value);
    if (values.egfr == null && values.cre != null && age != null) {
      values.egfr = estimateEgfr(values.cre, age);
    }
    const postMeal = num('postMealHours');
    if (Number.isNaN(postMeal)) {
      message.textContent = '食後時間は半角数値で入力してください。';
      return;
    }
    const record = {
      id: editing ? editing.id : crypto.randomUUID(),
      date: dateInput.value,
      facility: $('f-facility').value.trim(),
      postMealHours: postMeal,
      ...values,
      currentTreatment: $('f-currentTreatment').value.trim(),
      newTreatment: $('f-newTreatment').value.trim(),
      memo: $('f-memo').value.trim(),
      createdAt: editing ? editing.createdAt : new Date().toISOString(),
    };
    saveRecords(localStorage, upsertRecord(loadRecords(localStorage), record));
    document.dispatchEvent(new CustomEvent('kensa:goto', { detail: { view: editing ? 'history' : 'dashboard' } }));
  });
}
