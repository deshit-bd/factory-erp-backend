const fs = require("fs");
const path = require("path");
const multer = require("multer");

const uploadRoot = path.join(__dirname, "..", "..", "uploads");
const rawMaterialPurchaseReceiptDir = path.join(uploadRoot, "raw_material_purchase_receipt");

fs.mkdirSync(rawMaterialPurchaseReceiptDir, { recursive: true });

const storage = multer.diskStorage({
  destination(request, file, callback) {
    callback(null, rawMaterialPurchaseReceiptDir);
  },
  filename(request, file, callback) {
    const extension = path.extname(file.originalname || "");
    const baseName = path.basename(file.originalname || "receipt", extension).replace(/[^a-zA-Z0-9_-]/g, "-");
    callback(null, `${Date.now()}-${baseName}${extension}`);
  },
});

function fileFilter(request, file, callback) {
  const allowedMimeTypes = ["application/pdf", "image/jpeg", "image/png", "image/webp"];

  if (allowedMimeTypes.includes(file.mimetype)) {
    callback(null, true);
    return;
  }

  callback(new Error("Only PDF, JPG, PNG, and WEBP files are allowed."));
}

const uploadRawMaterialPurchaseReceipt = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

module.exports = {
  uploadRawMaterialPurchaseReceipt,
};
