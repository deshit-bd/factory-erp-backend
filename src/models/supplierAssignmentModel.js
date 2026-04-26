const { pool } = require("../config/db");

function formatSupplierAssignmentCode(id) {
  return `ASN-${String(id).padStart(3, "0")}`;
}

function formatSupplierAssignmentStatus(status) {
  if (status === "confirmed") {
    return "Confirmed";
  }

  if (status === "in progress") {
    return "In Progress";
  }

  if (status === "completed") {
    return "Completed";
  }

  return "Pending";
}

function normalizeSupplierAssignmentStatus(status) {
  if (status === "Confirmed") {
    return "confirmed";
  }

  if (status === "In Progress") {
    return "in progress";
  }

  if (status === "Completed") {
    return "completed";
  }

  return "pending";
}

function mapSupplierAssignmentRow(row) {
  return {
    recordId: row.id,
    id: formatSupplierAssignmentCode(row.id),
    projectId: row.project_id,
    project: row.project_code,
    product: row.product,
    supplier: row.supplier,
    quantity: String(Number(row.quantity || 0)),
    unitPriceValue: Number(row.unit_price || 0),
    perUnitPrice: `৳${Number(row.unit_price || 0).toFixed(2)}`,
    totalCost: `৳${(Number(row.quantity || 0) * Number(row.unit_price || 0)).toFixed(2)}`,
    status: formatSupplierAssignmentStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const supplierAssignmentSelect = `SELECT sa.id, sa.project_id, sa.product, sa.supplier, sa.quantity, sa.unit_price, sa.status,
       sa.created_at, sa.updated_at,
       CONCAT('PRJ-', LPAD(sa.project_id, 3, '0')) AS project_code
     FROM supplier_assignment sa`;

async function getAllSupplierAssignments(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${supplierAssignmentSelect}
       ORDER BY sa.id DESC`,
    );

    return rows.map(mapSupplierAssignmentRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${supplierAssignmentSelect}
     WHERE CAST(sa.id AS CHAR) LIKE ?
       OR CAST(sa.project_id AS CHAR) LIKE ?
       OR sa.product LIKE ?
       OR sa.supplier LIKE ?
       OR sa.status LIKE ?
     ORDER BY sa.id DESC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapSupplierAssignmentRow);
}

async function getSupplierAssignmentById(id) {
  const [rows] = await pool.query(
    `${supplierAssignmentSelect}
     WHERE sa.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapSupplierAssignmentRow(rows[0]) : null;
}

async function createSupplierAssignment(assignmentData) {
  const [result] = await pool.query(
    `INSERT INTO supplier_assignment (project_id, product, supplier, quantity, unit_price)
     VALUES (?, ?, ?, ?, ?)`,
    [
      Number(assignmentData.projectId),
      assignmentData.product,
      assignmentData.supplier,
      Number(assignmentData.quantity),
      Number(assignmentData.unitPrice),
    ],
  );

  return getSupplierAssignmentById(result.insertId);
}

async function updateSupplierAssignmentStatus(id, status) {
  await pool.query(
    `UPDATE supplier_assignment
     SET status = ?
     WHERE id = ?`,
    [normalizeSupplierAssignmentStatus(status), Number(id)],
  );

  return getSupplierAssignmentById(id);
}

module.exports = {
  createSupplierAssignment,
  getAllSupplierAssignments,
  getSupplierAssignmentById,
  updateSupplierAssignmentStatus,
};
