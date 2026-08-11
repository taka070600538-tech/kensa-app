# 検査記録アプリ (kensa-app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 健康診断・血液検査の15項目を記録し、基準値判定・自動コメント・推移グラフで追跡する個人用静的PWAを構築し、GitHub Pagesで公開する。

**Architecture:** ビルド不要のvanilla JS(ESM)+自前SVGグラフ。純ロジック(判定・計算・CRUD・SVG生成)とUI(5タブのビュー)を分離し、純ロジックのみnode:testでテストする。データはlocalStorage、app-sync共通基盤で1日1回GitHubに自動バックアップ。bp-app(`Git\血圧手帳アプリ`)の構成・コード規約を踏襲する。

**Tech Stack:** vanilla JS (ES Modules) / node:test(依存ゼロ) / GitHub Pages / app-sync基盤

## Global Constraints

- 依存パッケージゼロ。`package.json` は `"type": "module"`、テストは `node --test tests/*.test.js`
- UI文言・コメント・コミットメッセージはすべて日本語
- localStorageキー: レコード=`kensa-app:records`、設定=`kensa-app:settings`
- app-sync: `https://taka070600538-tech.github.io/app-sync/v1/sync.js` を動的import、appId=`kensa-app`。このURLは `sw.js` でキャッシュしない
- GitHubリポジトリ: `taka070600538-tech/kensa-app`(公開)、GitHub Pagesで配信
- 数値未入力は `null` で表現。定性値は `'-' | '+-' | '+' | '++' | null`
- 判定は `'normal' | 'border' | 'warning' | null`(未入力)の3段階+null
- コミットメッセージ末尾には各エージェントの標準Co-Authored-Byトレーラーを付ける
- 作業ディレクトリ: `D:\Obsidian Vault for Claude Code\Git\検査記録アプリ`(git初期化済み、設計書コミット済み)

**仕様書:** `docs/superpowers/specs/2026-08-11-kensa-app-design.md`(基準値表・画面仕様の正はこちら)

---

### Task 1: プロジェクト土台+検査項目マスタ (items.js)

**Files:**
- Create: `package.json`, `.gitignore`, `tools/serve.js`, `js/items.js`
- Test: `tests/items.test.js`

**Interfaces:**
- Produces: `ITEMS`(配列: `{ key, label, short, unit, category, type, step?, example? }`)、`ITEM_MAP`(key→定義)、`GRADE_VALUES = ['-','+-','+','++']`、`GRADE_LABELS`(表示名)、`NUMBER_KEYS`(数値13項目のkey配列)、`CATEGORIES`(カテゴリ名配列)

- [ ] **Step 1: 土台ファイルを作成**

`package.json`:

```json
{
  "name": "kensa-app",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test tests/*.test.js"
  }
}
```

`.gitignore`:

```
node_modules/
```

`tools/serve.js`(bp-appと同一の最小静的サーバー):

```js
// 開発確認用の最小静的サーバー(依存なし)。本番はGitHub Pagesで配信する。
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const port = 8124;
const types = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

http.createServer((req, res) => {
  const urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  let file = path.join(root, urlPath === '/' ? 'index.html' : urlPath.slice(1));
  if (!file.startsWith(root) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' });
  fs.createReadStream(file).pipe(res);
}).listen(port, () => console.log(`http://localhost:${port}`));
```

- [ ] **Step 2: 失敗するテストを書く**

`tests/items.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, ITEM_MAP, GRADE_VALUES, GRADE_LABELS, NUMBER_KEYS, CATEGORIES } from '../js/items.js';

test('項目マスタ: 15項目(数値13+定性2)が定義されている', () => {
  assert.equal(ITEMS.length, 15);
  assert.equal(NUMBER_KEYS.length, 13);
  assert.equal(ITEMS.filter((i) => i.type === 'grade').length, 2);
});

test('項目マスタ: 期待するkeyがすべて存在する', () => {
  const keys = ITEMS.map((i) => i.key);
  for (const k of ['fbs', 'hba1c', 'urineGlucose', 'urineProtein', 'hdl', 'ldl', 'tc',
    'nonHdl', 'tg', 'ast', 'alt', 'ggt', 'cre', 'egfr', 'ua']) {
    assert.ok(keys.includes(k), `${k} がある`);
  }
});

test('項目マスタ: ITEM_MAPで引ける・カテゴリが5種', () => {
  assert.equal(ITEM_MAP.fbs.label, '空腹時血糖');
  assert.equal(ITEM_MAP.egfr.unit, 'mL/分/1.73m²');
  assert.deepEqual(CATEGORIES, ['糖代謝', '脂質代謝', '肝機能', '腎機能', '尿酸・その他']);
});

test('定性値: 4段階と表示名', () => {
  assert.deepEqual(GRADE_VALUES, ['-', '+-', '+', '++']);
  assert.equal(GRADE_LABELS['+-'], '擬陽性 (±)');
});
```

- [ ] **Step 3: テストが失敗することを確認**

Run: `node --test tests/items.test.js`
Expected: FAIL(`js/items.js` が存在しない)

- [ ] **Step 4: items.js を実装**

`js/items.js`:

```js
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
```

- [ ] **Step 5: テストが通ることを確認**

Run: `node --test tests/items.test.js`
Expected: PASS(4件)

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "プロジェクト土台と検査項目マスタを追加"
```

---

### Task 2: 計算ロジック (calc.js)

**Files:**
- Create: `js/calc.js`
- Test: `tests/calc.test.js`

**Interfaces:**
- Produces: `calcNonHdl(tc, hdl)`→number|null、`estimateEgfr(cre, age)`→number|null(男性式)、`calcAge(birthDate, onDate)`→number|null(YYYY-MM-DD文字列2つ)、`formatDate(date)`→'YYYY-MM-DD'(ローカル時刻)

- [ ] **Step 1: 失敗するテストを書く**

`tests/calc.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcNonHdl, estimateEgfr, calcAge, formatDate } from '../js/calc.js';

test('calcNonHdl: 総コレ−HDL。どちらか欠けたらnull', () => {
  assert.equal(calcNonHdl(198, 45), 153);
  assert.equal(calcNonHdl(null, 45), null);
  assert.equal(calcNonHdl(198, null), null);
});

test('estimateEgfr: 日本腎臓学会式(男性)で小数1桁', () => {
  // 194 * 0.89^-1.094 * 49^-0.287 = 71.5前後
  const v = estimateEgfr(0.89, 49);
  assert.ok(Math.abs(v - 71.7) < 1.0, `計算値 ${v} が想定範囲`);
  assert.equal(v, Math.round(v * 10) / 10);
  assert.equal(estimateEgfr(null, 49), null);
  assert.equal(estimateEgfr(0.89, null), null);
});

test('calcAge: 誕生日前後で満年齢が変わる', () => {
  assert.equal(calcAge('1976-09-29', '2026-09-28'), 49);
  assert.equal(calcAge('1976-09-29', '2026-09-29'), 50);
  assert.equal(calcAge('1976-09-29', '2026-06-20'), 49);
  assert.equal(calcAge('', '2026-06-20'), null);
  assert.equal(calcAge('invalid', '2026-06-20'), null);
});

test('formatDate: ローカル日付をYYYY-MM-DDに', () => {
  assert.equal(formatDate(new Date(2026, 7, 11)), '2026-08-11');
  assert.equal(formatDate(new Date(2026, 0, 5)), '2026-01-05');
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/calc.test.js`
Expected: FAIL(`js/calc.js` が存在しない)

- [ ] **Step 3: calc.js を実装**

`js/calc.js`:

```js
// 検査値まわりの純計算ロジック。
export function calcNonHdl(tc, hdl) {
  if (tc == null || hdl == null) return null;
  return tc - hdl;
}

// 日本腎臓学会のeGFR推算式(男性)。cre: 血清クレアチニン mg/dL、age: 満年齢。
export function estimateEgfr(cre, age) {
  if (cre == null || age == null || cre <= 0 || age <= 0) return null;
  return Math.round(194 * Math.pow(cre, -1.094) * Math.pow(age, -0.287) * 10) / 10;
}

// 'YYYY-MM-DD'文字列2つから満年齢を計算。不正な日付はnull。
export function calcAge(birthDate, onDate) {
  if (!birthDate || !onDate) return null;
  const b = new Date(`${birthDate}T00:00:00`);
  const d = new Date(`${onDate}T00:00:00`);
  if (Number.isNaN(b.getTime()) || Number.isNaN(d.getTime())) return null;
  let age = d.getFullYear() - b.getFullYear();
  const beforeBirthday =
    d.getMonth() < b.getMonth() ||
    (d.getMonth() === b.getMonth() && d.getDate() < b.getDate());
  return beforeBirthday ? age - 1 : age;
}

export function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/calc.test.js`
Expected: PASS(4件)

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "non-HDL・eGFR推算・満年齢の計算ロジックを追加"
```

---

### Task 3: 基準値と判定ロジック (reference.js) + 設定の保存 (settings.js)

**Files:**
- Create: `js/reference.js`, `js/settings.js`
- Test: `tests/reference.test.js`, `tests/settings.test.js`

**Interfaces:**
- Consumes: `NUMBER_KEYS`(items.js)
- Produces:
  - `DEFAULT_REFERENCES`(key→`{ kind:'upper', low, high, borderHigh }` または `{ kind:'lower', low, borderLow }`。lowはnull可)
  - `judgeNumber(value, ref)`→`'normal'|'border'|'warning'|null`
  - `judgeGrade(value)`→同上(定性値用)
  - `judgeRecord(record, references)`→`{ [key]: judgment }`(15項目すべて)
  - `describeRange(ref, unit)`→基準値の説明文字列(例: '70〜99 mg/dL')
  - settings.js: `DEFAULT_BIRTH_DATE='1976-09-29'`、`loadSettings(storage)`→`{ birthDate, references }`(デフォルトとマージ済み)、`saveSettings(storage, settings)`

- [ ] **Step 1: 失敗するテストを書く**

`tests/reference.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_REFERENCES, judgeNumber, judgeGrade, judgeRecord, describeRange } from '../js/reference.js';
import { NUMBER_KEYS } from '../js/items.js';

test('基準値: 数値13項目すべてにデフォルトがある', () => {
  for (const key of NUMBER_KEYS) {
    assert.ok(DEFAULT_REFERENCES[key], `${key} の基準値がある`);
  }
});

test('judgeNumber(上限型): 境界値ちょうどを含めて3段階判定', () => {
  const ref = DEFAULT_REFERENCES.fbs; // 70-99 / 100-125 / >=126
  assert.equal(judgeNumber(99, ref), 'normal');
  assert.equal(judgeNumber(100, ref), 'border');
  assert.equal(judgeNumber(125, ref), 'border');
  assert.equal(judgeNumber(126, ref), 'warning');
  assert.equal(judgeNumber(69, ref), 'warning'); // 下限割れ
  assert.equal(judgeNumber(null, ref), null);
});

test('judgeNumber(下限型): HDLは低いほど悪い', () => {
  const ref = DEFAULT_REFERENCES.hdl; // >=40 / 35-39 / <35
  assert.equal(judgeNumber(40, ref), 'normal');
  assert.equal(judgeNumber(39, ref), 'border');
  assert.equal(judgeNumber(35, ref), 'border');
  assert.equal(judgeNumber(34, ref), 'warning');
});

test('judgeNumber(下限なし上限型): ASTは低値でも正常', () => {
  const ref = DEFAULT_REFERENCES.ast; // <=30 / 31-35 / >=36
  assert.equal(judgeNumber(5, ref), 'normal');
  assert.equal(judgeNumber(31, ref), 'border');
  assert.equal(judgeNumber(36, ref), 'warning');
});

test('judgeGrade: 陰性のみ正常、±は境界、+以上は要注意', () => {
  assert.equal(judgeGrade('-'), 'normal');
  assert.equal(judgeGrade('+-'), 'border');
  assert.equal(judgeGrade('+'), 'warning');
  assert.equal(judgeGrade('++'), 'warning');
  assert.equal(judgeGrade(null), null);
});

test('judgeRecord: 全15項目の判定を返す', () => {
  const record = { fbs: 96, hba1c: 6.6, urineGlucose: '-', urineProtein: '+-', hdl: 34 };
  const j = judgeRecord(record, DEFAULT_REFERENCES);
  assert.equal(j.fbs, 'normal');
  assert.equal(j.hba1c, 'warning');
  assert.equal(j.urineGlucose, 'normal');
  assert.equal(j.urineProtein, 'border');
  assert.equal(j.hdl, 'warning');
  assert.equal(j.ldl, null); // 未入力
  assert.equal(Object.keys(j).length, 15);
});

test('judgeRecord: カスタム基準値が反映される', () => {
  const refs = { ...DEFAULT_REFERENCES, ldl: { kind: 'upper', low: 60, high: 99, borderHigh: 119 } };
  assert.equal(judgeRecord({ ldl: 110 }, refs).ldl, 'border');
});

test('describeRange: 範囲の説明文字列', () => {
  assert.equal(describeRange(DEFAULT_REFERENCES.fbs, 'mg/dL'), '70〜99 mg/dL');
  assert.equal(describeRange(DEFAULT_REFERENCES.hdl, 'mg/dL'), '40 mg/dL 以上');
  assert.equal(describeRange(DEFAULT_REFERENCES.ast, 'U/L'), '30 U/L 以下');
});
```

`tests/settings.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSettings, saveSettings, DEFAULT_BIRTH_DATE } from '../js/settings.js';
import { DEFAULT_REFERENCES } from '../js/reference.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('loadSettings: 空ストレージならデフォルト設定', () => {
  const s = loadSettings(fakeStorage());
  assert.equal(s.birthDate, DEFAULT_BIRTH_DATE);
  assert.deepEqual(s.references, DEFAULT_REFERENCES);
});

test('loadSettings: 保存済み基準値がデフォルトとマージされる', () => {
  const storage = fakeStorage({
    'kensa-app:settings': JSON.stringify({
      birthDate: '1980-01-01',
      references: { ldl: { kind: 'upper', low: 60, high: 99, borderHigh: 119 } },
    }),
  });
  const s = loadSettings(storage);
  assert.equal(s.birthDate, '1980-01-01');
  assert.equal(s.references.ldl.high, 99);
  assert.deepEqual(s.references.fbs, DEFAULT_REFERENCES.fbs); // 未保存項目はデフォルト
});

test('loadSettings: 壊れたJSONはデフォルトに戻す', () => {
  const s = loadSettings(fakeStorage({ 'kensa-app:settings': '{broken' }));
  assert.equal(s.birthDate, DEFAULT_BIRTH_DATE);
});

test('saveSettings→loadSettingsで往復できる', () => {
  const storage = fakeStorage();
  saveSettings(storage, { birthDate: '1976-09-29', references: DEFAULT_REFERENCES });
  assert.deepEqual(loadSettings(storage).references, DEFAULT_REFERENCES);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/reference.test.js tests/settings.test.js`
Expected: FAIL(モジュールが存在しない)

- [ ] **Step 3: reference.js と settings.js を実装**

`js/reference.js`:

```js
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
```

`js/settings.js`:

```js
import { DEFAULT_REFERENCES } from './reference.js';

const KEY = 'kensa-app:settings';
export const DEFAULT_BIRTH_DATE = '1976-09-29';

// 保存された設定をデフォルトとマージして返す(項目追加時に壊れないように)。
export function loadSettings(storage) {
  let parsed = {};
  try {
    const raw = storage.getItem(KEY);
    parsed = raw ? JSON.parse(raw) : {};
    if (typeof parsed !== 'object' || parsed === null) parsed = {};
  } catch {
    parsed = {};
  }
  const references = {};
  for (const [key, def] of Object.entries(DEFAULT_REFERENCES)) {
    references[key] = { ...def, ...(parsed.references?.[key] ?? {}) };
  }
  return { birthDate: parsed.birthDate || DEFAULT_BIRTH_DATE, references };
}

export function saveSettings(storage, settings) {
  storage.setItem(KEY, JSON.stringify(settings));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/reference.test.js tests/settings.test.js`
Expected: PASS(12件)

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "基準値デフォルト・3段階判定・設定の保存を追加"
```

---

### Task 4: 自動コメント生成 (comments.js)

**Files:**
- Create: `js/comments.js`
- Test: `tests/comments.test.js`

**Interfaces:**
- Consumes: `judgeNumber`(reference.js)
- Produces: `buildComments(record, references)`→string[](該当コメントの配列。すべて良好なら固定文言1件)

- [ ] **Step 1: 失敗するテストを書く**

`tests/comments.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildComments } from '../js/comments.js';
import { DEFAULT_REFERENCES } from '../js/reference.js';

const refs = DEFAULT_REFERENCES;

test('すべて基準内なら良好メッセージ1件', () => {
  const record = { fbs: 96, hba1c: 5.4, hdl: 45, ldl: 114, tg: 98, alt: 21, egfr: 71.5, ua: 6.1 };
  assert.deepEqual(buildComments(record, refs), ['すべての主要項目が良好です！']);
});

test('糖代謝: 糖尿病域(fbs>=126またはhba1c>=6.5)', () => {
  assert.ok(buildComments({ fbs: 130 }, refs).includes('糖代謝：糖尿病域の数値です'));
  assert.ok(buildComments({ hba1c: 6.5 }, refs).includes('糖代謝：糖尿病域の数値です'));
});

test('糖代謝: 境界型(fbs 100-125またはhba1c 5.6-6.4)', () => {
  assert.ok(buildComments({ fbs: 112 }, refs).includes('糖代謝：境界型（糖尿病予備軍）'));
});

test('低血糖(fbs<70)では糖尿病域コメントを出さない', () => {
  const comments = buildComments({ fbs: 60 }, refs);
  assert.ok(!comments.includes('糖代謝：糖尿病域の数値です'));
  assert.ok(comments.includes('糖代謝：空腹時血糖が基準値未満です'));
});

test('脂質代謝: LDLと中性脂肪', () => {
  assert.ok(buildComments({ ldl: 152 }, refs).includes('脂質代謝：高LDLコレステロール血症'));
  assert.ok(buildComments({ ldl: 132 }, refs).includes('脂質代謝：軽度高コレステロール'));
  assert.ok(buildComments({ tg: 320 }, refs).includes('脂質代謝：高トリグリセリド（中性脂肪）血症'));
  assert.ok(buildComments({ tg: 185 }, refs).includes('脂質代謝：中性脂肪軽度高値（境界域）'));
});

test('肝機能: ALT', () => {
  assert.ok(buildComments({ alt: 41 }, refs).includes('肝機能：ALT（GPT）上昇'));
  assert.ok(buildComments({ alt: 34 }, refs).includes('肝機能：ALT軽度高値'));
});

test('腎機能と尿酸', () => {
  assert.ok(buildComments({ egfr: 55 }, refs).includes('腎機能：eGFRの低下'));
  assert.ok(buildComments({ ua: 7.2 }, refs).includes('尿酸値：高尿酸血症'));
});

test('複数該当なら複数件返る', () => {
  const comments = buildComments({ fbs: 112, ldl: 152, ua: 7.2 }, refs);
  assert.equal(comments.length, 3);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/comments.test.js`
Expected: FAIL(`js/comments.js` が存在しない)

- [ ] **Step 3: comments.js を実装**

`js/comments.js`:

```js
import { judgeNumber } from './reference.js';

// 最新レコードの値から医学的な注意コメントを生成する(表示はダッシュボード)。
// 値の方向(高値/低値)を区別するため、judgeの結果ではなく値と基準値で判定する。
export function buildComments(record, references) {
  const comments = [];
  const j = (key) => judgeNumber(record[key], references[key]);

  // 糖代謝
  const fbsRef = references.fbs;
  const fbsHigh = record.fbs != null && record.fbs > fbsRef.borderHigh;
  const fbsBorder = record.fbs != null && record.fbs > fbsRef.high && record.fbs <= fbsRef.borderHigh;
  const fbsLow = record.fbs != null && fbsRef.low != null && record.fbs < fbsRef.low;
  const a1cRef = references.hba1c;
  const a1cHigh = record.hba1c != null && record.hba1c > a1cRef.borderHigh;
  const a1cBorder = record.hba1c != null && record.hba1c > a1cRef.high && record.hba1c <= a1cRef.borderHigh;
  if (fbsHigh || a1cHigh) comments.push('糖代謝：糖尿病域の数値です');
  else if (fbsBorder || a1cBorder) comments.push('糖代謝：境界型（糖尿病予備軍）');
  if (fbsLow) comments.push('糖代謝：空腹時血糖が基準値未満です');

  // 脂質代謝
  if (j('ldl') === 'warning' && record.ldl > references.ldl.high) comments.push('脂質代謝：高LDLコレステロール血症');
  else if (j('ldl') === 'border') comments.push('脂質代謝：軽度高コレステロール');
  if (j('tg') === 'warning' && record.tg > references.tg.high) comments.push('脂質代謝：高トリグリセリド（中性脂肪）血症');
  else if (j('tg') === 'border') comments.push('脂質代謝：中性脂肪軽度高値（境界域）');

  // 肝機能
  if (j('alt') === 'warning' && record.alt > references.alt.high) comments.push('肝機能：ALT（GPT）上昇');
  else if (j('alt') === 'border') comments.push('肝機能：ALT軽度高値');

  // 腎機能
  if (record.egfr != null && record.egfr < references.egfr.low) comments.push('腎機能：eGFRの低下');

  // 尿酸
  if (record.ua != null && record.ua > references.ua.high) comments.push('尿酸値：高尿酸血症');

  return comments.length ? comments : ['すべての主要項目が良好です！'];
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/comments.test.js`
Expected: PASS(8件)

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "基準値判定にもとづく自動コメント生成を追加"
```

---

### Task 5: レコードのCRUDと検索 (records.js)

**Files:**
- Create: `js/records.js`
- Test: `tests/records.test.js`

**Interfaces:**
- Produces: `loadRecords(storage)`、`saveRecords(storage, records)`、`upsertRecord(records, record)`(id一致は置換、date昇順ソート)、`deleteRecord(records, id)`、`searchRecords(records, query)`(date/facility/currentTreatment/newTreatment/memoの部分一致)、`latestRecord(records)`(最新日付、同日ならcreatedAt降順)、`sortByDateDesc(records)`
- レコード形式(仕様書と同一): `{ id, date, facility, postMealHours, fbs, hba1c, urineGlucose, urineProtein, hdl, ldl, tc, nonHdl, tg, ast, alt, ggt, cre, egfr, ua, currentTreatment, newTreatment, memo, createdAt }`

- [ ] **Step 1: 失敗するテストを書く**

`tests/records.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadRecords, saveRecords, upsertRecord, deleteRecord,
  searchRecords, latestRecord, sortByDateDesc,
} from '../js/records.js';

function fakeStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

const rec = (id, date, extra = {}) => ({ id, date, createdAt: `${date}T09:00:00.000Z`, ...extra });

test('upsertRecord: 新規追加はdate昇順に並ぶ', () => {
  const records = upsertRecord(upsertRecord([], rec('b', '2026-06-20')), rec('a', '2025-12-15'));
  assert.deepEqual(records.map((r) => r.id), ['a', 'b']);
});

test('upsertRecord: 同じidは置換される(同日複数レコードは共存できる)', () => {
  let records = [rec('a', '2026-06-20', { fbs: 96 }), rec('b', '2026-06-20', { fbs: 104 })];
  records = upsertRecord(records, rec('a', '2026-06-20', { fbs: 99 }));
  assert.equal(records.length, 2);
  assert.equal(records.find((r) => r.id === 'a').fbs, 99);
});

test('deleteRecord: idで削除', () => {
  const records = deleteRecord([rec('a', '2026-06-20'), rec('b', '2026-06-21')], 'a');
  assert.deepEqual(records.map((r) => r.id), ['b']);
});

test('load/saveRecords: 往復できる。壊れたJSONは空配列', () => {
  const storage = fakeStorage();
  saveRecords(storage, [rec('a', '2026-06-20')]);
  assert.equal(loadRecords(storage).length, 1);
  assert.deepEqual(loadRecords(fakeStorage({ 'kensa-app:records': '{broken' })), []);
});

test('searchRecords: 日付・施設・治療内容・備考の部分一致(大文字小文字無視)', () => {
  const records = [
    rec('a', '2026-06-20', { facility: '丸の内健診センター', currentTreatment: '', newTreatment: '', memo: '' }),
    rec('b', '2025-12-15', { facility: '', currentTreatment: 'メトホルミン250mg', newTreatment: '', memo: '' }),
    rec('c', '2025-06-10', { facility: '', currentTreatment: '', newTreatment: '', memo: '運動を継続' }),
  ];
  assert.deepEqual(searchRecords(records, '丸の内').map((r) => r.id), ['a']);
  assert.deepEqual(searchRecords(records, 'メトホルミン').map((r) => r.id), ['b']);
  assert.deepEqual(searchRecords(records, '2025').map((r) => r.id), ['b', 'c']);
  assert.deepEqual(searchRecords(records, '運動').map((r) => r.id), ['c']);
  assert.equal(searchRecords(records, '').length, 3);
});

test('latestRecord: 最新日付を返す。同日ならcreatedAtが新しい方', () => {
  assert.equal(latestRecord([]), null);
  const records = [
    rec('a', '2026-06-20'),
    { id: 'b', date: '2026-06-20', createdAt: '2026-06-20T12:00:00.000Z' },
    rec('c', '2025-12-15'),
  ];
  assert.equal(latestRecord(records).id, 'b');
});

test('sortByDateDesc: 降順コピーを返し元配列を壊さない', () => {
  const records = [rec('a', '2025-12-15'), rec('b', '2026-06-20')];
  assert.deepEqual(sortByDateDesc(records).map((r) => r.id), ['b', 'a']);
  assert.deepEqual(records.map((r) => r.id), ['a', 'b']);
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/records.test.js`
Expected: FAIL(`js/records.js` が存在しない)

- [ ] **Step 3: records.js を実装**

`js/records.js`:

```js
// 検査レコードのlocalStorage CRUD。1検査=1レコード(idはUUID、同日複数可)。
const KEY = 'kensa-app:records';

export function loadRecords(storage) {
  try {
    const raw = storage.getItem(KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveRecords(storage, records) {
  storage.setItem(KEY, JSON.stringify(records));
}

export function upsertRecord(records, record) {
  const rest = records.filter((r) => r.id !== record.id);
  return [...rest, record].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function deleteRecord(records, id) {
  return records.filter((r) => r.id !== id);
}

export function searchRecords(records, query) {
  const q = (query || '').trim().toLowerCase();
  if (!q) return records;
  const fields = ['date', 'facility', 'currentTreatment', 'newTreatment', 'memo'];
  return records.filter((r) =>
    fields.some((f) => String(r[f] || '').toLowerCase().includes(q))
  );
}

export function latestRecord(records) {
  if (!records.length) return null;
  return [...records].sort((a, b) =>
    a.date !== b.date ? (a.date < b.date ? -1 : 1) : String(a.createdAt || '') < String(b.createdAt || '') ? -1 : 1
  ).at(-1);
}

export function sortByDateDesc(records) {
  return [...records].sort((a, b) => (a.date > b.date ? -1 : a.date < b.date ? 1 : 0));
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/records.test.js`
Expected: PASS(7件)

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "検査レコードのCRUD・検索・最新取得を追加"
```

---

### Task 6: バックアップpayload (backup.js)

**Files:**
- Create: `js/backup.js`
- Test: `tests/backup.test.js`

**Interfaces:**
- Consumes: なし(純関数)
- Produces: `buildBackupPayload(records, settings, now?)`→`{ version: 1, exportedAt, records, settings }`、`validateBackupData(data)`→data(不正ならthrow)

- [ ] **Step 1: 失敗するテストを書く**

`tests/backup.test.js`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBackupPayload, validateBackupData } from '../js/backup.js';

test('buildBackupPayload: version/exportedAt/records/settingsを含む', () => {
  const now = new Date('2026-08-11T00:00:00Z');
  const payload = buildBackupPayload([{ id: 'a', date: '2026-06-20' }], { birthDate: '1976-09-29' }, now);
  assert.equal(payload.version, 1);
  assert.equal(payload.exportedAt, '2026-08-11T00:00:00.000Z');
  assert.equal(payload.records.length, 1);
  assert.equal(payload.settings.birthDate, '1976-09-29');
});

test('validateBackupData: 正常データはそのまま返す', () => {
  const data = { version: 1, records: [], settings: {} };
  assert.equal(validateBackupData(data), data);
});

test('validateBackupData: settingsなし(旧形式)も許容する', () => {
  assert.ok(validateBackupData({ version: 1, records: [] }));
});

test('validateBackupData: 不正データはthrow', () => {
  assert.throws(() => validateBackupData(null));
  assert.throws(() => validateBackupData({ version: 2, records: [] }));
  assert.throws(() => validateBackupData({ version: 1, records: 'x' }));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/backup.test.js`
Expected: FAIL(`js/backup.js` が存在しない)

- [ ] **Step 3: backup.js を実装**

`js/backup.js`:

```js
// GitHubバックアップ・ファイル入出力で共用するpayloadの構築と検証。
export function buildBackupPayload(records, settings, now = new Date()) {
  return { version: 1, exportedAt: now.toISOString(), records, settings };
}

export function validateBackupData(data) {
  if (!data || data.version !== 1) throw new Error('バックアップデータの形式が不正です(version)');
  if (!Array.isArray(data.records)) throw new Error('バックアップデータの形式が不正です(records)');
  return data;
}
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/backup.test.js`
Expected: PASS(4件)

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "バックアップpayloadの構築と検証を追加"
```

---

### Task 7: 折れ線グラフSVG生成 (chart.js)

**Files:**
- Create: `js/chart.js`
- Test: `tests/chart.test.js`

**Interfaces:**
- Consumes: `ITEM_MAP`, `GRADE_VALUES`(items.js)
- Produces:
  - `GRADE_NUMBER = { '-': 0, '+-': 1, '+': 2, '++': 3 }`
  - `buildSeries(records, key)`→`[{ date, value }]`(date昇順、null値は除外、定性は段階値に変換)
  - `refLinesFor(ref)`→`[{ value, label }]`(上限型: high/borderHigh、下限型: low/borderLow。定性(refなし)は空配列)
  - `buildChartSvg({ points, refLines, unit, width?, height? })`→SVG文字列(polyline+データ点circle+基準破線+軸ラベル)

- [ ] **Step 1: 失敗するテストを書く**

`tests/chart.test.js`:

```js
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
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/chart.test.js`
Expected: FAIL(`js/chart.js` が存在しない)

- [ ] **Step 3: chart.js を実装**

`js/chart.js`:

```js
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
```

- [ ] **Step 4: テストが通ることを確認**

Run: `node --test tests/chart.test.js`
Expected: PASS(4件)

- [ ] **Step 5: 全テストを回してからコミット**

Run: `npm test`
Expected: すべてPASS

```bash
git add -A
git commit -m "推移グラフのSVG生成ロジックを追加"
```

---

### Task 8: アプリシェル (index.html / style.css / app.js / 各ビューのスタブ)

**Files:**
- Create: `index.html`, `style.css`, `js/app.js`, `js/dashboardView.js`, `js/historyView.js`, `js/recordForm.js`, `js/graphView.js`, `js/settingsView.js`

**Interfaces:**
- Produces: 各ビューは `render<Name>View(container)` をexport(この時点ではスタブ)。recordForm.jsは追加で `startEdit(id)` をexport。app.jsはタブ切替+`kensa:edit`/`kensa:goto` CustomEventの購読+SW登録+app-sync組み込み
- Consumes: `loadRecords/saveRecords`(records.js)、`buildBackupPayload/validateBackupData`(backup.js)、`loadSettings/saveSettings`(settings.js)

- [ ] **Step 1: index.html を作成**

```html
<!doctype html>
<html lang="ja">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>検査記録</title>
<meta name="theme-color" content="#1E6FA8">
<link rel="manifest" href="manifest.json">
<link rel="icon" href="icons/icon.svg" type="image/svg+xml">
<link rel="stylesheet" href="style.css">
</head>
<body>
<header class="app-header">
  <div class="app-title">
    <h1>検査記録</h1>
    <span class="app-subtitle">健康診断・血液検査の推移トラッカー</span>
  </div>
</header>

<main id="view-dashboard" class="view"></main>
<main id="view-history" class="view hidden"></main>
<main id="view-add" class="view hidden"></main>
<main id="view-graph" class="view hidden"></main>
<main id="view-settings" class="view hidden"></main>

<nav class="app-nav">
  <button data-view="dashboard" class="nav-btn is-active"><span class="nav-icon">🏠</span>ホーム</button>
  <button data-view="history" class="nav-btn"><span class="nav-icon">📋</span>履歴</button>
  <button data-view="add" class="nav-btn"><span class="nav-icon">✚</span>追加</button>
  <button data-view="graph" class="nav-btn"><span class="nav-icon">📈</span>グラフ</button>
  <button data-view="settings" class="nav-btn"><span class="nav-icon">⚙</span>設定</button>
</nav>

<script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: style.css を作成**

```css
:root {
  --bg: #F2F5F7;
  --panel: #FFFFFF;
  --ink: #1E293B;
  --muted: #64748B;
  --accent: #1E6FA8;
  --accent-dark: #175A88;
  --normal: #15803D;
  --normal-bg: #DCFCE7;
  --border-j: #B45309;
  --border-j-bg: #FEF3C7;
  --warning: #B91C1C;
  --warning-bg: #FEE2E2;
  --line: #E2E8F0;
}
* { box-sizing: border-box; }
body {
  margin: 0;
  font-family: "Hiragino Sans", "Yu Gothic UI", "Noto Sans JP", sans-serif;
  background: var(--bg);
  color: var(--ink);
  padding-bottom: 76px;
}
.app-header { background: var(--accent); color: #fff; padding: 14px 16px; }
.app-title h1 { margin: 0; font-size: 1.15rem; }
.app-subtitle { font-size: 0.75rem; opacity: 0.85; }
.view { max-width: 720px; margin: 0 auto; padding: 12px; }
.hidden { display: none; }

.app-nav {
  position: fixed; bottom: 0; left: 0; right: 0;
  display: flex; background: var(--panel);
  border-top: 1px solid var(--line);
  padding-bottom: env(safe-area-inset-bottom);
}
.nav-btn {
  flex: 1; padding: 8px 0 10px; border: none; background: none;
  font-size: 0.7rem; color: var(--muted); display: flex; flex-direction: column;
  align-items: center; gap: 2px; cursor: pointer;
}
.nav-btn .nav-icon { font-size: 1.15rem; }
.nav-btn.is-active { color: var(--accent); font-weight: 700; }

.panel { background: var(--panel); border-radius: 12px; padding: 14px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08); }
.panel-title { margin: 0 0 8px; font-size: 1rem; color: var(--accent-dark); }
.panel-note { font-size: 0.8rem; color: var(--muted); margin: 4px 0 10px; }

.badge { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 0.72rem; font-weight: 700; }
.badge-normal { background: var(--normal-bg); color: var(--normal); }
.badge-border { background: var(--border-j-bg); color: var(--border-j); }
.badge-warning { background: var(--warning-bg); color: var(--warning); }
.badge-none { background: var(--line); color: var(--muted); }

.item-row { display: flex; align-items: center; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--line); gap: 8px; }
.item-row:last-child { border-bottom: none; }
.item-name { font-size: 0.85rem; }
.item-ref { font-size: 0.7rem; color: var(--muted); }
.item-value { font-weight: 700; font-size: 0.95rem; white-space: nowrap; }
.item-value .unit { font-size: 0.7rem; color: var(--muted); font-weight: 400; }

.comment-list { margin: 0; padding-left: 1.2em; font-size: 0.85rem; }
.comment-list li { margin: 4px 0; }

.form-label { display: block; font-size: 0.8rem; color: var(--muted); margin: 10px 0 4px; }
.form-input, .form-select, .form-textarea {
  width: 100%; padding: 9px 10px; border: 1px solid var(--line); border-radius: 8px;
  font-size: 1rem; background: #fff; color: var(--ink);
}
.form-textarea { min-height: 64px; resize: vertical; }
.input-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 10px; }
.save-btn {
  width: 100%; padding: 12px; margin-top: 10px; border: none; border-radius: 10px;
  background: var(--accent); color: #fff; font-size: 1rem; font-weight: 700; cursor: pointer;
}
.danger-btn { background: var(--warning); }
.ghost-btn { background: var(--panel); color: var(--accent); border: 1px solid var(--accent); }
.save-message { font-size: 0.85rem; color: var(--accent-dark); min-height: 1.2em; }

.table-wrap { overflow-x: auto; }
.history-table { border-collapse: collapse; font-size: 0.78rem; white-space: nowrap; }
.history-table th, .history-table td { padding: 6px 8px; border-bottom: 1px solid var(--line); text-align: right; }
.history-table th { color: var(--muted); font-weight: 600; background: var(--panel); }
.history-table th:first-child, .history-table td:first-child { text-align: left; position: sticky; left: 0; background: var(--panel); }
.history-table tbody tr { cursor: pointer; }
.history-table tbody tr.is-selected { outline: 2px solid var(--accent); outline-offset: -2px; }
.cell-border { color: var(--border-j); font-weight: 700; }
.cell-warning { color: var(--warning); font-weight: 700; }

.trend-chart { width: 100%; height: auto; }
.grid-line { stroke: var(--line); stroke-width: 1; }
.axis-label { font-size: 10px; fill: var(--muted); }
.ref-line { stroke: var(--warning); stroke-width: 1.2; opacity: 0.7; }
.ref-label { font-size: 9px; fill: var(--warning); }
.trend-line { stroke: var(--accent); stroke-width: 2.2; }
.trend-dot { fill: var(--accent-dark); }

.ref-editor-row { display: grid; grid-template-columns: 1fr repeat(3, 72px); gap: 6px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); font-size: 0.8rem; }
.ref-editor-row input { width: 100%; padding: 6px; border: 1px solid var(--line); border-radius: 6px; font-size: 0.85rem; }
.ref-editor-head { color: var(--muted); font-size: 0.72rem; }
```

- [ ] **Step 3: 各ビューのスタブと app.js を作成**

`js/dashboardView.js` / `js/historyView.js` / `js/graphView.js` / `js/settingsView.js`(4ファイル、それぞれ関数名だけ変える):

```js
export function renderDashboardView(container) {
  container.innerHTML = '<section class="panel"><p class="panel-note">準備中</p></section>';
}
```

(関数名はそれぞれ `renderDashboardView` / `renderHistoryView` / `renderGraphView` / `renderSettingsView`)

`js/recordForm.js`(スタブ):

```js
let editingId = null;

// 履歴タブから編集開始するときに呼ばれる(app.js経由)。
export function startEdit(id) {
  editingId = id;
}

export function consumeEditingId() {
  const id = editingId;
  editingId = null;
  return id;
}

export function renderRecordForm(container) {
  container.innerHTML = '<section class="panel"><p class="panel-note">準備中</p></section>';
}
```

`js/app.js`:

```js
import { renderDashboardView } from './dashboardView.js';
import { renderHistoryView } from './historyView.js';
import { renderRecordForm, startEdit } from './recordForm.js';
import { renderGraphView } from './graphView.js';
import { renderSettingsView } from './settingsView.js';
import { loadRecords, saveRecords } from './records.js';
import { loadSettings, saveSettings } from './settings.js';
import { buildBackupPayload, validateBackupData } from './backup.js';

const renderers = {
  dashboard: renderDashboardView,
  history: renderHistoryView,
  add: renderRecordForm,
  graph: renderGraphView,
  settings: renderSettingsView,
};

function switchView(viewName) {
  for (const view of document.querySelectorAll('.view')) {
    view.classList.toggle('hidden', view.id !== `view-${viewName}`);
  }
  for (const btn of document.querySelectorAll('.nav-btn')) {
    btn.classList.toggle('is-active', btn.dataset.view === viewName);
  }
  renderers[viewName](document.getElementById(`view-${viewName}`));
  window.scrollTo(0, 0);
}

function init() {
  document.querySelectorAll('.nav-btn').forEach((btn) => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
  });

  // ビュー間の遷移はCustomEventで疎結合にする(循環importを避ける)。
  document.addEventListener('kensa:edit', (e) => {
    startEdit(e.detail.id);
    switchView('add');
  });
  document.addEventListener('kensa:goto', (e) => switchView(e.detail.view));

  switchView('dashboard');

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }

  // 共有バックアップ基盤は動的import。オフラインやapp-sync障害時は黙ってスキップし、
  // アプリ本体の起動を妨げない(次回オンライン起動時に再試行される)。
  import('https://taka070600538-tech.github.io/app-sync/v1/sync.js')
    .then((sync) => sync.initDailyBackup({
      appId: 'kensa-app',
      collect: async () => buildBackupPayload(loadRecords(localStorage), loadSettings(localStorage)),
      restore: async (data) => {
        validateBackupData(data);
        saveRecords(localStorage, data.records);
        if (data.settings) saveSettings(localStorage, data.settings);
      },
    }))
    .catch(() => {});
}

init();
```

- [ ] **Step 4: 動作確認**

Run: `node tools/serve.js` を起動し、`http://localhost:8124` をブラウザで開く
Expected: ヘッダー+5タブが表示され、タブ切替で「準備中」パネルが出る。コンソールにモジュールエラーがない(sw.js 404は次タスクで解消するため無視)

- [ ] **Step 5: コミット**

```bash
git add -A
git commit -m "アプリシェル(5タブ)とビュースタブを追加"
```

---

### Task 9: 追加/編集フォーム (recordForm.js)

**Files:**
- Modify: `js/recordForm.js`(スタブを実装で置き換え)

**Interfaces:**
- Consumes: `ITEMS/ITEM_MAP/GRADE_VALUES/GRADE_LABELS`(items.js)、`calcNonHdl/estimateEgfr/calcAge/formatDate`(calc.js)、`loadRecords/saveRecords/upsertRecord`(records.js)、`loadSettings`(settings.js)
- Produces: `renderRecordForm(container)`、`startEdit(id)`、`consumeEditingId()`(既存シグネチャ維持)

- [ ] **Step 1: recordForm.js を実装**

```js
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
```

注意: `num('postMealHours')` が動くように、食後時間inputのidは `f-postMealHours` にしてある(上記HTML参照)。

- [ ] **Step 2: 動作確認**

Run: `node tools/serve.js` → ブラウザで「追加」タブを開く
Expected: カテゴリ別の入力フォームが表示される。総コレ200・HDL55を入れるとnon-HDLに145が自動入力される。検査日を入れると満年齢が表示される。保存でダッシュボード(準備中)に遷移し、localStorageの `kensa-app:records` にレコードが入る

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "検査データの追加・編集フォームを実装"
```

---

### Task 10: ダッシュボード (dashboardView.js)

**Files:**
- Modify: `js/dashboardView.js`(スタブを実装で置き換え)

**Interfaces:**
- Consumes: `ITEMS/ITEM_MAP/GRADE_LABELS/CATEGORIES`(items.js)、`judgeRecord/describeRange`(reference.js)、`buildComments`(comments.js)、`loadRecords/latestRecord`(records.js)、`loadSettings`(settings.js)、`calcAge`(calc.js)
- Produces: `renderDashboardView(container)`

- [ ] **Step 1: dashboardView.js を実装**

```js
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
```

- [ ] **Step 2: 動作確認**

Run: `node tools/serve.js` → 「追加」でデータを1件保存 → ダッシュボードに遷移
Expected: 最新結果のメタ情報・所見コメント・カテゴリ別の15項目(値+基準値+バッジ)が表示される。レコード0件時(localStorageクリア後)はウェルカム画面

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "ダッシュボード(最新結果の判定と所見)を実装"
```

---

### Task 11: 履歴一覧+詳細 (historyView.js)

**Files:**
- Modify: `js/historyView.js`(スタブを実装で置き換え)

**Interfaces:**
- Consumes: `ITEMS/ITEM_MAP/GRADE_LABELS/CATEGORIES`(items.js)、`judgeRecord/describeRange`(reference.js)、`loadRecords/saveRecords/deleteRecord/searchRecords/sortByDateDesc`(records.js)、`loadSettings`(settings.js)、`calcAge`(calc.js)
- Produces: `renderHistoryView(container)`。編集は `kensa:edit` CustomEvent(`detail: { id }`)をdispatch

- [ ] **Step 1: historyView.js を実装**

```js
import { ITEMS, GRADE_LABELS, CATEGORIES } from './items.js';
import { judgeRecord, describeRange } from './reference.js';
import { loadRecords, saveRecords, deleteRecord, searchRecords, sortByDateDesc } from './records.js';
import { loadSettings } from './settings.js';
import { calcAge } from './calc.js';

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
      ${record.facility || '検査施設未設定'} ／
      ${record.postMealHours != null ? `食後 ${record.postMealHours} 時間` : '空腹時'}
    </p>
    ${sections}
    ${record.currentTreatment ? `<h3 class="panel-title">現治療内容</h3><p class="panel-note">${record.currentTreatment}</p>` : ''}
    ${record.newTreatment ? `<h3 class="panel-title">変更後治療内容</h3><p class="panel-note">${record.newTreatment}</p>` : ''}
    ${record.memo ? `<h3 class="panel-title">備考</h3><p class="panel-note">${record.memo}</p>` : ''}
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
        <td>${r.date}${r.facility ? `<br><span class="item-ref">${r.facility}</span>` : ''}</td>${cells}<td></td>
      </tr>`;
    }).join('');

    const selected = all.find((r) => r.id === selectedId) || null;
    container.innerHTML = `
      <section class="panel">
        <h2 class="panel-title">検査履歴一覧 (${all.length}件)</h2>
        <input class="form-input" type="search" id="history-search" placeholder="日付、検査施設、治療内容で検索..." value="${query}">
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
```

- [ ] **Step 2: 動作確認**

Run: `node tools/serve.js` → データを2〜3件入れて「履歴」タブ
Expected: 降順テーブル(基準外セルが色付き)、行タップで詳細、編集ボタンで追加タブに既存値入りフォーム、削除で確認→消える、検索で絞り込める

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "検査履歴一覧・詳細・編集/削除・検索を実装"
```

---

### Task 12: 推移グラフ (graphView.js)

**Files:**
- Modify: `js/graphView.js`(スタブを実装で置き換え)

**Interfaces:**
- Consumes: `ITEMS/ITEM_MAP`(items.js)、`buildSeries/refLinesFor/buildChartSvg/GRADE_NUMBER`(chart.js)、`loadRecords`(records.js)、`loadSettings`(settings.js)、`describeRange`(reference.js)
- Produces: `renderGraphView(container)`

- [ ] **Step 1: graphView.js を実装**

```js
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
```

- [ ] **Step 2: 動作確認**

Run: `node tools/serve.js` → 日付違いのデータを3件入れて「グラフ」タブ
Expected: HbA1cの折れ線+基準破線2本が表示され、項目を切り替えると再描画。値のない項目は案内文。尿蛋白は段階値(0〜3)で描画

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "検査項目別の推移グラフを実装"
```

---

### Task 13: 設定タブ (settingsView.js)

**Files:**
- Modify: `js/settingsView.js`(スタブを実装で置き換え)

**Interfaces:**
- Consumes: `ITEMS/ITEM_MAP/NUMBER_KEYS`(items.js)、`DEFAULT_REFERENCES`(reference.js)、`loadSettings/saveSettings`(settings.js)、`loadRecords/saveRecords`(records.js)、`buildBackupPayload/validateBackupData`(backup.js)、`formatDate`(calc.js)
- Produces: `renderSettingsView(container)`

- [ ] **Step 1: settingsView.js を実装**

```js
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
```

- [ ] **Step 2: 動作確認**

Run: `node tools/serve.js` → 「設定」タブ
Expected: 生年月日(初期値1976-09-29)、基準値エディタ(13行)、保存で反映(LDL上限を99にするとダッシュボード判定が変わる)、初期値に戻すで復元、エクスポートでJSONがダウンロードされ、インポートで復元確認→反映。app-syncセクションはオンラインなら表示

- [ ] **Step 3: コミット**

```bash
git add -A
git commit -m "設定タブ(基準値編集・生年月日・バックアップ)を実装"
```

---

### Task 14: PWA対応 (アイコン生成 / manifest.json / sw.js)

**Files:**
- Create: `tools/make-icons.mjs`, `icons/icon.svg`, `icons/icon-192.png`, `icons/icon-512.png`, `icons/icon-maskable-512.png`, `manifest.json`, `sw.js`
- Test: `tests/pwaAssets.test.js`

**Interfaces:**
- Consumes: なし
- Produces: PWAアセット一式。sw.jsのASSETSに `js/` 配下の全ファイル+アイコン+index.html/style.css/manifest.jsonを列挙

- [ ] **Step 1: 失敗するテストを書く**

`tests/pwaAssets.test.js`(bp-appと同じ検証方式):

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const swSource = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');

// sw.jsのASSETS配列を文字列として抜き出す(sw.jsはself前提でimportできないため)
function swAssets() {
  const m = swSource.match(/const ASSETS = \[([\s\S]*?)\];/);
  assert.ok(m, 'sw.jsにASSETS配列がある');
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1].replace(/^\.\//, ''));
}

function pngSize(buf) {
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

test('manifest: PNGアイコン3種(192/512/maskable)が宣言されている', () => {
  const srcs = manifest.icons.map((i) => i.src);
  assert.ok(srcs.includes('icons/icon-192.png'));
  assert.ok(srcs.includes('icons/icon-512.png'));
  assert.ok(srcs.includes('icons/icon-maskable-512.png'));
  const maskable = manifest.icons.find((i) => i.src === 'icons/icon-maskable-512.png');
  assert.equal(maskable.purpose, 'maskable');
});

test('manifest: 宣言された全アイコンファイルが実在する', () => {
  for (const icon of manifest.icons) {
    assert.ok(fs.existsSync(path.join(root, icon.src)), icon.src + ' が存在する');
  }
});

test('manifest: PNGアイコンの実寸がsizes宣言と一致する', () => {
  for (const icon of manifest.icons.filter((i) => i.type === 'image/png')) {
    const [w, h] = icon.sizes.split('x').map(Number);
    const actual = pngSize(fs.readFileSync(path.join(root, icon.src)));
    assert.deepEqual(actual, { width: w, height: h }, icon.src);
  }
});

test('sw.js: manifestの全アイコンがASSETSに含まれる', () => {
  const assets = swAssets();
  for (const icon of manifest.icons) {
    assert.ok(assets.includes(icon.src), icon.src + ' がASSETSにある');
  }
});

test('sw.js: js配下の全モジュールがASSETSに含まれる', () => {
  const assets = swAssets();
  for (const file of fs.readdirSync(path.join(root, 'js'))) {
    assert.ok(assets.includes(`js/${file}`), `js/${file} がASSETSにある`);
  }
});

test('sw.js: app-syncの共有モジュールURLをキャッシュしていない', () => {
  assert.ok(!swSource.includes('github.io/app-sync'));
});
```

- [ ] **Step 2: テストが失敗することを確認**

Run: `node --test tests/pwaAssets.test.js`
Expected: FAIL(manifest.json が存在しない)

- [ ] **Step 3: アイコン生成スクリプトを作成して実行**

`tools/make-icons.mjs`(依存なしのPNGエンコーダ。青地に白の上昇折れ線+データ点のアイコンを描く):

```js
// アイコンPNGを依存なしで生成する(node tools/make-icons.mjs で再生成)。
// デザイン: 青地(#1E6FA8)に白の上昇折れ線+データ点(検査値の推移を表す)。
import { deflateSync } from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'icons');
fs.mkdirSync(outDir, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
function encodePng(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [0x1e, 0x6f, 0xa8, 255];
const FG = [255, 255, 255, 255];

function makeIcon(size, { margin }) {
  const px = Buffer.alloc(size * size * 4);
  const set = (x, y, [r, g, b, a]) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 4;
    px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
  };
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) set(x, y, BG);

  // 上昇折れ線: 相対座標(0..1)の点列を太線で結ぶ
  const inner = size * (1 - margin * 2);
  const ox = size * margin;
  const oy = size * margin;
  const nodes = [
    [0.05, 0.75], [0.35, 0.55], [0.6, 0.68], [0.95, 0.2],
  ].map(([nx, ny]) => [ox + nx * inner, oy + ny * inner]);
  const thick = Math.max(2, Math.round(size * 0.045));
  const drawDot = (cx, cy, r) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y++)
      for (let x = Math.floor(cx - r); x <= cx + r; x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(Math.round(x), Math.round(y), FG);
  };
  for (let i = 0; i < nodes.length - 1; i++) {
    const [x1, y1] = nodes[i];
    const [x2, y2] = nodes[i + 1];
    const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
    for (let s = 0; s <= steps; s++) {
      drawDot(x1 + ((x2 - x1) * s) / steps, y1 + ((y2 - y1) * s) / steps, thick);
    }
  }
  for (const [cx, cy] of nodes) drawDot(cx, cy, thick * 2);
  return encodePng(size, px);
}

fs.writeFileSync(path.join(outDir, 'icon-192.png'), makeIcon(192, { margin: 0.14 }));
fs.writeFileSync(path.join(outDir, 'icon-512.png'), makeIcon(512, { margin: 0.14 }));
// maskable: セーフゾーン(中央80%)に収まるよう余白を広めに
fs.writeFileSync(path.join(outDir, 'icon-maskable-512.png'), makeIcon(512, { margin: 0.22 }));
console.log('icons generated');
```

`icons/icon.svg`(同じデザインのSVG版):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="22" fill="#1E6FA8"/>
  <polyline points="18,68 39,54 57,63 82,29" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>
  <circle cx="18" cy="68" r="7" fill="#fff"/>
  <circle cx="39" cy="54" r="7" fill="#fff"/>
  <circle cx="57" cy="63" r="7" fill="#fff"/>
  <circle cx="82" cy="29" r="7" fill="#fff"/>
</svg>
```

Run: `node tools/make-icons.mjs`
Expected: `icons/` にPNG3枚が生成される

- [ ] **Step 4: manifest.json と sw.js を作成**

`manifest.json`:

```json
{
  "name": "検査記録",
  "short_name": "検査記録",
  "start_url": "./index.html",
  "display": "standalone",
  "background_color": "#F2F5F7",
  "theme_color": "#1E6FA8",
  "icons": [
    { "src": "icons/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" },
    { "src": "icons/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "icons/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

`sw.js`:

```js
const CACHE_NAME = 'kensa-app-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './manifest.json',
  './js/app.js',
  './js/items.js',
  './js/calc.js',
  './js/reference.js',
  './js/settings.js',
  './js/comments.js',
  './js/records.js',
  './js/backup.js',
  './js/chart.js',
  './js/dashboardView.js',
  './js/historyView.js',
  './js/recordForm.js',
  './js/graphView.js',
  './js/settingsView.js',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];
// 注意: app-sync(共有モジュール)のURLはキャッシュしない。
// オフライン時はどのみち保存できず、キャッシュすると更新が届かなくなるため。

self.addEventListener('install', (event) => {
  // cache:'reload'でブラウザHTTPキャッシュを迂回する。素のaddAllだと、
  // 古いHTTPキャッシュの内容が新しいキャッシュ名の箱に入り込み、
  // 以後どれだけ再起動しても旧版が配信され続ける事故が起きる。
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
```

- [ ] **Step 5: テストが通ることを確認**

Run: `npm test`
Expected: 全テストPASS(pwaAssets含む)

- [ ] **Step 6: コミット**

```bash
git add -A
git commit -m "PWA対応(アイコン生成・manifest・Service Worker)を追加"
```

---

### Task 15: README+GitHub公開

**Files:**
- Create: `README.md`
- 操作: GitHubリポジトリ作成・push・Pages有効化

- [ ] **Step 1: README.md を作成**

```markdown
# 検査記録 (kensa-app)

健康診断・血液検査の15項目を記録し、基準値判定・自動コメント・推移グラフで
追跡する個人用PWA。Google AI Studioで作った同名アプリをClaude Codeで
作り直したもの。ビルド不要の静的構成(GitHub Pagesで配信)。

- 公開URL: https://taka070600538-tech.github.io/kensa-app/
- データ保存: 端末のlocalStorage + [app-sync共通基盤](https://github.com/taka070600538-tech/app-sync)で
  1日1回 `app-data/kensa-app/backup.json` に自動バックアップ
- PC側同期: 既存のタスクスケジューラ`AppDataGitPull`(app-dataを毎日pull)がそのまま使われる。追加設定不要

## 機能

- **ダッシュボード**: 最新検査の15項目(空腹時血糖・HbA1c・尿糖・尿蛋白・HDL・LDL・総コレ・
  non-HDL・中性脂肪・AST・ALT・γ-GTP・クレアチニン・eGFR・尿酸)を基準値と照合し、
  基準内/境界値/要注意の3段階判定+所見コメントを自動表示
- **履歴**: 検査日降順の一覧(基準外セルは色付け)、詳細表示、編集・削除、
  日付/施設/治療内容の検索
- **追加**: カテゴリ別フォーム。non-HDLは総コレ−HDLで自動計算、
  eGFRは未入力ならクレアチニンと満年齢から自動推算(日本腎臓学会式・男性)。
  治療・処方内容/変更後治療/備考も記録できる
- **グラフ**: 項目を選んで折れ線表示+基準境界線(自前SVG)
- **設定**: 基準値のカスタマイズ(男性基準がデフォルト)、生年月日、
  GitHubバックアップ(app-sync)、JSONファイルの書き出し/読み込み

## 開発

    npm test             # node:test(依存なし)
    node tools/serve.js  # http://localhost:8124 で動作確認
    node tools/make-icons.mjs  # アイコンPNGの再生成

## 構成

- `js/items.js` — 検査項目マスタ(15項目の定義)
- `js/reference.js` — 基準値デフォルト+3段階判定(純ロジック)
- `js/comments.js` — 所見コメント生成(純ロジック)
- `js/calc.js` — non-HDL・eGFR推算・満年齢(純ロジック)
- `js/records.js` — localStorageレコードのCRUD・検索
- `js/settings.js` — 基準値・生年月日の保存
- `js/backup.js` — バックアップpayloadの構築と検証
- `js/chart.js` — 推移グラフSVG生成(純ロジック)
- `js/dashboardView.js` / `historyView.js` / `recordForm.js` / `graphView.js` / `settingsView.js` / `app.js` — 各タブのUI
```

- [ ] **Step 2: コミット**

```bash
git add -A
git commit -m "READMEを追加"
```

- [ ] **Step 3: GitHubリポジトリを作成してpush**

```bash
gh repo create kensa-app --public --source=. --remote=origin --push
```

Expected: `taka070600538-tech/kensa-app` が作成されmasterがpushされる

- [ ] **Step 4: GitHub Pagesを有効化**

```bash
gh api repos/taka070600538-tech/kensa-app/pages -X POST -f "source[branch]=master" -f "source[path]=/"
```

Expected: 201 Created(既に有効なら409でもよい)。数分後 https://taka070600538-tech.github.io/kensa-app/ で配信される

---

## 最終検証(セッション本体が実施。サブエージェントには委譲しない)

- [ ] `npm test` を本体が実行し、全テストPASSをログで確認
- [ ] `node tools/serve.js` +ブラウザペインで実機確認:
  - 追加→ダッシュボード判定(正常値/境界値/要注意の3パターン入力)
  - 履歴の検索・編集・削除
  - グラフの項目切替と基準線
  - 設定で基準値変更→ダッシュボード判定が変わる
  - JSONエクスポート/インポート
- [ ] 公開URLにアクセスし、PWAとして動作することを確認
- [ ] スマホでの利用手順(ホーム画面追加・トークン設定)をユーザーに案内
