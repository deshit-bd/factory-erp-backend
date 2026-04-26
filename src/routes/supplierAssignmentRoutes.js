const express = require("express");
const supplierAssignmentController = require("../controllers/supplierAssignmentController");

const router = express.Router();

router.get("/", supplierAssignmentController.getSupplierAssignments);
router.post("/", supplierAssignmentController.createSupplierAssignment);
router.put("/:id/status", supplierAssignmentController.updateSupplierAssignmentStatus);

module.exports = router;
