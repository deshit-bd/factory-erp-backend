const express = require("express");
const monthlyBillController = require("../controllers/monthlyBillController");
const { uploadMonthlyBillReceipt } = require("../config/upload");

const router = express.Router();

router.get("/", monthlyBillController.getMonthlyBills);
router.post("/", uploadMonthlyBillReceipt.single("receipt"), monthlyBillController.createMonthlyBill);

module.exports = router;
