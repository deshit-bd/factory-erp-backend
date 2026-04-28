const path = require("path");
const { pool } = require("../config/db");
const { insertCashLedgerEntry, normalizeLedgerDate } = require("./ledgerModel");

function formatFactoryCostCode(id) {
  return `FC-${String(id).padStart(3, "0")}`;
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

function mapFactoryCostRow(row) {
  const receiptLocation = row.receipt_location || "";

  return {
    recordId: row.id,
    id: formatFactoryCostCode(row.id),
    category: row.cost_category,
    description: row.description || "",
    costType: row.category === "monthly" ? "Monthly Costs" : "Daily Costs",
    amount: Number(row.amount || 0),
    amountFormatted: `৳${Number(row.amount || 0).toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })}`,
    date: formatDateValue(row.created_at),
    receiptLocation,
    receiptName: receiptLocation ? path.basename(receiptLocation) : "-",
    createdAt: row.created_at,
  };
}

async function getAllFactoryCosts() {
  const [rows] = await pool.query(
    `SELECT id, category, cost_category, description, amount, receipt_location, created_at
     FROM factory_costs
     ORDER BY created_at DESC, id DESC`,
  );

  return rows.map(mapFactoryCostRow);
}

async function getFactoryCostById(id) {
  const [rows] = await pool.query(
    `SELECT id, category, cost_category, description, amount, receipt_location, created_at
     FROM factory_costs
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapFactoryCostRow(rows[0]) : null;
}

async function createFactoryCost(factoryCost) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO factory_costs (category, cost_category, description, amount, receipt_location, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        factoryCost.category,
        factoryCost.costCategory,
        factoryCost.description,
        Number(factoryCost.amount),
        factoryCost.receiptLocation,
        factoryCost.createdAt,
      ],
    );

    await insertCashLedgerEntry(connection, {
      ledgerDate: normalizeLedgerDate(factoryCost.createdAt),
      reference: formatFactoryCostCode(result.insertId),
      description: `Factory cost / ${factoryCost.costCategory}`,
      debit: 0,
      credit: Number(factoryCost.amount),
    });

    await connection.commit();
    return getFactoryCostById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createFactoryCost,
  getAllFactoryCosts,
};
