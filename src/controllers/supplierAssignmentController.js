const supplierAssignmentModel = require("../models/supplierAssignmentModel");

function validateSupplierAssignmentPayload(body) {
  const errors = [];

  if (!body.projectId || Number(body.projectId) <= 0) {
    errors.push("Project is required.");
  }

  if (!body.product?.trim()) {
    errors.push("Product is required.");
  }

  if (!body.supplier?.trim()) {
    errors.push("Supplier is required.");
  }

  if (!body.supplierId || Number(body.supplierId) <= 0) {
    errors.push("Supplier selection is invalid.");
  }

  if (!body.quantity || Number(body.quantity) <= 0) {
    errors.push("Quantity must be greater than zero.");
  }

  if (!body.unitPrice || Number(body.unitPrice) <= 0) {
    errors.push("Per unit price must be greater than zero.");
  }

  return errors;
}

function validateSupplierAssignmentStatus(status) {
  const allowedStatuses = ["Pending", "Confirmed", "In Progress", "Completed"];

  if (!allowedStatuses.includes(status)) {
    return "Status is invalid.";
  }

  return "";
}

function handleSupplierAssignmentError(response, error) {
  console.error(error);
  return response.status(500).json({ message: error.message || "Something went wrong while processing supplier assignments." });
}

async function getSupplierAssignments(request, response) {
  try {
    const assignments = await supplierAssignmentModel.getAllSupplierAssignments(request.query.search || "");
    return response.json(assignments);
  } catch (error) {
    return handleSupplierAssignmentError(response, error);
  }
}

async function createSupplierAssignment(request, response) {
  const errors = validateSupplierAssignmentPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const assignment = await supplierAssignmentModel.createSupplierAssignment(request.body);
    return response.status(201).json(assignment);
  } catch (error) {
    return handleSupplierAssignmentError(response, error);
  }
}

async function updateSupplierAssignmentStatus(request, response) {
  const statusError = validateSupplierAssignmentStatus(request.body.status);
  if (statusError) {
    return response.status(400).json({ message: statusError });
  }

  try {
    const existingAssignment = await supplierAssignmentModel.getSupplierAssignmentById(request.params.id);
    if (!existingAssignment) {
      return response.status(404).json({ message: "Supplier assignment not found." });
    }

    const assignment = await supplierAssignmentModel.updateSupplierAssignmentStatus(request.params.id, request.body.status);
    return response.json(assignment);
  } catch (error) {
    return handleSupplierAssignmentError(response, error);
  }
}

module.exports = {
  createSupplierAssignment,
  getSupplierAssignments,
  updateSupplierAssignmentStatus,
};
