const { pool } = require("../config/db");

function formatShipmentCode(id) {
  return `SHP-${String(id).padStart(3, "0")}`;
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

function mapShipmentCostGroups(rows) {
  const groups = new Map();

  rows.forEach((row) => {
    const shipmentDate = formatDateValue(row.shipment_date);
    const groupKey = [row.project_id, row.destination, shipmentDate].join("::");
    const amount = Number(row.amount || 0);

    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        recordId: row.id,
        id: formatShipmentCode(row.id),
        projectId: row.project_id,
        projectCode: `PRJ-${String(row.project_id).padStart(3, "0")}`,
        projectName: row.project_name || "",
        project: `PRJ-${String(row.project_id).padStart(3, "0")}`,
        destination: row.destination,
        date: shipmentDate,
        totalAmount: 0,
        totalCost: "",
        items: [],
      });
    }

    const currentGroup = groups.get(groupKey);
    currentGroup.recordId = Math.min(currentGroup.recordId, row.id);
    currentGroup.id = formatShipmentCode(currentGroup.recordId);
    currentGroup.totalAmount += amount;
    currentGroup.items.push({
      recordId: row.id,
      category: row.category,
      amount,
      description: row.description || "",
    });
  });

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      totalCost: `৳${group.totalAmount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`,
    }))
    .sort((left, right) => right.recordId - left.recordId);
}

async function getAllShipmentCosts() {
  const [rows] = await pool.query(
    `SELECT sc.id, sc.project_id, sc.destination, sc.shipment_date, sc.category, sc.amount, sc.description,
            p.name AS project_name
     FROM shipment_costs sc
     LEFT JOIN projects p ON p.id = sc.project_id
     ORDER BY sc.id DESC`,
  );

  return mapShipmentCostGroups(rows);
}

async function createShipmentCosts(shipmentData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    for (const item of shipmentData.items) {
      await connection.query(
        `INSERT INTO shipment_costs (project_id, destination, shipment_date, category, amount, description)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [
          Number(shipmentData.projectId),
          shipmentData.destination,
          shipmentData.shipmentDate || null,
          item.category,
          Number(item.amount),
          item.description || null,
        ],
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }

  return getAllShipmentCosts();
}

module.exports = {
  createShipmentCosts,
  getAllShipmentCosts,
};
