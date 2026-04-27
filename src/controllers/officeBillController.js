const officeBillModel = require("../models/officeBillModel");

function getTodayDateValue() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function validateOfficeBillPayload(body) {
  const errors = [];

  if (!body.category || !["daily", "monthly"].includes(body.category)) {
    errors.push("Category must be daily or monthly.");
  }

  if (!body.costCategory?.trim()) {
    errors.push("Cost category is required.");
  }

  if (!body.description?.trim()) {
    errors.push("Description is required.");
  }

  if (body.amount === undefined || body.amount === null || body.amount === "" || Number(body.amount) <= 0) {
    errors.push("Amount must be greater than zero.");
  }

  return errors;
}

function handleOfficeBillError(response, error) {
  console.error(error);
  return response.status(500).json({ message: "Something went wrong while processing office costs." });
}

async function getOfficeBills(request, response) {
  try {
    const officeBills = await officeBillModel.getAllOfficeBills();
    return response.json(officeBills);
  } catch (error) {
    return handleOfficeBillError(response, error);
  }
}

async function createOfficeBill(request, response) {
  const errors = validateOfficeBillPayload(request.body);

  if (errors.length > 0) {
    return response.status(400).json({ message: errors.join(" ") });
  }

  try {
    const officeBill = await officeBillModel.createOfficeBill({
      category: request.body.category,
      costCategory: request.body.costCategory.trim(),
      description: request.body.description.trim(),
      amount: request.body.amount,
      receiptLocation: request.file ? `/uploads/office_bill_receipt/${request.file.filename}` : "",
      createdAt: `${request.body.date?.trim() || getTodayDateValue()} 00:00:00`,
    });

    return response.status(201).json(officeBill);
  } catch (error) {
    return handleOfficeBillError(response, error);
  }
}

module.exports = {
  createOfficeBill,
  getOfficeBills,
};
