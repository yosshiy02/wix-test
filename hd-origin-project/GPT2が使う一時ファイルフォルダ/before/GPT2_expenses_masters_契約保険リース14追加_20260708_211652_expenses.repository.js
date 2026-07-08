const pool = require("../db");

async function getMasters() {
  const [
    accountTitles,
    paymentMethods,
    taxCategories,
    vendors,
    targetPeople,
    purposes,
    projects,
    departments
  ] = await Promise.all([
    pool.query(`
      SELECT account_title_id, account_code, account_name
      FROM expenses.account_titles
      WHERE is_active = TRUE
      ORDER BY sort_order, account_title_id
    `),
    pool.query(`
      SELECT payment_method_id, method_name, default_credit_account
      FROM expenses.payment_methods
      WHERE is_active = TRUE
      ORDER BY sort_order, payment_method_id
    `),
    pool.query(`
      SELECT tax_category_id, tax_name, tax_rate
      FROM expenses.tax_categories
      WHERE is_active = TRUE
      ORDER BY sort_order, tax_category_id
    `),
    pool.query(`
      SELECT vendor_id, vendor_name
      FROM expenses.vendors
      WHERE is_active = TRUE
      ORDER BY vendor_name
      LIMIT 300
    `),
    pool.query(`
      SELECT target_person_id, target_person_name
      FROM expenses.target_people
      WHERE is_active = TRUE
      ORDER BY sort_order, target_person_id
    `),
    pool.query(`
      SELECT purpose_id, purpose_name
      FROM expenses.purposes
      WHERE is_active = TRUE
      ORDER BY sort_order, purpose_id
    `),
    pool.query(`
      SELECT project_id, project_name
      FROM expenses.projects
      WHERE is_active = TRUE
      ORDER BY sort_order, project_id
    `),
    pool.query(`
      SELECT department_id, department_name
      FROM expenses.departments
      WHERE is_active = TRUE
      ORDER BY sort_order, department_id
    `),
  ]);

  return {
    account_titles: accountTitles.rows,
    payment_methods: paymentMethods.rows,
    tax_categories: taxCategories.rows,
    vendors: vendors.rows,
    target_people: targetPeople.rows,
    purposes: purposes.rows,
    projects: projects.rows,
    departments: departments.rows,
  };
}

async function findPaymentMethod(client, paymentMethodId) {
  if (!paymentMethodId) return null;

  const result = await client.query(
    `
    SELECT payment_method_id, method_name
    FROM expenses.payment_methods
    WHERE payment_method_id = $1
    `,
    [paymentMethodId]
  );

  return result.rows[0] || null;
}

async function findAccountTitle(client, accountTitleId) {
  if (!accountTitleId) return null;

  const result = await client.query(
    `
    SELECT account_title_id, account_name
    FROM expenses.account_titles
    WHERE account_title_id = $1
    `,
    [accountTitleId]
  );

  return result.rows[0] || null;
}

async function findTaxCategory(client, taxCategoryId) {
  if (!taxCategoryId) return null;

  const result = await client.query(
    `
    SELECT tax_category_id, tax_name, tax_rate
    FROM expenses.tax_categories
    WHERE tax_category_id = $1
    `,
    [taxCategoryId]
  );

  return result.rows[0] || null;
}

async function findTargetPerson(client, targetPersonId) {
  if (!targetPersonId) return null;

  const result = await client.query(
    `
    SELECT target_person_id, target_person_name
    FROM expenses.target_people
    WHERE target_person_id = $1
    `,
    [targetPersonId]
  );

  return result.rows[0] || null;
}

async function findPurpose(client, purposeId) {
  if (!purposeId) return null;

  const result = await client.query(
    `
    SELECT purpose_id, purpose_name
    FROM expenses.purposes
    WHERE purpose_id = $1
    `,
    [purposeId]
  );

  return result.rows[0] || null;
}

async function findProject(client, projectId) {
  if (!projectId) return null;

  const result = await client.query(
    `
    SELECT project_id, project_name
    FROM expenses.projects
    WHERE project_id = $1
    `,
    [projectId]
  );

  return result.rows[0] || null;
}

async function findDepartment(client, departmentId) {
  if (!departmentId) return null;

  const result = await client.query(
    `
    SELECT department_id, department_name
    FROM expenses.departments
    WHERE department_id = $1
    `,
    [departmentId]
  );

  return result.rows[0] || null;
}

async function upsertVendor(client, vendorName) {
  const name = String(vendorName || "").trim();

  if (!name) return null;

  const result = await client.query(
    `
    INSERT INTO expenses.vendors (vendor_name)
    VALUES ($1)
    ON CONFLICT (vendor_name)
    DO UPDATE SET vendor_name = EXCLUDED.vendor_name
    RETURNING vendor_id, vendor_name
    `,
    [name]
  );

  return result.rows[0];
}

async function createExpense(payload) {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const details = Array.isArray(payload.details) ? payload.details : [];

    const validDetails = details
      .map((d, index) => ({
        line_no: index + 1,
        account_title_id: d.account_title_id ? Number(d.account_title_id) : null,
        description: String(d.description || "").trim(),
        amount: Number(d.amount || 0),
        tax_category_id: d.tax_category_id ? Number(d.tax_category_id) : null,
        memo: String(d.memo || "").trim(),
      }))
      .filter(d => d.description || d.amount);

    if (!payload.expense_date) {
      throw new Error("日付が未入力です。");
    }

    if (!validDetails.length) {
      throw new Error("明細がありません。");
    }

    const vendor = await upsertVendor(client, payload.vendor_name);
    const paymentMethod = await findPaymentMethod(client, payload.payment_method_id);

    const targetPerson = await findTargetPerson(client, payload.target_person_id);
    const purpose = await findPurpose(client, payload.purpose_id);
    const project = await findProject(client, payload.project_id);
    const department = await findDepartment(client, payload.department_id);

    const totalAmount = validDetails.reduce((sum, d) => sum + Number(d.amount || 0), 0);

    const headerResult = await client.query(
      `
      INSERT INTO expenses.expense_headers
        (
          expense_date,
          vendor_id,
          vendor_name,
          payment_method_id,
          payment_method_name,
          total_amount,
          target_person_id,
          target_person,
          purpose_id,
          purpose,
          project_id,
          project_name,
          department_id,
          department_name,
          invoice_status,
          invoice_number,
          evidence_type,
          evidence_memo,
          summary
        )
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      RETURNING *
      `,
      [
        payload.expense_date,
        vendor ? vendor.vendor_id : null,
        vendor ? vendor.vendor_name : String(payload.vendor_name || "").trim(),
        paymentMethod ? paymentMethod.payment_method_id : null,
        paymentMethod ? paymentMethod.method_name : "",
        totalAmount,
        targetPerson ? targetPerson.target_person_id : null,
        targetPerson ? targetPerson.target_person_name : "",
        purpose ? purpose.purpose_id : null,
        purpose ? purpose.purpose_name : "",
        project ? project.project_id : null,
        project ? project.project_name : "",
        department ? department.department_id : null,
        department ? department.department_name : "",
        String(payload.invoice_status || "").trim(),
        String(payload.invoice_number || "").trim(),
        String(payload.evidence_type || "").trim(),
        String(payload.evidence_memo || "").trim(),
        String(payload.summary || "").trim(),
      ]
    );

    const expenseId = headerResult.rows[0].expense_id;

    for (const detail of validDetails) {
      const accountTitle = await findAccountTitle(client, detail.account_title_id);
      const taxCategory = await findTaxCategory(client, detail.tax_category_id);

      await client.query(
        `
        INSERT INTO expenses.expense_details
          (expense_id, line_no, account_title_id, account_title_name, description, amount,
           tax_category_id, tax_category_name, tax_rate, memo)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        `,
        [
          expenseId,
          detail.line_no,
          accountTitle ? accountTitle.account_title_id : null,
          accountTitle ? accountTitle.account_name : "",
          detail.description,
          detail.amount,
          taxCategory ? taxCategory.tax_category_id : null,
          taxCategory ? taxCategory.tax_name : "",
          taxCategory ? taxCategory.tax_rate : 0,
          detail.memo,
        ]
      );
    }

    await client.query("COMMIT");

    return await getExpense(expenseId);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function listExpenses() {
  const result = await pool.query(`
    SELECT
      h.expense_id,
      h.expense_date,
      h.vendor_name,
      h.payment_method_name,
      h.total_amount,
      h.target_person,
      h.purpose,
      h.project_name,
      h.department_name,
      h.invoice_status,
      h.invoice_number,
      h.evidence_type,
      h.evidence_memo,
      h.summary,
      h.created_at,
      COUNT(d.detail_id)::int AS detail_count
    FROM expenses.expense_headers h
    LEFT JOIN expenses.expense_details d
      ON d.expense_id = h.expense_id
    GROUP BY h.expense_id
    ORDER BY h.expense_date DESC, h.expense_id DESC
    LIMIT 300
  `);

  return result.rows;
}

async function getExpense(expenseId) {
  const header = await pool.query(
    `
    SELECT *
    FROM expenses.expense_headers
    WHERE expense_id = $1
    `,
    [expenseId]
  );

  if (!header.rows[0]) {
    const err = new Error("経費データが見つかりません。");
    err.statusCode = 404;
    throw err;
  }

  const details = await pool.query(
    `
    SELECT *
    FROM expenses.expense_details
    WHERE expense_id = $1
    ORDER BY line_no, detail_id
    `,
    [expenseId]
  );

  return {
    header: header.rows[0],
    details: details.rows,
  };
}

async function deleteExpense(expenseId) {
  const result = await pool.query(
    `
    DELETE FROM expenses.expense_headers
    WHERE expense_id = $1
    RETURNING expense_id
    `,
    [expenseId]
  );

  return result.rowCount > 0;
}

async function listExpenseCsvRows() {
  const result = await pool.query(`
    SELECT
      h.expense_id,
      h.expense_date,
      h.vendor_name,
      h.payment_method_name,
      h.target_person,
      h.purpose,
      h.project_name,
      h.department_name,
      h.invoice_status,
      h.invoice_number,
      h.evidence_type,
      h.evidence_memo,
      h.summary,
      d.line_no,
      d.account_title_name,
      d.description,
      d.amount,
      d.tax_category_name,
      d.memo
    FROM expenses.expense_headers h
    JOIN expenses.expense_details d
      ON d.expense_id = h.expense_id
    ORDER BY h.expense_date DESC, h.expense_id DESC, d.line_no
  `);

  return result.rows;
}

module.exports = {
  getMasters,
  createExpense,
  listExpenses,
  getExpense,
  deleteExpense,
  listExpenseCsvRows,
};
