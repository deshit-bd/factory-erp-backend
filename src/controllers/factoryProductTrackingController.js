const factoryProductTrackingModel = require("../models/factoryProductTrackingModel");

function validateFactoryProductPayload(body) {
  const errors = [];

  if (!body.date?.trim()) {
    errors.push("Date is required.");
  }

  if (!body.projectId || Number(body.projectId) <= 0) {
    errors.push("Project is required.");
  }

  if (!body.quantityProduced || Number(body.quantityProduced) <= 0) {
    errors.push("Quantity produced must be greater than zero.");
  }

  if (!["Pass", "Fail", "pass", "fail"].includes(body.qualityStatus)) {
    errors.push("Quality status must be Pass or Fail.");
  }

  return errors;
}

function handleFactoryProductError(response, error) {
  console.error(error);
  return response.status(500).json({ message: error.message || "Something went wrong while processing factory product entries." });
}

async function getFactoryProductEntries(request, response) {
  try {
    const entries = await factoryProductTrackingModel.getAllFactoryProductEntries(request.query.search || "");
    return response.json(entries);
  } catch (error) {
    return handleFactoryProductError(response, error);
  }
}

async function createFactoryProductEntry(request, response) {
  const errors = validateFactoryProductPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const entry = await factoryProductTrackingModel.createFactoryProductEntry(request.body);
    return response.status(201).json(entry);
  } catch (error) {
    return handleFactoryProductError(response, error);
  }
}

async function updateFactoryProductEntry(request, response) {
  const errors = validateFactoryProductPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const entry = await factoryProductTrackingModel.updateFactoryProductEntry(request.params.id, request.body);

    if (!entry) {
      return response.status(404).json({ message: "Factory product entry not found." });
    }

    return response.json(entry);
  } catch (error) {
    return handleFactoryProductError(response, error);
  }
}

module.exports = {
  createFactoryProductEntry,
  getFactoryProductEntries,
  updateFactoryProductEntry,
};
