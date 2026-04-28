const { pool } = require("../config/db");
const { insertDueLedgerEntry, normalizeLedgerDate } = require("./ledgerModel");

function formatRawMaterialPurchaseCode(id) {
  return `PUR-${String(id).padStart(3, "0")}`;
}

function formatPurchaseDateValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatPurchaseDateDisplay(value) {
  const normalized = formatPurchaseDateValue(value);

  if (!normalized) {
    return "";
  }

  const [year, month, day] = normalized.split("-");
  return `${day}/${month}/${year}`;
}

function mapRawMaterialPurchaseRow(row) {
  const unitCost = Number(row.unit_cost || 0);
  const quantity = Number(row.quantity || 0);
  const total = quantity * unitCost;

  return {
    recordId: row.id,
    id: formatRawMaterialPurchaseCode(row.id),
    material: row.material,
    supplierId: row.supplier_id,
    supplier: row.supplier_name,
    quantity: String(quantity),
    unitCost: `৳${unitCost}`,
    total: `৳${total.toLocaleString("en-US")}`,
    supplierRating: Number(row.supplier_rating || 0),
    date: formatPurchaseDateDisplay(row.created_at),
    dateValue: formatPurchaseDateValue(row.created_at),
    receiptLocation: row.receipt_location || "",
    createdAt: row.created_at,
  };
}

async function upsertRawMaterialStockFromPurchase(connection, purchaseData) {
  const materialName = purchaseData.material.trim();
  const [existingRows] = await connection.query(
    `SELECT id, current_stock
     FROM raw_material_stock
     WHERE LOWER(material) = LOWER(?)
     LIMIT 1`,
    [materialName],
  );

  if (existingRows[0]) {
    await connection.query(
      `UPDATE raw_material_stock
       SET current_stock = current_stock + ?, unit_cost = ?, updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [Number(purchaseData.quantity), Number(purchaseData.unitCost), existingRows[0].id],
    );
    return;
  }

  await connection.query(
    `INSERT INTO raw_material_stock (material, category, current_stock, minimum_stock, unit_cost)
     VALUES (?, ?, ?, ?, ?)`,
    [
      materialName,
      purchaseData.category,
      Number(purchaseData.quantity),
      Number(purchaseData.minimumStock),
      Number(purchaseData.unitCost),
    ],
  );
}

async function updateRawMaterialSupplierAverageRating(connection, supplierId) {
  await connection.query(
    `UPDATE raw_material_supplier rms
     SET rms.rating = COALESCE(
       (
         SELECT AVG(rmp.supplier_rating)
         FROM raw_material_purchase rmp
         WHERE rmp.supplier_id = rms.id
           AND rmp.supplier_rating > 0
       ),
       0
     )
     WHERE rms.id = ?`,
    [Number(supplierId)],
  );
}

async function increaseRawMaterialSupplierDue(connection, purchaseData) {
  const totalAmount = Number(purchaseData.quantity || 0) * Number(purchaseData.unitCost || 0);

  await connection.query(
    `UPDATE raw_material_supplier
     SET previous_due = previous_due + ?
     WHERE id = ?`,
    [totalAmount, Number(purchaseData.supplierId)],
  );
}

async function getAllRawMaterialPurchases(search = "") {
  const normalizedSearch = search.trim();

  const baseQuery = `SELECT rmp.id, rmp.material, rmp.supplier_id, rmp.quantity, rmp.unit_cost, rmp.supplier_rating, rmp.receipt_location, rmp.created_at,
       rms.name AS supplier_name
     FROM raw_material_purchase rmp
     INNER JOIN raw_material_supplier rms ON rms.id = rmp.supplier_id`;

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${baseQuery}
       ORDER BY rmp.id ASC`,
    );

    return rows.map(mapRawMaterialPurchaseRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${baseQuery}
     WHERE CAST(rmp.id AS CHAR) LIKE ?
       OR rmp.material LIKE ?
       OR rms.name LIKE ?
       OR rmp.created_at LIKE ?
     ORDER BY rmp.id ASC`,
    [likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapRawMaterialPurchaseRow);
}

async function getRawMaterialPurchaseById(id) {
  const [rows] = await pool.query(
    `SELECT rmp.id, rmp.material, rmp.supplier_id, rmp.quantity, rmp.unit_cost, rmp.supplier_rating, rmp.receipt_location, rmp.created_at,
       rms.name AS supplier_name
     FROM raw_material_purchase rmp
     INNER JOIN raw_material_supplier rms ON rms.id = rmp.supplier_id
     WHERE rmp.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapRawMaterialPurchaseRow(rows[0]) : null;
}

async function createRawMaterialPurchase(purchaseData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO raw_material_purchase (material, supplier_id, quantity, unit_cost, supplier_rating, receipt_location, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        purchaseData.material,
        Number(purchaseData.supplierId),
        Number(purchaseData.quantity),
        Number(purchaseData.unitCost),
        Number(purchaseData.supplierRating),
        purchaseData.receiptLocation || "",
        purchaseData.createdAt,
      ],
    );

    const totalAmount = Number(purchaseData.quantity || 0) * Number(purchaseData.unitCost || 0);
    await insertDueLedgerEntry(connection, {
      ledgerDate: normalizeLedgerDate(purchaseData.createdAt),
      reference: formatRawMaterialPurchaseCode(result.insertId),
      description: `Raw material supplier due / Supplier #${Number(purchaseData.supplierId)} / ${purchaseData.material}`,
      debit: 0,
      credit: totalAmount,
    });

    await upsertRawMaterialStockFromPurchase(connection, purchaseData);
    await increaseRawMaterialSupplierDue(connection, purchaseData);
    await updateRawMaterialSupplierAverageRating(connection, purchaseData.supplierId);
    await connection.commit();

    return getRawMaterialPurchaseById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createRawMaterialPurchase,
  getAllRawMaterialPurchases,
};
