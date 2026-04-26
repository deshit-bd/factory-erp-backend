const { pool } = require("../config/db");

function formatProjectCode(id) {
  return `PRJ-${String(id).padStart(3, "0")}`;
}

function formatProjectStatus(status) {
  return status === "completed" ? "Completed" : "In Progress";
}

function getProjectProgress(status) {
  return status === "completed" ? 100 : 60;
}

function mapProjectRow(row) {
  return {
    recordId: row.id,
    id: formatProjectCode(row.id),
    name: row.name,
    buyer: row.buyer,
    startDate: row.start_date,
    deliveryDate: row.delivery_date,
    status: formatProjectStatus(row.status),
    progress: getProjectProgress(row.status),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function getAllProjects(search = "") {
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const [rows] = await pool.query(
      `SELECT id, name, buyer, start_date, delivery_date, status, created_at, updated_at
       FROM projects
       ORDER BY id DESC`,
    );

    return rows.map(mapProjectRow);
  }

  const likeSearch = `%${normalizedSearch}%`;
  const [rows] = await pool.query(
    `SELECT id, name, buyer, start_date, delivery_date, status, created_at, updated_at
     FROM projects
     WHERE CAST(id AS CHAR) LIKE ?
       OR name LIKE ?
       OR buyer LIKE ?
       OR start_date LIKE ?
       OR delivery_date LIKE ?
       OR status LIKE ?
     ORDER BY id DESC`,
    [likeSearch, likeSearch, likeSearch, likeSearch, likeSearch, likeSearch],
  );

  return rows.map(mapProjectRow);
}

module.exports = {
  getAllProjects,
};
