const express = require("express");
const rawMaterialStockController = require("../controllers/rawMaterialStockController");

const router = express.Router();

router.get("/", rawMaterialStockController.getRawMaterialStocks);
router.post("/", rawMaterialStockController.createRawMaterialStock);

module.exports = router;
