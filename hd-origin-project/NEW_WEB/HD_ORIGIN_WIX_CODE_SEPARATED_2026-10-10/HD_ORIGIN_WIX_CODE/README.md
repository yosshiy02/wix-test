# HDオリジンオンラインストア — Wix ソース取得フォルダ

このフォルダは、Wix エディタから個別に読み取った実コードを役割ごとに保存するための出力先です。

```text
HD_ORIGIN_WIX_CODE/
├─ backend/
│  ├─ products.jsw             # 商品・ブランド初期データ
│  └─ squareCheckout.jsw       # Square 決済リンクと SquareOrders 保存
└─ public/
   └─ cartHtmlBridge.js        # 埋め込みサイドカートと Wix カートの橋渡し
```

## フロントエンド

HDオリジンオンラインストアのページコードは `public/pages/jsj63.js`（4,964 行、158,161 文字）である。Wix エディタ上で完全なソースを取得済みで、以下を import する。

- `backend/squareCheckout.jsw`
- `backend/products.jsw`
- `backend/shop_back/menuService.jsw`
- `backend/shop_back/mobileBannerService`
- `public/cartHtmlBridge`

この大きなページファイルは、Wix の現在のエディタから個別ファイルのダウンロード操作が提供されないため、エディタのコード画面で選択して保存する必要がある。コードの関係図・行単位の機能索引は親フォルダの `HD_ORIGIN_WIX_CODE_RELATIONSHIP_AUDIT.md` に収録している。
