
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

  window.applySortingOnlyDraftToForm = function (draft) {
    const d = draft && typeof draft === "object" ? draft : {};
    const s = d.ai_summary && typeof d.ai_summary === "object" ? d.ai_summary : {};

    let count = 0;

    count += window.hdOriginSetControlValueLoose("draftAiDocumentKind", d.document_type_code || d.document_type_label || d.document_type_name, d.document_type_label || d.document_type_name || s.document_kind);
    count += window.hdOriginSetControlValueLoose("draftAiDestination", d.payment_destination_code || d.payment_destination_label || d.payment_destination_name, d.payment_destination_label || d.payment_destination_name || s.destination);

    count += window.hdOriginSetControlValueLoose("draftAiPayableFlag", s.payment_target || d.payment_target || "");
    count += window.hdOriginSetControlValueLoose("draftAiUnpaidFlag", s.payable_target || d.payable_target || "");
    count += window.hdOriginSetControlValueLoose("draftAiExpenseFlag", s.expense_target || d.expense_target || "");
    count += window.hdOriginSetControlValueLoose("draftAiTaxPublicFlag", s.tax_public || d.tax_public || "");
    count += window.hdOriginSetControlValueLoose("draftAiContractFlag", s.contract_insurance_lease || d.contract_insurance_lease || "");

    count += window.hdOriginSetControlValueLoose("draftAiConfidence", d.confidence_label || d.ai_confidence || s.confidence_label || d.confidence || "");
    count += window.hdOriginSetControlValueLoose("draftAiReason", d.review_reason || s.reason || d.reason || "");

    count += window.hdOriginSetControlValueLoose("draftAccountingCategory", d.accounting_category_code || d.accounting_category_label || d.accounting_category_name, d.accounting_category_label || d.accounting_category_name || "");
    count += window.hdOriginSetControlValueLoose("draftDestination", d.payment_destination_code || d.payment_destination_label || d.payment_destination_name, d.payment_destination_label || d.payment_destination_name || s.destination);

    window.__lastAiDraftAppliedCount = count;

    return count;
  };
})();
