# HD ORIGIN WIX FULL EXPORT

取得対象: Wix ページ「HDオリジンオンラインストア」（slug: `hd-origin-shop`）。

## 格納内容

- `embedded-html-main.html` — ページに組み込まれている `hd-brand-shop` カスタム要素の実HTML/CSS/JavaScript。
- `velo-source/backend/squareCheckout.jsw` — Square 決済リンク作成バックエンド。実トークンは含まれず、Wix Secrets の `SQUARE_ACCESS_TOKEN` 名だけを参照する。
- `velo-source/backend/products.jsw` — 商品初期データ取得バックエンド。
- `velo-source/public/cartHtmlBridge.js` — HTML コンポーネントとWixカートをつなぐフロント側ブリッジ。

このフォルダは、Wix が生成する配信用ランタイム全体（Wix基盤の圧縮済みJS・CSS数百ファイル）ではなく、サイト固有のHTML埋め込みとVeloコードを対象にした取得物です。
