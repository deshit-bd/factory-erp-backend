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
const projectGoodsSupplierPaymentRoutes = require("./routes/projectGoodsSupplierPaymentRoutes");
const rawMaterialSupplierRoutes = require("./routes/rawMaterialSupplierRoutes");
const rawMaterialSupplierPaymentRoutes = require("./routes/rawMaterialSupplierPaymentRoutes");
const rawMaterialPurchaseRoutes = require("./routes/rawMaterialPurchaseRoutes");
const rawMaterialStockRoutes = require("./routes/rawMaterialStockRoutes");
const rawMaterialAllocationRoutes = require("./routes/rawMaterialAllocationRoutes");
const factoryProductTrackingRoutes = require("./routes/factoryProductTrackingRoutes");
const deliveryShipmentRoutes = require("./routes/deliveryShipmentRoutes");
const invoiceRoutes = require("./routes/invoiceRoutes");
const factoryCostRoutes = require("./routes/factoryCostRoutes");
const shipmentCostRoutes = require("./routes/shipmentCostRoutes");
const monthlyBillRoutes = require("./routes/monthlyBillRoutes");
const officeBillRoutes = require("./routes/officeBillRoutes");
const accountsRoutes = require("./routes/accountsRoutes");
const authRoutes = require("./routes/authRoutes");

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
app.use("/api/project-goods-supplier-payments", projectGoodsSupplierPaymentRoutes);
app.use("/api/raw-material-suppliers", rawMaterialSupplierRoutes);
app.use("/api/raw-material-supplier-payments", rawMaterialSupplierPaymentRoutes);
app.use("/api/raw-material-purchases", rawMaterialPurchaseRoutes);
app.use("/api/raw-material-stocks", rawMaterialStockRoutes);
app.use("/api/raw-material-allocations", rawMaterialAllocationRoutes);
app.use("/api/factory-product-tracking", factoryProductTrackingRoutes);
app.use("/api/delivery-shipments", deliveryShipmentRoutes);
app.use("/api/invoices", invoiceRoutes);
app.use("/api/factory-costs", factoryCostRoutes);
app.use("/api/shipment-costs", shipmentCostRoutes);
app.use("/api/monthly-bills", monthlyBillRoutes);
app.use("/api/office-bills", officeBillRoutes);
app.use("/api/accounts", accountsRoutes);
app.use("/api/auth", authRoutes);

module.exports = app;
