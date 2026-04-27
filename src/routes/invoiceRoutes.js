const express = require("express");
const invoiceController = require("../controllers/invoiceController");

const router = express.Router();

router.get("/", invoiceController.getInvoices);
router.get("/form-options", invoiceController.getInvoiceFormOptions);
router.post("/", invoiceController.createInvoice);

module.exports = router;
