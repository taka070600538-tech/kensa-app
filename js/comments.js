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
