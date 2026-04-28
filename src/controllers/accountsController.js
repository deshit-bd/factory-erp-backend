const accountsModel = require("../models/accountsModel");

async function getAccountsDashboard(request, response) {
  try {
    const dashboard = await accountsModel.getAccountsDashboard();
    return response.json(dashboard);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: error.message || "Something went wrong while loading accounts dashboard." });
  }
}

async function getCompanyInfo(request, response) {
  try {
    const companyInfo = await accountsModel.getCompanyInfo();
    return response.json(companyInfo);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: error.message || "Something went wrong while loading company info." });
  }
}

async function saveCompanyInfo(request, response) {
  const { companyName, email, phone, address } = request.body;

  if (!companyName?.trim()) {
    return response.status(400).json({ message: "Company name is required." });
  }

  try {
    const companyInfo = await accountsModel.saveCompanyInfo({
      companyName: companyName.trim(),
      email: String(email || "").trim(),
      phone: String(phone || "").trim(),
      address: String(address || "").trim(),
    });

    return response.json(companyInfo);
  } catch (error) {
    console.error(error);
    return response.status(500).json({ message: error.message || "Something went wrong while saving company info." });
  }
}

module.exports = {
  getCompanyInfo,
  getAccountsDashboard,
  saveCompanyInfo,
};
