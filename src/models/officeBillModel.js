const path = require("path");
const { pool } = require("../config/db");

function formatOfficeBillCode(id) {
  return `OFC-${String(id).padStart(3, "0")}`;
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

function mapOfficeBillRow(row) {
  const amount = Number(row.amount || 0);
  const receiptLocation = row.receipt_location || "";

  return {
    recordId: row.id,
    id: formatOfficeBillCode(row.id),
    category: row.cost_category || "",
    description: row.description || "",
    costType: row.category === "monthly" ? "Monthly Costs" : "Daily Costs",
    amount,
    amountFormatted: `৳${amount.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`,
    date: formatDateValue(row.created_at),
    receiptLocation,
    receiptName: receiptLocation ? path.basename(receiptLocation) : "-",
    createdAt: row.created_at,
  };
}

async function getAllOfficeBills() {
  const [rows] = await pool.query(
    `SELECT id, category, cost_category, description, amount, receipt_location, created_at
     FROM office_bills
     ORDER BY created_at DESC, id DESC`,
  );

  return rows.map(mapOfficeBillRow);
}

async function getOfficeBillById(id) {
  const [rows] = await pool.query(
    `SELECT id, category, cost_category, description, amount, receipt_location, created_at
     FROM office_bills
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapOfficeBillRow(rows[0]) : null;
}

async function createOfficeBill(officeBill) {
  const [result] = await pool.query(
    `INSERT INTO office_bills (category, cost_category, description, amount, receipt_location, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      officeBill.category,
      officeBill.costCategory,
      officeBill.description,
      Number(officeBill.amount),
      officeBill.receiptLocation,
      officeBill.createdAt,
    ],
  );

  return getOfficeBillById(result.insertId);
}

module.exports = {
  createOfficeBill,
  getAllOfficeBills,
};
