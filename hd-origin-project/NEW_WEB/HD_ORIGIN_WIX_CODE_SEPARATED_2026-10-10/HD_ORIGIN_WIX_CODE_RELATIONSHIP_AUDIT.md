# HDオリジンオンラインストア — Wix/Velo コード関連図

取得日時: 2026-10-10（JST）  
対象サイト: HATODAIYA / `www.hatodaiya.com`  
対象ページ: **HDオリジンオンラインストア**（エディタ上の URL スラッグ: `hd-origin-shop`）

## 1. 今回取得できたコードの範囲

Wix エディタのページコードを読み取り、対象ページの実コードを確認した。

| 種別 | Wix 内のファイル／識別子 | 取得結果 |
|---|---|---|
| 対象フロントエンド | `file:///public/pages/jsj63.js` | 4,964 行、158,161 文字を確認 |
| ページ内 HTML コンポーネント | `MobileCombinedHtml`、`CartUiHtml`、`mobilemainGalleryHtml`、`mainGalleryHtml`、`PCStockHtml` ほか | ページコードからメッセージ連携を確認 |
| バックエンド呼び出し先 | `backend/squareCheckout.jsw`、`backend/products.jsw`、`backend/shop_back/menuService.jsw`、`backend/shop_back/mobileBannerService` | フロントエンドの import と呼び出しを確認 |
| 共有フロントモジュール | `public/cartHtmlBridge` | import と初期化を確認 |

この資料作成中、Wix エディタには「別のブラウザで変更が加えられました。ページを再読み込みして、最新の状態にしてください。」という通知が表示されていた。そのため **再読み込み・保存・公開は一切行っていない**。以下は、通知表示時点でエディタにロードされていたコードの読取結果である。

## 2. 全体構成

```text
HDオリジンオンラインストア（public/pages/jsj63.js）
│
├─ Wix 標準 API
│  ├─ wix-data ─────────────── CMS／Wix Stores の検索
│  ├─ wix-stores-frontend ─── cart（カート操作）
│  ├─ wix-storage ─────────── session（状態保持）
│  ├─ wix-location ────────── URL・画面遷移
│  ├─ wix-window ──────────── 端末種別などの画面制御
│  └─ wix-seo-frontend ────── title／meta tag
│
├─ Wix CMS / Stores データ
│  ├─ BrandSettings
│  ├─ Import307
│  ├─ SalesPoint
│  ├─ SoleNameTable
│  ├─ ProductSalesTexts
│  ├─ Stores/Products
│  └─ Stores/Variants
│
├─ バックエンド Web モジュール
│  ├─ squareCheckout.jsw ──── Square 決済リンク生成
│  ├─ products.jsw ────────── 初期ページデータ取得
│  ├─ shop_back/menuService.jsw
│  │  ├─ Helmetty ブランドボックス HTML
│  │  └─ Hatodaiya ブランドボックス HTML
│  └─ shop_back/mobileBannerService
│     └─ モバイル用バナー HTML
│
└─ 埋め込み HTML UI（postMessage/onMessage）
   ├─ モバイル商品・ギャラリー
   ├─ PC 商品ギャラリー・在庫表
   ├─ カタログ情報／商品情報
   ├─ カテゴリーサムネイルメニュー
   └─ カート／購入 UI
```

## 3. フロントエンドの import 関係（完全一覧）

| import 元 | 用途 |
|---|---|
| `wix-data` | CMS と Wix Stores コレクションを照会するデータ層 |
| `wix-window` | モバイル／デスクトップの表示分岐 |
| `wix-stores-frontend` の `cart` | カート内容の取得・追加・消去・更新 |
| `wix-storage` の `session` | ページ間で使う一時状態 |
| `wix-location` | クエリ取得・ページ遷移 |
| `backend/squareCheckout.jsw` の `createSquarePaymentLink` | Square 決済への遷移先を生成 |
| `backend/products.jsw` の `getInitialPageData` | 初期ロードに必要な商品・ページ情報を取得 |
| `backend/shop_back/menuService.jsw` の `getHelmettyBrandBoxHtml` | HELMETTY ブランド枠の HTML を取得 |
| `backend/shop_back/menuService.jsw` の `getHatodaiyaBrandBoxHtml` | HATODAIYA ブランド枠の HTML を取得 |
| `backend/shop_back/mobileBannerService` の `getMobileBannerHtml` | モバイル用トップバナー HTML を取得 |
| `public/cartHtmlBridge` の `initCartHtmlBridge` | 埋め込みカート UI と Wix カートを接続 |
| `wix-seo-frontend` の `setMetaTags`, `setTitle` | 商品／ページに連動した SEO 設定 |

## 4. データ関連

| データセット | ページコードでの役割 |
|---|---|
| `Stores/Products` | 商品本体の取得、商品数・商品表示の基礎 |
| `Stores/Variants` | サイズ等のバリアントと在庫表示 |
| `Import307` | slug をキーにした商品補足情報の取得 |
| `BrandSettings` | 現在ブランドの設定・ロゴ等の決定 |
| `SalesPoint` | 商品タイトルに対応する訴求画像 |
| `SoleNameTable` | ソール名称・高さ・素材の補足情報 |
| `ProductSalesTexts` | 商品販売テキスト |

`Stores/Products` の直接検索は約 2,033 行目、`Import307` は約 906 行目、`BrandSettings` は約 887 行目に存在する。データ利用は、商品選択後にギャラリー・商品情報・在庫・SEOへ流れる。

## 5. UI 間のメッセージ契約

ページコードは `$w(...).onMessage` で HTML コンポーネントからのイベントを受け、`postMessage` で表示モデルを戻す。確認できた message `type` は次のとおり。

| 区分 | メッセージ |
|---|---|
| 商品／ギャラリー | `setGalleryItems`, `productInfo`, `catalogInfo`, `setProductScreenActive`, `resetG1G2Scroll` |
| ブランド | `setBrandBoxHtml`, `brandBoxHtml` |
| カテゴリー | `setCategories`, `setActiveCategory`, `setMenuData`, `g1`, `g2` |
| カート／購入 | `setPurchaseUi`, `setOtherProductsButtonDisabled`, `stockTableUpdate` |
| モバイル配置 | `requestCombinedHeight`, `setMobileMenuState`, `closeMenu` |

受信側として明示的に登録されているコンポーネントは `#MobileCombinedHtml`、`#MainImageHtml`、`#mobilemainGalleryHtml`、`#mainGalleryHtml`、`#categoryThumbnailMenu` である。

## 6. 主要ロジック索引

行番号は `public/pages/jsj63.js` の取得時点の目安。

| 行 | 関数／初期化 | 責務 |
|---:|---|---|
| 16 | `applyMobileTopBanner` | バックエンドから受けたモバイルバナーを適用 |
| 79 | `getCartSnapshot` | Wix カートの現在値を正規化して取得 |
| 135–172 | リクエスト世代管理 | 商品切替・古い非同期結果の破棄、在庫更新の整合性維持 |
| 336 | `setupCartUiHtml` | カート HTML ブリッジの初期化 |
| 479–861 | カタログ／画像送信群 | 商品・カタログ・ブランド・メイン画像を各 HTML UI へ配信 |
| 902–950 | CMS 補足情報取得群 | `Import307`、訴求、ソール情報を商品に紐付け |
| 962 | `postProductInfoToHtml` | 商品情報コンポーネントへの表示モデル送信 |
| 1,017 | `applyPinterestMeta` | 商品に合わせた Pinterest/SEO メタ設定 |
| 1,043 | `clearWixCartAll` | Wix カートを全消去する内部処理 |
| 1,190–1,374 | モバイル・カート画面群 | メニュー開閉、カート描画、購入画面の開閉 |
| 1,395 | `$w.onReady` | 初期化の起点 |
| 3,614 | `loadCategoryGalleryFromPayload` | カテゴリー選択後のギャラリー切替 |
| 4,337 | `updateCartAndDisplay` | カート変更後の画面反映 |
| 4,384 | `setupViewBasedOnDevice` | PC／モバイル表示の分岐 |
| 4,422–4,427 | イベント登録 | ページ要素・カートイベントの結線 |
| 4,473 | `addProductToCart` | 選択バリアントを Wix カートへ追加 |
| 4,542 | `updateDropdownAndStockDisplay` | 選択肢／在庫表示更新 |
| 4,701 | `goSquareCheckoutFromCart` | カートを基に決済リンクを取得して Square へ進む |
| 4,767 | `fetchProductAndVariants` | 商品とバリアントを取得・表示用に加工 |
| 4,910 | `setupPasswordProtectedActions` | パスワード保護された操作を初期化 |

## 7. 購入フロー

```text
商品 URL / カテゴリー選択
  → getInitialPageData + CMS / Stores 照会
  → 商品、バリアント、在庫、補足情報を組み立て
  → HTML ギャラリー・商品情報・在庫表へ postMessage
  → サイズ／バリアント選択
  → addProductToCart
  → wix-stores-frontend.cart を updateCartAndDisplay で再描画
  → goSquareCheckoutFromCart
  → backend/squareCheckout.jsw:createSquarePaymentLink
  → Square 決済リンクへ遷移
```

## 8. Wix エディタに存在するページコード（確認済み一覧）

メインページには、TOP、オリジンメールシステム、レシート読み取りページ、商品登録ページ、在庫更新ページ、Rasi:mショップ、着せ替えアプリ、着せ替え確認ページ、着せ替え登録アプリ、着せ替えアプリ左右別、大阪サンダル工業、相互ストアリンク、オンラインストア、特定商取引法に基づく表示、支払・返品等について、プライバシー・ポリシー、SUNGENOVA / LADYGENOVINA、ナニワ刺繍、LADY GENOVINA、POSUR、DONKEY POINT、Remarl、PERRO GATO、カスタマーサービス、CONTACT、オンラインストア問い合わせフォーム、シェアギャラリー、Members、HDDB SHOP (リスト)、HDSHOP、Rasi:m-SHOP、Rasi:m-SHOP(item)、レシーム(Item)、HELMETTY ALL、リンクショップALL、リンクショップALL_BACKUP、ブランドコンフィグ、リンクショップ(Item)、**HDオリジンオンラインストア**、受注登録ページ、自己紹介、リンクカタログ ALL、リンクカタログ(Item)、Products (Slug)、HDSHOP (LG)、HDSHOP (HEL) (Item)、HDcategorySG、HDcategoryLG、HDcategoryDP、HDcategoryRE、リンクカタログA、リンクカタログB が表示されていた。

併せて `masterPage.js`、Wix ストア（HE001、ショップ、商品ページ、サンキューページ、remarl オンラインストア、カートページ、サイドカート、成功ポップアップ）、動的ページ（Collections、HDcatalog、HDコレクション、Variant-catalog、Parent-catalog など）、ポップアップ（ConfirmPopup、ResponsePopup）のコード入口が確認できた。

## 9. 未取得部分と次の読取対象

今回、対象ページのフロントエンド全体と、その import 依存先は確認できた。一方で Wix の「別ブラウザで変更」通知を保護するため、次のファイルを UI 上で開く操作は止めている。これらを開ければバックエンド実装そのものまで行単位で照合できる。

1. `backend/squareCheckout.jsw`
2. `backend/products.jsw`
3. `backend/shop_back/menuService.jsw`
4. `backend/shop_back/mobileBannerService`
5. `public/cartHtmlBridge`
6. 上記の HTML コンポーネント群のソース

通知を解消してコードファイル一覧が操作可能な状態になれば、この資料に各ファイルの実コード索引、関数引数・戻り値、CMS クエリ、決済データの受け渡しまで追記できる。
