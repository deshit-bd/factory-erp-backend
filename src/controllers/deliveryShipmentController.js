const deliveryShipmentModel = require("../models/deliveryShipmentModel");

function handleDeliveryShipmentError(response, error) {
  console.error(error);
  return response.status(500).json({ message: error.message || "Something went wrong while processing delivery shipments." });
}

async function getDeliveryShipments(request, response) {
  try {
    const deliveries = await deliveryShipmentModel.getAllDeliveryShipments(request.query.search || "");
    return response.json(deliveries);
  } catch (error) {
    return handleDeliveryShipmentError(response, error);
  }
}

async function updateDeliveryShipmentStatus(request, response) {
  const { status } = request.body;

  if (!["Delivered", "Not Delivered", "delivered", "not delivered"].includes(status)) {
    return response.status(400).json({ message: "Status must be delivered or not delivered." });
  }

  try {
    const delivery = await deliveryShipmentModel.updateDeliveryShipmentStatus(request.params.id, status);

    if (!delivery) {
      return response.status(404).json({ message: "Delivery shipment not found." });
    }

    return response.json(delivery);
  } catch (error) {
    return handleDeliveryShipmentError(response, error);
  }
}

module.exports = {
  getDeliveryShipments,
  updateDeliveryShipmentStatus,
};
