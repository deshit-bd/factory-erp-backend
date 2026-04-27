const { pool } = require("../config/db");

function formatPaymentCode(id) {
  return `RMSP-${String(id).padStart(3, "0")}`;
}

function formatInvoiceCode(id) {
  return `RMSPI-${String(id).padStart(3, "0")}`;
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
    supplierId: row.supplier_code || `RMS-${String(row.supplier_id).padStart(3, "0")}`,
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

const paymentSelect = `SELECT rmsp.id, rmsp.payment_date, rmsp.supplier_id, rmsp.payment_method,
       rmsp.paid_amount, rmsp.due_amount, rmsp.payment_status, rmsp.created_at, rmsp.updated_at,
       rms.name AS supplier_name
     FROM raw_material_supplier_payment rmsp
     INNER JOIN raw_material_supplier rms ON rms.id = rmsp.supplier_id`;

async function getAllRawMaterialSupplierPayments() {
  const [rows] = await pool.query(
    `${paymentSelect}
     ORDER BY rmsp.id DESC`,
  );

  return rows.map(mapPaymentRow);
}

async function getRawMaterialSupplierPaymentById(id, connection = pool) {
  const [rows] = await connection.query(
    `${paymentSelect}
     WHERE rmsp.id = ?
     LIMIT 1`,
    [Number(id)],
  );

  return rows[0] ? mapPaymentRow(rows[0]) : null;
}

async function createRawMaterialSupplierPayment(paymentData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [supplierRows] = await connection.query(
      `SELECT id, previous_due
       FROM raw_material_supplier
       WHERE id = ?
       LIMIT 1`,
      [Number(paymentData.supplierId)],
    );

    if (!supplierRows[0]) {
      throw new Error("Raw material supplier not found.");
    }

    const previousDue = Number(supplierRows[0].previous_due || 0);
    const paidAmount = Number(paymentData.paidAmount || 0);

    if (paidAmount > previousDue) {
      throw new Error("Paid amount cannot be greater than the remaining due.");
    }

    const dueAmount = Math.max(previousDue - paidAmount, 0);
    const paymentStatus = dueAmount === 0 ? "paid" : "partial";

    const [result] = await connection.query(
      `INSERT INTO raw_material_supplier_payment (payment_date, supplier_id, payment_method, paid_amount, due_amount, payment_status)
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
      `UPDATE raw_material_supplier
       SET previous_due = ?
       WHERE id = ?`,
      [dueAmount, Number(paymentData.supplierId)],
    );

    await connection.commit();

    return getRawMaterialSupplierPaymentById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createRawMaterialSupplierPayment,
  getAllRawMaterialSupplierPayments,
};
