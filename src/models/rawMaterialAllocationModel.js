const { pool } = require("../config/db");

function formatRawMaterialAllocationCode(id) {
  return `ALL-${String(id).padStart(3, "0")}`;
}

function formatAllocationDateValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function mapRawMaterialAllocationRow(row) {
  return {
    recordId: row.id,
    id: formatRawMaterialAllocationCode(row.id),
    projectId: row.project_id,
    project: row.project_code,
    projectName: row.project_name || "",
    rawMaterialId: row.raw_material_id,
    material: row.material || `Material #${row.raw_material_id}`,
    quantity: String(Number(row.quantity || 0)),
    date: formatAllocationDateValue(row.allocation_date),
    allocationDate: row.allocation_date,
  };
}

const allocationSelect = `SELECT rma.id, rma.project_id, rma.raw_material_id, rma.quantity, rma.allocation_date,
       CONCAT('PRJ-', LPAD(rma.project_id, 3, '0')) AS project_code,
       p.name AS project_name,
       rms.material
     FROM raw_material_allocation rma
     LEFT JOIN projects p ON p.id = rma.project_id
     LEFT JOIN raw_material_stock rms ON rms.id = rma.raw_material_id`;

async function getAllRawMaterialAllocations(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${allocationSelect}
       ORDER BY rma.id ASC`,
    );

    return rows.map(mapRawMaterialAllocationRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${allocationSelect}
     WHERE CAST(rma.id AS CHAR) LIKE ?
       OR CAST(rma.project_id AS CHAR) LIKE ?
       OR p.name LIKE ?
       OR rms.material LIKE ?
       OR rma.allocation_date LIKE ?
     ORDER BY rma.id ASC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapRawMaterialAllocationRow);
}

async function getRawMaterialAllocationById(id) {
  const [rows] = await pool.query(
    `${allocationSelect}
     WHERE rma.id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapRawMaterialAllocationRow(rows[0]) : null;
}

async function createRawMaterialAllocation(allocationData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const quantity = Number(allocationData.quantity);
    const [stockRows] = await connection.query(
      `SELECT id, current_stock
       FROM raw_material_stock
       WHERE id = ?
       LIMIT 1
       FOR UPDATE`,
      [Number(allocationData.rawMaterialId)],
    );

    if (!stockRows[0]) {
      throw new Error("Selected material was not found in stock.");
    }

    if (Number(stockRows[0].current_stock || 0) < quantity) {
      throw new Error("Allocation quantity exceeds available stock.");
    }

    const [result] = await connection.query(
      `INSERT INTO raw_material_allocation (project_id, raw_material_id, quantity, allocation_date)
       VALUES (?, ?, ?, ?)`,
      [
        Number(allocationData.projectId),
        Number(allocationData.rawMaterialId),
        quantity,
        `${allocationData.date} 00:00:00`,
      ],
    );

    await connection.query(
      `UPDATE raw_material_stock
       SET current_stock = current_stock - ?, updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [quantity, Number(allocationData.rawMaterialId)],
    );

    await connection.commit();
    return getRawMaterialAllocationById(result.insertId);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createRawMaterialAllocation,
  getAllRawMaterialAllocations,
};
