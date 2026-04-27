const express = require("express");
const officeBillController = require("../controllers/officeBillController");
const { uploadOfficeBillReceipt } = require("../config/upload");

const router = express.Router();

router.get("/", officeBillController.getOfficeBills);
router.post("/", uploadOfficeBillReceipt.single("receipt"), officeBillController.createOfficeBill);

module.exports = router;
