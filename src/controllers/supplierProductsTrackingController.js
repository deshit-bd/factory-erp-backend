const supplierProductsTrackingModel = require("../models/supplierProductsTrackingModel");

function validateSupplierProductsTrackingPayload(body) {
  const errors = [];

  if (!body.supplierId || Number(body.supplierId) <= 0) {
    errors.push("Supplier is required.");
  }

  if (!body.projectId || Number(body.projectId) <= 0) {
    errors.push("Project is required.");
  }

  if (!body.productId || Number(body.productId) <= 0) {
    errors.push("Product is required.");
  }

  if (!body.quantitySupplied || Number(body.quantitySupplied) <= 0) {
    errors.push("Quantity supplied must be greater than zero.");
  }

  if (!["pass", "fail"].includes(body.qualityStatus)) {
    errors.push("Quality status is required.");
  }

  if (!body.date?.trim()) {
    errors.push("Date is required.");
  }

  if (body.notes === undefined) {
    errors.push("Notes are required.");
  }

  return errors;
}

function buildSupplierProductsTrackingPayload(body) {
  return {
    supplierId: body.supplierId,
    projectId: body.projectId,
    productId: body.productId,
    quantitySupplied: body.quantitySupplied,
    qualityStatus: body.qualityStatus,
    notes: body.notes?.trim() || "",
    date: body.date.trim(),
  };
}

function buildReceiptLocation(file) {
  return file ? `/uploads/supplier_products_tracking_receipt/${file.filename}` : "";
}

function handleSupplierProductsTrackingError(response, error) {
  console.error(error);
  return response.status(500).json({ message: error.message || "Something went wrong while processing supplier products tracking." });
}

async function getSupplierProductsTracking(request, response) {
  try {
    const entries = await supplierProductsTrackingModel.getAllSupplierProductsTracking();
    return response.json(entries);
  } catch (error) {
    return handleSupplierProductsTrackingError(response, error);
  }
}

async function createSupplierProductsTracking(request, response) {
  const errors = validateSupplierProductsTrackingPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const entry = await supplierProductsTrackingModel.createSupplierProductsTracking(
      {
        ...buildSupplierProductsTrackingPayload(request.body),
        receiptLocation: buildReceiptLocation(request.file),
      },
    );
    return response.status(201).json(entry);
  } catch (error) {
    return handleSupplierProductsTrackingError(response, error);
  }
}

async function updateSupplierProductsTracking(request, response) {
  const errors = validateSupplierProductsTrackingPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const existingEntry = await supplierProductsTrackingModel.getSupplierProductsTrackingById(request.params.id);
    if (!existingEntry) {
      return response.status(404).json({ message: "Supplier product entry not found." });
    }

    const entry = await supplierProductsTrackingModel.updateSupplierProductsTracking(
      request.params.id,
      {
        ...buildSupplierProductsTrackingPayload(request.body),
        receiptLocation: buildReceiptLocation(request.file),
      },
    );
    return response.json(entry);
  } catch (error) {
    return handleSupplierProductsTrackingError(response, error);
  }
}

module.exports = {
  createSupplierProductsTracking,
  getSupplierProductsTracking,
  updateSupplierProductsTracking,
};
