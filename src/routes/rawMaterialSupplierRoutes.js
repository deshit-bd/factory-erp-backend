const express = require("express");
const rawMaterialSupplierController = require("../controllers/rawMaterialSupplierController");

const router = express.Router();

router.get("/", rawMaterialSupplierController.getRawMaterialSuppliers);
router.post("/", rawMaterialSupplierController.createRawMaterialSupplier);
router.put("/:id", rawMaterialSupplierController.updateRawMaterialSupplier);
router.delete("/:id", rawMaterialSupplierController.deleteRawMaterialSupplier);

module.exports = router;
