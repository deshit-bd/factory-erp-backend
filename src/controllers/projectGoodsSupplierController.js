const projectGoodsSupplierModel = require("../models/projectGoodsSupplierModel");

function validateProjectGoodsSupplierPayload(body) {
  const errors = [];

  if (!body.name?.trim()) {
    errors.push("Name is required.");
  }

  if (!body.category?.trim()) {
    errors.push("Category is required.");
  }

  if (!body.email?.trim()) {
    errors.push("Email is required.");
  }

  if (!body.phone?.trim()) {
    errors.push("Phone is required.");
  }

  return errors;
}

function buildSupplierPayload(body) {
  return {
    name: body.name.trim(),
    category: body.category.trim(),
    email: body.email.trim(),
    phone: body.phone.trim(),
  };
}

function handleProjectGoodsSupplierError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing project goods suppliers." });
}

async function getProjectGoodsSuppliers(request, response) {
  try {
    const suppliers = await projectGoodsSupplierModel.getAllProjectGoodsSuppliers(request.query.search || "");
    return response.json(suppliers);
  } catch (error) {
    return handleProjectGoodsSupplierError(response, error);
  }
}

async function createProjectGoodsSupplier(request, response) {
  const errors = validateProjectGoodsSupplierPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const supplier = await projectGoodsSupplierModel.createProjectGoodsSupplier(buildSupplierPayload(request.body));
    return response.status(201).json(supplier);
  } catch (error) {
    return handleProjectGoodsSupplierError(response, error);
  }
}

async function updateProjectGoodsSupplier(request, response) {
  const errors = validateProjectGoodsSupplierPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const existingSupplier = await projectGoodsSupplierModel.getProjectGoodsSupplierById(request.params.id);
    if (!existingSupplier) {
      return response.status(404).json({ message: "Project goods supplier not found." });
    }

    const supplier = await projectGoodsSupplierModel.updateProjectGoodsSupplier(
      request.params.id,
      buildSupplierPayload(request.body),
    );
    return response.json(supplier);
  } catch (error) {
    return handleProjectGoodsSupplierError(response, error);
  }
}

async function deleteProjectGoodsSupplier(request, response) {
  try {
    const deleted = await projectGoodsSupplierModel.deleteProjectGoodsSupplier(request.params.id);

    if (!deleted) {
      return response.status(404).json({ message: "Project goods supplier not found." });
    }

    return response.status(204).send();
  } catch (error) {
    return handleProjectGoodsSupplierError(response, error);
  }
}

module.exports = {
  createProjectGoodsSupplier,
  deleteProjectGoodsSupplier,
  getProjectGoodsSuppliers,
  updateProjectGoodsSupplier,
};
