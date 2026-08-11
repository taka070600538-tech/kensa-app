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
