const { pool } = require("../config/db");

function formatRawMaterialSupplierCode(id) {
  return `RMS-${String(id).padStart(3, "0")}`;
}

function mapRawMaterialSupplierRow(row) {
  return {
    recordId: row.id,
    id: formatRawMaterialSupplierCode(row.id),
    name: row.name,
    category: row.category,
    email: row.email,
    phone: row.phone,
    rating: Number(row.rating || 0).toFixed(1),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const rawMaterialSupplierSelect = `SELECT rms.id, rms.name, rms.category, rms.email, rms.phone,
       COALESCE(AVG(NULLIF(rmp.supplier_rating, 0)), rms.rating) AS rating,
       rms.created_at, rms.updated_at
     FROM raw_material_supplier rms
     LEFT JOIN raw_material_purchase rmp ON rmp.supplier_id = rms.id`;

const rawMaterialSupplierGroupBy = `GROUP BY rms.id, rms.name, rms.category, rms.email, rms.phone, rms.rating, rms.created_at, rms.updated_at`;

async function getAllRawMaterialSuppliers(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${rawMaterialSupplierSelect}
       ${rawMaterialSupplierGroupBy}
       ORDER BY rms.id ASC`,
    );

    return rows.map(mapRawMaterialSupplierRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${rawMaterialSupplierSelect}
     WHERE CAST(rms.id AS CHAR) LIKE ?
       OR rms.name LIKE ?
       OR rms.category LIKE ?
       OR rms.email LIKE ?
       OR rms.phone LIKE ?
     ${rawMaterialSupplierGroupBy}
     ORDER BY rms.id ASC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapRawMaterialSupplierRow);
}

async function getRawMaterialSupplierById(id) {
  const [rows] = await pool.query(
    `${rawMaterialSupplierSelect}
     WHERE rms.id = ?
     ${rawMaterialSupplierGroupBy}
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapRawMaterialSupplierRow(rows[0]) : null;
}

async function createRawMaterialSupplier(supplierData) {
  const [result] = await pool.query(
    `INSERT INTO raw_material_supplier (name, category, email, phone, rating)
     VALUES (?, ?, ?, ?, ?)`,
    [supplierData.name, supplierData.category, supplierData.email, supplierData.phone, Number(supplierData.rating || 0)],
  );

  return getRawMaterialSupplierById(result.insertId);
}

async function updateRawMaterialSupplier(id, supplierData) {
  await pool.query(
    `UPDATE raw_material_supplier
     SET name = ?, category = ?, email = ?, phone = ?
     WHERE id = ?`,
    [supplierData.name, supplierData.category, supplierData.email, supplierData.phone, id],
  );

  return getRawMaterialSupplierById(id);
}

async function deleteRawMaterialSupplier(id) {
  const [result] = await pool.query("DELETE FROM raw_material_supplier WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = {
  createRawMaterialSupplier,
  deleteRawMaterialSupplier,
  getAllRawMaterialSuppliers,
  getRawMaterialSupplierById,
  updateRawMaterialSupplier,
};
