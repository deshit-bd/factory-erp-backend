const express = require("express");
const { uploadSupplierProductsTrackingReceipt } = require("../config/upload");
const supplierProductsTrackingController = require("../controllers/supplierProductsTrackingController");

const router = express.Router();

router.get("/", supplierProductsTrackingController.getSupplierProductsTracking);
router.post("/", uploadSupplierProductsTrackingReceipt.single("receipt"), supplierProductsTrackingController.createSupplierProductsTracking);
router.put("/:id", uploadSupplierProductsTrackingReceipt.single("receipt"), supplierProductsTrackingController.updateSupplierProductsTracking);

module.exports = router;
