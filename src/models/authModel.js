const crypto = require("crypto");

const { pool } = require("../config/db");

const defaultPermissions = [
  { key: "dashboard", label: "Dashboard", group: "Dashboard" },
  { key: "buyer_management", label: "Buyer Management", group: "Party" },
  { key: "raw_material_supplier", label: "Raw Material Supplier", group: "Party" },
  { key: "project_goods_supplier", label: "Project Goods Supplier", group: "Party" },
  { key: "supplier_assignment", label: "Supplier Assignment", group: "Party" },
  { key: "sales_orders", label: "Sales Orders", group: "Order" },
  { key: "projects", label: "Projects", group: "Order" },
  { key: "invoices", label: "Invoices", group: "Order" },
  { key: "raw_material_stock", label: "Raw Material Stock", group: "Stock" },
  { key: "material_purchase", label: "Material Purchase", group: "Stock" },
  { key: "material_allocation", label: "Material Allocation", group: "Stock" },
  { key: "finished_goods", label: "Finished Goods", group: "Stock" },
  { key: "factory_product_tracking", label: "Factory Product Tracking", group: "Production" },
  { key: "supplier_products_tracking", label: "Supplier Products Tracking", group: "Production" },
  { key: "delivery_shipment", label: "Delivery/Shipment", group: "Production" },
  { key: "delivery_history", label: "Delivery History", group: "Production" },
  { key: "material_supplier_payment", label: "Material Supplier Payment", group: "Accounts" },
  { key: "goods_supplier_payment", label: "Goods Supplier Payment", group: "Accounts" },
  { key: "accounts", label: "Accounts", group: "Accounts" },
  { key: "settings", label: "Settings", group: "System" },
];

const roleFallbackPermissionKeys = {
  admin: defaultPermissions.map((permission) => permission.key),
  manager: defaultPermissions.filter((permission) => permission.key !== "settings").map((permission) => permission.key),
  production_manager: [
    "dashboard",
    "projects",
    "raw_material_stock",
    "material_purchase",
    "material_allocation",
    "finished_goods",
    "factory_product_tracking",
    "supplier_assignment",
    "supplier_products_tracking",
    "raw_material_supplier",
    "project_goods_supplier",
    "delivery_shipment",
    "delivery_history",
  ],
  salesman: ["dashboard", "buyer_management", "sales_orders", "projects", "invoices"],
};

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");

  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(password, storedPassword) {
  const normalizedStoredPassword = String(storedPassword || "");

  if (!normalizedStoredPassword.startsWith("scrypt$")) {
    return password === normalizedStoredPassword;
  }

  const [, salt, savedHash] = normalizedStoredPassword.split("$");

  if (!salt || !savedHash) {
    return false;
  }

  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(savedHash, "hex"));
}

function mapUserRow(row, permissions = []) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    permissionMode: row.permission_mode,
    permissions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensurePermissionSeedData(connection) {
  const [permissionRows] = await connection.query(
    `SELECT id, permission_key
     FROM permissions`,
  );

  const existingPermissionKeys = new Set(permissionRows.map((row) => row.permission_key));
  const missingPermissions = defaultPermissions.filter((permission) => !existingPermissionKeys.has(permission.key));

  if (missingPermissions.length) {
    await connection.query(
      `INSERT INTO permissions (permission_key, permission_label, permission_group)
       VALUES ?`,
      [missingPermissions.map((permission) => [permission.key, permission.label, permission.group])],
    );
  }

  const [seededPermissionRows] = await connection.query(
    `SELECT id, permission_key
     FROM permissions`,
  );

  const permissionIdByKey = new Map(seededPermissionRows.map((row) => [row.permission_key, row.id]));
  const [rolePermissionRows] = await connection.query(
    `SELECT rp.role, p.permission_key
     FROM role_permissions rp
     INNER JOIN permissions p ON p.id = rp.permission_id`,
  );

  const existingRolePermissionPairs = new Set(rolePermissionRows.map((row) => `${row.role}:${row.permission_key}`));
  const missingRolePermissions = Object.entries(roleFallbackPermissionKeys).flatMap(([role, permissionKeys]) =>
    permissionKeys
      .filter((permissionKey) => permissionIdByKey.has(permissionKey) && !existingRolePermissionPairs.has(`${role}:${permissionKey}`))
      .map((permissionKey) => [role, permissionIdByKey.get(permissionKey)]),
  );

  if (missingRolePermissions.length) {
    await connection.query("INSERT INTO role_permissions (role, permission_id) VALUES ?", [missingRolePermissions]);
  }
}

async function getUserPermissions(connection, userId, role, permissionMode) {
  await ensurePermissionSeedData(connection);

  const useCustomPermissions = String(permissionMode || "role") === "custom";
  const [rows] = await connection.query(
    useCustomPermissions
      ? `SELECT p.permission_key
         FROM user_permissions up
         INNER JOIN permissions p ON p.id = up.permission_id
         WHERE up.user_id = ?
         ORDER BY p.permission_group ASC, p.permission_label ASC`
      : `SELECT p.permission_key
         FROM role_permissions rp
         INNER JOIN permissions p ON p.id = rp.permission_id
         WHERE rp.role = ?
         ORDER BY p.permission_group ASC, p.permission_label ASC`,
    useCustomPermissions ? [Number(userId)] : [role],
  );

  const permissionKeys = rows.map((row) => row.permission_key);

  if (permissionKeys.length) {
    return permissionKeys;
  }

  return roleFallbackPermissionKeys[role] || [];
}

async function getAllPermissions(connection = pool) {
  await ensurePermissionSeedData(connection);

  const [rows] = await connection.query(
    `SELECT id, permission_key, permission_label, permission_group
     FROM permissions
     ORDER BY permission_group ASC, permission_label ASC`,
  );

  return rows;
}

async function getAllUsers() {
  const [rows] = await pool.query(
    `SELECT id, name, email, role, status, permission_mode, created_at, updated_at
     FROM users
     ORDER BY id DESC`,
  );

  const users = await Promise.all(
    rows.map(async (row) => {
      const permissions = await getUserPermissions(pool, row.id, row.role, row.permission_mode);
      return mapUserRow(row, permissions);
    }),
  );

  return users;
}

async function loginUser(email, password) {
  const [rows] = await pool.query(
    `SELECT id, name, email, password, role, status, permission_mode, created_at, updated_at
     FROM users
     WHERE email = ?
     LIMIT 1`,
    [email],
  );

  const user = rows[0];

  if (!user) {
    throw new Error("Invalid email or password.");
  }

  if (String(user.status || "").toLowerCase() !== "active") {
    throw new Error("This user account is inactive.");
  }

  if (!verifyPassword(password, user.password)) {
    throw new Error("Invalid email or password.");
  }

  const permissions = await getUserPermissions(pool, user.id, user.role, user.permission_mode);
  return mapUserRow(user, permissions);
}

async function saveUserPermissions(connection, userId, permissionKeys) {
  await connection.query("DELETE FROM user_permissions WHERE user_id = ?", [Number(userId)]);

  if (!permissionKeys.length) {
    return;
  }

  const [permissionRows] = await connection.query(
    `SELECT id, permission_key
     FROM permissions
     WHERE permission_key IN (?)`,
    [permissionKeys],
  );

  if (!permissionRows.length) {
    return;
  }

  const values = permissionRows.map((row) => [Number(userId), row.id]);
  await connection.query("INSERT INTO user_permissions (user_id, permission_id) VALUES ?", [values]);
}

async function createUser(userData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO users (name, email, password, role, status, permission_mode)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        userData.name,
        userData.email,
        hashPassword(userData.password),
        userData.role,
        userData.status || "active",
        userData.permissionMode || "role",
      ],
    );

    if (userData.permissionMode === "custom") {
      await saveUserPermissions(connection, result.insertId, userData.permissions || []);
    }

    await connection.commit();

    const [rows] = await pool.query(
      `SELECT id, name, email, role, status, permission_mode, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [result.insertId],
    );

    const user = rows[0];
    const permissions = await getUserPermissions(pool, user.id, user.role, user.permission_mode);
    return mapUserRow(user, permissions);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function updateUser(userId, userData) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();

    const fields = ["name = ?", "email = ?", "role = ?", "status = ?", "permission_mode = ?"];
    const values = [userData.name, userData.email, userData.role, userData.status || "active", userData.permissionMode || "role"];

    if (userData.password) {
      fields.push("password = ?");
      values.push(hashPassword(userData.password));
    }

    values.push(Number(userId));

    await connection.query(
      `UPDATE users
       SET ${fields.join(", ")}
       WHERE id = ?`,
      values,
    );

    if (userData.permissionMode === "custom") {
      await saveUserPermissions(connection, userId, userData.permissions || []);
    } else {
      await connection.query("DELETE FROM user_permissions WHERE user_id = ?", [Number(userId)]);
    }

    await connection.commit();

    const [rows] = await pool.query(
      `SELECT id, name, email, role, status, permission_mode, created_at, updated_at
       FROM users
       WHERE id = ?
       LIMIT 1`,
      [Number(userId)],
    );

    const user = rows[0];
    const permissions = await getUserPermissions(pool, user.id, user.role, user.permission_mode);
    return mapUserRow(user, permissions);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function deleteUser(userId) {
  const [result] = await pool.query("DELETE FROM users WHERE id = ?", [Number(userId)]);
  return result.affectedRows > 0;
}

module.exports = {
  createUser,
  deleteUser,
  getAllPermissions,
  getAllUsers,
  loginUser,
  updateUser,
};
