const { pool } = require("../config/db");

function formatSupplierProductsTrackingCode(id) {
  return `SP-${String(id).padStart(3, "0")}`;
}

function formatQualityStatus(status) {
  return status === "fail" ? "Fail" : "Pass";
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

function mapSupplierProductsTrackingRow(row) {
  return {
    recordId: row.id,
    id: formatSupplierProductsTrackingCode(row.id),
    date: formatDateValue(row.entry_date),
    supplierId: row.supplier_id,
    supplier: row.supplier_name || `Supplier #${row.supplier_id}`,
    projectRecordId: row.project_id,
    projectId: row.project_code,
    productId: row.product,
    product: row.product_name || `Product #${row.product}`,
    quantitySupplied: String(Number(row.quantity || 0)),
    qualityStatus: formatQualityStatus(row.status),
    notes: row.notes || "",
    receiptLocation: row.receipt_location || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const supplierProductsTrackingSelect = `SELECT spt.id, spt.entry_date, spt.supplier_id, spt.project_id, spt.product, spt.quantity,
       spt.status, spt.notes, spt.receipt_location, spt.created_at, spt.updated_at,
       CONCAT('PRJ-', LPAD(spt.project_id, 3, '0')) AS project_code,
       pgs.name AS supplier_name,
       p.name AS product_name
     FROM supplier_products_tracking spt
     LEFT JOIN project_goods_supplier pgs ON pgs.id = spt.supplier_id
     LEFT JOIN projects p ON p.id = spt.project_id`;

async function getAllSupplierProductsTracking() {
  const [rows] = await pool.query(
    `${supplierProductsTrackingSelect}
     ORDER BY spt.id DESC`,
  );

  return rows.map(mapSupplierProductsTrackingRow);
}

async function getSupplierProductsTrackingById(id) {
  const [rows] = await pool.query(
    `${supplierProductsTrackingSelect}
     WHERE spt.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapSupplierProductsTrackingRow(rows[0]) : null;
}

async function createSupplierProductsTracking(entryData) {
  const [result] = await pool.query(
    `INSERT INTO supplier_products_tracking (entry_date, supplier_id, project_id, product, quantity, status, notes, receipt_location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      entryData.date,
      Number(entryData.supplierId),
      Number(entryData.projectId),
      Number(entryData.productId),
      Number(entryData.quantitySupplied),
      entryData.qualityStatus,
      entryData.notes,
      entryData.receiptLocation,
    ],
  );

  return getSupplierProductsTrackingById(result.insertId);
}

async function updateSupplierProductsTracking(id, entryData) {
  const fields = ["entry_date = ?", "supplier_id = ?", "project_id = ?", "product = ?", "quantity = ?", "status = ?", "notes = ?"];
  const values = [
    entryData.date,
    Number(entryData.supplierId),
    Number(entryData.projectId),
    Number(entryData.productId),
    Number(entryData.quantitySupplied),
    entryData.qualityStatus,
    entryData.notes,
  ];

  if (entryData.receiptLocation) {
    fields.push("receipt_location = ?");
    values.push(entryData.receiptLocation);
  }

  values.push(Number(id));

  await pool.query(
    `UPDATE supplier_products_tracking
     SET ${fields.join(", ")}
     WHERE id = ?`,
    values,
  );

  return getSupplierProductsTrackingById(id);
}

module.exports = {
  createSupplierProductsTracking,
  getAllSupplierProductsTracking,
  getSupplierProductsTrackingById,
  updateSupplierProductsTracking,
};
