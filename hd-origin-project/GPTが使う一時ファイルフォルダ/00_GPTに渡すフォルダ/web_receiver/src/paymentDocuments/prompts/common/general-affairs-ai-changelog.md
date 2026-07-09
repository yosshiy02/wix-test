# HD Origin Project 総務AI 変更履歴

## 2026-07-09 初期作成

### 追加内容

総務AIを、HD Origin Project の会社業務理解用プロンプトとして追加。

### 作成ファイル

- general-affairs-ai.txt
- general-affairs-ai-notes.md
- general-affairs-ai-changelog.md

### ローダー組み込み

paymentDocuments.aiPromptLoader.js に common/general-affairs-ai.txt を読み込む処理を追加。

### 読ませる対象

- 1回目仕分けAI
- 請求・未払系専門AI
- 税金・公的支払系専門AI

### 読ませない対象

- レシート系
- カード明細系
- 契約・保険・リース系
- 公共料金・通信費系

### 方針

総務AIは固定完成版ではなく、今後成長する業務知識として扱う。

AIに毎回読ませる本文は general-affairs-ai.txt に短くまとめる。

詳細な業務メモは general-affairs-ai-notes.md に追記する。

変更履歴は general-affairs-ai-changelog.md に残す。
