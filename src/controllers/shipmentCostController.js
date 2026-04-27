const shipmentCostModel = require("../models/shipmentCostModel");

function validateShipmentCostPayload(body) {
  const errors = [];

  if (!body.projectId || Number(body.projectId) <= 0) {
    errors.push("Project is required.");
  }

  if (!body.destination?.trim()) {
    errors.push("Destination is required.");
  }

  if (!body.shipmentDate?.trim()) {
    errors.push("Date is required.");
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    errors.push("At least one shipment cost item is required.");
  }

  if (Array.isArray(body.items)) {
    body.items.forEach((item, index) => {
      if (!item.category?.trim()) {
        errors.push(`Item ${index + 1}: category is required.`);
      }

      if (item.amount === undefined || item.amount === null || item.amount === "" || Number(item.amount) <= 0) {
        errors.push(`Item ${index + 1}: amount must be greater than zero.`);
      }
    });
  }

  return errors;
}

function handleShipmentCostError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing shipment costs." });
}

async function getShipmentCosts(request, response) {
  try {
    const shipmentCosts = await shipmentCostModel.getAllShipmentCosts();
    return response.json(shipmentCosts);
  } catch (error) {
    return handleShipmentCostError(response, error);
  }
}

async function createShipmentCosts(request, response) {
  const errors = validateShipmentCostPayload(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const shipmentCosts = await shipmentCostModel.createShipmentCosts({
      projectId: request.body.projectId,
      destination: request.body.destination.trim(),
      shipmentDate: request.body.shipmentDate.trim(),
      items: request.body.items.map((item) => ({
        category: item.category.trim(),
        amount: item.amount,
        description: item.description?.trim() || "",
      })),
    });

    return response.status(201).json(shipmentCosts);
  } catch (error) {
    return handleShipmentCostError(response, error);
  }
}

module.exports = {
  createShipmentCosts,
  getShipmentCosts,
};
