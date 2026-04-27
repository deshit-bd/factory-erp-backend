const express = require("express");
const shipmentCostController = require("../controllers/shipmentCostController");

const router = express.Router();

router.get("/", shipmentCostController.getShipmentCosts);
router.post("/", shipmentCostController.createShipmentCosts);

module.exports = router;
