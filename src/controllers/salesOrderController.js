const salesOrderModel = require("../models/salesOrderModel");

function validateSalesOrderPayload(body) {
  const errors = [];

  if (!body.buyer?.trim()) {
    errors.push("Buyer is required.");
  }

  if (!body.product?.trim()) {
    errors.push("Product is required.");
  }

  if (!body.quantity || Number(body.quantity) <= 0) {
    errors.push("Quantity must be greater than zero.");
  }

  if (!body.unitPrice || Number(body.unitPrice) <= 0) {
    errors.push("Unit price must be greater than zero.");
  }

  if (!body.deliveryDate?.trim()) {
    errors.push("Delivery date is required.");
  }

  return errors;
}

function handleSalesOrderError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing sales orders." });
}

async function getSalesOrders(request, response) {
  try {
    const salesOrders = await salesOrderModel.getAllSalesOrders(request.query.search || "");
    response.json(salesOrders);
  } catch (error) {
    handleSalesOrderError(response, error);
  }
}

async function createSalesOrder(request, response) {
  const errors = validateSalesOrderPayload(request.body);
  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const salesOrder = await salesOrderModel.createSalesOrder({
      ...request.body,
      status: request.body.status || "pending",
    });
    return response.status(201).json(salesOrder);
  } catch (error) {
    return handleSalesOrderError(response, error);
  }
}

async function updateSalesOrderStatus(request, response) {
  const { status } = request.body;

  if (!["Pending", "Confirmed", "In Progress", "Completed", "pending", "confirmed", "in progress", "completed"].includes(status)) {
    return response.status(400).json({ message: "Status must be pending, confirmed, in progress, or completed." });
  }

  try {
    const salesOrder = await salesOrderModel.updateSalesOrderStatus(request.params.id, status);

    if (!salesOrder) {
      return response.status(404).json({ message: "Sales order not found." });
    }

    return response.json(salesOrder);
  } catch (error) {
    return handleSalesOrderError(response, error);
  }
}

async function deleteSalesOrder(request, response) {
  try {
    const deleted = await salesOrderModel.deleteSalesOrder(request.params.id);

    if (!deleted) {
      return response.status(404).json({ message: "Sales order not found." });
    }

    return response.status(204).send();
  } catch (error) {
    return handleSalesOrderError(response, error);
  }
}

module.exports = {
  createSalesOrder,
  deleteSalesOrder,
  getSalesOrders,
  updateSalesOrderStatus,
};
