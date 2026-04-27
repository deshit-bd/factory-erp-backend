const express = require("express");
const projectGoodsSupplierPaymentController = require("../controllers/projectGoodsSupplierPaymentController");

const router = express.Router();

router.get("/", projectGoodsSupplierPaymentController.getProjectGoodsSupplierPayments);
router.post("/", projectGoodsSupplierPaymentController.createProjectGoodsSupplierPayment);

module.exports = router;
