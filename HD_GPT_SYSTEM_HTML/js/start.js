const menus = {
  accounting: {
    title: "会計ソフト 編集",
    text: "HD Origin会計ソフト側の編集入口です。支払書類、レシート、請求・未払、マスタ管理などをここから分けます。",
    items: [
      ["支払書類", "仕分け・専門解析・総務フロー"],
      ["レシート", "レシート読取・下書き・本保存"],
      ["請求・未払", "請求書・未払管理・明細"],
      ["マスタ管理", "区分・税区分・勘定科目・支払先"]
    ]
  },
  wix: {
    title: "Wix編集",
    text: "Wix本番を直接触らず、ローカルHTML・外部HTML・貼り付け用コードを作る入口です。",
    items: [
      ["トップページ", "ブランド導線・メイン表示"],
      ["商品ページ", "商品説明・サイズ・価格表示"],
      ["ブランドページ", "Rasi:m・HELMETTY・HATODAIYA"],
      ["外部HTML埋め込み", "iframe・HTML貼り付け・表示テスト"]
    ]
  }
};

const detailPanel = document.getElementById("detailPanel");

document.querySelectorAll(".menu-card").forEach((button) => {
  button.addEventListener("click", () => {
    const key = button.dataset.target;
    const menu = menus[key];

    if (!menu || !detailPanel) return;

    const itemsHtml = menu.items.map((item) => {
      return `
        <button class="sub-button" type="button">
          <strong>${item[0]}</strong>
          <span>${item[1]}</span>
        </button>
      `;
    }).join("");

    detailPanel.innerHTML = `
      <h2>${menu.title}</h2>
      <p>${menu.text}</p>
      <div class="sub-menu">
        ${itemsHtml}
      </div>
    `;
  });
});

console.log("HD GPT SYSTEM HTML loaded.");
