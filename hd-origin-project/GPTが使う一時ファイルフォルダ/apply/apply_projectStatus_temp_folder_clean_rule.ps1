$Root = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"
$Temp = Join-Path $Root "GPTが使う一時ファイルフォルダ"
$After = Join-Path $Temp "after\web_receiver\src\projectStatus.js"
$Target = Join-Path $Root "web_receiver\src\projectStatus.js"
$Memo = Join-Path $Temp "memo\00_スタート文書_一時フォルダ清掃ルール_反映結果.txt"

Copy-Item $After $Target -Force

$NodePath = "C:\Program Files\nodejs\node.exe"
$Check = & $NodePath --check $Target 2>&1

@"
スタート文書生成元 projectStatus.js に、一時フォルダ清掃ルールを反映しました。

反映内容:
- GPTに渡すフォルダを正式な収集先として明記
- 収集前に GPTに渡すフォルダをクリーンすることを明記
- before / after / apply / undo / memo の役割を維持
- backup フォルダ、実バックアップ、.env、DB、画像は勝手に触らないことを明記

反映先:
$Target

node --check 結果:
$Check
"@ | Set-Content -Path $Memo -Encoding UTF8

notepad $Memo
