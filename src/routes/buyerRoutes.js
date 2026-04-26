const express = require("express");
const buyerController = require("../controllers/buyerController");

const router = express.Router();

router.get("/", buyerController.getBuyers);
router.post("/", buyerController.createBuyer);
router.put("/:id", buyerController.updateBuyer);
router.patch("/:id/status", buyerController.updateBuyerStatus);
router.delete("/:id", buyerController.deleteBuyer);

module.exports = router;
