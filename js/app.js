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
