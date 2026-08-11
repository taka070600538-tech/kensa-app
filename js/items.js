// 検査項目マスタ。type: 'number'(数値) | 'grade'(定性)。
// 表示順=この配列順(履歴テーブル・入力フォーム・グラフ選択で共通)。
export const GRADE_VALUES = ['-', '+-', '+', '++'];
export const GRADE_LABELS = {
  '-': '陰性 (-)',
  '+-': '擬陽性 (±)',
  '+': '陽性 (+)',
  '++': '強陽性 (++)',
};

export const CATEGORIES = ['糖代謝', '脂質代謝', '肝機能', '腎機能', '尿酸・その他'];

export const ITEMS = [
  { key: 'fbs', label: '空腹時血糖', short: '空腹時血糖', unit: 'mg/dL', category: '糖代謝', type: 'number', step: 1, example: '95' },
  { key: 'hba1c', label: 'HbA1c', short: 'HbA1c', unit: '%', category: '糖代謝', type: 'number', step: 0.1, example: '5.4' },
  { key: 'urineGlucose', label: '尿糖', short: '尿糖', unit: '', category: '糖代謝', type: 'grade' },
  { key: 'hdl', label: 'HDLコレステロール', short: 'HDL', unit: 'mg/dL', category: '脂質代謝', type: 'number', step: 1, example: '55' },
  { key: 'ldl', label: 'LDLコレステロール', short: 'LDL', unit: 'mg/dL', category: '脂質代謝', type: 'number', step: 1, example: '110' },
  { key: 'tc', label: '総コレステロール', short: '総コレ', unit: 'mg/dL', category: '脂質代謝', type: 'number', step: 1, example: '200' },
  { key: 'nonHdl', label: 'non-HDLコレステロール', short: 'non-HDL', unit: 'mg/dL', category: '脂質代謝', type: 'number', step: 1, example: '145' },
  { key: 'tg', label: '中性脂肪', short: '中性脂肪', unit: 'mg/dL', category: '脂質代謝', type: 'number', step: 1, example: '130' },
  { key: 'ast', label: 'AST (GOT)', short: 'AST', unit: 'U/L', category: '肝機能', type: 'number', step: 1, example: '22' },
  { key: 'alt', label: 'ALT (GPT)', short: 'ALT', unit: 'U/L', category: '肝機能', type: 'number', step: 1, example: '18' },
  { key: 'ggt', label: 'γ-GTP', short: 'γ-GTP', unit: 'U/L', category: '肝機能', type: 'number', step: 1, example: '25' },
  { key: 'urineProtein', label: '尿蛋白', short: '尿蛋白', unit: '', category: '腎機能', type: 'grade' },
  { key: 'cre', label: 'クレアチニン', short: 'クレアチニン', unit: 'mg/dL', category: '腎機能', type: 'number', step: 0.01, example: '0.85' },
  { key: 'egfr', label: 'eGFR', short: 'eGFR', unit: 'mL/分/1.73m²', category: '腎機能', type: 'number', step: 0.1, example: '75.2' },
  { key: 'ua', label: '尿酸', short: '尿酸', unit: 'mg/dL', category: '尿酸・その他', type: 'number', step: 0.1, example: '5.8' },
];

export const ITEM_MAP = Object.fromEntries(ITEMS.map((i) => [i.key, i]));
export const NUMBER_KEYS = ITEMS.filter((i) => i.type === 'number').map((i) => i.key);
