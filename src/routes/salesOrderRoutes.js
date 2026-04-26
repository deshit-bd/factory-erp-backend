const express = require("express");
const salesOrderController = require("../controllers/salesOrderController");

const router = express.Router();

router.get("/", salesOrderController.getSalesOrders);
router.post("/", salesOrderController.createSalesOrder);
router.patch("/:id/status", salesOrderController.updateSalesOrderStatus);
router.delete("/:id", salesOrderController.deleteSalesOrder);

module.exports = router;
