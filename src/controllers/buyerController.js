const buyerModel = require("../models/buyerModel");

function validateBuyerPayload(body) {
  const errors = [];

  if (!body.name?.trim()) {
    errors.push("Name is required.");
  }

  if (!body.company?.trim()) {
    errors.push("Company is required.");
  }

  if (!body.email?.trim()) {
    errors.push("Email is required.");
  }

  if (!["Active", "Inactive", "active", "inactive"].includes(body.status)) {
    errors.push("Status must be active or inactive.");
  }

  return errors;
}

function handleBuyerError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing buyers." });
}

async function getBuyers(request, response) {
  try {
    const buyers = await buyerModel.getAllBuyers(request.query.search || "");
    response.json(buyers);
  } catch (error) {
    handleBuyerError(response, error);
  }
}

async function createBuyer(request, response) {
  const errors = validateBuyerPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const buyer = await buyerModel.createBuyer(request.body);
    return response.status(201).json(buyer);
  } catch (error) {
    return handleBuyerError(response, error);
  }
}

async function updateBuyer(request, response) {
  const errors = validateBuyerPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const existingBuyer = await buyerModel.getBuyerById(request.params.id);
    if (!existingBuyer) {
      return response.status(404).json({ message: "Buyer not found." });
    }

    const buyer = await buyerModel.updateBuyer(request.params.id, request.body);
    return response.json(buyer);
  } catch (error) {
    return handleBuyerError(response, error);
  }
}

async function updateBuyerStatus(request, response) {
  const { status } = request.body;

  if (!["Active", "Inactive", "active", "inactive"].includes(status)) {
    return response.status(400).json({ message: "Status must be active or inactive." });
  }

  try {
    const existingBuyer = await buyerModel.getBuyerById(request.params.id);
    if (!existingBuyer) {
      return response.status(404).json({ message: "Buyer not found." });
    }

    const buyer = await buyerModel.updateBuyerStatus(request.params.id, status);
    return response.json(buyer);
  } catch (error) {
    return handleBuyerError(response, error);
  }
}

async function deleteBuyer(request, response) {
  try {
    const deleted = await buyerModel.deleteBuyer(request.params.id);

    if (!deleted) {
      return response.status(404).json({ message: "Buyer not found." });
    }

    return response.status(204).send();
  } catch (error) {
    return handleBuyerError(response, error);
  }
}

module.exports = {
  createBuyer,
  deleteBuyer,
  getBuyers,
  updateBuyer,
  updateBuyerStatus,
};
