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

async function getProjectSupplyLimit(projectId, excludedSupplierEntryId = 0) {
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
       WHERE id <> ?
       GROUP BY project_id
     ) spt ON spt.project_id = p.id
     LEFT JOIN (
       SELECT project_id, SUM(quanttity_produced) AS total_factory_produced
       FROM factory_product_tracking
       GROUP BY project_id
     ) fpt ON fpt.project_id = p.id
     WHERE p.id = ?
     LIMIT 1`,
    [Number(excludedSupplierEntryId || 0), Number(projectId)],
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

async function assertQuantityWithinProjectOrder(entryData, excludedSupplierEntryId = 0) {
  const quantitySupplied = Number(entryData.quantitySupplied);
  const { remainingQuantity, totalOrderQuantity } = await getProjectSupplyLimit(entryData.projectId, excludedSupplierEntryId);

  if (totalOrderQuantity <= 0) {
    throw new Error("No ordered quantity found for this project.");
  }

  if (quantitySupplied > remainingQuantity) {
    throw new Error(`Quantity supplied exceeds remaining ordered quantity. Remaining quantity: ${remainingQuantity}.`);
  }
}

async function getSupplierAssignmentLimit(projectId, supplierId, excludedSupplierEntryId = 0) {
  const [rows] = await pool.query(
    `SELECT COALESCE(sa.total_assigned_quantity, 0) AS total_assigned_quantity,
            COALESCE(spt.total_supplier_produced, 0) AS total_supplier_produced
     FROM project_goods_supplier pgs
     LEFT JOIN (
       SELECT supplier, project_id, SUM(quantity) AS total_assigned_quantity
       FROM supplier_assignment
       GROUP BY supplier, project_id
     ) sa ON sa.supplier = pgs.name AND sa.project_id = ?
     LEFT JOIN (
       SELECT supplier_id, project_id, SUM(quantity) AS total_supplier_produced
       FROM supplier_products_tracking
       WHERE id <> ?
       GROUP BY supplier_id, project_id
     ) spt ON spt.supplier_id = pgs.id AND spt.project_id = ?
     WHERE pgs.id = ?
     LIMIT 1`,
    [Number(projectId), Number(excludedSupplierEntryId || 0), Number(projectId), Number(supplierId)],
  );

  if (!rows[0]) {
    throw new Error("Supplier not found.");
  }

  const totalAssignedQuantity = Number(rows[0].total_assigned_quantity || 0);
  const totalSupplierProduced = Number(rows[0].total_supplier_produced || 0);

  return {
    remainingAssignedQuantity: Math.max(totalAssignedQuantity - totalSupplierProduced, 0),
    totalAssignedQuantity,
  };
}

async function assertQuantityWithinSupplierAssignment(entryData, excludedSupplierEntryId = 0) {
  const quantitySupplied = Number(entryData.quantitySupplied);
  const { remainingAssignedQuantity, totalAssignedQuantity } = await getSupplierAssignmentLimit(
    entryData.projectId,
    entryData.supplierId,
    excludedSupplierEntryId,
  );

  if (totalAssignedQuantity <= 0) {
    throw new Error("No supplier assigned quantity found for this project.");
  }

  if (quantitySupplied > remainingAssignedQuantity) {
    throw new Error(`Quantity supplied exceeds supplier assigned remaining quantity. Remaining quantity: ${remainingAssignedQuantity}.`);
  }
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
  await assertQuantityWithinProjectOrder(entryData);
  await assertQuantityWithinSupplierAssignment(entryData);

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
  await assertQuantityWithinProjectOrder(entryData, id);
  await assertQuantityWithinSupplierAssignment(entryData, id);

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
