const { pool } = require("../config/db");

function formatProjectCode(id) {
  return `PRJ-${String(id).padStart(3, "0")}`;
}

function formatProjectStatus(status) {
  if (status === "pending") {
    return "Pending";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "confirmed") {
    return "Confirmed";
  }

  return "In Progress";
}

function getProjectStatus(row) {
  const totalOrderQuantity = Number(row.quantity || row.total_order_quantity || 0);
  const totalProduced = Number(row.total_supplier_produced || 0) + Number(row.total_factory_produced || 0);

  if (totalOrderQuantity > 0) {
    return totalProduced >= totalOrderQuantity ? "Completed" : "In Progress";
  }

  return formatProjectStatus(row.status || row.order_status);
}

function getProjectProgress(row) {
  const totalOrderQuantity = Number(row.quantity || row.total_order_quantity || 0);
  const totalProduced = Number(row.total_supplier_produced || 0) + Number(row.total_factory_produced || 0);

  if (totalOrderQuantity <= 0) {
    return 0;
  }

  return Math.min(Math.round((totalProduced / totalOrderQuantity) * 100), 100);
}

function mapProjectRow(row) {
  return {
    recordId: row.id,
    id: formatProjectCode(row.id),
    name: row.name,
    product: row.product || row.order_product || row.name,
    buyer: row.buyer,
    startDate: row.start_date,
    deliveryDate: row.delivery_date,
    status: getProjectStatus(row),
    progress: getProjectProgress(row),
    totalOrderQuantity: String(Number(row.quantity || row.total_order_quantity || 0)),
    totalSupplierProduced: String(Number(row.total_supplier_produced || 0)),
    totalFactoryProduced: String(Number(row.total_factory_produced || 0)),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const projectSelect = `SELECT p.id, p.name, p.buyer, p.product, p.quantity, p.start_date, p.delivery_date, p.status, p.created_at, p.updated_at,
       COALESCE(so.product, p.product, p.name) AS order_product,
       so.order_status,
       COALESCE(so.total_order_quantity, 0) AS total_order_quantity,
       COALESCE(spt.total_supplier_produced, 0) AS total_supplier_produced,
       COALESCE(fpt.total_factory_produced, 0) AS total_factory_produced
     FROM projects p
     LEFT JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity) AS total_order_quantity,
              CASE MAX(
                CASE status
                  WHEN 'completed' THEN 4
                  WHEN 'in progress' THEN 3
                  WHEN 'confirmed' THEN 2
                  ELSE 1
                END
              )
                WHEN 4 THEN 'completed'
                WHEN 3 THEN 'in progress'
                WHEN 2 THEN 'confirmed'
                ELSE 'pending'
              END AS order_status
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = COALESCE(p.product, p.name) AND so.buyer = p.buyer AND so.delivery_date = p.delivery_date
     LEFT JOIN (
       SELECT project_id, SUM(quantity) AS total_supplier_produced
       FROM supplier_products_tracking
       GROUP BY project_id
     ) spt ON spt.project_id = p.id
     LEFT JOIN (
       SELECT project_id, SUM(quanttity_produced) AS total_factory_produced
       FROM factory_product_tracking
       GROUP BY project_id
     ) fpt ON fpt.project_id = p.id`;

async function getAllProjects(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `${projectSelect}
       ORDER BY p.id DESC`,
    );

    return rows.map(mapProjectRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `${projectSelect}
     WHERE CAST(p.id AS CHAR) LIKE ?
       OR p.name LIKE ?
       OR p.product LIKE ?
       OR p.buyer LIKE ?
       OR p.start_date LIKE ?
       OR p.delivery_date LIKE ?
       OR p.status LIKE ?
     ORDER BY p.id DESC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapProjectRow);
}

module.exports = {
  getAllProjects,
};
