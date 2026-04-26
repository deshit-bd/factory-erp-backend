const rawMaterialAllocationModel = require("../models/rawMaterialAllocationModel");

function validateRawMaterialAllocationPayload(body) {
  const errors = [];

  if (!body.projectId || Number(body.projectId) <= 0) {
    errors.push("Project is required.");
  }

  if (!body.rawMaterialId || Number(body.rawMaterialId) <= 0) {
    errors.push("Material is required.");
  }

  if (!body.quantity || Number(body.quantity) <= 0) {
    errors.push("Quantity must be greater than zero.");
  }

  if (!body.date?.trim()) {
    errors.push("Date is required.");
  }

  return errors;
}

function handleRawMaterialAllocationError(response, error) {
  console.error(error);
  return response.status(500).json({ message: error.message || "Something went wrong while processing material allocations." });
}

async function getRawMaterialAllocations(request, response) {
  try {
    const allocations = await rawMaterialAllocationModel.getAllRawMaterialAllocations(request.query.search || "");
    return response.json(allocations);
  } catch (error) {
    return handleRawMaterialAllocationError(response, error);
  }
}

async function createRawMaterialAllocation(request, response) {
  const errors = validateRawMaterialAllocationPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const allocation = await rawMaterialAllocationModel.createRawMaterialAllocation(request.body);
    return response.status(201).json(allocation);
  } catch (error) {
    return handleRawMaterialAllocationError(response, error);
  }
}

module.exports = {
  createRawMaterialAllocation,
  getRawMaterialAllocations,
};
