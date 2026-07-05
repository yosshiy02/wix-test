$Target = "G:\GITHUB\wix-test\hd-origin-project\web_receiver\src\receipts\receipts.ai.js"
$Before = "G:\GITHUB\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\receipts\receipts.ai_before_company_account_prompt_20260705_110056.js"

Copy-Item -LiteralPath $Before -Destination $Target -Force

$NodePath = "G:\Apps\NodeJS\node.exe"
if (Test-Path -LiteralPath $NodePath) {
  & $NodePath --check $Target
} else {
  node --check $Target
}
