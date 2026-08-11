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
- `js/html.js` — ユーザー入力のHTMLエスケープ(共有ヘルパー)
- `js/dashboardView.js` / `historyView.js` / `recordForm.js` / `graphView.js` / `settingsView.js` / `app.js` — 各タブのUI
