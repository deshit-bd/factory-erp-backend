const factoryCostModel = require("../models/factoryCostModel");

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validateFactoryCostPayload(body) {
  const errors = [];

  if (!body.category || !["daily", "monthly"].includes(body.category)) {
    errors.push("Category must be daily or monthly.");
  }

  if (!body.costCategory?.trim()) {
    errors.push("Cost category is required.");
  }

  if (!body.description?.trim()) {
    errors.push("Description is required.");
  }

  if (body.amount === undefined || body.amount === null || body.amount === "" || Number(body.amount) <= 0) {
    errors.push("Amount must be greater than zero.");
  }

  return errors;
}

function handleFactoryCostError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing factory costs." });
}

async function getFactoryCosts(request, response) {
  try {
    const factoryCosts = await factoryCostModel.getAllFactoryCosts();
    return response.json(factoryCosts);
  } catch (error) {
    return handleFactoryCostError(response, error);
  }
}

async function createFactoryCost(request, response) {
  const errors = validateFactoryCostPayload(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const factoryCost = await factoryCostModel.createFactoryCost({
      category: request.body.category,
      costCategory: request.body.costCategory.trim(),
      description: request.body.description.trim(),
      amount: request.body.amount,
      receiptLocation: request.file ? `/uploads/factory_cost_receipt/${request.file.filename}` : "",
      createdAt: `${request.body.date?.trim() || getTodayDateValue()} 00:00:00`,
    });

    return response.status(201).json(factoryCost);
  } catch (error) {
    return handleFactoryCostError(response, error);
  }
}

module.exports = {
  createFactoryCost,
  getFactoryCosts,
};
