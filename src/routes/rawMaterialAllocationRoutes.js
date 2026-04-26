const express = require("express");
const rawMaterialAllocationController = require("../controllers/rawMaterialAllocationController");

const router = express.Router();

router.get("/", rawMaterialAllocationController.getRawMaterialAllocations);
router.post("/", rawMaterialAllocationController.createRawMaterialAllocation);

module.exports = router;
