const { pool } = require("../config/db");
const { insertCashLedgerEntry, insertDueLedgerEntry } = require("./ledgerModel");

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

function normalizeTransferredInvoiceStatus({ totalAmount, paidAmount, wasTransferred }) {
  const total = Number(totalAmount || 0);
  const paid = Number(paidAmount || 0);

  if (wasTransferred && total === 0 && paid === 0) {
    return "Reissued";
  }

  return normalizeInvoiceStatus({ totalAmount: total, paidAmount: paid });
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
    `SELECT b.id, b.name, b.company, COALESCE(inv.total_due_amount, 0) AS total_due_amount
     FROM buyer b
     LEFT JOIN (
       SELECT buyer_id, SUM(due_amount) AS total_due_amount
       FROM invoices
       GROUP BY buyer_id
     ) inv ON inv.buyer_id = b.id
     WHERE status = 'active'
     ORDER BY b.company ASC`,
  );

  const [projectRows] = await pool.query(
    `SELECT p.id,
            b.id AS buyer_id,
            b.company AS buyer_company,
            COALESCE(p.product, p.name) AS project_name,
            p.delivery_date,
            COALESCE(so.total_order_amount, 0) AS total_order_amount,
            COALESCE(inv.total_invoiced_amount, 0) AS total_invoiced_amount,
            COALESCE(inv.total_due_amount, 0) AS total_due_amount
     FROM projects p
     INNER JOIN buyer b ON b.company = p.buyer
     LEFT JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity * unit_price) AS total_order_amount
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = COALESCE(p.product, p.name)
         AND so.buyer = p.buyer
         AND so.delivery_date = p.delivery_date
     LEFT JOIN (
       SELECT buyer_id, project_id, SUM(total_amount) AS total_invoiced_amount, SUM(due_amount) AS total_due_amount
       FROM invoices
       GROUP BY buyer_id, project_id
     ) inv ON inv.buyer_id = b.id
         AND inv.project_id = p.id
     ORDER BY p.id DESC`,
  );

  return {
    buyers: buyerRows.map((row) => ({
      recordId: row.id,
      id: `BYR-${String(row.id).padStart(3, "0")}`,
      name: row.name,
      company: row.company,
      previousDue: String(Number(row.total_due_amount || 0)),
      previousDueFormatted: formatMoney(row.total_due_amount),
    })),
    projects: projectRows.map((row) => {
      const totalAmount = Number(row.total_order_amount || 0);
      const invoicedAmount = Number(row.total_invoiced_amount || 0);
      const dueAmount = Number(row.total_due_amount || 0);
      const remainingAmount = Math.max(totalAmount - invoicedAmount, 0);
      const invoiceableAmount = dueAmount > 0 ? dueAmount : remainingAmount;
      const invoiceSource = dueAmount > 0 ? "due" : "remaining";

      return {
        recordId: row.id,
        id: formatProjectCode(row.id),
        buyerRecordId: row.buyer_id,
        buyer: row.buyer_company,
        name: row.project_name || "",
        deliveryDate: formatDateValue(row.delivery_date),
        amountValue: String(invoiceableAmount),
        amountFormatted: formatMoney(invoiceableAmount),
        invoiceSource,
        totalOrderAmountValue: String(totalAmount),
        totalOrderAmountFormatted: formatMoney(totalAmount),
        totalInvoicedAmountValue: String(invoicedAmount),
        totalInvoicedAmountFormatted: formatMoney(invoicedAmount),
        totalDueAmountValue: String(dueAmount),
        totalDueAmountFormatted: formatMoney(dueAmount),
      };
    }),
  };
}

async function getProjectInvoiceAmount(connection, buyerId, projectId) {
  const [rows] = await connection.query(
    `SELECT p.id,
            b.id AS buyer_id,
            b.company AS buyer_company,
            COALESCE(so.total_order_amount, 0) AS total_order_amount,
            COALESCE(inv.total_invoiced_amount, 0) AS total_invoiced_amount
     FROM projects p
     INNER JOIN buyer b ON b.company = p.buyer
     LEFT JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity * unit_price) AS total_order_amount
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = COALESCE(p.product, p.name)
         AND so.buyer = p.buyer
         AND so.delivery_date = p.delivery_date
     LEFT JOIN (
       SELECT buyer_id, project_id, SUM(total_amount) AS total_invoiced_amount
       FROM invoices
       GROUP BY buyer_id, project_id
     ) inv ON inv.buyer_id = b.id
         AND inv.project_id = p.id
     WHERE p.id = ?
       AND b.id = ?
     LIMIT 1`,
    [Number(projectId), Number(buyerId)],
  );

  return rows[0] || null;
}

async function getProjectDueInvoices(connection, buyerId, projectId) {
  const [rows] = await connection.query(
    `SELECT id, invoice_no, total_amount, paid_amount, due_amount
     FROM invoices
     WHERE buyer_id = ?
       AND project_id = ?
       AND due_amount > 0
     ORDER BY id ASC
     FOR UPDATE`,
    [Number(buyerId), Number(projectId)],
  );

  return rows;
}

async function transferExistingDueToNewInvoice(connection, { buyerId, projectId, transferAmount }) {
  let remainingTransferAmount = Number(transferAmount || 0);

  if (remainingTransferAmount <= 0) {
    return 0;
  }

  const dueInvoices = await getProjectDueInvoices(connection, buyerId, projectId);
  let transferredAmount = 0;

  for (const invoice of dueInvoices) {
    if (remainingTransferAmount <= 0) {
      break;
    }

    const invoiceTotalAmount = Number(invoice.total_amount || 0);
    const invoicePaidAmount = Number(invoice.paid_amount || 0);
    const invoiceDueAmount = Number(invoice.due_amount || 0);
    const movedAmount = Math.min(invoiceDueAmount, remainingTransferAmount);
    const nextTotalAmount = Math.max(invoiceTotalAmount - movedAmount, 0);
    const nextDueAmount = Math.max(invoiceDueAmount - movedAmount, 0);
    const nextStatus = normalizeTransferredInvoiceStatus({
      totalAmount: nextTotalAmount,
      paidAmount: invoicePaidAmount,
      wasTransferred: movedAmount > 0,
    });

    await connection.query(
      `UPDATE invoices
       SET total_amount = ?, due_amount = ?, status = ?
       WHERE id = ?`,
      [nextTotalAmount, nextDueAmount, nextStatus, invoice.id],
    );

    remainingTransferAmount -= movedAmount;
    transferredAmount += movedAmount;
  }

  return transferredAmount;
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
    const totalInvoicedAmount = Number(projectAmountRow.total_invoiced_amount || 0);
    const existingDueAmount = await getProjectDueInvoices(connection, invoiceData.buyerId, invoiceData.projectId).then((rows) =>
      rows.reduce((sum, row) => sum + Number(row.due_amount || 0), 0),
    );
    const remainingAmount = Math.max(totalAmount - totalInvoicedAmount, 0);
    const invoiceAmount = existingDueAmount > 0 ? existingDueAmount : remainingAmount;
    const paidAmount = Number(invoiceData.paidAmount || 0);

    if (totalAmount <= 0) {
      throw new Error("No invoice amount found for the selected buyer and project.");
    }

    if (invoiceAmount <= 0) {
      throw new Error("This project has no remaining invoice amount.");
    }

    if (paidAmount < 0) {
      throw new Error("Paid amount cannot be negative.");
    }

    if (paidAmount > invoiceAmount) {
      throw new Error("Paid amount cannot exceed the remaining invoice amount.");
    }

    if (existingDueAmount > 0) {
      await transferExistingDueToNewInvoice(connection, {
        buyerId: invoiceData.buyerId,
        projectId: invoiceData.projectId,
        transferAmount: existingDueAmount,
      });
    }

    const dueAmount = Math.max(invoiceAmount - paidAmount, 0);
    const invoiceNo = await getNextInvoiceNumber(connection);
    const status = normalizeInvoiceStatus({ totalAmount: invoiceAmount, paidAmount });

    const [result] = await connection.query(
      `INSERT INTO invoices (invoice_no, buyer_id, project_id, total_amount, paid_amount, due_amount, invoice_date, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        invoiceNo,
        Number(invoiceData.buyerId),
        Number(invoiceData.projectId),
        invoiceAmount,
        paidAmount,
        dueAmount,
        invoiceData.date,
        status,
      ],
    );

    const projectCode = formatProjectCode(Number(invoiceData.projectId));
    const buyerName = projectAmountRow.buyer_company || `Buyer #${invoiceData.buyerId}`;

    if (paidAmount > 0) {
      await insertCashLedgerEntry(connection, {
        ledgerDate: invoiceData.date,
        reference: invoiceNo,
        description: `Invoice payment / ${buyerName} / ${projectCode}`,
        debit: paidAmount,
        credit: 0,
      });
    }

    if (existingDueAmount > 0) {
      await insertDueLedgerEntry(connection, {
        ledgerDate: invoiceData.date,
        reference: invoiceNo,
        description: `Buyer due transfer / ${buyerName} / ${projectCode}`,
        debit: 0,
        credit: existingDueAmount,
      });
    }

    if (dueAmount > 0) {
      await insertDueLedgerEntry(connection, {
        ledgerDate: invoiceData.date,
        reference: invoiceNo,
        description: `Buyer due / ${buyerName} / ${projectCode}`,
        debit: dueAmount,
        credit: 0,
      });
    }

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
