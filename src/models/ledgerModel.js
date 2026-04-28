function normalizeLedgerDate(value) {
  if (!value) {
    return null;
  }

  const dateText = String(value);
  const dateOnlyMatch = dateText.match(/^(\d{4})-(\d{2})-(\d{2})/);

  if (dateOnlyMatch) {
    return dateOnlyMatch[0];
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function normalizeAmount(value) {
  return Number(Number(value || 0).toFixed(2));
}

async function insertCashLedgerEntry(connection, entry) {
  await connection.query(
    `INSERT INTO cash_ledger (ledger_date, reference, description, debit, credit)
     VALUES (?, ?, ?, ?, ?)`,
    [
      normalizeLedgerDate(entry.ledgerDate),
      entry.reference || null,
      entry.description,
      normalizeAmount(entry.debit),
      normalizeAmount(entry.credit),
    ],
  );
}

async function insertBankLedgerEntry(connection, entry) {
  await connection.query(
    `INSERT INTO bank_ledger (ledger_date, reference, description, debit, credit)
     VALUES (?, ?, ?, ?, ?)`,
    [
      normalizeLedgerDate(entry.ledgerDate),
      entry.reference || null,
      entry.description,
      normalizeAmount(entry.debit),
      normalizeAmount(entry.credit),
    ],
  );
}

async function insertDueLedgerEntry(connection, entry) {
  await connection.query(
    `INSERT INTO due_ledger (ledger_date, reference, description, debit, credit)
     VALUES (?, ?, ?, ?, ?)`,
    [
      normalizeLedgerDate(entry.ledgerDate),
      entry.reference || null,
      entry.description,
      normalizeAmount(entry.debit),
      normalizeAmount(entry.credit),
    ],
  );
}

module.exports = {
  insertBankLedgerEntry,
  insertCashLedgerEntry,
  insertDueLedgerEntry,
  normalizeLedgerDate,
};
