const express = require("express");
const projectGoodsSupplierController = require("../controllers/projectGoodsSupplierController");

const router = express.Router();

router.get("/", projectGoodsSupplierController.getProjectGoodsSuppliers);
router.post("/", projectGoodsSupplierController.createProjectGoodsSupplier);
router.put("/:id", projectGoodsSupplierController.updateProjectGoodsSupplier);
router.delete("/:id", projectGoodsSupplierController.deleteProjectGoodsSupplier);

module.exports = router;
