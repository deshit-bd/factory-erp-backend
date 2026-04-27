const rawMaterialSupplierPaymentModel = require("../models/rawMaterialSupplierPaymentModel");

function validatePaymentPayload(body) {
  const errors = [];

  if (!body.paymentDate?.trim()) {
    errors.push("Payment date is required.");
  }

  if (!body.supplierId || Number(body.supplierId) <= 0) {
    errors.push("Supplier is required.");
  }

  if (!["cash", "bank"].includes(String(body.paymentMethod || "").toLowerCase())) {
    errors.push("Payment method must be cash or bank.");
  }

  if (!body.paidAmount || Number(body.paidAmount) <= 0) {
    errors.push("Paid amount must be greater than zero.");
  }

  return errors;
}

function handlePaymentError(response, error) {
  console.error(error);
  return response.status(500).json({ message: error.message || "Something went wrong while processing raw material supplier payments." });
}

async function getRawMaterialSupplierPayments(request, response) {
  try {
    const payments = await rawMaterialSupplierPaymentModel.getAllRawMaterialSupplierPayments();
    return response.json(payments);
  } catch (error) {
    return handlePaymentError(response, error);
  }
}

async function createRawMaterialSupplierPayment(request, response) {
  const errors = validatePaymentPayload(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const payment = await rawMaterialSupplierPaymentModel.createRawMaterialSupplierPayment({
      paymentDate: request.body.paymentDate,
      supplierId: request.body.supplierId,
      paymentMethod: String(request.body.paymentMethod).toLowerCase(),
      paidAmount: request.body.paidAmount,
    });

    return response.status(201).json(payment);
  } catch (error) {
    return handlePaymentError(response, error);
  }
}

module.exports = {
  createRawMaterialSupplierPayment,
  getRawMaterialSupplierPayments,
};
