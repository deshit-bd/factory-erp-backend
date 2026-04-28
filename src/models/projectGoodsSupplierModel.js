const { pool } = require("../config/db");

function formatProjectGoodsSupplierCode(id) {
  return `PGS-${String(id).padStart(3, "0")}`;
}

function mapProjectGoodsSupplierRow(row) {
  return {
    recordId: row.id,
    id: formatProjectGoodsSupplierCode(row.id),
    name: row.name,
    category: row.category,
    email: row.email,
    phone: row.phone,
    rating: Number(row.rating || 0).toFixed(1),
    previousDue: Number(row.previous_due || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function hasPreviousDueColumn() {
  try {
    const [rows] = await pool.query(
      `SELECT 1
       FROM information_schema.COLUMNS
       WHERE TABLE_SCHEMA = DATABASE()
         AND TABLE_NAME = 'project_goods_supplier'
         AND COLUMN_NAME = 'previous_due'
       LIMIT 1`,
    );

    return rows.length > 0;
  } catch {
    return false;
  }
}

async function getProjectGoodsSupplierSelect() {
  const includePreviousDue = await hasPreviousDueColumn();

  return includePreviousDue
    ? `SELECT id, name, category, email, phone, rating, previous_due, created_at, updated_at
       FROM project_goods_supplier`
    : `SELECT id, name, category, email, phone, rating, 0 AS previous_due, created_at, updated_at
       FROM project_goods_supplier`;
}

async function getAllProjectGoodsSuppliers(search = "") {
  const normalizedSearch = search.trim();
  const selectQuery = await getProjectGoodsSupplierSelect();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${selectQuery}
       ORDER BY id ASC`,
    );

    return rows.map(mapProjectGoodsSupplierRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${selectQuery}
     WHERE CAST(id AS CHAR) LIKE ?
       OR name LIKE ?
       OR category LIKE ?
       OR email LIKE ?
       OR phone LIKE ?
     ORDER BY id ASC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapProjectGoodsSupplierRow);
}

async function getProjectGoodsSupplierById(id) {
  const selectQuery = await getProjectGoodsSupplierSelect();
  const [rows] = await pool.query(
    `${selectQuery}
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapProjectGoodsSupplierRow(rows[0]) : null;
}

async function createProjectGoodsSupplier(supplierData) {
  const [result] = await pool.query(
    `INSERT INTO project_goods_supplier (name, category, email, phone, rating)
     VALUES (?, ?, ?, ?, ?)`,
    [supplierData.name, supplierData.category, supplierData.email, supplierData.phone, 0],
  );

  return getProjectGoodsSupplierById(result.insertId);
}

async function updateProjectGoodsSupplier(id, supplierData) {
  const fields = ["name = ?", "category = ?", "email = ?", "phone = ?"];
  const values = [supplierData.name, supplierData.category, supplierData.email, supplierData.phone];

  values.push(id);

  await pool.query(
    `UPDATE project_goods_supplier
     SET ${fields.join(", ")}
     WHERE id = ?`,
    values,
  );

  return getProjectGoodsSupplierById(id);
}

async function deleteProjectGoodsSupplier(id) {
  const [result] = await pool.query("DELETE FROM project_goods_supplier WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = {
  createProjectGoodsSupplier,
  deleteProjectGoodsSupplier,
  getAllProjectGoodsSuppliers,
  getProjectGoodsSupplierById,
  updateProjectGoodsSupplier,
};
