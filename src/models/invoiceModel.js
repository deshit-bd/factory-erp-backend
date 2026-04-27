const { pool } = require("../config/db");

function formatInvoiceCode(invoiceNo, id) {
  if (invoiceNo) {
    return invoiceNo;
  }

  return `INV-${String(id).padStart(3, "0")}`;
}

function formatProjectCode(id) {
  return `PRJ-${String(id).padStart(3, "0")}`;
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return `৳${amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function formatDateValue(value) {
  if (!value) {
    return "";
  }

  const dateText = String(value);
  const dateOnlyMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    return dateOnlyMatch[0];
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeInvoiceStatus({ totalAmount, paidAmount }) {
  const total = Number(totalAmount || 0);
  const paid = Number(paidAmount || 0);
  const due = Math.max(total - paid, 0);

  if (due === 0) {
    return "Paid";
  }

  if (paid > 0) {
    return "Partial";
  }

  return "Unpaid";
}

function mapInvoiceRow(row) {
  return {
    recordId: row.id,
    id: formatInvoiceCode(row.invoice_no, row.id),
    buyerId: row.buyer_id,
    buyer: row.buyer_company || "",
    projectRecordId: row.project_id,
    project: row.project_code || formatProjectCode(row.project_id),
    projectName: row.project_name || "",
    amount: formatMoney(row.total_amount),
    amountValue: String(Number(row.total_amount || 0)),
    paid: formatMoney(row.paid_amount),
    paidValue: String(Number(row.paid_amount || 0)),
    due: formatMoney(row.due_amount),
    dueValue: String(Number(row.due_amount || 0)),
    date: formatDateValue(row.invoice_date),
    status: row.status || "Unpaid",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function syncBuyerPreviousDue(connection, buyerId) {
  await connection.query(
    `UPDATE buyer
     SET previous_due = COALESCE((
       SELECT SUM(i.due_amount)
       FROM invoices i
       WHERE i.buyer_id = ?
     ), 0)
     WHERE id = ?`,
    [Number(buyerId), Number(buyerId)],
  );
}

async function getNextInvoiceNumber(connection) {
  const [rows] = await connection.query(
    `SELECT AUTO_INCREMENT AS next_id
     FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = 'invoices'
     LIMIT 1`,
  );

  const nextId = Number(rows[0]?.next_id || 1);
  return `INV-${String(nextId).padStart(3, "0")}`;
}

const invoiceSelect = `SELECT i.id, i.invoice_no, i.buyer_id, i.project_id, i.total_amount, i.paid_amount, i.due_amount,
       i.invoice_date, i.status, i.created_at, i.updated_at,
       b.company AS buyer_company,
       CONCAT('PRJ-', LPAD(i.project_id, 3, '0')) AS project_code,
       COALESCE(p.product, p.name) AS project_name
     FROM invoices i
     INNER JOIN buyer b ON b.id = i.buyer_id
     INNER JOIN projects p ON p.id = i.project_id`;

async function getInvoiceById(id, connection = pool) {
  const [rows] = await connection.query(
    `${invoiceSelect}
     WHERE i.id = ?
     LIMIT 1`,
    [Number(id)],
  );

  return rows[0] ? mapInvoiceRow(rows[0]) : null;
}

async function getAllInvoices(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${invoiceSelect}
       ORDER BY i.id DESC`,
    );

    return rows.map(mapInvoiceRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${invoiceSelect}
     WHERE i.invoice_no LIKE ?
       OR b.company LIKE ?
       OR CONCAT('PRJ-', LPAD(i.project_id, 3, '0')) LIKE ?
       OR COALESCE(p.product, p.name) LIKE ?
       OR i.invoice_date LIKE ?
       OR i.status LIKE ?
     ORDER BY i.id DESC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapInvoiceRow);
}

async function getInvoiceFormOptions() {
  const [buyerRows] = await pool.query(
    `SELECT id, name, company, previous_due
     FROM buyer
     WHERE status = 'active'
     ORDER BY company ASC`,
  );

  const [projectRows] = await pool.query(
    `SELECT p.id,
            b.id AS buyer_id,
            b.company AS buyer_company,
            COALESCE(p.product, p.name) AS project_name,
            p.delivery_date,
            COALESCE(so.total_order_amount, 0) AS total_order_amount
     FROM projects p
     INNER JOIN buyer b ON b.company = p.buyer
     LEFT JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity * unit_price) AS total_order_amount
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = COALESCE(p.product, p.name)
         AND so.buyer = p.buyer
         AND so.delivery_date = p.delivery_date
     ORDER BY p.id DESC`,
  );

  return {
    buyers: buyerRows.map((row) => ({
      recordId: row.id,
      id: `BYR-${String(row.id).padStart(3, "0")}`,
      name: row.name,
      company: row.company,
      previousDue: String(Number(row.previous_due || 0)),
      previousDueFormatted: formatMoney(row.previous_due),
    })),
    projects: projectRows.map((row) => ({
      recordId: row.id,
      id: formatProjectCode(row.id),
      buyerRecordId: row.buyer_id,
      buyer: row.buyer_company,
      name: row.project_name || "",
      deliveryDate: formatDateValue(row.delivery_date),
      amountValue: String(Number(row.total_order_amount || 0)),
      amountFormatted: formatMoney(row.total_order_amount),
    })),
  };
}

async function getProjectInvoiceAmount(connection, buyerId, projectId) {
  const [rows] = await connection.query(
    `SELECT p.id,
            b.id AS buyer_id,
            COALESCE(so.total_order_amount, 0) AS total_order_amount
     FROM projects p
     INNER JOIN buyer b ON b.company = p.buyer
     LEFT JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity * unit_price) AS total_order_amount
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = COALESCE(p.product, p.name)
         AND so.buyer = p.buyer
         AND so.delivery_date = p.delivery_date
     WHERE p.id = ?
       AND b.id = ?
     LIMIT 1`,
    [Number(projectId), Number(buyerId)],
  );

  return rows[0] || null;
}

async function createInvoice(invoiceData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const projectAmountRow = await getProjectInvoiceAmount(connection, invoiceData.buyerId, invoiceData.projectId);

    if (!projectAmountRow) {
      throw new Error("Selected project does not belong to the selected buyer.");
    }

    const totalAmount = Number(projectAmountRow.total_order_amount || 0);
    const paidAmount = Number(invoiceData.paidAmount || 0);

    if (totalAmount <= 0) {
      throw new Error("No invoice amount found for the selected buyer and project.");
    }

    if (paidAmount < 0) {
      throw new Error("Paid amount cannot be negative.");
    }

    if (paidAmount > totalAmount) {
      throw new Error("Paid amount cannot exceed total amount.");
    }

    const dueAmount = Math.max(totalAmount - paidAmount, 0);
    const invoiceNo = await getNextInvoiceNumber(connection);
    const status = normalizeInvoiceStatus({ totalAmount, paidAmount });

    const [result] = await connection.query(
      `INSERT INTO invoices (invoice_no, buyer_id, project_id, total_amount, paid_amount, due_amount, invoice_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNo,
        Number(invoiceData.buyerId),
        Number(invoiceData.projectId),
        totalAmount,
        paidAmount,
        dueAmount,
        invoiceData.date,
        status,
      ],
    );

    await syncBuyerPreviousDue(connection, invoiceData.buyerId);
    await connection.commit();

    return getInvoiceById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createInvoice,
  getAllInvoices,
  getInvoiceFormOptions,
};
