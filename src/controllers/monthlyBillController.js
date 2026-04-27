const monthlyBillModel = require("../models/monthlyBillModel");

function validateMonthlyBillPayload(body) {
  const errors = [];

  if (!body.category?.trim()) {
    errors.push("Category is required.");
  }

  if (!body.description?.trim()) {
    errors.push("Description is required.");
  }

  if (body.amount === undefined || body.amount === null || body.amount === "" || Number(body.amount) <= 0) {
    errors.push("Amount must be greater than zero.");
  }

  if (!body.billDate?.trim()) {
    errors.push("Bill date is required.");
  }

  return errors;
}

function handleMonthlyBillError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing monthly bills." });
}

async function getMonthlyBills(request, response) {
  try {
    const monthlyBills = await monthlyBillModel.getAllMonthlyBills();
    return response.json(monthlyBills);
  } catch (error) {
    return handleMonthlyBillError(response, error);
  }
}

async function createMonthlyBill(request, response) {
  const errors = validateMonthlyBillPayload(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const monthlyBill = await monthlyBillModel.createMonthlyBill({
      category: request.body.category.trim(),
      description: request.body.description.trim(),
      amount: request.body.amount,
      billDate: request.body.billDate.trim(),
      receiptPath: request.file ? `/uploads/monthly_bill_receipt/${request.file.filename}` : "",
    });

    return response.status(201).json(monthlyBill);
  } catch (error) {
    return handleMonthlyBillError(response, error);
  }
}

module.exports = {
  createMonthlyBill,
  getMonthlyBills,
};
