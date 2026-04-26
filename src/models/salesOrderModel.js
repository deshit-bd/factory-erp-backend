const { pool } = require("../config/db");

function formatSalesOrderCode(id) {
  return `SO-${String(id).padStart(3, "0")}`;
}

function formatSalesOrderStatus(status) {
  if (status === "pending") {
    return "Pending";
  }

  if (status === "completed") {
    return "Completed";
  }

  if (status === "in progress") {
    return "In Progress";
  }

  return "Confirmed";
}

function normalizeSalesOrderStatus(status) {
  const value = String(status || "").toLowerCase();

  if (value === "pending" || value === "confirmed" || value === "in progress" || value === "completed") {
    return value;
  }

  return "pending";
}

function getLocalDateString() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

async function syncProjectForSalesOrder(connection, salesOrder) {
  const projectStatus = salesOrder.status === "completed" ? "completed" : "in progress";
  const startDate = getLocalDateString();

  const [existingProjects] = await connection.query(
    `SELECT id
     FROM projects
     WHERE name = ? AND buyer = ? AND delivery_date = ?
     ORDER BY id DESC
     LIMIT 1`,
    [salesOrder.product, salesOrder.buyer, salesOrder.delivery_date],
  );

  if (existingProjects[0]) {
    await connection.query(
      `UPDATE projects
       SET status = ?, delivery_date = ?, updated_at = CURRENT_TIMESTAMP()
       WHERE id = ?`,
      [projectStatus, salesOrder.delivery_date, existingProjects[0].id],
    );
    return;
  }

  await connection.query(
    `INSERT INTO projects (name, buyer, start_date, delivery_date, status)
     VALUES (?, ?, ?, ?, ?)`,
    [salesOrder.product, salesOrder.buyer, startDate, salesOrder.delivery_date, projectStatus],
  );
}

function mapSalesOrderRow(row) {
  const unitPrice = Number(row.unit_price || 0);
  const quantity = Number(row.quantity || 0);
  const total = quantity * unitPrice;

  return {
    recordId: row.id,
    id: formatSalesOrderCode(row.id),
    buyer: row.buyer,
    product: row.product,
    quantity: String(quantity),
    unitPrice: `৳${unitPrice}`,
    total: `৳${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    deliveryDate: row.delivery_date,
    status: formatSalesOrderStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllSalesOrders(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `SELECT id, buyer, product, quantity, unit_price, delivery_date, status, created_at, updated_at
       FROM sales_order
       ORDER BY id DESC`,
    );

    return rows.map(mapSalesOrderRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `SELECT id, buyer, product, quantity, unit_price, delivery_date, status, created_at, updated_at
     FROM sales_order
     WHERE CAST(id AS CHAR) LIKE ?
       OR buyer LIKE ?
       OR product LIKE ?
       OR delivery_date LIKE ?
       OR status LIKE ?
     ORDER BY id DESC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapSalesOrderRow);
}

async function getSalesOrderById(id) {
  const [rows] = await pool.query(
    `SELECT id, buyer, product, quantity, unit_price, delivery_date, status, created_at, updated_at
     FROM sales_order
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapSalesOrderRow(rows[0]) : null;
}

async function createSalesOrder(orderData) {
  const [result] = await pool.query(
    `INSERT INTO sales_order (buyer, product, quantity, unit_price, delivery_date, status)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      orderData.buyer,
      orderData.product,
      Number(orderData.quantity),
      Number(orderData.unitPrice),
      orderData.deliveryDate,
      normalizeSalesOrderStatus(orderData.status),
    ],
  );

  return getSalesOrderById(result.insertId);
}

async function deleteSalesOrder(id) {
  const [result] = await pool.query("DELETE FROM sales_order WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

async function updateSalesOrderStatus(id, status) {
  const normalizedStatus = normalizeSalesOrderStatus(status);
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `UPDATE sales_order
       SET status = ?
       WHERE id = ?`,
      [normalizedStatus, id],
    );

    if (result.affectedRows === 0) {
      await connection.rollback();
      return null;
    }

    const [rows] = await connection.query(
      `SELECT id, buyer, product, quantity, unit_price, delivery_date, status, created_at, updated_at
       FROM sales_order
       WHERE id = ?
       LIMIT 1`,
      [id],
    );

    const salesOrder = rows[0];

    if (normalizedStatus === "in progress" || normalizedStatus === "completed") {
      await syncProjectForSalesOrder(connection, salesOrder);
    }

    await connection.commit();
    return mapSalesOrderRow(salesOrder);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = {
  createSalesOrder,
  deleteSalesOrder,
  getAllSalesOrders,
  getSalesOrderById,
  updateSalesOrderStatus,
};
