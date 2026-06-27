import { saveReceiptFromHtml } from "backend/receiptUpload.jsw";

$w.onReady(function () {
  $w("#htmlReceiptApp").onMessage(async (event) => {
    const data = event.data;

    if (!data || data.type !== "SAVE_RECEIPT") {
      return;
    }

    try {
      const result = await saveReceiptFromHtml(data);

      $w("#htmlReceiptApp").postMessage({
        type: "SAVE_RECEIPT_RESULT",
        ok: true,
        receiptId: result.receiptId,
        imageUrl: result.imageUrl,
        itemId: result.itemId
      });

    } catch (err) {
      console.error(err);

      $w("#htmlReceiptApp").postMessage({
        type: "SAVE_RECEIPT_RESULT",
        ok: false,
        receiptId: data.receiptId,
        message: err.message || String(err)
      });
    }
  });
});