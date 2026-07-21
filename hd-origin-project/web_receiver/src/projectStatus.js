/**
 * HD Origin Project
 * スタートアップ状態定義ファイル (AI向け)
 */

const PROJECT_STATUS_TEXT = `
==============================================================================
HD Origin Project
支払書類AI解析 Stage1・Stage2・Stage3 設計確定メモ
==============================================================================

作成日：2026年7月21日

【このメモを正とする（目標設計）】
※ただし、Stage3-2「領収・レシート（receipt_evidence）」の専門解析についてはほぼ完成済み。
これをモデルとして他Stageの実装を進めること。

Stage1
共通仕分け

Stage2
書類の身元を確認する基本10項目

Stage3
Stage1で決定した専門解析先ごとの専門解析

Stage1、Stage2、Stage3の役割を混ぜない。

==============================================================================
Stage1：共通仕分け
==============================================================================
【目的】
OCR本文とシステムが保持する取込情報から、
・どの会社の書類か
・何の文書か
・どの処理先へ送るか
・どの会計区分か
・どの専門解析へ送るか
を決定する。Stage1は仕分けだけを行う。

【Stage1の絶対ルール】
会社、文書種別、処理先、会計区分、専門解析先は、AIが候補マスタを見て判断する。
後付け仕分け（SQL、JS、固定値、推測）は禁止。
analysis_system_codeを専門解析先の正規キーとする。

==============================================================================
Stage2：共通基本情報
==============================================================================
【目的】
書類の身元確認に必要となる基本10項目だけをOCR本文から抽出する。
Stage2では金額、税額、支払、明細、契約内容を解析しない。

【解析項目】
1. document_number (書類番号)
2. reference_number (参照番号)
3. issuer_name (発行者名称)
4. issuer_registration_number (発行者登録番号)
5. issuer_postal_code (発行者郵便番号)
6. issuer_address (発行者住所)
7. issuer_phone (発行者電話番号)
8. recipient_name (宛先名称)
9. recipient_code (宛先コード)
10. document_date (書類日付)

【絶対ルール】
・OCR本文に存在する値だけを返す
・値を計算・推測しない
・Stage1の仕分けを変更しない
・金額や専門項目を解析しない、自由な日本語項目を追加しない

==============================================================================
Stage3：専門解析
==============================================================================
【目的】
Stage1で決定されたanalysis_system_codeに従い、その書類に必要な内容を専門解析する。
Stage3は専門解析先ごとにAIを1回実行する。Stage1/Stage2を再実行しない。

【共通項目 (11～30)】
due_date, payment_date, period_start, period_end, subtotal_amount, tax_amount, total_amount, paid_amount, currency_code, tax_included_flag, payment_method, description_summary, line_items_json, notes, bank_name, bank_branch_name, bank_account_type, bank_account_number_masked, bank_account_holder, withholding_tax_amount

【専門解析先一覧】
1. invoice_payable (請求・未払)
2. receipt_evidence (領収・レシート) ※ほぼ完成済み
3. tax_public (税金・公的)
4. card_statement (カード・決済)
5. utility_communication (公共・通信)
6. contract_insurance_lease (契約・保険・リース)
7. delivery_note (納品書・補助)
8. needs_review (要確認・その他)

【Stage3の共通禁止事項】
・Stage1/Stage2の判定や値をやり直さない
・OCR本文にない値を作らない、金額/税額をJSで計算・逆算しない
・画面側でfields/warningsを作らない
・専門項目を全書類へ強制しない

==============================================================================
END
==============================================================================
`;

module.exports = {
    PROJECT_STATUS_TEXT
};
