$ErrorActionPreference = "Stop"

$Pairs = @(
  [pscustomobject]@{
    Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\sorting.system.txt"
    Before = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_prompt_analysis_system_required_20260709_112613.web_receiver_src_paymentDocuments_prompts_sorting.system.txt.before.txt"
  }
  [pscustomobject]@{
    Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\sorting.extra-rules.txt"
    Before = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_prompt_analysis_system_required_20260709_112613.web_receiver_src_paymentDocuments_prompts_sorting.extra-rules.txt.before.txt"
  }
  [pscustomobject]@{
    Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\classification.system.txt"
    Before = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_prompt_analysis_system_required_20260709_112613.web_receiver_src_paymentDocuments_prompts_classification.system.txt.before.txt"
  }
  [pscustomobject]@{
    Target = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\web_receiver\src\paymentDocuments\prompts\classification.extra-rules.txt"
    Before = "C:\Users\yossh.2FLABO\Desktop\新しいフォルダー\wix-test\hd-origin-project\GPTが使う一時ファイルフォルダ\before\GPT00_prompt_analysis_system_required_20260709_112613.web_receiver_src_paymentDocuments_prompts_classification.extra-rules.txt.before.txt"
  }
)

foreach ($Pair in $Pairs) {
  if (-not (Test-Path -LiteralPath $Pair.Before)) { throw "beforeファイルが見つかりません: $($Pair.Before)" }
  Copy-Item -LiteralPath $Pair.Before -Destination $Pair.Target -Force
}

Write-Host "UNDO完了: 仕分けAI analysis_system_* 必須プロンプト修正前へ戻しました。"
