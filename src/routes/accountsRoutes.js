const express = require("express");
const accountsController = require("../controllers/accountsController");

const router = express.Router();

router.get("/dashboard", accountsController.getAccountsDashboard);
router.get("/company-info", accountsController.getCompanyInfo);
router.put("/company-info", accountsController.saveCompanyInfo);

module.exports = router;
