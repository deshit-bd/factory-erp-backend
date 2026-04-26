const rawMaterialPurchaseModel = require("../models/rawMaterialPurchaseModel");

function validateRawMaterialPurchasePayload(body, file) {
  const errors = [];

  if (!body.material?.trim()) {
    errors.push("Material is required.");
  }

  if (!body.supplierId || Number(body.supplierId) <= 0) {
    errors.push("Supplier is required.");
  }

  if (!body.quantity || Number(body.quantity) <= 0) {
    errors.push("Quantity must be greater than zero.");
  }

  if (!body.unitCost || Number(body.unitCost) <= 0) {
    errors.push("Unit cost must be greater than zero.");
  }

  if (!body.supplierRating || Number(body.supplierRating) < 1 || Number(body.supplierRating) > 5) {
    errors.push("Supplier rating must be between 1 and 5.");
  }

  if (!body.date?.trim()) {
    errors.push("Date is required.");
  }

  if (body.isNewMaterial === "true") {
    if (!body.category?.trim()) {
      errors.push("Category is required for a new material.");
    }

    if (body.minimumStock === undefined || body.minimumStock === null || body.minimumStock === "" || Number(body.minimumStock) < 0) {
      errors.push("Minimum stock is required for a new material.");
    }
  }

  if (!file) {
    errors.push("Receipt file is required.");
  }

  return errors;
}

function handleRawMaterialPurchaseError(response, error) {
  console.error(error);
  return response.status(500).json({ message: error.message || "Something went wrong while processing material purchases." });
}

async function getRawMaterialPurchases(request, response) {
  try {
    const purchases = await rawMaterialPurchaseModel.getAllRawMaterialPurchases(request.query.search || "");
    return response.json(purchases);
  } catch (error) {
    return handleRawMaterialPurchaseError(response, error);
  }
}

async function createRawMaterialPurchase(request, response) {
  const errors = validateRawMaterialPurchasePayload(request.body, request.file);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const purchase = await rawMaterialPurchaseModel.createRawMaterialPurchase({
      material: request.body.material,
      supplierId: request.body.supplierId,
      quantity: request.body.quantity,
      unitCost: request.body.unitCost,
      supplierRating: request.body.supplierRating,
      category: request.body.category || "",
      minimumStock: request.body.minimumStock || 0,
      receiptLocation: `/uploads/raw_material_purchase_receipt/${request.file.filename}`,
      createdAt: `${request.body.date} 00:00:00`,
    });

    return response.status(201).json(purchase);
  } catch (error) {
    return handleRawMaterialPurchaseError(response, error);
  }
}

module.exports = {
  createRawMaterialPurchase,
  getRawMaterialPurchases,
};
