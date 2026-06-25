const { sendJson, readBody, csvEscape } = require("../response");
const repo = require("./expenses.repository");

function getExpenseIdFromUrl(url) {
  const match = url.match(/^\/api\/expenses\/(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function handleExpenseRoutes(req, res) {
  if (req.method === "GET" && req.url === "/api/expenses/masters") {
    const masters = await repo.getMasters();

    sendJson(res, 200, {
      ok: true,
      masters,
    });

    return true;
  }

  if (req.method === "GET" && req.url === "/api/expenses") {
    const expenses = await repo.listExpenses();

    sendJson(res, 200, {
      ok: true,
      expenses,
    });

    return true;
  }

  if (req.method === "POST" && req.url === "/api/expenses") {
    const raw = await readBody(req);
    const payload = JSON.parse(raw || "{}");

    const expense = await repo.createExpense(payload);

    sendJson(res, 200, {
      ok: true,
      message: "経費を保存しました。",
      expense,
    });

    return true;
  }

  if (req.method === "GET" && /^\/api\/expenses\/\d+$/.test(req.url)) {
    const expenseId = getExpenseIdFromUrl(req.url);
    const expense = await repo.getExpense(expenseId);

    sendJson(res, 200, {
      ok: true,
      expense,
    });

    return true;
  }

  if (req.method === "DELETE" && /^\/api\/expenses\/\d+$/.test(req.url)) {
    const expenseId = getExpenseIdFromUrl(req.url);
    const deleted = await repo.deleteExpense(expenseId);

    sendJson(res, 200, {
      ok: deleted,
      message: deleted ? "削除しました。" : "削除対象がありません。",
    });

    return true;
  }

  if (req.method === "GET" && req.url === "/api/expenses.csv") {
    const rows = await repo.listExpenseCsvRows();

    const header = [
      "経費ID",
      "日付",
      "支払先",
      "支払方法",
      "摘要",
      "行",
      "勘定科目",
      "内容",
      "金額",
      "税区分",
      "メモ"
    ];

    const lines = [header.map(csvEscape).join(",")];

    for (const row of rows) {
      lines.push([
        row.expense_id,
        row.expense_date,
        row.vendor_name,
        row.payment_method_name,
        row.summary,
        row.line_no,
        row.account_title_name,
        row.description,
        row.amount,
        row.tax_category_name,
        row.memo,
      ].map(csvEscape).join(","));
    }

    res.writeHead(200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=expenses.csv"
    });

    res.end("\uFEFF" + lines.join("\r\n"));
    return true;
  }

  return false;
}

module.exports = {
  handleExpenseRoutes,
};
