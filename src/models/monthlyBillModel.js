const path = require("path");
const { pool } = require("../config/db");

function formatMonthlyBillCode(id) {
  return `BILL-${String(id).padStart(3, "0")}`;
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

function mapMonthlyBillRow(row) {
  const amount = Number(row.amount || 0);
  const receiptPath = row.receipt_path || "";

  return {
    recordId: row.id,
    id: formatMonthlyBillCode(row.id),
    category: row.category || "",
    description: row.description || "",
    amount,
    amountFormatted: `৳${amount.toLocaleString("en-US")}`,
    billDate: formatDateValue(row.bill_date),
    receiptPath,
    receiptName: receiptPath ? path.basename(receiptPath) : "-",
    status: "Pending",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllMonthlyBills() {
  const [rows] = await pool.query(
    `SELECT id, category, description, amount, bill_date, receipt_path, created_at, updated_at
     FROM monthly_bills
     ORDER BY id DESC`,
  );

  return rows.map(mapMonthlyBillRow);
}

async function getMonthlyBillById(id) {
  const [rows] = await pool.query(
    `SELECT id, category, description, amount, bill_date, receipt_path, created_at, updated_at
     FROM monthly_bills
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapMonthlyBillRow(rows[0]) : null;
}

async function createMonthlyBill(monthlyBill) {
  const [result] = await pool.query(
    `INSERT INTO monthly_bills (category, description, amount, bill_date, receipt_path)
     VALUES (?, ?, ?, ?, ?)`,
    [
      monthlyBill.category,
      monthlyBill.description,
      Number(monthlyBill.amount),
      monthlyBill.billDate,
      monthlyBill.receiptPath || null,
    ],
  );

  return getMonthlyBillById(result.insertId);
}

module.exports = {
  createMonthlyBill,
  getAllMonthlyBills,
};
