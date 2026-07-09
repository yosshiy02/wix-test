$ErrorActionPreference = "Stop"

$Pairs = @(
  [pscustomobject]@{
    Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\sorting.system.txt"
    After  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT00_prompt_analysis_system_required_20260709_112613.web_receiver_src_paymentDocuments_prompts_sorting.system.txt.after.txt"
  }
  [pscustomobject]@{
    Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\sorting.extra-rules.txt"
    After  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT00_prompt_analysis_system_required_20260709_112613.web_receiver_src_paymentDocuments_prompts_sorting.extra-rules.txt.after.txt"
  }
  [pscustomobject]@{
    Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\classification.system.txt"
    After  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT00_prompt_analysis_system_required_20260709_112613.web_receiver_src_paymentDocuments_prompts_classification.system.txt.after.txt"
  }
  [pscustomobject]@{
    Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\classification.extra-rules.txt"
    After  = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\after\GPT00_prompt_analysis_system_required_20260709_112613.web_receiver_src_paymentDocuments_prompts_classification.extra-rules.txt.after.txt"
  }
)

foreach ($Pair in $Pairs) {
  if (-not (Test-Path -LiteralPath $Pair.After)) { throw "afterファイルが見つかりません: $($Pair.After)" }
  Copy-Item -LiteralPath $Pair.After -Destination $Pair.Target -Force
}

Write-Host "OK: 仕分けAI analysis_system_* 必須プロンプト修正を本体へ反映しました。"
