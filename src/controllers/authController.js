const authModel = require("../models/authModel");

const allowedRoles = ["admin", "manager", "production_manager", "salesman"];

function normalizeUserPayload(body) {
  return {
    name: String(body.name || "").trim(),
    email: String(body.email || "").trim(),
    password: String(body.password || "").trim(),
    role: String(body.role || "").trim(),
    status: String(body.status || "active").trim().toLowerCase(),
    permissionMode: String(body.permissionMode || "role").trim().toLowerCase(),
    permissions: Array.isArray(body.permissions) ? body.permissions.map((item) => String(item || "").trim()).filter(Boolean) : [],
  };
}

function validateUserPayload(payload, { requirePassword = true } = {}) {
  if (!payload.name) {
    return "Name is required.";
  }

  if (!payload.email) {
    return "Email is required.";
  }

  if (requirePassword && !payload.password) {
    return "Password is required.";
  }

  if (payload.role && !allowedRoles.includes(payload.role)) {
    return "Role must be admin, manager, production_manager, or salesman.";
  }

  if (!["active", "inactive"].includes(payload.status)) {
    return "Status must be active or inactive.";
  }

  if (!["role", "custom"].includes(payload.permissionMode)) {
    return "Permission mode must be role or custom.";
  }

  return "";
}

async function login(request, response) {
  const email = String(request.body.email || "").trim();
  const password = String(request.body.password || "");

  if (!email || !password) {
    return response.status(400).json({ message: "Email and password are required." });
  }

  try {
    const user = await authModel.loginUser(email, password);
    return response.json(user);
  } catch (error) {
    return response.status(401).json({ message: error.message || "Login failed." });
  }
}

async function getUsers(request, response) {
  try {
    const users = await authModel.getAllUsers();
    return response.json(users);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: error.message || "Failed to load users." });
  }
}

async function getPermissions(request, response) {
  try {
    const permissions = await authModel.getAllPermissions();
    return response.json(permissions);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: error.message || "Failed to load permissions." });
  }
}

async function createUser(request, response) {
  const payload = normalizeUserPayload(request.body);
  const validationMessage = validateUserPayload(payload, { requirePassword: true });

  if (validationMessage) {
    return response.status(400).json({ message: validationMessage });
  }

  try {
    const user = await authModel.createUser(payload);
    return response.status(201).json(user);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: error.message || "Failed to create user." });
  }
}

async function updateUser(request, response) {
  const payload = normalizeUserPayload(request.body);
  const validationMessage = validateUserPayload(payload, { requirePassword: false });

  if (validationMessage) {
    return response.status(400).json({ message: validationMessage });
  }

  try {
    const user = await authModel.updateUser(request.params.id, payload);
    return response.json(user);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: error.message || "Failed to update user." });
  }
}

async function deleteUser(request, response) {
  try {
    const deleted = await authModel.deleteUser(request.params.id);

    if (!deleted) {
      return response.status(404).json({ message: "User not found." });
    }

    return response.status(204).send();
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: error.message || "Failed to delete user." });
  }
}

module.exports = {
  createUser,
  deleteUser,
  getPermissions,
  getUsers,
  login,
  updateUser,
};
