require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const buyerRoutes = require("./routes/buyerRoutes");
const salesOrderRoutes = require("./routes/salesOrderRoutes");
const projectRoutes = require("./routes/projectRoutes");
const supplierAssignmentRoutes = require("./routes/supplierAssignmentRoutes");
const supplierProductsTrackingRoutes = require("./routes/supplierProductsTrackingRoutes");
const projectGoodsSupplierRoutes = require("./routes/projectGoodsSupplierRoutes");
const rawMaterialSupplierRoutes = require("./routes/rawMaterialSupplierRoutes");
const rawMaterialPurchaseRoutes = require("./routes/rawMaterialPurchaseRoutes");
const rawMaterialStockRoutes = require("./routes/rawMaterialStockRoutes");
const rawMaterialAllocationRoutes = require("./routes/rawMaterialAllocationRoutes");
const factoryProductTrackingRoutes = require("./routes/factoryProductTrackingRoutes");
const deliveryShipmentRoutes = require("./routes/deliveryShipmentRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
  }),
);
app.use(express.json());

app.get("/api/health", (request, response) => {
  response.json({ message: "Backend is running." });
});

app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
app.use("/api/buyers", buyerRoutes);
app.use("/api/sales-orders", salesOrderRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/supplier-assignments", supplierAssignmentRoutes);
app.use("/api/supplier-products-tracking", supplierProductsTrackingRoutes);
app.use("/api/project-goods-suppliers", projectGoodsSupplierRoutes);
app.use("/api/raw-material-suppliers", rawMaterialSupplierRoutes);
app.use("/api/raw-material-purchases", rawMaterialPurchaseRoutes);
app.use("/api/raw-material-stocks", rawMaterialStockRoutes);
app.use("/api/raw-material-allocations", rawMaterialAllocationRoutes);
app.use("/api/factory-product-tracking", factoryProductTrackingRoutes);
app.use("/api/delivery-shipments", deliveryShipmentRoutes);
app.use("/api/invoices", invoiceRoutes);

module.exports = app;
