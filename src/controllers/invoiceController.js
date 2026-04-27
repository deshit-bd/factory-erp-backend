const invoiceModel = require("../models/invoiceModel");

function handleInvoiceError(response, error) {
  console.error(error);
  return response.status(500).json({ message: error.message || "Something went wrong while processing invoices." });
}

async function getInvoices(request, response) {
  try {
    const invoices = await invoiceModel.getAllInvoices(request.query.search || "");
    return response.json(invoices);
  } catch (error) {
    return handleInvoiceError(response, error);
  }
}

async function getInvoiceFormOptions(request, response) {
  try {
    const options = await invoiceModel.getInvoiceFormOptions();
    return response.json(options);
  } catch (error) {
    return handleInvoiceError(response, error);
  }
}

async function createInvoice(request, response) {
  const { buyerId, projectId, paidAmount, date } = request.body;

  if (!buyerId) {
    return response.status(400).json({ message: "Buyer is required." });
  }

  if (!projectId) {
    return response.status(400).json({ message: "Project is required." });
  }

  if (!date) {
    return response.status(400).json({ message: "Date is required." });
  }

  try {
    const invoice = await invoiceModel.createInvoice({
      buyerId,
      projectId,
      paidAmount: paidAmount || 0,
      date,
    });

    return response.status(201).json(invoice);
  } catch (error) {
    return handleInvoiceError(response, error);
  }
}

module.exports = {
  createInvoice,
  getInvoiceFormOptions,
  getInvoices,
};
