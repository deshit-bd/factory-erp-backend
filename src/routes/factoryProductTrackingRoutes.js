const express = require("express");
const factoryProductTrackingController = require("../controllers/factoryProductTrackingController");

const router = express.Router();

router.get("/", factoryProductTrackingController.getFactoryProductEntries);
router.post("/", factoryProductTrackingController.createFactoryProductEntry);
router.put("/:id", factoryProductTrackingController.updateFactoryProductEntry);

module.exports = router;
