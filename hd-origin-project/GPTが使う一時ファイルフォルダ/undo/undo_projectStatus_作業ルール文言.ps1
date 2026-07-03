$ProjectRoot = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project"
$Source = Join-Path $ProjectRoot "web_receiver\src\projectStatus.js"
$Before = Join-Path $ProjectRoot "GPTが使う一時ファイルフォルダ\before\web_receiver\src\projectStatus.js"
$WebDir = Join-Path $ProjectRoot "web_receiver"
$NodePath = "C:\Program Files\nodejs\node.exe"

Copy-Item -LiteralPath $Before -Destination $Source -Force

Push-Location $WebDir
& $NodePath -e "const { writeProjectStatus } = require('./src/projectStatus'); writeProjectStatus();"
Pop-Location

notepad (Join-Path $ProjectRoot "PROJECT_STATUS_FOR_GPT.txt")
