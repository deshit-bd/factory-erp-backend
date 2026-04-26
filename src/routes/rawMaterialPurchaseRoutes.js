const express = require("express");
const rawMaterialPurchaseController = require("../controllers/rawMaterialPurchaseController");
const { uploadRawMaterialPurchaseReceipt } = require("../config/upload");

const router = express.Router();

router.get("/", rawMaterialPurchaseController.getRawMaterialPurchases);
router.post("/", uploadRawMaterialPurchaseReceipt.single("receipt"), rawMaterialPurchaseController.createRawMaterialPurchase);

module.exports = router;
