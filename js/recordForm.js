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
