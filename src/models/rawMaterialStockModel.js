const { pool } = require("../config/db");

function formatRawMaterialStockCode(id) {
  return `MAT-${String(id).padStart(3, "0")}`;
}

function mapRawMaterialStockRow(row) {
  const currentStock = Number(row.current_stock || 0);
  const minimumStock = Number(row.minimum_stock || 0);
  const unitCost = Number(row.unit_cost || 0);
  const totalValue = currentStock * unitCost;

  return {
    recordId: row.id,
    id: formatRawMaterialStockCode(row.id),
    material: row.material,
    category: row.category,
    currentStock: String(currentStock),
    minimumStock: String(minimumStock),
    unitCost: `৳${unitCost}`,
    totalValue: `৳${totalValue.toLocaleString("en-US")}`,
    status: currentStock < minimumStock ? "Low Stock" : "Normal",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllRawMaterialStocks(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `SELECT id, material, category, current_stock, minimum_stock, unit_cost, created_at, updated_at
       FROM raw_material_stock
       ORDER BY id ASC`,
    );

    return rows.map(mapRawMaterialStockRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `SELECT id, material, category, current_stock, minimum_stock, unit_cost, created_at, updated_at
     FROM raw_material_stock
     WHERE CAST(id AS CHAR) LIKE ?
       OR material LIKE ?
       OR category LIKE ?
     ORDER BY id ASC`,
    [likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapRawMaterialStockRow);
}

async function createRawMaterialStock(stockData) {
  const [result] = await pool.query(
    `INSERT INTO raw_material_stock (material, category, current_stock, minimum_stock, unit_cost)
     VALUES (?, ?, ?, ?, ?)`,
    [
      stockData.material,
      stockData.category,
      Number(stockData.currentStock),
      Number(stockData.minimumStock),
      Number(stockData.unitCost),
    ],
  );

  const [rows] = await pool.query(
    `SELECT id, material, category, current_stock, minimum_stock, unit_cost, created_at, updated_at
     FROM raw_material_stock
     WHERE id = ?
     LIMIT 1`,
    [result.insertId],
  );

  return rows[0] ? mapRawMaterialStockRow(rows[0]) : null;
}

module.exports = {
  createRawMaterialStock,
  getAllRawMaterialStocks,
};
