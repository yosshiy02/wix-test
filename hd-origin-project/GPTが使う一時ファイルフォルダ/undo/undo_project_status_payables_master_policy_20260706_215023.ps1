$ErrorActionPreference = "Stop"
function Write-Utf8Bom {
  param([string]$Path,[string]$Text)
  $Utf8Bom = New-Object System.Text.UTF8Encoding($true)
  [System.IO.File]::WriteAllText($Path, $Text, $Utf8Bom)
}

$Before = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\PROJECT_STATUS_FOR_GPT_before_payables_master_policy_20260706_215023_PROJECT_STATUS_FOR_GPT.txt"
$Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\PROJECT_STATUS_FOR_GPT.txt"
Copy-Item -LiteralPath $Before -Destination $Target -Force
Write-Host "UNDO restored: $Target"
