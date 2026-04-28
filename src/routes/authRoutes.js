const express = require("express");

const authController = require("../controllers/authController");

const router = express.Router();

router.post("/login", authController.login);
router.get("/users", authController.getUsers);
router.get("/permissions", authController.getPermissions);
router.post("/users", authController.createUser);
router.put("/users/:id", authController.updateUser);
router.delete("/users/:id", authController.deleteUser);

module.exports = router;
