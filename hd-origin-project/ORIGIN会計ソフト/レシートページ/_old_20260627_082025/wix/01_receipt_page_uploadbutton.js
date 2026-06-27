import wixData from "wix-data";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function makeReceiptId() {
  const d = new Date();

  const y = d.getFullYear();
  const m = pad2(d.getMonth() + 1);
  const day = pad2(d.getDate());
  const h = pad2(d.getHours());
  const min = pad2(d.getMinutes());
  const s = pad2(d.getSeconds());

  return `R${y}${m}${day}-${h}${min}${s}`;
}

function toNumber(value) {
  if (value === null || value === undefined) {
    return 0;
  }

  const cleaned = String(value).replace(/[^\d.-]/g, "");
  const n = Number(cleaned);

  return Number.isFinite(n) ? n : 0;
}

$w.onReady(function () {
  $w("#txtStatus").text = "レシート画像を選んでください。";

  $w("#btnSaveReceipt").onClick(async () => {
    try {
      $w("#txtStatus").text = "アップロード中です...";

      const files = await $w("#uploadReceiptImage").uploadFiles();

      if (!files || files.length === 0) {
        $w("#txtStatus").text = "画像が選択されていません。";
        return;
      }

      const file = files[0];
      const receiptId = makeReceiptId();

      const receiptDate = $w("#dateReceipt").value || new Date();
      const vendorName = $w("#inputVendor").value || "";
      const totalAmount = toNumber($w("#inputTotal").value);
      const paymentMethod = $w("#inputPaymentMethod").value || "";
      const memo = $w("#inputMemo").value || "";

      const imageUrl = file.fileUrl;

      await wixData.insert("Receipts", {
        title: receiptId,
        receiptId: receiptId,
        receiptDate: receiptDate,
        vendorName: vendorName,
        totalAmount: totalAmount,
        paymentMethod: paymentMethod,
        imageUrl: imageUrl,
        originalFileName: file.originalFileName || "",
        status: "uploaded",
        memo: memo,
        createdAt: new Date()
      });

      $w("#imgReceiptPreview").src = imageUrl;
      $w("#txtStatus").text = `保存しました：${receiptId}`;

      $w("#inputVendor").value = "";
      $w("#inputTotal").value = "";
      $w("#inputPaymentMethod").value = "";
      $w("#inputMemo").value = "";

    } catch (err) {
      console.error(err);
      $w("#txtStatus").text = "保存でエラーが出ました。";
    }
  });
});