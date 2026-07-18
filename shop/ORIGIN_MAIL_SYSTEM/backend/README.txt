HD ORGIN STYLE MAIL SYSTEM BACKEND

目的
Google Workspaceの店舗用メールエイリアス宛てに届いたメールを取得し、
担当者個人メールへ対応リンクを通知し、
Wix上の専用画面から店舗エイリアス名義で返信する。

店舗
Rasiːm

店舗エイリアス
rasi-m@hatodaiya.com

現在の段階
ローカルAPI土台のみ。
Google Workspaceにはまだ接続していない。
メールは実際には送信しない。

起動
PowerShellで start_backend.ps1 を実行する。

確認URL
http://127.0.0.1:3210/api/health
http://127.0.0.1:3210/api/messages

今後の接続
1. Google Cloudプロジェクト
2. Gmail API
3. Cloud Pub/Sub
4. OAuthまたはドメイン全体の委任
5. エイリアス送信確認
6. 担当者通知
7. 公開HTTPSサーバー
8. Wix画面接続