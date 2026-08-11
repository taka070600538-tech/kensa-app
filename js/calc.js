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
