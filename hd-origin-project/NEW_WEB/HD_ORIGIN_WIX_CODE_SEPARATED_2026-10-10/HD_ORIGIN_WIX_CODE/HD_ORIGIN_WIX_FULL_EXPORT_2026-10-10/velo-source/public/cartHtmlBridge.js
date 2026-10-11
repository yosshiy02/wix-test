// public/cartHtmlBridge.js
import { cart } from "wix-stores-frontend";

let __cartHtmlBridgeBound = false;

function toStaticWixUrlMaybe(u) {
  const s = String(u || "").trim();
  if (!s) return "";
  if (s.startsWith("wix:image://v1/")) {
    const rest = s.slice("wix:image://v1/".length);
    const mediaId = rest.split("/")[0] || "";
    if (!mediaId) return "";
    return `https://static.wixstatic.com/media/${mediaId}`;
  }
  return s;
}

function patchLineItemImage(li, preferredUrl) {
  const url = toStaticWixUrlMaybe(preferredUrl || li?.media?.mainMedia?.image?.url || li?.media?.mainMedia?.url || li?.image || li?.mediaUrl || li?.thumbnail || li?.mediaItem?.src || "");
  if (!url) return li;
  return {
    ...li,
    image: li.image || url,
    mediaUrl: li.mediaUrl || url,
    media: {
      ...(li.media || {}),
      mainMedia: {
        ...((li.media && li.media.mainMedia) || {}),
        url: (li.media && li.media.mainMedia && li.media.mainMedia.url) || url,
        image: (li.media && li.media.mainMedia && li.media.mainMedia.image) || { url }
      }
    }
  };
}

export function initCartHtmlBridge(htmlId, getCartSnapshot, getPreferredImageUrl, onCheckout) {
  const html = $w(htmlId);
  if (!html) {
    console.warn("cartHtmlBridge: HTMLが見つかりません:", htmlId);
    return;
  }

  function postCart(cartData) {
    if (!cartData) return;
    const patched = {
      ...cartData,
      lineItems: (cartData.lineItems || []).map((li) => {
        const preferredUrl = typeof getPreferredImageUrl === "function" ? toStaticWixUrlMaybe(getPreferredImageUrl(li)) : "";
        return patchLineItemImage(li, preferredUrl);
      })
    };
    html.postMessage({ type: "SIDE_CART_DATA", payload: patched });
  }

  async function refreshAndPost() {
    try {
      const fresh = await Promise.resolve(getCartSnapshot(0));
      postCart(fresh);
    } catch (e) {
      console.error("cartHtmlBridge: refreshAndPost 失敗", e);
    }
  }

  function toLineItemIdNumber(maybeId) {
    const n = Number(maybeId);
    return Number.isFinite(n) ? n : NaN;
  }

  function findLineItemById(cartData, lineItemIdNumber) {
    const items = cartData?.lineItems || [];
    return items.find((x) => toLineItemIdNumber(x?.id) === lineItemIdNumber) || null;
  }

  html.onMessage(async (event) => {
    const msg = event?.data;
    if (!msg || !msg.type) return;
    try {
      const type = String(msg.type || "");
      const payload = msg.payload || {};
      const lineItemId = toLineItemIdNumber(payload?.lineItemId);

      if (type === "SIDE_CART_QTY_INC") {
        if (!Number.isFinite(lineItemId)) return;
        const c = await Promise.resolve(getCartSnapshot(0));
        const li = findLineItemById(c, lineItemId);
        await cart.updateLineItemQuantity(lineItemId, Math.max(1, Number(li?.quantity || 0) + 1));
        await refreshAndPost();
        return;
      }
      if (type === "SIDE_CART_QTY_DEC") {
        if (!Number.isFinite(lineItemId)) return;
        const c = await Promise.resolve(getCartSnapshot(0));
        const li = findLineItemById(c, lineItemId);
        const nextQty = Number(li?.quantity || 0) - 1;
        if (nextQty <= 0) await cart.removeProduct(lineItemId);
        else await cart.updateLineItemQuantity(lineItemId, nextQty);
        await refreshAndPost();
        return;
      }
      if (type === "SIDE_CART_REMOVE") {
        if (!Number.isFinite(lineItemId)) return;
        await cart.removeProduct(lineItemId);
        await refreshAndPost();
        return;
      }
      if (type === "SIDE_CART_CHECKOUT") {
        if (typeof onCheckout === "function") await onCheckout();
        return;
      }
      if (type === "SIDE_CART_ACTION") {
        const action = String(msg.action || "");
        const id = toLineItemIdNumber(msg.lineItemId);
        const qty = Number(msg.qty || 0);
        if (!Number.isFinite(id)) return;
        if (action === "PLUS") { await cart.updateLineItemQuantity(id, Math.max(1, qty + 1)); await refreshAndPost(); return; }
        if (action === "MINUS") { const next = qty - 1; if (next <= 0) await cart.removeProduct(id); else await cart.updateLineItemQuantity(id, next); await refreshAndPost(); return; }
        if (action === "DELETE") { await cart.removeProduct(id); await refreshAndPost(); return; }
        if (action === "CHECKOUT" && typeof onCheckout === "function") { await onCheckout(); return; }
      }
    } catch (err) {
      console.error("cartHtmlBridge: HTML→cart 更新失敗", err);
    }
  });

  Promise.resolve().then(() => getCartSnapshot(0)).then(postCart).catch((err) => console.error("cartHtmlBridge: 初回送信失敗", err));
  if (!__cartHtmlBridgeBound) {
    cart.onChange((event) => { try { postCart(event); } catch (err) { console.error("cartHtmlBridge: onChange送信失敗", err); } });
    __cartHtmlBridgeBound = true;
  }
}
