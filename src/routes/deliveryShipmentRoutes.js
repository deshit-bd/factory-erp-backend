const express = require("express");
const deliveryShipmentController = require("../controllers/deliveryShipmentController");

const router = express.Router();

router.get("/", deliveryShipmentController.getDeliveryShipments);
router.patch("/:id/status", deliveryShipmentController.updateDeliveryShipmentStatus);

module.exports = router;
