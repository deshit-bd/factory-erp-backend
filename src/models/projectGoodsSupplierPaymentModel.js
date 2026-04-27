const { pool } = require("../config/db");

function formatPaymentCode(id) {
  return `PGSP-${String(id).padStart(3, "0")}`;
}

function formatInvoiceCode(id) {
  return `PGSPI-${String(id).padStart(3, "0")}`;
}

function formatDateValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateDisplay(value) {
  const normalized = formatDateValue(value);

  if (!normalized) {
    return "";
  }

  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function formatCurrency(value) {
  return `৳${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function mapPaymentRow(row) {
  return {
    recordId: row.id,
    id: formatPaymentCode(row.id),
    supplierRecordId: row.supplier_id,
    supplierId: row.supplier_code || `PGS-${String(row.supplier_id).padStart(3, "0")}`,
    supplier: row.supplier_name || `Supplier #${row.supplier_id}`,
    projectRecordId: null,
    project: "N/A",
    projectName: "",
    paymentMethod: row.payment_method === "cash" ? "Cash" : "Bank",
    totalPaid: formatCurrency(row.paid_amount),
    remainingDue: formatCurrency(row.due_amount),
    previousDueAmount: formatCurrency(Number(row.paid_amount || 0) + Number(row.due_amount || 0)),
    status: row.payment_status === "paid" ? "Paid" : "Partial",
    date: formatDateDisplay(row.payment_date),
    dateValue: formatDateValue(row.payment_date),
    invoiceId: formatInvoiceCode(row.id),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const paymentSelect = `SELECT pgsp.id, pgsp.payment_date, pgsp.supplier_id, pgsp.payment_method,
       pgsp.paid_amount, pgsp.due_amount, pgsp.payment_status, pgsp.created_at, pgsp.updated_at,
       pgs.name AS supplier_name
     FROM project_goods_supplier_payment pgsp
     INNER JOIN project_goods_supplier pgs ON pgs.id = pgsp.supplier_id`;

async function getAllProjectGoodsSupplierPayments() {
  const [rows] = await pool.query(
    `${paymentSelect}
     ORDER BY pgsp.id DESC`,
  );

  return rows.map(mapPaymentRow);
}

async function getProjectGoodsSupplierPaymentById(id, connection = pool) {
  const [rows] = await connection.query(
    `${paymentSelect}
     WHERE pgsp.id = ?
     LIMIT 1`,
    [Number(id)],
  );

  return rows[0] ? mapPaymentRow(rows[0]) : null;
}

async function createProjectGoodsSupplierPayment(paymentData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [supplierRows] = await connection.query(
      `SELECT id, COALESCE(previous_due, 0) AS previous_due
       FROM project_goods_supplier
       WHERE id = ?
       LIMIT 1`,
      [Number(paymentData.supplierId)],
    );

    if (!supplierRows[0]) {
      throw new Error("Project goods supplier not found.");
    }

    const previousDue = Number(supplierRows[0].previous_due || 0);
    const paidAmount = Number(paymentData.paidAmount || 0);

    if (paidAmount > previousDue) {
      throw new Error("Paid amount cannot be greater than the remaining due.");
    }

    const dueAmount = Math.max(previousDue - paidAmount, 0);
    const paymentStatus = dueAmount === 0 ? "paid" : "partial";

    const [result] = await connection.query(
      `INSERT INTO project_goods_supplier_payment (payment_date, supplier_id, payment_method, paid_amount, due_amount, payment_status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        paymentData.paymentDate,
        Number(paymentData.supplierId),
        paymentData.paymentMethod,
        paidAmount,
        dueAmount,
        paymentStatus,
      ],
    );

    await connection.query(
      `UPDATE project_goods_supplier
       SET previous_due = ?
       WHERE id = ?`,
      [dueAmount, Number(paymentData.supplierId)],
    );

    await connection.commit();

    return getProjectGoodsSupplierPaymentById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createProjectGoodsSupplierPayment,
  getAllProjectGoodsSupplierPayments,
};
