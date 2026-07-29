
(function () {
  window.hdOriginSetControlValueLoose = function (id, value, label) {
    const el = document.getElementById(id);

    if (!el) return 0;

    const rawValue = value === null || value === undefined ? "" : String(value).trim();
    const rawLabel = label === null || label === undefined ? "" : String(label).trim();
    const wanted = rawLabel || rawValue;

    if (el.tagName === "SELECT") {
      let matched = false;

      Array.from(el.options || []).forEach(option => {
        const optValue = String(option.value || "").trim();
        const optText = String(option.textContent || "").trim();
        const optCode = String(option.dataset ? (option.dataset.code || option.dataset.programCode || "") : "").trim();

        if (
          optValue === rawValue ||
          optValue === rawLabel ||
          optCode === rawValue ||
          optCode === rawLabel ||
          (wanted && optText === wanted) ||
          (wanted && optText.includes(wanted)) ||
          (wanted && wanted.includes(optText) && optText.length >= 2)
        ) {
          el.value = option.value;
          matched = true;
        }
      });

      if (!matched && rawValue) {
        el.value = rawValue;
      }
    } else {
      el.value = wanted || rawValue;
    }

    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    return 1;
  };

  window.applySortingOnlyAnalysisToForm = function (draft) {
    const d = draft && typeof draft === "object" ? analysis : {};
    const s = d.ai_summary && typeof d.ai_summary === "object" ? d.ai_summary : {};

    let count = 0;

    count += window.hdOriginSetControlValueLoose("analysisAiDocumentKind", d.document_type_code || d.document_type_label || d.document_type_name, d.document_type_label || d.document_type_name || s.document_kind);
    count += window.hdOriginSetControlValueLoose("analysisAiDestination", d.payment_destination_code || d.payment_destination_label || d.payment_destination_name, d.payment_destination_label || d.payment_destination_name || s.destination);

    
    count += window.hdOriginSetControlValueLoose("analysisAnalysisSystemCode", d.analysis_system_code || s.analysis_system_code || "");
    count += window.hdOriginSetControlValueLoose(
      "analysisAnalysisSystemLabel",
      d.analysis_system_code || s.analysis_system_code || "",
      d.analysis_system_label ||
        s.analysis_system ||
        s.analysis_system_label ||
        ""
    );
    count += window.hdOriginSetControlValueLoose("analysisAnalysisSystemConfidence", d.analysis_system_confidence || s.analysis_system_confidence || "");
    count += window.hdOriginSetControlValueLoose("analysisAnalysisSystemReason", d.analysis_system_reason || s.analysis_system_reason || "");
count += window.hdOriginSetControlValueLoose("analysisAiPayableFlag", s.payment_target || d.payment_target || "");
    count += window.hdOriginSetControlValueLoose("analysisAiUnpaidFlag", s.payable_target || d.payable_target || "");
    count += window.hdOriginSetControlValueLoose("analysisAiExpenseFlag", s.expense_target || d.expense_target || "");
    count += window.hdOriginSetControlValueLoose("analysisAiTaxPublicFlag", s.tax_public || d.tax_public || "");
    count += window.hdOriginSetControlValueLoose("analysisAiContractFlag", s.contract_insurance_lease || d.contract_insurance_lease || "");

    count += window.hdOriginSetControlValueLoose("analysisIssueDate", d.issue_date || s.issue_date || "");
    count += window.hdOriginSetControlValueLoose("analysisAiConfidence", d.confidence_label || d.ai_confidence || s.confidence_label || d.confidence || "");
    count += window.hdOriginSetControlValueLoose("analysisAiReason", d.review_reason || s.reason || d.reason || d.analysis_system_reason || s.analysis_system_reason || "");

    count += window.hdOriginSetControlValueLoose("analysisAccountingCategory", d.accounting_category_code || d.accounting_category_label || d.accounting_category_name, d.accounting_category_label || d.accounting_category_name || "");
    count += window.hdOriginSetControlValueLoose("analysisDestination", d.payment_destination_code || d.payment_destination_label || d.payment_destination_name, d.payment_destination_label || d.payment_destination_name || s.destination);

    window.__lastAnalysisResultAppliedCount = count;

    return count;
  };
})();
