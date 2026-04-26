const rawMaterialSupplierModel = require("../models/rawMaterialSupplierModel");

function validateRawMaterialSupplierPayload(body) {
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

function handleRawMaterialSupplierError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing raw material suppliers." });
}

async function getRawMaterialSuppliers(request, response) {
  try {
    const suppliers = await rawMaterialSupplierModel.getAllRawMaterialSuppliers(request.query.search || "");
    return response.json(suppliers);
  } catch (error) {
    return handleRawMaterialSupplierError(response, error);
  }
}

async function createRawMaterialSupplier(request, response) {
  const errors = validateRawMaterialSupplierPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const supplier = await rawMaterialSupplierModel.createRawMaterialSupplier(request.body);
    return response.status(201).json(supplier);
  } catch (error) {
    return handleRawMaterialSupplierError(response, error);
  }
}

async function updateRawMaterialSupplier(request, response) {
  const errors = validateRawMaterialSupplierPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const existingSupplier = await rawMaterialSupplierModel.getRawMaterialSupplierById(request.params.id);
    if (!existingSupplier) {
      return response.status(404).json({ message: "Raw material supplier not found." });
    }

    const supplier = await rawMaterialSupplierModel.updateRawMaterialSupplier(request.params.id, request.body);
    return response.json(supplier);
  } catch (error) {
    return handleRawMaterialSupplierError(response, error);
  }
}

async function deleteRawMaterialSupplier(request, response) {
  try {
    const deleted = await rawMaterialSupplierModel.deleteRawMaterialSupplier(request.params.id);

    if (!deleted) {
      return response.status(404).json({ message: "Raw material supplier not found." });
    }

    return response.status(204).send();
  } catch (error) {
    return handleRawMaterialSupplierError(response, error);
  }
}

module.exports = {
  createRawMaterialSupplier,
  deleteRawMaterialSupplier,
  getRawMaterialSuppliers,
  updateRawMaterialSupplier,
};
