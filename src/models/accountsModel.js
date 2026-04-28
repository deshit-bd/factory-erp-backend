const { pool } = require("../config/db");

function formatDateValue(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatMoney(value) {
  return `৳${Number(value || 0).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}

function mapLedgerRow(row, isDebit) {
  return {
    date: formatDateValue(row.ledger_date),
    reference: row.reference || "-",
    description: row.description || "",
    amount: `${isDebit ? "-" : ""}${formatMoney(isDebit ? row.credit : row.debit).replace(/^৳/, "")}`,
    amountRaw: Number(isDebit ? row.credit : row.debit || 0),
    ledger: row.ledger,
  };
}

function formatProjectStatus(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") {
    return "Completed";
  }

  if (normalized === "confirmed") {
    return "Confirmed";
  }

  if (normalized === "pending") {
    return "Pending";
  }

  return "In Progress";
}

function getProjectStatusTone(status) {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "completed") {
    return "green";
  }

  if (normalized === "pending") {
    return "amber";
  }

  return "blue";
}

function getResolvedProjectStatus(row) {
  const totalOrderQuantity = toAmount(row.total_order_quantity || row.quantity);
  const totalProduced = toAmount(row.total_supplier_produced) + toAmount(row.total_factory_produced);

  if (totalOrderQuantity > 0) {
    return totalProduced >= totalOrderQuantity ? "Completed" : "In Progress";
  }

  return formatProjectStatus(row.status || row.order_status);
}

function toAmount(value) {
  return Number(value || 0);
}

function getMonthShortLabel(date) {
  return date.toLocaleString("en-US", { month: "short" });
}

async function getCompanyInfo() {
  const [rows] = await pool.query(
    `SELECT id, company_name, email, phone, address, created_at, updated_at
     FROM company_info
     ORDER BY id ASC
     LIMIT 1`,
  );

  const row = rows[0];

  if (!row) {
    return {
      id: null,
      companyName: "",
      email: "",
      phone: "",
      address: "",
      createdAt: null,
      updatedAt: null,
    };
  }

  return {
    id: row.id,
    companyName: row.company_name || "",
    email: row.email || "",
    phone: row.phone || "",
    address: row.address || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function saveCompanyInfo(companyInfo) {
  const existing = await getCompanyInfo();

  if (existing.id) {
    await pool.query(
      `UPDATE company_info
       SET company_name = ?, email = ?, phone = ?, address = ?
       WHERE id = ?`,
      [companyInfo.companyName, companyInfo.email, companyInfo.phone, companyInfo.address, Number(existing.id)],
    );
  } else {
    await pool.query(
      `INSERT INTO company_info (company_name, email, phone, address)
       VALUES (?, ?, ?, ?)`,
      [companyInfo.companyName, companyInfo.email, companyInfo.phone, companyInfo.address],
    );
  }

  return getCompanyInfo();
}

function mapProjectWiseRow(row) {
  const sales = toAmount(row.sales_amount);
  const materialCost = toAmount(row.material_cost);
  const supplierCost = toAmount(row.supplier_cost);
  const shipmentCost = toAmount(row.shipment_cost);
  const factoryCost = toAmount(row.allocated_factory_cost);
  const officeCost = toAmount(row.allocated_office_cost);
  const totalCost = materialCost + supplierCost + shipmentCost + factoryCost + officeCost;
  const profit = sales - totalCost;

  return {
    projectRecordId: row.project_id,
    projectId: `PRJ-${String(row.project_id).padStart(3, "0")}`,
    name: row.project_name || "",
    buyerName: row.buyer_name || "",
    totalBudget: formatMoney(sales),
    totalBudgetValue: String(sales),
    materialCost: formatMoney(materialCost),
    materialCostValue: String(materialCost),
    supplierCost: formatMoney(supplierCost),
    supplierCostValue: String(supplierCost),
    shipmentCost: formatMoney(shipmentCost),
    shipmentCostValue: String(shipmentCost),
    factoryCost: formatMoney(factoryCost),
    factoryCostValue: String(factoryCost),
    officeCost: formatMoney(officeCost),
    officeCostValue: String(officeCost),
    totalCost: formatMoney(totalCost),
    totalCostValue: String(totalCost),
    profits: formatMoney(profit),
    profitsValue: String(profit),
  };
}

const supplierAssignmentUnitPriceBySupplierProjectSelect = `SELECT pgs.id AS supplier_id,
       sa.project_id,
       CASE
         WHEN SUM(sa.quantity) = 0 THEN 0
         ELSE SUM(sa.quantity * sa.unit_price) / SUM(sa.quantity)
       END AS unit_price
     FROM supplier_assignment sa
     INNER JOIN project_goods_supplier pgs ON pgs.name = sa.supplier
     GROUP BY pgs.id, sa.project_id`;

const supplierSuppliedCostByProjectSelect = `SELECT spt.project_id,
       SUM(spt.quantity * COALESCE(sa_price.unit_price, 0)) AS supplier_cost
     FROM supplier_products_tracking spt
     LEFT JOIN (
       ${supplierAssignmentUnitPriceBySupplierProjectSelect}
     ) sa_price ON sa_price.supplier_id = spt.supplier_id
               AND sa_price.project_id = spt.project_id
     GROUP BY spt.project_id`;

const totalSupplierSuppliedCostSelect = `SELECT COALESCE(SUM(spt.quantity * COALESCE(sa_price.unit_price, 0)), 0)
     FROM supplier_products_tracking spt
     LEFT JOIN (
       ${supplierAssignmentUnitPriceBySupplierProjectSelect}
     ) sa_price ON sa_price.supplier_id = spt.supplier_id
               AND sa_price.project_id = spt.project_id`;

async function getProjectWiseFinancials({ totalFactoryCost, totalOfficeCost, totalSales }) {
  const safeTotalFactoryCost = toAmount(totalFactoryCost);
  const safeTotalOfficeCost = toAmount(totalOfficeCost);
  const safeTotalSales = toAmount(totalSales);

  const [rows] = await pool.query(
    `SELECT p.id AS project_id,
            COALESCE(p.product, p.name) AS project_name,
            p.buyer AS buyer_name,
            COALESCE(inv.sales_amount, 0) AS sales_amount,
            COALESCE(rma.material_cost, 0) AS material_cost,
            COALESCE(sa.supplier_cost, 0) AS supplier_cost,
            COALESCE(sc.shipment_cost, 0) AS shipment_cost
     FROM projects p
     LEFT JOIN (
       SELECT project_id, SUM(total_amount) AS sales_amount
       FROM invoices
       GROUP BY project_id
     ) inv ON inv.project_id = p.id
     LEFT JOIN (
       SELECT rma.project_id, SUM(rma.quantity * COALESCE(rms.unit_cost, 0)) AS material_cost
       FROM raw_material_allocation rma
       LEFT JOIN raw_material_stock rms ON rms.id = rma.raw_material_id
       GROUP BY rma.project_id
     ) rma ON rma.project_id = p.id
     LEFT JOIN (
       ${supplierSuppliedCostByProjectSelect}
     ) sa ON sa.project_id = p.id
     LEFT JOIN (
       SELECT project_id, SUM(amount) AS shipment_cost
       FROM shipment_costs
       GROUP BY project_id
     ) sc ON sc.project_id = p.id
     WHERE COALESCE(inv.sales_amount, 0) > 0
        OR COALESCE(rma.material_cost, 0) > 0
        OR COALESCE(sa.supplier_cost, 0) > 0
        OR COALESCE(sc.shipment_cost, 0) > 0
     ORDER BY p.id DESC`,
  );

  return rows.map((row) => {
    const salesAmount = toAmount(row.sales_amount);
    const salesRatio = safeTotalSales > 0 ? salesAmount / safeTotalSales : 0;

    return mapProjectWiseRow({
      ...row,
      allocated_factory_cost: safeTotalFactoryCost * salesRatio,
      allocated_office_cost: safeTotalOfficeCost * salesRatio,
    });
  });
}

async function getDashboardOverview() {
  const [[overview]] = await pool.query(
    `SELECT
       COALESCE((SELECT COUNT(*) FROM projects), 0) AS total_projects,
       COALESCE((SELECT SUM(total_amount) FROM invoices), 0) AS total_revenue,
       COALESCE((SELECT COUNT(*) FROM sales_order WHERE status = 'pending'), 0) AS pending_orders,
       COALESCE((SELECT COUNT(*) FROM raw_material_stock WHERE current_stock < minimum_stock), 0) AS low_stock_items,
       COALESCE((SELECT COUNT(*) FROM raw_material_supplier), 0) AS raw_material_suppliers,
       COALESCE((SELECT COUNT(*) FROM project_goods_supplier), 0) AS project_goods_suppliers,
       COALESCE((SELECT SUM(current_stock * unit_cost) FROM raw_material_stock), 0) AS inventory_value`,
  );

  const [recentProjectRows] = await pool.query(
    `SELECT p.id,
            COALESCE(p.product, p.name) AS project_name,
            p.buyer,
            p.status,
            COALESCE(p.quantity, so.total_order_quantity, 0) AS total_order_quantity,
            COALESCE(spt.total_supplier_produced, 0) AS total_supplier_produced,
            COALESCE(fpt.total_factory_produced, 0) AS total_factory_produced
     FROM projects p
     LEFT JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity) AS total_order_quantity
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = COALESCE(p.product, p.name)
         AND so.buyer = p.buyer
         AND so.delivery_date = p.delivery_date
     LEFT JOIN (
       SELECT project_id, SUM(quantity) AS total_supplier_produced
       FROM supplier_products_tracking
       GROUP BY project_id
     ) spt ON spt.project_id = p.id
     LEFT JOIN (
       SELECT project_id, SUM(quanttity_produced) AS total_factory_produced
       FROM factory_product_tracking
       GROUP BY project_id
     ) fpt ON fpt.project_id = p.id
     ORDER BY p.id DESC
     LIMIT 5`,
  );

  const [distributionProjectRows] = await pool.query(
    `SELECT p.id,
            p.status,
            COALESCE(p.quantity, so.total_order_quantity, 0) AS total_order_quantity,
            COALESCE(spt.total_supplier_produced, 0) AS total_supplier_produced,
            COALESCE(fpt.total_factory_produced, 0) AS total_factory_produced
     FROM projects p
     LEFT JOIN (
       SELECT product, buyer, delivery_date, SUM(quantity) AS total_order_quantity
       FROM sales_order
       GROUP BY product, buyer, delivery_date
     ) so ON so.product = COALESCE(p.product, p.name)
         AND so.buyer = p.buyer
         AND so.delivery_date = p.delivery_date
     LEFT JOIN (
       SELECT project_id, SUM(quantity) AS total_supplier_produced
       FROM supplier_products_tracking
       GROUP BY project_id
     ) spt ON spt.project_id = p.id
     LEFT JOIN (
       SELECT project_id, SUM(quanttity_produced) AS total_factory_produced
       FROM factory_product_tracking
       GROUP BY project_id
     ) fpt ON fpt.project_id = p.id`,
  );

  const [alertRows] = await pool.query(
    `SELECT material, current_stock, minimum_stock
     FROM raw_material_stock
     WHERE current_stock < minimum_stock
     ORDER BY (minimum_stock - current_stock) DESC, id ASC
     LIMIT 5`,
  );

  const monthDates = Array.from({ length: 6 }, (_, index) => {
    const date = new Date();
    date.setDate(1);
    date.setMonth(date.getMonth() - (5 - index));
    return date;
  });

  const trendStartDate = new Date(monthDates[0]);
  const trendEndDate = new Date(monthDates[5]);
  trendEndDate.setMonth(trendEndDate.getMonth() + 1);

  const [salesTrendRows] = await pool.query(
    `SELECT YEAR(invoice_date) AS year_value,
            MONTH(invoice_date) AS month_value,
            SUM(total_amount) AS total_amount
     FROM invoices
     WHERE invoice_date >= ?
       AND invoice_date < ?
     GROUP BY YEAR(invoice_date), MONTH(invoice_date)
     ORDER BY YEAR(invoice_date) ASC, MONTH(invoice_date) ASC`,
    [formatDateValue(trendStartDate), formatDateValue(trendEndDate)],
  );

  const salesTrendMap = new Map(
    salesTrendRows.map((row) => [`${row.year_value}-${String(row.month_value).padStart(2, "0")}`, toAmount(row.total_amount)]),
  );

  const recentProjects = recentProjectRows.map((row) => {
    const totalOrderQuantity = toAmount(row.total_order_quantity);
    const totalProduced = toAmount(row.total_supplier_produced) + toAmount(row.total_factory_produced);
    const progress = totalOrderQuantity > 0 ? Math.min(Math.round((totalProduced / totalOrderQuantity) * 100), 100) : 0;
    const status = getResolvedProjectStatus(row);

    return {
      id: `PRJ-${String(row.id).padStart(3, "0")}`,
      name: row.project_name || "",
      buyer: row.buyer || "",
      status,
      statusTone: getProjectStatusTone(status),
      progress,
    };
  });

  const alerts = alertRows.map((row) => ({
    title: `${row.material} inventory below minimum threshold (${toAmount(row.current_stock)}/${toAmount(row.minimum_stock)})`,
    time: "Needs restock",
  }));

  const statusCounts = distributionProjectRows.reduce(
    (summary, row) => {
      const status = getResolvedProjectStatus(row);

      if (status === "Completed") {
        summary.completed += 1;
      } else if (status === "In Progress") {
        summary.inProgress += 1;
      } else if (status === "Pending") {
        summary.pending += 1;
      } else if (status === "Confirmed") {
        summary.confirmed += 1;
      }

      return summary;
    },
    { completed: 0, inProgress: 0, pending: 0, confirmed: 0 },
  );
  const distributionTotal = distributionProjectRows.length || 1;
  const productionDistribution = [
    {
      key: "completed",
      label: "Completed",
      count: statusCounts.completed,
      percentage: Math.round((statusCounts.completed / distributionTotal) * 100),
      color: "var(--app-primary)",
    },
    {
      key: "confirmed",
      label: "Confirmed",
      count: statusCounts.confirmed,
      percentage: Math.round((statusCounts.confirmed / distributionTotal) * 100),
      color: "#64748b",
    },
    {
      key: "pending",
      label: "Pending",
      count: statusCounts.pending,
      percentage: Math.round((statusCounts.pending / distributionTotal) * 100),
      color: "#d97706",
    },
    {
      key: "inProgress",
      label: "In Progress",
      count: statusCounts.inProgress,
      percentage: Math.round((statusCounts.inProgress / distributionTotal) * 100),
      color: "#fb923c",
    },
  ];
  const productionDistributionGradient = productionDistribution.reduce((segments, item, index) => {
    const previousEnd = index === 0 ? 0 : segments[index - 1].end;
    const end = index === productionDistribution.length - 1 ? 100 : previousEnd + item.percentage;

    segments.push({
      ...item,
      start: previousEnd,
      end,
    });

    return segments;
  }, []);

  const salesTrend = monthDates.map((date) => {
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    return {
      month: getMonthShortLabel(date),
      amount: salesTrendMap.get(key) || 0,
    };
  });

  return {
    summaryCards: [
      { icon: "pulse", value: String(toAmount(overview.total_projects)), label: "Total Projects", tone: "primary" },
      { icon: "dollar", value: formatMoney(overview.total_revenue), label: "Total Revenue", tone: "success" },
      { icon: "clock", value: String(toAmount(overview.pending_orders)), label: "Pending Orders", tone: "warning" },
      { icon: "alert", value: String(toAmount(overview.low_stock_items)), label: "Low Stock Items", tone: "danger" },
      { icon: "trend", value: String(toAmount(overview.raw_material_suppliers)), label: "Raw Material Suppliers", tone: "primary" },
      { icon: "trend", value: String(toAmount(overview.project_goods_suppliers)), label: "Project Goods Suppliers", tone: "info" },
      { icon: "cube", value: formatMoney(overview.inventory_value), label: "Inventory Value", tone: "info" },
    ],
    recentProjects,
    alerts,
    productionDistribution: productionDistributionGradient,
    salesTrend,
  };
}

async function getAccountsDashboard() {
  const [[totals]] = await pool.query(
    `SELECT
       COALESCE((
         SELECT SUM(debit - credit)
         FROM due_ledger
         WHERE description LIKE 'Buyer due /%'
       ), 0) AS receivables,
       COALESCE((
         SELECT SUM(credit - debit)
         FROM due_ledger
         WHERE description LIKE 'Raw material supplier due /%'
            OR description LIKE 'Project goods supplier due /%'
       ), 0) AS payables,
       COALESCE((SELECT SUM(debit - credit) FROM cash_ledger), 0)
       + COALESCE((SELECT SUM(debit - credit) FROM bank_ledger), 0) AS cash_bank_balance,
       COALESCE((SELECT SUM(total_amount) FROM invoices), 0) AS total_sales,
       COALESCE((SELECT SUM(quantity * unit_cost) FROM raw_material_purchase), 0) AS raw_material_cost,
       COALESCE((SELECT SUM(amount) FROM factory_costs), 0) AS factory_cost,
       COALESCE((SELECT SUM(amount) FROM office_bills), 0) AS office_cost,
       COALESCE((SELECT SUM(amount) FROM shipment_costs), 0) AS shipment_cost,
       COALESCE((${totalSupplierSuppliedCostSelect}), 0) AS goods_supplier_cost`,
  );

  const [debitRows] = await pool.query(
    `SELECT ledger_date, reference, description, credit, 'cash' AS ledger
     FROM cash_ledger
     WHERE credit > 0
     UNION ALL
     SELECT ledger_date, reference, description, credit, 'bank' AS ledger
     FROM bank_ledger
     WHERE credit > 0
     UNION ALL
     SELECT ledger_date, reference, description, credit, 'due' AS ledger
     FROM due_ledger
     WHERE credit > 0
     ORDER BY ledger_date DESC, reference DESC
     LIMIT 50`,
  );

  const [creditRows] = await pool.query(
    `SELECT ledger_date, reference, description, debit, 'cash' AS ledger
     FROM cash_ledger
     WHERE debit > 0
     UNION ALL
     SELECT ledger_date, reference, description, debit, 'bank' AS ledger
     FROM bank_ledger
     WHERE debit > 0
     UNION ALL
     SELECT ledger_date, reference, description, debit, 'due' AS ledger
     FROM due_ledger
     WHERE debit > 0
     ORDER BY ledger_date DESC, reference DESC
     LIMIT 50`,
  );

  const totalExpenses =
    Number(totals.raw_material_cost || 0) +
    Number(totals.factory_cost || 0) +
    Number(totals.office_cost || 0) +
    Number(totals.shipment_cost || 0) +
    Number(totals.goods_supplier_cost || 0);

  const netProfitLoss = Number(totals.total_sales || 0) - totalExpenses;
  const overview = await getDashboardOverview();
  const projectWiseRows = await getProjectWiseFinancials({
    totalFactoryCost: totals.factory_cost,
    totalOfficeCost: totals.office_cost,
    totalSales: totals.total_sales,
  });
  const projectCostSummary = projectWiseRows.reduce(
    (summary, row) => ({
      materialCost: summary.materialCost + toAmount(row.materialCostValue),
      supplierCost: summary.supplierCost + toAmount(row.supplierCostValue),
      shipmentCost: summary.shipmentCost + toAmount(row.shipmentCostValue),
      totalCost: summary.totalCost + toAmount(row.totalCostValue),
      totalBudget: summary.totalBudget + toAmount(row.totalBudgetValue),
      totalProfit: summary.totalProfit + toAmount(row.profitsValue),
    }),
    {
      materialCost: 0,
      supplierCost: 0,
      shipmentCost: 0,
      totalCost: 0,
      totalBudget: 0,
      totalProfit: 0,
    },
  );

  return {
    summary: {
      receivables: Number(totals.receivables || 0),
      payables: Number(totals.payables || 0),
      cashBankBalance: Number(totals.cash_bank_balance || 0),
      netProfitLoss,
      receivablesFormatted: formatMoney(totals.receivables || 0),
      payablesFormatted: formatMoney(totals.payables || 0),
      cashBankBalanceFormatted: formatMoney(totals.cash_bank_balance || 0),
      netProfitLossFormatted: `${netProfitLoss >= 0 ? "+" : "-"}${formatMoney(Math.abs(netProfitLoss))}`,
    },
    projectWise: {
      summary: {
        materialCost: projectCostSummary.materialCost,
        supplierCost: projectCostSummary.supplierCost,
        shipmentCost: projectCostSummary.shipmentCost,
        totalCost: projectCostSummary.totalCost,
        totalBudget: projectCostSummary.totalBudget,
        totalProfit: projectCostSummary.totalProfit,
        materialCostFormatted: formatMoney(projectCostSummary.materialCost),
        supplierCostFormatted: formatMoney(projectCostSummary.supplierCost),
        shipmentCostFormatted: formatMoney(projectCostSummary.shipmentCost),
        totalCostFormatted: formatMoney(projectCostSummary.totalCost),
        totalBudgetFormatted: formatMoney(projectCostSummary.totalBudget),
        totalProfitFormatted: `${projectCostSummary.totalProfit >= 0 ? "" : "-"}${formatMoney(Math.abs(projectCostSummary.totalProfit))}`,
      },
      rows: projectWiseRows,
      allocationMethod: "Factory and office costs are allocated by each project's share of total invoiced sales.",
    },
    overview,
    debitRows: debitRows.map((row) => mapLedgerRow(row, true)),
    creditRows: creditRows.map((row) => mapLedgerRow(row, false)),
  };
}

module.exports = {
  getCompanyInfo,
  getAccountsDashboard,
  saveCompanyInfo,
};
