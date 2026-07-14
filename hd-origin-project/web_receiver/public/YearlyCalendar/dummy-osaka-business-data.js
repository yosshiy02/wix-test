(() => {
    const FLAG_KEY = "hdDummyOsakaBusinessDataInsertedV1";
    const EVENT_KEY = "teamEventsMulti";

    if (localStorage.getItem(FLAG_KEY)) return;

    function uuid() {
        return "dummy_" + Math.random().toString(36).slice(2, 10);
    }

    function readEvents() {
        try {
            return JSON.parse(localStorage.getItem(EVENT_KEY) || "{}");
        } catch {
            return {};
        }
    }

    function saveEvents(events) {
        localStorage.setItem(EVENT_KEY, JSON.stringify(events));
    }

    function add(events, date, channel, user, text) {
        if (!events[date]) events[date] = [];
        events[date].push({
            id: uuid(),
            channel,
            user,
            text
        });
    }

    const events = readEvents();

    // ==========================================
    // 大阪本社・会計
    // ==========================================
    add(events, "2026-07-17", "accounting", "kawatani", "09:30 [準備] 20日締め 請求書不足確認 / 大阪本社");
    add(events, "2026-07-20", "accounting", "kawatani", "15:00 [締切] 請求締め処理 / 大阪本社");
    add(events, "2026-07-21", "accounting", "kawatani", "10:00 [実行] 請求書送付 / 大阪本社");
    add(events, "2026-07-24", "accounting", "sakaguchi", "13:00 [準備] 月末振込リスト確認 / 大阪本社");
    add(events, "2026-07-27", "accounting", "sakaguchi", "10:00 [実行] 給与振込 / 大阪本社");
    add(events, "2026-07-31", "accounting", "sakaguchi", "14:00 [実行] 月末支払・振込実行 / 大阪本社");
    add(events, "2026-08-07", "accounting", "kawatani", "11:00 [準備] 源泉所得税・市民税 納付書確認");
    add(events, "2026-08-10", "accounting", "sakaguchi", "09:30 [締切] 源泉所得税・市民税 納付");

    // ==========================================
    // 製造・出荷
    // ==========================================
    add(events, "2026-07-22", "manufacture", "takayama", "09:00 [準備] 生地・資材在庫確認 / 大阪工場");
    add(events, "2026-07-23", "manufacture", "takayama", "13:00 [実行] 製造開始 MTG / 大阪工場");
    add(events, "2026-07-28", "manufacture", "takayama", "10:00 [確認] 初回ロット検品 / 大阪工場");
    add(events, "2026-07-29", "manufacture", "takayama", "15:00 [実行] 出荷前検品・梱包指示");
    add(events, "2026-07-30", "manufacture", "kawatani", "11:00 [実行] 出荷手配 / 大阪倉庫");
    add(events, "2026-08-03", "manufacture", "takayama", "16:00 [締切] 納期回答期限 / 取引先A");

    // ==========================================
    // 商談・販売
    // ==========================================
    add(events, "2026-07-18", "sales", "sakaguchi", "14:00 [商談] 新規取引先 打合せ / 大阪市内");
    add(events, "2026-07-22", "sales", "sakaguchi", "17:00 [準備] 見積資料作成");
    add(events, "2026-07-24", "sales", "sakaguchi", "10:30 [実行] 見積提出 / メール送付");
    add(events, "2026-07-31", "sales", "kawatani", "12:00 [締切] 回答期限 / 取引先B");

    // ==========================================
    // 遠征・出店：東京
    // 大阪 → 東京：前日移動、本番、翌日帰阪
    // ==========================================
    add(events, "2026-08-04", "event", "sakaguchi", "13:00 [移動] 大阪→東京 出店準備移動");
    add(events, "2026-08-04", "event", "takayama", "15:00 [準備] 東京会場 搬入チェック");
    add(events, "2026-08-05", "event", "sakaguchi", "09:00 [実行] 東京展示会 出店1日目");
    add(events, "2026-08-06", "event", "sakaguchi", "09:00 [実行] 東京展示会 出店2日目");
    add(events, "2026-08-06", "event", "kawatani", "17:30 [確認] 売上・名刺・商談メモ回収");
    add(events, "2026-08-07", "event", "sakaguchi", "10:00 [移動] 東京→大阪 帰阪");
    add(events, "2026-08-07", "sales", "kawatani", "15:00 [実行] 展示会フォロー メール送付");

    // ==========================================
    // 遠征・納品：名古屋
    // ==========================================
    add(events, "2026-08-17", "manufacture", "takayama", "16:00 [準備] 名古屋納品分 梱包・積込");
    add(events, "2026-08-18", "manufacture", "takayama", "08:00 [移動] 大阪→名古屋 納品移動");
    add(events, "2026-08-18", "manufacture", "takayama", "13:00 [実行] 名古屋 取引先へ納品");
    add(events, "2026-08-18", "sales", "sakaguchi", "15:00 [商談] 名古屋 追加案件ヒアリング");
    add(events, "2026-08-19", "manufacture", "takayama", "09:00 [移動] 名古屋→大阪 帰阪");
    add(events, "2026-08-19", "sales", "sakaguchi", "14:00 [確認] 名古屋商談メモ整理");

    // ==========================================
    // 遠征・出店：福岡
    // ==========================================
    add(events, "2026-09-10", "event", "sakaguchi", "11:00 [移動] 大阪→福岡 出店移動");
    add(events, "2026-09-10", "event", "kawatani", "16:00 [準備] 福岡会場 搬入・設営");
    add(events, "2026-09-11", "event", "sakaguchi", "10:00 [実行] 福岡イベント 出店");
    add(events, "2026-09-12", "event", "sakaguchi", "10:00 [実行] 福岡イベント 出店");
    add(events, "2026-09-12", "accounting", "kawatani", "18:00 [確認] 福岡イベント 売上仮集計");
    add(events, "2026-09-13", "event", "sakaguchi", "09:00 [移動] 福岡→大阪 帰阪");
    add(events, "2026-09-14", "accounting", "kawatani", "11:00 [実行] 福岡イベント 売上・経費整理");

    // ==========================================
    // 納期逆算テスト
    // ==========================================
    add(events, "2026-09-18", "sales", "sakaguchi", "17:00 [締切] 取引先C 納期確定回答");
    add(events, "2026-09-21", "manufacture", "takayama", "09:00 [準備] 取引先C 材料準備");
    add(events, "2026-09-24", "manufacture", "takayama", "09:00 [実行] 取引先C 製造開始");
    add(events, "2026-09-29", "manufacture", "takayama", "13:00 [確認] 取引先C 検品");
    add(events, "2026-09-30", "manufacture", "kawatani", "10:00 [実行] 取引先C 出荷");
    add(events, "2026-10-02", "manufacture", "kawatani", "17:00 [締切] 取引先C 納品予定日");

    // ==========================================
    // 全般・経営確認
    // ==========================================
    add(events, "2026-07-25", "general", "sakaguchi", "18:00 [確認] 会社全体の今月タスク棚卸し");
    add(events, "2026-08-01", "general", "sakaguchi", "10:00 [確認] 月初 経営・資金繰り確認");
    add(events, "2026-09-01", "general", "sakaguchi", "10:00 [確認] 月初 業務フロー見直し");

    saveEvents(events);
    localStorage.setItem(FLAG_KEY, "1");

    alert("大阪拠点・遠征移動日つきのダミーデータを追加しました。ブラウザを手動でF5更新してください。");
})();