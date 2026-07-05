$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js"
$After = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\receipts\receipts.ai.js"

Copy-Item -LiteralPath $After -Destination $Target -Force

$NodePath = "G:\Apps\NodeJS\node.exe"
if (Test-Path -LiteralPath $NodePath) {
  & $NodePath --check $Target
} else {
  node --check $Target
}
