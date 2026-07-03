$ErrorActionPreference = "Stop"

Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\web_receiver\src\projectStatus.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\projectStatus.js" -Force

$NodeExe = "C:\Program Files\nodejs\node.exe"
if (-not (Test-Path -LiteralPath $NodeExe)) {
  $NodeExe = "node"
}

$Check = & $NodeExe --check "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\projectStatus.js" 2>&1
if ($LASTEXITCODE -ne 0) {
  Copy-Item -LiteralPath "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\web_receiver\src\projectStatus_before_file_count_rule_20.js" -Destination "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\projectStatus.js" -Force
  throw "反映後チェック失敗。beforeから戻しました。"
}

Push-Location "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver"
try {
  & $NodeExe -e "require('./src/projectStatus').writeProjectStatus()"
}
finally {
  Pop-Location
}

Write-Host "projectStatus.js に20ファイル上限ルールを反映し、PROJECT_STATUS_FOR_GPT.txt を再生成しました。"
