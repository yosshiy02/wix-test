# 簡易会計入力Webアプリ DBなし版

PostgreSQLをまだ入れていない段階で、画面と流れを確認するための版です。

保存先はPostgreSQLではなく、以下のJSONファイルです。

```text
data/transactions.json
```

## 1. 必要なもの

まず Node.js だけ必要です。

PostgreSQLはまだ不要です。

## 2. 起動

このフォルダをVS Codeで開き、ターミナルで実行します。

```powershell
npm start
```

または直接：

```powershell
node server.js
```

## 3. ブラウザで開く

```text
http://localhost:3000
```

## 4. できること

- 取引入力
- 一覧表示
- JSONファイル保存
- CSV出力

## 5. 後でPostgreSQL版へ移す

このDBなし版で画面・流れを確認したあと、PostgreSQL版に戻します。

最終形は以下です。

```text
ブラウザ
↓
Node.js
↓
PostgreSQL
```

このDBなし版は本番用ではありません。
