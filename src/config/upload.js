const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadRoot = path.join(__dirname, "..", "..", "uploads");
const rawMaterialPurchaseReceiptDir = path.join(uploadRoot, "raw_material_purchase_receipt");
const projectGoodsSupplierReceiptDir = path.join(uploadRoot, "project_goods_supplier_receipt");
const supplierProductsTrackingReceiptDir = path.join(uploadRoot, "supplier_products_tracking_receipt");

fs.mkdirSync(rawMaterialPurchaseReceiptDir, { recursive: true });
fs.mkdirSync(projectGoodsSupplierReceiptDir, { recursive: true });
fs.mkdirSync(supplierProductsTrackingReceiptDir, { recursive: true });

function createStorage(destinationDir) {
  return multer.diskStorage({
    destination(request, file, callback) {
      callback(null, destinationDir);
    },
    filename(request, file, callback) {
      const extension = path.extname(file.originalname || "");
      const baseName = path.basename(file.originalname || "receipt", extension).replace(/[^a-zA-Z0-9_-]/g, "-");
      callback(null, `${Date.now()}-${baseName}${extension}`);
    },
  });
}

function fileFilter(request, file, callback) {
  const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    callback(null, true);
    return;
  }

  callback(new Error("Only PDF, JPG, PNG, and WEBP files are allowed."));
}

const uploadRawMaterialPurchaseReceipt = multer({
  storage: createStorage(rawMaterialPurchaseReceiptDir),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const uploadProjectGoodsSupplierReceipt = multer({
  storage: createStorage(projectGoodsSupplierReceiptDir),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const uploadSupplierProductsTrackingReceipt = multer({
  storage: createStorage(supplierProductsTrackingReceiptDir),
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  uploadProjectGoodsSupplierReceipt,
  uploadRawMaterialPurchaseReceipt,
  uploadSupplierProductsTrackingReceipt,
};
