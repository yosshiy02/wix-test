$ErrorActionPreference = "Stop"

$env:PGPASSWORD = "19771225"
$env:PGCLIENTENCODING = "UTF8"

& "C:\\Program Files\\PostgreSQL\\17\\bin\\psql.exe" 
  -h "127.0.0.1" 
  -p "5432" 
  -U "postgres" 
  -d "hd_origin_project" 
  -v ON_ERROR_STOP=1 
  -f "C:\\Users\\yossh.2FLABO\\Desktop\\新しいフォルダー\\wix-test\\hd-origin-project\\GPT2が使う一時ファイルフォルダ\\undo\\undo_specialist_link_db_20260710_200955.sql"

if ($LASTEXITCODE -ne 0) {
  throw "UNDO失敗"
}

Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
Remove-Item Env:\PGCLIENTENCODING -ErrorAction SilentlyContinue

Write-Host "OK: UNDO完了"