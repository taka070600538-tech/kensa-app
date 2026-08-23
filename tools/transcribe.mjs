// app-data/kensa-app/backup.json を読み、Obsidianデイリーノートに転記する。
// マーカー区間を冪等にupsertするため、再実行のたびに最新内容へ自己修復される。
// 日本語パスはこのファイル(UTF-8)内に持つ(.ps1に書くと文字化けするため)。
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const START = '<!-- kensa-app:start -->';
const END = '<!-- kensa-app:end -->';
const DEFAULT_BACKUP = String.raw`D:\Obsidian Vault for Claude Code\Git\app-data\kensa-app\backup.json`;
const DEFAULT_DIARY_DIR = String.raw`D:\Obsidian Vault for Claude Code\01_油田`;

export function todayString(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 数値項目のラベルと単位。null以外のときだけ行を出す。
const NUMERIC_FIELDS = [
  ['postMealHours', (v) => `- 食後: ${v}時間`],
  ['fbs', (v) => `- 血糖: ${v} mg/dL`],
  ['hba1c', (v) => `- HbA1c: ${v} %`],
  ['hdl', (v) => `- HDL: ${v} mg/dL`],
  ['ldl', (v) => `- LDL: ${v} mg/dL`],
  ['tc', (v) => `- 総コレステロール: ${v} mg/dL`],
  ['nonHdl', (v) => `- non-HDL: ${v} mg/dL`],
  ['tg', (v) => `- 中性脂肪: ${v} mg/dL`],
  ['ast', (v) => `- AST: ${v} U/L`],
  ['alt', (v) => `- ALT: ${v} U/L`],
  ['ggt', (v) => `- γ-GT: ${v} U/L`],
  ['cre', (v) => `- クレアチニン: ${v} mg/dL`],
  ['egfr', (v) => `- eGFR: ${v}`],
  ['ua', (v) => `- 尿酸: ${v} mg/dL`],
  ['urineGlucose', (v) => `- 尿糖: ${v}`],
  ['urineProtein', (v) => `- 尿蛋白: ${v}`],
];

// 文字列項目のラベル。空文字でなければ行を出す。
const TEXT_FIELDS = [
  ['currentTreatment', (v) => `- 現在の治療: ${v}`],
  ['newTreatment', (v) => `- 新規治療: ${v}`],
  ['memo', (v) => `- メモ: ${v}`],
];

// 1件のrecordを行の配列に変換する(facility見出し + 数値項目 + 文字列項目)。
function buildRecordLines(rec) {
  const lines = [];
  if (rec.facility) lines.push(`- 施設: ${rec.facility}`);
  for (const [key, fmt] of NUMERIC_FIELDS) {
    if (rec[key] != null) lines.push(fmt(rec[key]));
  }
  for (const [key, fmt] of TEXT_FIELDS) {
    if (rec[key]) lines.push(fmt(rec[key]));
  }
  return lines;
}

// その日のrecordから検査記録セクションを組み立てる。同一日に複数recordがあれば全て順に出す
// (record間は空行1つ)。該当recordが無い、または全項目が空ならnullを返す。
export function buildDaySection(records, date) {
  const dayRecords = records.filter((r) => r.date === date);
  if (dayRecords.length === 0) return null;
  const blocks = dayRecords.map((rec) => buildRecordLines(rec)).filter((lines) => lines.length > 0);
  if (blocks.length === 0) return null;
  return ['## 検査記録', '', blocks.map((lines) => lines.join('\n')).join('\n\n')].join('\n');
}

// contentの改行スタイルを保ちながら、マーカー区間を冪等に置換(無ければ末尾に追記)する。
// 日記本文の他の部分には一切触れない。
export function upsertSection(content, section) {
  const eol = content.includes('\r\n') ? '\r\n' : '\n';
  const block = `${START}${eol}${section.replaceAll('\n', eol)}${eol}${END}${eol}`;
  const startIdx = content.indexOf(START);
  const endIdx = content.indexOf(END);
  if (startIdx !== -1 && endIdx !== -1) {
    return content.slice(0, startIdx) + block + content.slice(endIdx + END.length).replace(/^\r?\n/, '');
  }
  if (content === '') return block;
  const sep = content.endsWith(eol) ? eol : eol + eol;
  return content + sep + block;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// 転記対象の日付(当日より前かつYYYY-MM-DD形式のみ)。記録のある日を昇順で返す。
export function datesToTranscribe(records, today) {
  const dates = new Set(records.map((r) => r.date));
  return [...dates].filter((d) => DATE_RE.test(d) && d < today).sort();
}

// diaryDir配下の各日付ファイルへ、backup.json記載の内容をupsertする。
// action: 'created'(新規ファイル) / 'updated'(内容変更あり) / 'unchanged'(差分なし) / 'error'
export function runTranscription({ records, diaryDir, today }) {
  const results = [];
  for (const date of datesToTranscribe(records, today)) {
    const section = buildDaySection(records, date);
    if (!section) continue;
    const path = join(diaryDir, `スマホ - ${date}.md`);
    try {
      const existing = existsSync(path) ? readFileSync(path, 'utf8') : '';
      const next = upsertSection(existing, section);
      if (existing === next) {
        results.push({ date, action: 'unchanged' });
      } else {
        writeFileSync(path, next, 'utf8');
        results.push({ date, action: existing === '' ? 'created' : 'updated' });
      }
    } catch (err) {
      results.push({ date, action: 'error', message: err.message });
    }
  }
  return results;
}

function main() {
  const backupPath = process.argv[2] || DEFAULT_BACKUP;
  const diaryDir = process.argv[3] || DEFAULT_DIARY_DIR;
  if (!existsSync(backupPath)) {
    console.log('backup.jsonがまだありません。スキップします');
    return;
  }
  let records;
  try {
    const data = JSON.parse(readFileSync(backupPath, 'utf8'));
    records = Array.isArray(data.records) ? data.records : null;
  } catch (err) {
    console.log(`backup.jsonを読めません (${err.message})`);
    return;
  }
  if (!records) {
    console.log('backup.jsonにrecordsがありません。スキップします');
    return;
  }
  mkdirSync(diaryDir, { recursive: true });
  const results = runTranscription({ records, diaryDir, today: todayString() });
  for (const r of results) {
    console.log(r.action === 'error' ? `${r.date}: ERROR (${r.message})` : `${r.date}: ${r.action}`);
  }
  if (results.length === 0) console.log('転記対象なし');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
