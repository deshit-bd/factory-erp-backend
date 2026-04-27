const express = require("express");
const rawMaterialSupplierPaymentController = require("../controllers/rawMaterialSupplierPaymentController");

const router = express.Router();

router.get("/", rawMaterialSupplierPaymentController.getRawMaterialSupplierPayments);
router.post("/", rawMaterialSupplierPaymentController.createRawMaterialSupplierPayment);

module.exports = router;
