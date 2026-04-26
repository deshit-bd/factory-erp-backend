const { pool } = require("../config/db");

function formatFactoryProductCode(id) {
  return `FP-${String(id).padStart(3, "0")}`;
}

function formatProjectCode(id) {
  return `PRJ-${String(id).padStart(3, "0")}`;
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

function formatQualityStatus(status) {
  return status === "fail" ? "Fail" : "Pass";
}

function normalizeQualityStatus(status) {
  return String(status || "").toLowerCase() === "fail" ? "fail" : "pass";
}

async function getProjectProductionLimit(projectId, excludedFactoryEntryId = 0) {
  const [rows] = await pool.query(
    `SELECT p.id,
            COALESCE(so.total_order_quantity, 0) AS total_order_quantity,
            COALESCE(spt.total_supplier_produced, 0) AS total_supplier_produced,
            COALESCE(fpt.total_factory_produced, 0) AS total_factory_produced
     FROM projects p
     LEFT JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity) AS total_order_quantity
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = p.name AND so.buyer = p.buyer AND so.delivery_date = p.delivery_date
     LEFT JOIN (
       SELECT project_id, SUM(quantity) AS total_supplier_produced
       FROM supplier_products_tracking
       GROUP BY project_id
     ) spt ON spt.project_id = p.id
     LEFT JOIN (
       SELECT project_id, SUM(quanttity_produced) AS total_factory_produced
       FROM factory_product_tracking
       WHERE id <> ?
       GROUP BY project_id
     ) fpt ON fpt.project_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    [Number(excludedFactoryEntryId || 0), Number(projectId)],
  );

  if (!rows[0]) {
    throw new Error("Project not found.");
  }

  const totalOrderQuantity = Number(rows[0].total_order_quantity || 0);
  const totalProduced = Number(rows[0].total_supplier_produced || 0) + Number(rows[0].total_factory_produced || 0);

  return {
    remainingQuantity: Math.max(totalOrderQuantity - totalProduced, 0),
    totalOrderQuantity,
  };
}

async function assertQuantityWithinProjectOrder(entryData, excludedFactoryEntryId = 0) {
  const quantityProduced = Number(entryData.quantityProduced);
  const { remainingQuantity, totalOrderQuantity } = await getProjectProductionLimit(entryData.projectId, excludedFactoryEntryId);

  if (totalOrderQuantity <= 0) {
    throw new Error("No ordered quantity found for this project.");
  }

  if (quantityProduced > remainingQuantity) {
    throw new Error(`Quantity produced exceeds remaining ordered quantity. Remaining quantity: ${remainingQuantity}.`);
  }
}

function mapFactoryProductRow(row) {
  return {
    recordId: row.id,
    id: formatFactoryProductCode(row.id),
    date: formatDateValue(row.entry_date),
    entryDate: row.entry_date,
    projectRecordId: row.project_id,
    projectId: formatProjectCode(row.project_id),
    productName: row.project_name || "",
    quantityProduced: String(Number(row.quanttity_produced || 0)),
    qualityStatus: formatQualityStatus(row.quanttity_status),
    remarks: row.remarks || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const factoryProductSelect = `SELECT fpt.id, fpt.entry_date, fpt.project_id, fpt.quanttity_produced,
       fpt.quanttity_status, fpt.remarks, fpt.created_at, fpt.updated_at, p.name AS project_name
     FROM factory_product_tracking fpt
     LEFT JOIN projects p ON p.id = fpt.project_id`;

async function getAllFactoryProductEntries(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${factoryProductSelect}
       ORDER BY fpt.id DESC`,
    );

    return rows.map(mapFactoryProductRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${factoryProductSelect}
     WHERE CAST(fpt.id AS CHAR) LIKE ?
       OR CAST(fpt.project_id AS CHAR) LIKE ?
       OR p.name LIKE ?
       OR fpt.entry_date LIKE ?
       OR fpt.quanttity_status LIKE ?
       OR fpt.remarks LIKE ?
     ORDER BY fpt.id DESC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapFactoryProductRow);
}

async function getFactoryProductEntryById(id) {
  const [rows] = await pool.query(
    `${factoryProductSelect}
     WHERE fpt.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapFactoryProductRow(rows[0]) : null;
}

async function createFactoryProductEntry(entryData) {
  await assertQuantityWithinProjectOrder(entryData);

  const [result] = await pool.query(
    `INSERT INTO factory_product_tracking (entry_date, project_id, quanttity_produced, quanttity_status, remarks)
     VALUES (?, ?, ?, ?, ?)`,
    [
      entryData.date,
      Number(entryData.projectId),
      Number(entryData.quantityProduced),
      normalizeQualityStatus(entryData.qualityStatus),
      entryData.remarks || "",
    ],
  );

  return getFactoryProductEntryById(result.insertId);
}

async function updateFactoryProductEntry(id, entryData) {
  await assertQuantityWithinProjectOrder(entryData, id);

  const [result] = await pool.query(
    `UPDATE factory_product_tracking
     SET entry_date = ?, project_id = ?, quanttity_produced = ?, quanttity_status = ?, remarks = ?
     WHERE id = ?`,
    [
      entryData.date,
      Number(entryData.projectId),
      Number(entryData.quantityProduced),
      normalizeQualityStatus(entryData.qualityStatus),
      entryData.remarks || "",
      id,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return getFactoryProductEntryById(id);
}

module.exports = {
  createFactoryProductEntry,
  getAllFactoryProductEntries,
  updateFactoryProductEntry,
};
