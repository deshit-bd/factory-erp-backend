const { pool } = require("../config/db");

function formatDeliveryCode(id) {
  return `DEL-${String(id).padStart(3, "0")}`;
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

function formatDeliveryStatus(status) {
  return status === "delivered" ? "Delivered" : "Not Delivered";
}

function mapDeliveryShipmentRow(row) {
  return {
    recordId: row.id,
    id: formatDeliveryCode(row.id),
    projectRecordId: row.project_id,
    projectId: row.project_code,
    buyerId: row.buyer_id,
    buyer: row.buyer_name || `Buyer #${row.buyer_id}`,
    product: row.product || "",
    quantity: String(Number(row.quantity || 0)),
    date: formatDateValue(row.delivery_date),
    deliveryStatus: formatDeliveryStatus(row.delivery_status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function syncCompletedProjectsToDeliveryShipment() {
  await pool.query(
    `INSERT INTO \`delivery_&_shipment\` (project_id, buyer_id, product, quantity, delivery_date, delivery_status)
     SELECT p.id,
            b.id,
            COALESCE(p.product, p.name) AS product,
            so.total_order_quantity,
            p.delivery_date,
            'not delivered'
     FROM projects p
     INNER JOIN buyer b ON b.company = p.buyer
     INNER JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity) AS total_order_quantity
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = COALESCE(p.product, p.name) AND so.buyer = p.buyer AND so.delivery_date = p.delivery_date
     LEFT JOIN (
       SELECT project_id, SUM(quantity) AS total_supplier_produced
       FROM supplier_products_tracking
       WHERE status = 'pass'
       GROUP BY project_id
     ) spt ON spt.project_id = p.id
     LEFT JOIN (
       SELECT project_id, SUM(quanttity_produced) AS total_factory_produced
       FROM factory_product_tracking
       WHERE quanttity_status = 'pass'
       GROUP BY project_id
     ) fpt ON fpt.project_id = p.id
     LEFT JOIN \`delivery_&_shipment\` ds ON ds.project_id = p.id
     WHERE ds.id IS NULL
       AND so.total_order_quantity > 0
       AND COALESCE(spt.total_supplier_produced, 0) + COALESCE(fpt.total_factory_produced, 0) = so.total_order_quantity`,
  );
}

const deliveryShipmentSelect = `SELECT ds.id, ds.project_id, ds.buyer_id, ds.product, ds.quantity, ds.delivery_date, ds.delivery_status,
       ds.created_at, ds.updated_at,
       CONCAT('PRJ-', LPAD(ds.project_id, 3, '0')) AS project_code,
       b.company AS buyer_name
     FROM \`delivery_&_shipment\` ds
     LEFT JOIN buyer b ON b.id = ds.buyer_id`;

async function getAllDeliveryShipments(search = "") {
  await syncCompletedProjectsToDeliveryShipment();

  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${deliveryShipmentSelect}
       ORDER BY ds.id DESC`,
    );

    return rows.map(mapDeliveryShipmentRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${deliveryShipmentSelect}
     WHERE CAST(ds.id AS CHAR) LIKE ?
       OR CAST(ds.project_id AS CHAR) LIKE ?
       OR b.company LIKE ?
       OR ds.product LIKE ?
       OR ds.delivery_date LIKE ?
       OR ds.delivery_status LIKE ?
     ORDER BY ds.id DESC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapDeliveryShipmentRow);
}

async function updateDeliveryShipmentStatus(id, status) {
  const normalizedStatus = String(status || "").toLowerCase() === "delivered" ? "delivered" : "not delivered";

  const [result] = await pool.query(
    `UPDATE \`delivery_&_shipment\`
     SET delivery_status = ?
     WHERE id = ?`,
    [normalizedStatus, Number(id)],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  const [rows] = await pool.query(
    `${deliveryShipmentSelect}
     WHERE ds.id = ?
     LIMIT 1`,
    [Number(id)],
  );

  return rows[0] ? mapDeliveryShipmentRow(rows[0]) : null;
}

module.exports = {
  getAllDeliveryShipments,
  updateDeliveryShipmentStatus,
};
