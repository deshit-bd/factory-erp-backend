const rawMaterialStockModel = require("../models/rawMaterialStockModel");

function validateRawMaterialStockPayload(body) {
  const errors = [];

  if (!body.material?.trim()) {
    errors.push("Material is required.");
  }

  if (!body.category?.trim()) {
    errors.push("Category is required.");
  }

  if (body.currentStock === undefined || body.currentStock === null || body.currentStock === "" || Number(body.currentStock) < 0) {
    errors.push("Current stock is required.");
  }

  if (body.minimumStock === undefined || body.minimumStock === null || body.minimumStock === "" || Number(body.minimumStock) < 0) {
    errors.push("Minimum stock is required.");
  }

  if (body.unitCost === undefined || body.unitCost === null || body.unitCost === "" || Number(body.unitCost) < 0) {
    errors.push("Unit cost is required.");
  }

  return errors;
}

function handleRawMaterialStockError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing raw material stock." });
}

async function getRawMaterialStocks(request, response) {
  try {
    const stocks = await rawMaterialStockModel.getAllRawMaterialStocks(request.query.search || "");
    return response.json(stocks);
  } catch (error) {
    return handleRawMaterialStockError(response, error);
  }
}

async function createRawMaterialStock(request, response) {
  const errors = validateRawMaterialStockPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const stock = await rawMaterialStockModel.createRawMaterialStock(request.body);
    return response.status(201).json(stock);
  } catch (error) {
    return handleRawMaterialStockError(response, error);
  }
}

module.exports = {
  createRawMaterialStock,
  getRawMaterialStocks,
};
