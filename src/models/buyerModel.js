const { pool } = require("../config/db");

function formatBuyerCode(id) {
  return `BYR-${String(id).padStart(3, "0")}`;
}

function formatBuyerStatus(status) {
  return status === "active" ? "Active" : "Inactive";
}

function normalizeStatus(status) {
  return String(status).toLowerCase() === "active" ? "active" : "inactive";
}

function mapBuyerRow(row) {
  return {
    recordId: row.id,
    id: formatBuyerCode(row.id),
    name: row.name,
    company: row.company,
    email: row.email,
    phone: row.phone || "",
    address: row.address || "",
    country: row.country || "",
    status: formatBuyerStatus(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllBuyers(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `SELECT id, name, company, email, phone, address, country, status, created_at, updated_at
       FROM buyer
       ORDER BY id ASC`,
    );

    return rows.map(mapBuyerRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `SELECT id, name, company, email, phone, address, country, status, created_at, updated_at
     FROM buyer
     WHERE CAST(id AS CHAR) LIKE ?
       OR name LIKE ?
       OR company LIKE ?
       OR email LIKE ?
       OR phone LIKE ?
       OR country LIKE ?
       OR status LIKE ?
     ORDER BY id ASC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapBuyerRow);
}

async function getBuyerById(id) {
  const [rows] = await pool.query(
    `SELECT id, name, company, email, phone, address, country, status, created_at, updated_at
     FROM buyer
     WHERE id = ?
     LIMIT 1`,
    [id],
  );

  return rows[0] ? mapBuyerRow(rows[0]) : null;
}

async function createBuyer(buyerData) {
  const [result] = await pool.query(
    `INSERT INTO buyer (name, company, email, phone, address, country, status)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      buyerData.name,
      buyerData.company,
      buyerData.email,
      buyerData.phone || "",
      buyerData.address || "",
      buyerData.country || "",
      normalizeStatus(buyerData.status),
    ],
  );

  return getBuyerById(result.insertId);
}

async function updateBuyer(id, buyerData) {
  await pool.query(
    `UPDATE buyer
     SET name = ?, company = ?, email = ?, phone = ?, address = ?, country = ?, status = ?
     WHERE id = ?`,
    [
      buyerData.name,
      buyerData.company,
      buyerData.email,
      buyerData.phone || "",
      buyerData.address || "",
      buyerData.country || "",
      normalizeStatus(buyerData.status),
      id,
    ],
  );

  return getBuyerById(id);
}

async function updateBuyerStatus(id, status) {
  await pool.query(
    `UPDATE buyer
     SET status = ?
     WHERE id = ?`,
    [normalizeStatus(status), id],
  );

  return getBuyerById(id);
}

async function deleteBuyer(id) {
  const [result] = await pool.query("DELETE FROM buyer WHERE id = ?", [id]);
  return result.affectedRows > 0;
}

module.exports = {
  createBuyer,
  deleteBuyer,
  getAllBuyers,
  getBuyerById,
  updateBuyer,
  updateBuyerStatus,
};
