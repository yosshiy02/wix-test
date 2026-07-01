ORIGIN会計ソフト レシート関係 方針

【運用】
スマホのDropboxアプリでレシートをスキャンする。
トリミング・サイズ調整済みの画像を scan_inbox に入れる。
PROJECT側で scan_inbox 内の画像をまとめて処理する。

【フォルダ】
scan_inbox  : 未処理レシート画像
imported    : 取込成功済み
duplicate   : SHA-256重複
error        : 取込失敗
work         : 処理中一時置き場
memo         : メモ

【まとめて処理上限】
通常上限：20ファイル
警告付き上限：50ファイル
50ファイル超え：処理停止

【重複判定】
ファイル名ではなく、画像ファイルのSHA-256で判定する。
同じSHA-256が既にDBにあれば duplicate に移動する。
