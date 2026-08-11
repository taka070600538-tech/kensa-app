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
