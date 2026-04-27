const express = require("express");
const factoryCostController = require("../controllers/factoryCostController");
const { uploadFactoryCostReceipt } = require("../config/upload");

const router = express.Router();

router.get("/", factoryCostController.getFactoryCosts);
router.post("/", uploadFactoryCostReceipt.single("receipt"), factoryCostController.createFactoryCost);

module.exports = router;
