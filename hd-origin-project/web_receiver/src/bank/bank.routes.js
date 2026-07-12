const { sendJson } = require("../response");
const repo = require("./bank.repository");

function parseRequestUrl(url) {
  return new URL(
    String(url || ""),
    "http://localhost"
  );
}

async function handleBankRoutes(req, res) {
  const parsed = parseRequestUrl(req.url);
  const pathname = parsed.pathname;

  if (
    req.method === "GET" &&
    pathname === "/api/bank/accounts"
  ) {
    const result =
      await repo.listAccounts(
        parsed.searchParams.get("company_id")
      );

    sendJson(res, 200, {
      ok: true,
      company: result.company,
      accounts: result.accounts
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/bank/transactions"
  ) {
    const result =
      await repo.listTransactions(
        parsed.searchParams.get("company_id"),
        {
          limit:
            parsed.searchParams.get("limit")
        }
      );

    sendJson(res, 200, {
      ok: true,
      company: result.company,
      transactions: result.transactions
    });

    return true;
  }

  if (
    req.method === "GET" &&
    pathname === "/api/bank/summary"
  ) {
    const result =
      await repo.getSummary(
        parsed.searchParams.get("company_id")
      );

    sendJson(res, 200, {
      ok: true,
      company: result.company,
      summary: result.summary
    });

    return true;
  }

  return false;
}

module.exports = {
  handleBankRoutes
};