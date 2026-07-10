// PICKLEBALL CHIRO -- Google Sheets Webhook v29
// Consolidated: all data lives in ONE spreadsheet ("PickleballChiro HQ 2026").
// The HQ spreadsheet id is stored in Script Properties (HQ_ID) by setup_hq.
// Old per-topic spreadsheets are kept only as read-only archives.

var OLD_SHEET_IDS = {
  mileage:  "17e-O3auikpGd41qX8TXwzYmyJrmSD1u869Hf1Ch_asI",
  finance:  "1vOLOVPz4K4jQwx3R4DBEoZyDXvE3KGYa6c8xZuYXyGw",
  business: "1p-GyHNvvlo5Bbwpr3iIfdm32UUTc77faOxVxRczX4mU"
};
var MILEAGE_RATE = 0.725;

// Tab lookup keywords (matched against ascii-stripped lowercase tab names)
var TABS = {
  income:   "income",
  expenses: "expenses",
  summary:  "summary",
  mileage:  "mileage",
  leads:    "leads",
  clients:  "clients",
  sessions: "sessions",
  dashboard: "dashboard"
};

function props_() { return PropertiesService.getScriptProperties(); }

function hq_() {
  var id = props_().getProperty("HQ_ID");
  if (!id) throw new Error("HQ spreadsheet not set up yet -- run the setup_hq action first.");
  return SpreadsheetApp.openById(id);
}

function findSheet(ss, keyword) {
  var sheets = ss.getSheets();
  var kw = keyword.toLowerCase();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    var ascii = name.replace(/[^\x00-\x7F]/g, "").trim().toLowerCase();
    if (ascii.indexOf(kw) !== -1) return sheets[i];
  }
  return null;
}

function tab_(key) {
  var sheet = findSheet(hq_(), TABS[key] || key);
  if (!sheet) throw new Error("Tab not found in HQ sheet: " + key);
  return sheet;
}

// startRow: 1-indexed row to begin scanning (skip title/header rows)
function firstEmptyRow(sheet, startRow) {
  startRow = startRow || 2;
  var col = sheet.getRange("A:A").getValues();
  for (var i = startRow - 1; i < col.length; i++) {
    if (String(col[i][0]).trim() === "") return i + 1;
  }
  return col.length + 1;
}

// Find the 1-indexed row whose column A contains the given text (case-insensitive)
function findRowByColA_(sheet, text) {
  var col = sheet.getRange("A:A").getValues();
  var t = text.toLowerCase();
  for (var i = 0; i < col.length; i++) {
    if (String(col[i][0]).toLowerCase().indexOf(t) !== -1) return i + 1;
  }
  return -1;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    var action = data.action;
    var result;
    switch (action) {
      case "log_mileage":            result = logMileage(data);          break;
      case "log_income":             result = logIncome(data);           break;
      case "log_expense":            result = logExpense(data);          break;
      case "add_lead":               result = addLead(data);             break;
      case "update_lead":            result = updateLead(data);          break;
      case "add_client":             result = addClient(data);           break;
      case "update_client":          result = updateClient(data);        break;
      case "find_rows":              result = findRows(data);            break;
      case "update_income":          result = updateIncome(data);        break;
      case "update_expense":         result = updateExpense(data);       break;
      case "update_mileage":         result = updateMileage(data);       break;
      case "fix_income_formulas":    result = fixIncomeFormulas();       break;
      case "delete_duplicate_rows":  result = deleteDuplicateRows(data); break;
      case "delete_rows":            result = deleteRows(data);          break;
      case "set_cell":               result = setCell(data);             break;
      case "read_cells":             result = readCells(data);           break;
      case "setup_hq":               result = setupHq();                 break;
      case "archive_old_sheets":     result = archiveOldSheets();        break;
      case "theme_tabs":             result = themeTabs();               break;
      case "sort_tabs":              result = sortTabsChrono();          break;
      case "fix_dropdowns":          result = fixDropdowns();            break;
      case "log_session":            result = logSession(data);          break;
      case "record_payment":         result = recordPayment(data);       break;
      case "backfill_sessions":      result = backfillSessions(data);    break;
      default: result = { status: "error", message: "Unknown action: " + action };
    }
    return json_(result);
  } catch (err) {
    return json_({ status: "error", message: err.toString() });
  }
}

function doGet(e) {
  try {
    var p = (e && e.parameter) || {};
    if (p.action === "get_dashboard_data") {
      var key = props_().getProperty("DASHBOARD_KEY");
      if (!key || p.key !== key) return json_({ status: "error", message: "unauthorized" });
      return json_(getDashboardData());
    }
    return json_({ status: "ok", version: 18, hq: props_().getProperty("HQ_ID") ? "ready" : "not set up" });
  } catch (err) {
    return json_({ status: "error", message: err.toString() });
  }
}

function today() {
  return Utilities.formatDate(new Date(), "America/New_York", "MM/dd/yyyy");
}

function fmtDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, "America/New_York", "yyyy-MM-dd");
  return String(v || "");
}

// ---------------------------------------------------------------- LOG ACTIONS

function logMileage(data) {
  var sheet = tab_("mileage");
  var oneWay = Number(data.miles_one_way);
  var rt = oneWay * 2;
  var deduction = parseFloat((rt * MILEAGE_RATE).toFixed(2));
  var totalRow = findRowByColA_(sheet, "year totals");
  var row = firstEmptyRow(sheet, 4);
  if (totalRow !== -1 && row >= totalRow) {
    sheet.insertRowBefore(totalRow);
    row = totalRow;
  }
  sheet.getRange(row, 1, 1, 8).setValues([[
    data.date || today(),
    data.client_name,
    data.type || "Pickleball Lesson",
    data.from || "Home",
    data.to || "Client Address",
    oneWay, rt, deduction
  ]]);
  return { status: "ok", message: "Mileage logged -- " + oneWay + " mi OW, $" + deduction + " deduction" };
}

function logIncome(data) {
  var sheet = tab_("income");
  var totalRow = findRowByColA_(sheet, "total income");
  var row = firstEmptyRow(sheet, 4);
  if (totalRow !== -1 && row >= totalRow) {
    sheet.insertRowBefore(totalRow);
    row = totalRow;
  }
  sheet.getRange(row, 1, 1, 6).setValues([[
    data.date || today(),
    data.client_source,
    data.income_type,
    data.notes || "",
    data.payment_method,
    Number(data.amount)
  ]]);
  // Self-healing running total: sums the amount column from the top, so no
  // dependency on the row above -- edits/deletes can never corrupt neighbours.
  sheet.getRange(row, 7).setFormula('=IF($F' + row + '="","",SUM($F$4:$F' + row + '))');
  // Copy data validation (dropdowns) from row above
  var cVal = sheet.getRange(row - 1, 3).getDataValidation();
  var eVal = sheet.getRange(row - 1, 5).getDataValidation();
  if (cVal) sheet.getRange(row, 3).setDataValidation(cVal);
  if (eVal) sheet.getRange(row, 5).setDataValidation(eVal);
  sheet.getRange(row, 6).setNumberFormat('"$"#,##0.00');
  return { status: "ok", message: "Income logged -- $" + data.amount + " from " + data.client_source };
}

function logExpense(data) {
  var sheet = tab_("expenses");
  var totalRow = findRowByColA_(sheet, "total expenses");
  var row = firstEmptyRow(sheet, 4);
  if (totalRow !== -1 && row >= totalRow) {
    sheet.insertRowBefore(totalRow);
    row = totalRow;
  }
  sheet.getRange(row, 1, 1, 7).setValues([[
    data.date || today(),
    data.vendor,
    data.category,
    data.description || "",
    data.payment_method,
    Number(data.amount),
    "Yes"
  ]]);
  var cVal = sheet.getRange(row - 1, 3).getDataValidation();
  var eVal = sheet.getRange(row - 1, 5).getDataValidation();
  if (cVal) sheet.getRange(row, 3).setDataValidation(cVal);
  if (eVal) sheet.getRange(row, 5).setDataValidation(eVal);
  sheet.getRange(row, 6).setNumberFormat('"$"#,##0.00');
  return { status: "ok", message: "Expense logged -- $" + data.amount + " at " + data.vendor };
}

function addLead(data) {
  var sheet = tab_("leads");
  var row = firstEmptyRow(sheet, 3);
  sheet.getRange(row, 1, 1, 9).setValues([[
    data.date || today(),
    data.name,
    data.phone || "",
    data.email || "",
    data.lead_source || "",
    data.service_interest || "",
    "New",
    data.follow_up || "",
    data.notes || ""
  ]]);
  return { status: "ok", message: "Lead added -- " + data.name };
}

function updateLead(data) {
  var sheet = tab_("leads");
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][1]).toLowerCase() === String(data.name).toLowerCase()) {
      var row = i + 1;
      if (data.status)    sheet.getRange(row, 7).setValue(data.status);
      if (data.follow_up) sheet.getRange(row, 8).setValue(data.follow_up);
      if (data.notes)     sheet.getRange(row, 9).setValue(data.notes);
      return { status: "ok", message: "Lead updated -- " + data.name };
    }
  }
  return { status: "error", message: "Lead not found: " + data.name };
}

// Restore the two formula columns (N = pkg sessions left, U = auto stage) for a client row
function setClientFormulas_(sheet, row) {
  sheet.getRange(row, 14).setFormula('=IF(L' + row + '="","",L' + row + '-M' + row + ')');
  sheet.getRange(row, 21).setFormula(
    '=IF(A' + row + '="","",IF(G' + row + '="Inactive","Inactive",IF(O' + row + '="Active","Package Client",' +
    'IF(J' + row + '=0,"New",IF(H' + row + '>=TODAY()-30,"Active",IF(H' + row + '>=TODAY()-60,"Check In","At Risk"))))))'
  );
}

function addClient(data) {
  var sheet = tab_("clients");
  var row = firstEmptyRow(sheet, 3);
  sheet.getRange(row, 1, 1, 22).setValues([[
    data.name,
    data.phone || "",
    data.email || "",
    data.dupr || "",
    data.lead_source || "",
    data.date || today(),
    data.status || "Active",
    data.last_session || data.date || today(),
    data.sessions_mo || 1,
    data.sessions_total || 1,
    data.package || "",
    data.sessions_included || "",
    data.sessions_used || "",
    "",  // col N: formula, set below
    data.pkg_status || "",
    data.pkg_value || "",
    data.total_paid || 0,
    data.outstanding || 0,
    data.payment_method || "",
    data.last_paid || data.date || today(),
    "",  // col U: formula, set below
    data.notes || ""
  ]]);
  // If sessions_left was passed explicitly, honour it as a value; otherwise use the formula
  if (data.sessions_left !== undefined && data.sessions_left !== "") {
    sheet.getRange(row, 14).setValue(data.sessions_left);
    sheet.getRange(row, 21).setFormula(
      '=IF(A' + row + '="","",IF(G' + row + '="Inactive","Inactive",IF(O' + row + '="Active","Package Client",' +
      'IF(J' + row + '=0,"New",IF(H' + row + '>=TODAY()-30,"Active",IF(H' + row + '>=TODAY()-60,"Check In","At Risk"))))))'
    );
  } else {
    setClientFormulas_(sheet, row);
  }
  return { status: "ok", message: "Client added -- " + data.name };
}

function updateClient(data) {
  var sheet = tab_("clients");
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase() === String(data.name).toLowerCase()) {
      var row = i + 1;
      if (data.last_session)                 sheet.getRange(row, 8).setValue(data.last_session);
      if (data.sessions_mo)                  sheet.getRange(row, 9).setValue(data.sessions_mo);
      if (data.sessions_total !== undefined)  sheet.getRange(row, 10).setValue(data.sessions_total);
      if (data.sessions_used !== undefined)   sheet.getRange(row, 13).setValue(data.sessions_used);
      if (data.sessions_left !== undefined)   sheet.getRange(row, 14).setValue(data.sessions_left);
      if (data.total_paid !== undefined)      sheet.getRange(row, 17).setValue(data.total_paid);
      if (data.outstanding !== undefined)     sheet.getRange(row, 18).setValue(data.outstanding);
      if (data.payment_method)               sheet.getRange(row, 19).setValue(data.payment_method);
      if (data.last_paid)                    sheet.getRange(row, 20).setValue(data.last_paid);
      if (data.notes)                        sheet.getRange(row, 22).setValue(data.notes);
      return { status: "ok", message: "Client updated -- " + data.name };
    }
  }
  return { status: "error", message: "Client not found: " + data.name };
}

// ---------------------------------------------------------- SAFE EDIT ACTIONS

var ROW_FIELDS = {
  income:   { date: 1, client_source: 2, income_type: 3, notes: 4, payment_method: 5, amount: 6 },
  expenses: { date: 1, vendor: 2, category: 3, description: 4, payment_method: 5, amount: 6, tax_deductible: 7 },
  mileage:  { date: 1, client_name: 2, type: 3, from: 4, to: 5, miles_one_way: 6, note: 9 }
};

// First data row per tab, and the col-A text that marks the totals/footer row
var DATA_REGION = {
  income:   { start: 4, endMarker: "total income" },
  expenses: { start: 4, endMarker: "total expenses" },
  mileage:  { start: 4, endMarker: "year totals" }
};

function dataEndRow_(sheet, tabKey) {
  var marker = DATA_REGION[tabKey].endMarker;
  var totalRow = findRowByColA_(sheet, marker);
  return totalRow === -1 ? sheet.getLastRow() + 1 : totalRow;
}

// Find rows in any tab by matching field values (case-insensitive substring).
// { tab: "income", match: { client_source: "Laura", amount: 80 } }
function findRows(data) {
  var tabKey = data.tab;
  var sheet = tab_(tabKey);
  var fields = ROW_FIELDS[tabKey];
  var values = sheet.getDataRange().getValues();
  var start = (DATA_REGION[tabKey] && DATA_REGION[tabKey].start) || 3;
  var end = DATA_REGION[tabKey] ? dataEndRow_(sheet, tabKey) : values.length + 1;
  var matches = [];
  for (var r = start; r < end && r <= values.length; r++) {
    var rowVals = values[r - 1];
    if (String(rowVals[0]).trim() === "" && String(rowVals[1]).trim() === "") continue;
    var ok = true;
    for (var f in (data.match || {})) {
      var col = fields ? fields[f] : null;
      if (!col) { ok = false; break; }
      var cell = rowVals[col - 1];
      var cellStr = (cell instanceof Date) ? fmtDate_(cell) : String(cell);
      if (cellStr.toLowerCase().indexOf(String(data.match[f]).toLowerCase()) === -1) { ok = false; break; }
    }
    if (ok) {
      matches.push({ row: r, values: rowVals.map(function (v) { return (v instanceof Date) ? fmtDate_(v) : v; }) });
      if (matches.length >= 20) break;
    }
  }
  return { status: "ok", tab: tabKey, matches: matches, count: matches.length };
}

// Shared: update only the named fields of one row, never touching formula columns
function updateRowFields_(tabKey, data) {
  var sheet = tab_(tabKey);
  var row = Number(data.row);
  var start = DATA_REGION[tabKey].start;
  var end = dataEndRow_(sheet, tabKey);
  if (!row || row < start || row >= end) {
    throw new Error("Row " + row + " is outside the data region (" + start + "-" + (end - 1) + ") of " + tabKey);
  }
  var fields = ROW_FIELDS[tabKey];
  var updated = [];
  for (var f in (data.fields || {})) {
    var col = fields[f];
    if (!col) throw new Error("Unknown field for " + tabKey + ": " + f);
    var v = data.fields[f];
    if (f === "amount" || f === "miles_one_way") v = Number(v);
    sheet.getRange(row, col).setValue(v);
    updated.push(f);
  }
  if (updated.length === 0) throw new Error("No fields given -- pass fields: { name: value, ... }");
  return { sheet: sheet, row: row, updated: updated };
}

function updateIncome(data) {
  var res = updateRowFields_("income", data);
  return { status: "ok", message: "Income row " + res.row + " updated (" + res.updated.join(", ") + "). Running totals recalc automatically." };
}

function updateExpense(data) {
  var res = updateRowFields_("expenses", data);
  return { status: "ok", message: "Expense row " + res.row + " updated (" + res.updated.join(", ") + ")." };
}

function updateMileage(data) {
  var res = updateRowFields_("mileage", data);
  // Recompute round trip + deduction whenever miles change
  if (res.updated.indexOf("miles_one_way") !== -1) {
    var oneWay = Number(res.sheet.getRange(res.row, 6).getValue());
    var rt = oneWay * 2;
    var deduction = parseFloat((rt * MILEAGE_RATE).toFixed(2));
    res.sheet.getRange(res.row, 7).setValue(rt);
    res.sheet.getRange(res.row, 8).setValue(deduction);
  }
  return { status: "ok", message: "Mileage row " + res.row + " updated (" + res.updated.join(", ") + ")." };
}

// Rebuild income running totals as self-healing formulas + fix the total row. Idempotent.
function fixIncomeFormulas() {
  var sheet = tab_("income");
  return fixIncomeFormulasOn_(sheet);
}

function fixIncomeFormulasOn_(sheet) {
  var totalRow = findRowByColA_(sheet, "total income");
  var end = totalRow === -1 ? sheet.getLastRow() : totalRow - 1;
  var fixed = 0;
  for (var r = 4; r <= end; r++) {
    var fVal = sheet.getRange(r, 6).getValue();
    if (fVal !== "" && fVal !== null) {
      sheet.getRange(r, 7).setFormula('=IF($F' + r + '="","",SUM($F$4:$F' + r + '))');
      sheet.getRange(r, 6).setNumberFormat('"$"#,##0.00');
      fixed++;
    } else {
      // clear stale prefilled running-total formulas in empty rows
      sheet.getRange(r, 7).setValue("");
    }
  }
  if (totalRow !== -1) {
    sheet.getRange(totalRow, 6).setFormula('=SUM($F$4:$F' + (totalRow - 1) + ')');
    sheet.getRange(totalRow, 7).setValue(""); // kill the double-count cell
    // clear the meaningless cumulative G cells in the breakdown section below
    var lastRow = sheet.getLastRow();
    for (var b = totalRow + 1; b <= lastRow; b++) {
      var g = sheet.getRange(b, 7);
      if (g.getFormula()) g.setValue("");
    }
  }
  return { status: "ok", message: "Rebuilt " + fixed + " running-total formula(s); total row fixed." };
}

// Delete duplicate rows by name in Clients or Leads tab, keeping only the first occurrence
function deleteDuplicateRows(data) {
  var sheet = tab_((data.tab || "clients").toLowerCase());
  var name = data.name;
  var values = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  var firstSeen = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase().trim() === String(name).toLowerCase().trim() ||
        String(values[i][1]).toLowerCase().trim() === String(name).toLowerCase().trim()) {
      if (!firstSeen) { firstSeen = true; }
      else { rowsToDelete.push(i + 1); }
    }
  }
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
  return { status: "ok", message: "Deleted " + rowsToDelete.length + " duplicate row(s) for " + name };
}

// Delete a range of rows by row number (1-indexed).
// New payloads: { tab: "income" | "expenses" | "mileage" | "leads" | "clients", start_row, end_row }
// Old payloads ({ sheet: "mileage" | "finance" | "business" }) still work.
function deleteRows(data) {
  var tabKey = data.tab;
  if (!tabKey && data.sheet) {
    tabKey = { mileage: "mileage", finance: "income", business: "clients" }[data.sheet] || data.sheet;
  }
  var sheet = tab_(String(tabKey).toLowerCase());
  var startRow = Number(data.start_row);
  var endRow = Number(data.end_row || data.start_row);
  var numRows = endRow - startRow + 1;
  sheet.deleteRows(startRow, numRows);
  // Re-heal income formulas after any deletion there (cheap + idempotent)
  var ascii = sheet.getName().replace(/[^\x00-\x7F]/g, "").trim().toLowerCase();
  if (ascii.indexOf("income") !== -1) fixIncomeFormulasOn_(sheet);
  return { status: "ok", message: "Deleted rows " + startRow + " to " + endRow + " from " + sheet.getName() };
}

// Set a single cell value or formula in any HQ tab. { tab, cell, value | formula, format? }
function setCell(data) {
  var sheet = tab_(String(data.tab || data.sheet).toLowerCase());
  var cell = sheet.getRange(data.cell);
  if (data.formula !== undefined) {
    cell.setFormula(data.formula);
  } else {
    cell.setValue(data.value);
  }
  if (data.format) cell.setNumberFormat(data.format);
  return { status: "ok", message: "Set " + data.cell + " in " + sheet.getName() };
}

// Read one or more cells and return their values/formulas. { tab, cells: ["G52", ...] }
function readCells(data) {
  var sheet = tab_(String(data.tab || data.sheet).toLowerCase());
  var results = {};
  var cells = data.cells || [];
  for (var i = 0; i < cells.length; i++) {
    var r = sheet.getRange(cells[i]);
    var v = r.getValue();
    results[cells[i]] = { value: (v instanceof Date) ? fmtDate_(v) : v, formula: r.getFormula() };
  }
  return { status: "ok", cells: results };
}

// ------------------------------------------------------------------ MIGRATION

// One-time: build "PickleballChiro HQ 2026" from the three old spreadsheets.
// Idempotent guard: refuses to run twice.
function setupHq() {
  var props = props_();
  if (props.getProperty("HQ_ID")) {
    return { status: "error", message: "HQ already set up: " + props.getProperty("HQ_ID") };
  }
  var hq = SpreadsheetApp.create("PickleballChiro HQ 2026");

  var finance = SpreadsheetApp.openById(OLD_SHEET_IDS.finance);
  var mileage = SpreadsheetApp.openById(OLD_SHEET_IDS.mileage);
  var business = SpreadsheetApp.openById(OLD_SHEET_IDS.business);

  // Copy order matters: data tabs first so cross-tab formulas resolve by name.
  var sources = [
    findSheet(finance, "income"),
    findSheet(finance, "expenses"),
    mileage.getSheets()[0],
    findSheet(business, "leads"),
    findSheet(business, "clients"),
    findSheet(finance, "summary"),
    findSheet(business, "dashboard")
  ];
  var counts = {};
  for (var i = 0; i < sources.length; i++) {
    var src = sources[i];
    if (!src) throw new Error("Source tab missing at index " + i);
    var copied = src.copyTo(hq);
    copied.setName(src.getName());
    counts[src.getName()] = src.getLastRow();
  }
  // Remove the default empty sheet
  var def = hq.getSheetByName("Sheet1");
  if (def) hq.deleteSheet(def);

  // --- Repairs on the new file ---
  var incomeTab = findSheet(hq, "income");
  fixIncomeFormulasOn_(incomeTab);

  // Normalize string dates in the Mileage tab (e.g. "4/20/26" -> real date)
  var mileageTab = findSheet(hq, "mileage");
  var mVals = mileageTab.getDataRange().getValues();
  for (var r = 3; r < mVals.length; r++) {
    var v = mVals[r][0];
    if (typeof v === "string" && /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v.trim())) {
      var parts = v.trim().split("/");
      var yr = Number(parts[2]); if (yr < 100) yr += 2000;
      mileageTab.getRange(r + 1, 1).setValue(new Date(yr, Number(parts[0]) - 1, Number(parts[1])))
        .setNumberFormat("mm/dd/yyyy");
    }
  }
  // Make sure the year-total row uses open SUM formulas for RT miles + deduction
  var yearRow = findRowByColA_(mileageTab, "year totals");
  if (yearRow !== -1) {
    mileageTab.getRange(yearRow, 7).setFormula("=SUM(G4:G" + (yearRow - 1) + ")");
    mileageTab.getRange(yearRow, 8).setFormula("=SUM(H4:H" + (yearRow - 1) + ")").setNumberFormat('"$"#,##0.00');
  }

  // --- Key Metrics (Dashboard tab): Finance becomes the source of truth ---
  var dash = findSheet(hq, "dashboard");
  var incomeName = "'" + incomeTab.getName() + "'";
  var mileageName = "'" + mileageTab.getName() + "'";
  var incomeTotal = "INDEX(" + incomeName + "!F:F,MATCH(\"2026 TOTAL INCOME\"," + incomeName + "!A:A,0))";
  dash.getRange("A6").setFormula("=" + incomeTotal);   // REVENUE COLLECTED
  dash.getRange("E21").setFormula("=" + incomeTotal);  // Total Collected
  dash.getRange("E23").setFormula("=" + incomeTotal + "+SUM(Clients!R3:R98)"); // Total Pipeline
  dash.getRange("E24").setFormula("=IFERROR(" + incomeTotal + "/COUNTIF(Clients!G3:G98,\"Active\"),\"-\")");
  dash.getRange("G21").setValue("Total 2026 income (Income tab is the source of truth)");
  // Sessions this month: counted from Mileage trips (includes package sessions)
  dash.getRange("G6").setFormula(
    "=COUNTIFS(" + mileageName + "!$A$4:$A$300,\">=\"&EOMONTH(TODAY(),-1)+1," +
    mileageName + "!$A$4:$A$300,\"<=\"&EOMONTH(TODAY(),0))"
  );

  // --- Fix the $70 drift: Charity paid 7/6 but was never added as a client ---
  var clientsTab = findSheet(hq, "clients");
  var already = false;
  var cVals = clientsTab.getDataRange().getValues();
  for (var c = 2; c < cVals.length; c++) {
    if (String(cVals[c][0]).toLowerCase().indexOf("charity") !== -1) { already = true; break; }
  }
  if (!already) {
    var newRow = firstEmptyRow(clientsTab, 3);
    clientsTab.getRange(newRow, 1, 1, 22).setValues([[
      "Charity", "", "", "", "Referral", "07/06/2026", "Active", "07/06/2026",
      1, 1, "", "", "", "", "", "", 70, 0, "Cash", "07/06/2026", "",
      "First group lesson at Pettis Park 7/6/26 with Vittoria (referral). $70 cash. Last name TBD."
    ]]);
    setClientFormulas_(clientsTab, newRow);
  }

  // --- Dashboard access key ---
  var key = props.getProperty("DASHBOARD_KEY");
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, "").slice(0, 20);
    props.setProperty("DASHBOARD_KEY", key);
  }
  props.setProperty("HQ_ID", hq.getId());

  return {
    status: "ok",
    message: "HQ created. SAVE THE DASHBOARD KEY -- it is only shown here.",
    hq_id: hq.getId(),
    hq_url: hq.getUrl(),
    dashboard_key: key,
    source_row_counts: counts
  };
}

// Rename the three old spreadsheets so nothing writes to them by accident.
function archiveOldSheets() {
  if (!props_().getProperty("HQ_ID")) throw new Error("Set up HQ first.");
  var renamed = [];
  for (var k in OLD_SHEET_IDS) {
    var ss = SpreadsheetApp.openById(OLD_SHEET_IDS[k]);
    var name = ss.getName();
    if (name.indexOf("OLD — DO NOT USE") === -1) {
      ss.rename("OLD — DO NOT USE (archived Jul 2026) — " + name);
      renamed.push(name);
    }
  }
  return { status: "ok", message: "Archived: " + (renamed.join(", ") || "nothing (already archived)") };
}

// ---------------------------------------------- THEME / SORT / DROPDOWNS (v30)
// One-time (idempotent) polish so the consolidated tabs share one brand look,
// read chronologically, and have clean dropdown lists.

var BRAND = {
  orange:   "#E8622A",  // primary title + column-header banners
  white:    "#FFFFFF",
  darkcap:  "#141517",  // caption/sub-title rows
  capText:  "#B7B7B7",
  charcoal: "#2B2D31",  // section sub-bands
  band:     "#FCEDE6"   // very light orange tint for alternating data rows
};

function styleRow_(sheet, row, lastCol, bg, fg, bold, italic) {
  if (row < 1) return;
  var rng = sheet.getRange(row, 1, 1, lastCol);
  rng.setBackground(bg).setFontColor(fg);
  rng.setFontWeight(bold ? "bold" : "normal");
  rng.setFontStyle(italic ? "italic" : "normal");
}

// Find first row (1-indexed) containing text in any column of the used range.
function findRowByAnyCol_(sheet, text, lastCol) {
  var lastRow = Math.min(sheet.getLastRow(), 400);
  if (lastRow < 1) return -1;
  var vals = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  var t = text.toLowerCase();
  for (var i = 0; i < vals.length; i++) {
    for (var c = 0; c < vals[i].length; c++) {
      if (String(vals[i][c]).toLowerCase().trim().indexOf(t) !== -1) return i + 1;
    }
  }
  return -1;
}

function themeSpecs_() {
  return [
    { key: "income",    title: 1, caption: 2, headers: [3], sections: ["2026 total income", "income breakdown by type"], dataStart: 4, cols: 7,  endMarker: "income" },
    { key: "expenses",  title: 1, caption: 2, headers: [4], sections: ["2026 total expenses", "expense breakdown by category"], dataStart: 5, cols: 7, endMarker: "expenses" },
    { key: "mileage",   title: 1, caption: 2, headers: [3], sections: ["year totals"], dataStart: 4, cols: 8, endMarker: "mileage" },
    { key: "leads",     title: 1, caption: 0, headers: [2], sections: [], dataStart: 3, cols: 9,  endMarker: null },
    { key: "clients",   title: 1, caption: 0, headers: [2], sections: [], dataStart: 3, cols: 22, endMarker: null },
    { key: "dashboard", title: 1, caption: 2, headers: [5, 9, 20], sections: ["key metrics", "lead pipeline", "client stages", "revenue summary", "clients needing attention", "lead follow-ups due"], dataStart: 0, cols: 12, endMarker: null, wipe: true }
    // Summary tab is intentionally left as-is: it is already orange and its
    // green "Total Income" / red "Total Expenses" money callouts are semantic.
  ];
}

function themeTabs() {
  var specs = themeSpecs_();
  var done = [];
  for (var i = 0; i < specs.length; i++) {
    var sp = specs[i];
    var sheet = tab_(sp.key);
    var lastCol = sp.cols;

    // remove existing bandings (kills the green/other striping)
    var bandings = sheet.getBandings();
    for (var b = 0; b < bandings.length; b++) bandings[b].remove();

    // For dashboard: wipe the whole used area to white first, then recolour.
    if (sp.wipe) {
      var lr = Math.max(sheet.getLastRow(), 1);
      sheet.getRange(1, 1, lr, lastCol).setBackground(BRAND.white);
    }

    styleRow_(sheet, sp.title, lastCol, BRAND.orange, BRAND.white, true, false);
    if (sp.caption) styleRow_(sheet, sp.caption, lastCol, BRAND.darkcap, BRAND.capText, false, true);
    for (var h = 0; h < sp.headers.length; h++) styleRow_(sheet, sp.headers[h], lastCol, BRAND.orange, BRAND.white, true, false);
    for (var s = 0; s < sp.sections.length; s++) {
      var r = findRowByAnyCol_(sheet, sp.sections[s], lastCol);
      if (r > 0) styleRow_(sheet, r, lastCol, BRAND.charcoal, BRAND.white, true, false);
    }

    // Data-region banding for the ledger-style tabs.
    if (sp.dataStart) {
      var endRow;
      if (sp.endMarker) endRow = dataEndRow_(sheet, sp.endMarker) - 1;      // stop before the totals row
      else endRow = sheet.getMaxRows();                                     // leads/clients: to the very bottom (clears trailing green)
      if (endRow >= sp.dataStart) {
        var n = endRow - sp.dataStart + 1;
        sheet.getRange(sp.dataStart, 1, n, lastCol).setBackground(BRAND.white);
        var lastData = sheet.getLastRow();
        var bandEnd = Math.min(endRow, lastData);
        if (bandEnd >= sp.dataStart) {
          var bn = bandEnd - sp.dataStart + 1;
          var bgs = [];
          for (var rr = 0; rr < bn; rr++) {
            var color = (rr % 2 === 1) ? BRAND.band : BRAND.white;
            var rowArr = [];
            for (var cc = 0; cc < lastCol; cc++) rowArr.push(color);
            bgs.push(rowArr);
          }
          sheet.getRange(sp.dataStart, 1, bn, lastCol).setBackgrounds(bgs);
        }
      }
    }
    done.push(sheet.getName());
  }
  return { status: "ok", message: "Themed: " + done.join(", ") };
}

// Sort each ledger tab's data region ascending by its date column, then
// re-apply the formulas that must stay intact.
function sortTabsChrono() {
  var out = [];
  out.push(sortRegion_("income", 4, 1, "income"));
  out.push(sortRegion_("expenses", 5, 1, "expenses"));
  out.push(sortRegion_("mileage", 4, 1, "mileage"));
  out.push(sortRegion_("leads", 3, 1, null));       // Date Added = col A
  out.push(sortRegion_("clients", 3, 6, null));     // Client Since = col F
  fixIncomeFormulasOn_(tab_("income"));
  reapplyClientFormulas_();
  return { status: "ok", message: out.join(" | ") };
}

function sortRegion_(key, dataStart, sortCol, endMarker) {
  var sheet = tab_(key);
  var end = endMarker ? dataEndRow_(sheet, endMarker) - 1 : sheet.getLastRow();
  var n = end - dataStart + 1;
  if (n <= 1) return key + ": nothing to sort";
  sheet.getRange(dataStart, 1, n, sheet.getLastColumn())
    .sort({ column: sortCol, ascending: true });
  return key + ": sorted rows " + dataStart + "-" + end + " by col " + sortCol;
}

function reapplyClientFormulas_() {
  var sheet = tab_("clients");
  var last = sheet.getLastRow();
  for (var r = 3; r <= last; r++) {
    if (String(sheet.getRange(r, 1).getValue()).trim() !== "") setClientFormulas_(sheet, r);
  }
}

// Rebuild every dropdown so nothing reads "invalid": merge duplicate variants,
// then set the allowed list = canonical vocabulary ∪ every value actually present.
function dropdownConfig_() {
  var PAY = ["Stripe", "Venmo", "Zelle", "Cash", "Card", "Personal Checking", "N/A", "Unknown"];
  var SOURCE = ["Pictona", "Instagram", "Earl Brown", "Referral", "Direct DM", "NSB (Pettis/Glencoe)", "Cresswind", "Other"];
  var srcMerge = { "Pettis Park": "NSB (Pettis/Glencoe)" };
  return [
    // Income
    { tab: "income", col: 3, dataStart: 4, endMarker: "income", canonical: ["Mobile Chiro Visit", "Pickleball Lessons", "Digital Products (Guides)", "Package Sales", "Tournament / Other"], merges: {} },
    { tab: "income", col: 5, dataStart: 4, endMarker: "income", canonical: PAY, merges: {} },
    // Expenses
    { tab: "expenses", col: 3, dataStart: 5, endMarker: "expenses", canonical: ["Equipment", "Supplies & Balls", "Software & Subscriptions", "Marketing", "Education & Courses", "Mileage & Travel", "Professional Services", "Phone (Business %)", "Other"], merges: {} },
    { tab: "expenses", col: 5, dataStart: 5, endMarker: "expenses", canonical: PAY, merges: {} },
    { tab: "expenses", col: 7, dataStart: 5, endMarker: "expenses", canonical: ["Yes", "No"], merges: {} },
    // Mileage
    { tab: "mileage", col: 3, dataStart: 4, endMarker: "mileage", canonical: ["Mobile Chiro", "Pickleball Lesson", "Other"], merges: { "Mobile Chiropractic": "Mobile Chiro", "Pickleball Lessons": "Pickleball Lesson" } },
    // Leads
    { tab: "leads", col: 5, dataStart: 3, endMarker: null, canonical: SOURCE, merges: srcMerge },
    { tab: "leads", col: 6, dataStart: 3, endMarker: null, canonical: ["Mobile Chiro", "In-Clinic Chiro", "Pickleball Lessons", "Mobile Chiro / In-Clinic Chiro", "Mobile Chiro / Pickleball Lessons", "Digital Product"], merges: { "Clinic Chiropractic": "In-Clinic Chiro", "Mobile Chiropractic": "Mobile Chiro", "Pickleball Lesson": "Pickleball Lessons" } },
    { tab: "leads", col: 7, dataStart: 3, endMarker: null, canonical: ["New", "Contacted", "Nurturing", "Booked", "Converted", "Lost", "Not a Fit"], merges: {} },
    // Clients
    { tab: "clients", col: 5, dataStart: 3, endMarker: null, canonical: SOURCE, merges: srcMerge },
    { tab: "clients", col: 7, dataStart: 3, endMarker: null, canonical: ["Active", "Inactive"], merges: {} },
    { tab: "clients", col: 11, dataStart: 3, endMarker: null, canonical: ["Mobile Chiro Package", "Lesson Package - Individual", "Lesson Package - Group", "Single Lesson", "Mobile Chiro (ongoing)", "In-Clinic Chiro", "None"], merges: { "Mobile Chiropractic": "Mobile Chiro Package", "Clinic Chiropractic": "In-Clinic Chiro", "Individual Lessons": "Lesson Package - Individual", "Group Lessons": "Lesson Package - Group" } },
    { tab: "clients", col: 19, dataStart: 3, endMarker: null, canonical: PAY, merges: {} }
  ];
}

function fixDropdowns() {
  var cfg = dropdownConfig_();
  var report = [];
  for (var i = 0; i < cfg.length; i++) {
    var c = cfg[i];
    var sheet = tab_(c.tab);
    var end = c.endMarker ? dataEndRow_(sheet, c.endMarker) - 1 : sheet.getLastRow();
    if (end < c.dataStart) { report.push(c.tab + " col" + c.col + ": empty"); continue; }
    var n = end - c.dataStart + 1;
    var rng = sheet.getRange(c.dataStart, c.col, n, 1);
    var vals = rng.getValues();
    var present = {};
    var changed = false;
    for (var r = 0; r < n; r++) {
      var v = String(vals[r][0]).trim();
      if (v === "") continue;
      if (c.merges && c.merges[v] !== undefined) { v = c.merges[v]; vals[r][0] = v; changed = true; }
      present[v] = true;
    }
    if (changed) rng.setValues(vals);
    var allowed = c.canonical.slice();
    for (var p in present) if (allowed.indexOf(p) === -1) allowed.push(p);
    var rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(allowed, true)
      .setAllowInvalid(true)   // future off-list values warn but never block the webhook
      .build();
    rng.setDataValidation(rule);
    report.push(c.tab + " col" + c.col + ": " + allowed.length + " opts");
  }
  return { status: "ok", message: report.join(" | ") };
}

// ------------------------------------------ SESSIONS LEDGER + PAYMENTS (v31)
// The 🗓 Sessions tab is the per-session source of truth. Every session is one
// row tagged Discipline (Chiro/Lesson) × Billing (Package/One-off/Exam), and the
// webhook keeps the Clients tab counts in sync so nothing has to be hand-typed.

function gasDate_(s) {
  if (s instanceof Date) return s;
  s = String(s).trim();
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/.exec(s);
  if (m) { var y = +m[3]; if (y < 100) y += 2000; return new Date(y, +m[1] - 1, +m[2]); }
  return null;
}

// Find a client's 1-indexed row by name (case-insensitive). -1 if not found.
function findClientRow_(sheet, name) {
  var vals = sheet.getRange(1, 1, sheet.getLastRow(), 1).getValues();
  var t = String(name).toLowerCase().trim();
  for (var i = 2; i < vals.length; i++) {
    if (String(vals[i][0]).toLowerCase().trim() === t) return i + 1;
  }
  return -1;
}

// Create + theme the Sessions tab if it doesn't exist yet.
function ensureSessionsTab_() {
  var ss = hq_();
  var sheet = findSheet(ss, "sessions");
  if (sheet) return sheet;
  sheet = ss.insertSheet("🗓 Sessions");
  sheet.getRange(1, 1, 1, 5).merge().setValue("PICKLEBALL CHIRO  ·  SESSIONS LOG")
    .setBackground(BRAND.orange).setFontColor(BRAND.white).setFontWeight("bold").setHorizontalAlignment("center");
  sheet.getRange(2, 1, 1, 5).merge()
    .setValue("One row per session — Chiro/Lesson × Package/One-off/Exam. The webhook keeps this in sync with the Clients tab.")
    .setBackground(BRAND.darkcap).setFontColor(BRAND.capText).setFontStyle("italic").setHorizontalAlignment("center");
  sheet.getRange(3, 1, 1, 5).setValues([["Date", "Client", "Discipline", "Billing", "Notes"]])
    .setBackground(BRAND.orange).setFontColor(BRAND.white).setFontWeight("bold");
  sheet.setFrozenRows(3);
  sheet.setColumnWidth(1, 95); sheet.setColumnWidth(2, 185); sheet.setColumnWidth(3, 110);
  sheet.setColumnWidth(4, 110); sheet.setColumnWidth(5, 380);
  var discRule = SpreadsheetApp.newDataValidation().requireValueInList(["Chiro", "Lesson"], true).setAllowInvalid(true).build();
  var billRule = SpreadsheetApp.newDataValidation().requireValueInList(["Package", "One-off", "Exam"], true).setAllowInvalid(true).build();
  sheet.getRange(4, 3, 997, 1).setDataValidation(discRule);
  sheet.getRange(4, 4, 997, 1).setDataValidation(billRule);
  return sheet;
}

// Sync one client's Clients-tab counters for a single session.
function applySessionToClient_(name, date, discipline, billing) {
  var clients = tab_("clients");
  var r = findClientRow_(clients, name);
  if (r < 0) return false;
  var tot = Number(clients.getRange(r, 10).getValue()) || 0;   // J Total Sessions
  clients.getRange(r, 10).setValue(tot + 1);
  if (billing === "Package") {                                  // M Used (+1); N Left is =L-M
    var used = Number(clients.getRange(r, 13).getValue()) || 0;
    var incl = Number(clients.getRange(r, 12).getValue()) || 0;
    clients.getRange(r, 13).setValue(used + 1);
    clients.getRange(r, 15).setValue(incl && used + 1 >= incl ? "Complete" : "Active"); // O Pkg Status
  }
  var d = gasDate_(date);
  var cur = gasDate_(clients.getRange(r, 8).getValue());        // H Last Session
  if (d && (!cur || d.getTime() >= cur.getTime())) clients.getRange(r, 8).setValue(d).setNumberFormat("mm/dd/yyyy");
  return true;
}

// Log one session: append a ledger row + keep the client's counters in sync.
// { name, date?, discipline: "Chiro"|"Lesson", billing: "Package"|"One-off"|"Exam", notes? }
function logSession(data) {
  var sheet = ensureSessionsTab_();
  var date = data.date || today();
  var discipline = data.discipline || "Lesson";
  var billing = data.billing || "One-off";
  var row = firstEmptyRow(sheet, 4);
  sheet.getRange(row, 1, 1, 5).setValues([[gasDate_(date), data.name, discipline, billing, data.notes || ""]]);
  sheet.getRange(row, 1).setNumberFormat("mm/dd/yyyy");
  var synced = applySessionToClient_(data.name, date, discipline, billing);
  return {
    status: "ok",
    message: "Session logged -- " + data.name + " " + discipline + "/" + billing + " on " + date +
      (synced ? "" : " (no matching client row to sync)")
  };
}

// Record a payment atomically: log income + bump Total Paid + optionally reduce Outstanding.
// { name, amount, method?, income_type?, notes?, date?, reduce_outstanding? }
function recordPayment(data) {
  var amount = Number(data.amount);
  if (!amount) throw new Error("record_payment needs a numeric amount");
  logIncome({
    client_source: data.name, income_type: data.income_type || "Pickleball Lessons",
    notes: data.notes || "", payment_method: data.method || "", amount: amount, date: data.date
  });
  var clients = tab_("clients");
  var r = findClientRow_(clients, data.name);
  if (r < 0) return { status: "ok", message: "Income logged for " + data.name + " ($" + amount + "), but no matching client row to update." };
  var paid = Number(clients.getRange(r, 17).getValue()) || 0;   // Q Total Paid
  clients.getRange(r, 17).setValue(paid + amount);
  if (data.method) clients.getRange(r, 19).setValue(data.method); // S Method
  clients.getRange(r, 20).setValue(data.date || today());         // T Last Paid
  var msg = "Payment recorded -- $" + amount + " from " + data.name;
  if (data.reduce_outstanding) {
    var out = Number(clients.getRange(r, 18).getValue()) || 0;    // R Outstanding
    var newOut = Math.max(0, out - amount);
    clients.getRange(r, 18).setValue(newOut);
    msg += " (outstanding " + out + " -> " + newOut + ")";
  }
  return { status: "ok", message: msg };
}

// One-time (re-runnable) seed of the Sessions ledger + corrected package counts.
// { sessions: [[date, client, discipline, billing, notes], ...],
//   client_counts: [{ name, package?, incl?, used?, pkg_status?, total_sessions? }, ...] }
function backfillSessions(data) {
  var sheet = ensureSessionsTab_();
  var last = sheet.getLastRow();
  if (last >= 4) sheet.getRange(4, 1, last - 3, 5).clearContent();   // re-runnable
  var rows = data.sessions || [];
  if (rows.length) {
    var out = rows.map(function (x) { return [gasDate_(x[0]), x[1], x[2], x[3], x[4] || ""]; });
    sheet.getRange(4, 1, out.length, 5).setValues(out);
    sheet.getRange(4, 1, out.length, 1).setNumberFormat("mm/dd/yyyy");
  }
  var counts = data.client_counts || [];
  var clients = tab_("clients");
  var applied = [];
  for (var k = 0; k < counts.length; k++) {
    var c = counts[k];
    var r = findClientRow_(clients, c.name);
    if (r < 0) continue;
    if (c.package !== undefined)        clients.getRange(r, 11).setValue(c.package);
    if (c.incl !== undefined)           clients.getRange(r, 12).setValue(c.incl);
    if (c.used !== undefined)           clients.getRange(r, 13).setValue(c.used);
    if (c.pkg_status !== undefined)     clients.getRange(r, 15).setValue(c.pkg_status);
    if (c.total_sessions !== undefined) clients.getRange(r, 10).setValue(c.total_sessions);
    setClientFormulas_(clients, r);   // keep Left (N) + Stage (U) as formulas
    applied.push(c.name);
  }
  return { status: "ok", message: "Backfilled " + rows.length + " sessions; counts set for: " + applied.join(", ") };
}

// ------------------------------------------------------------------ READ API

function getDashboardData() {
  var out = { status: "ok", generated_at: new Date().toISOString() };

  var income = tab_("income");
  var iEnd = dataEndRow_(income, "income");
  var iVals = income.getRange(4, 1, Math.max(iEnd - 4, 1), 6).getValues();
  out.income = [];
  for (var i = 0; i < iVals.length; i++) {
    var r = iVals[i];
    if (String(r[1]).trim() === "" && String(r[5]).trim() === "") continue;
    out.income.push({
      date: fmtDate_(r[0]), client: String(r[1]), type: String(r[2]),
      description: String(r[3]), method: String(r[4]), amount: Number(r[5]) || 0
    });
  }

  var expenses = tab_("expenses");
  var eEnd = dataEndRow_(expenses, "expenses");
  var eVals = expenses.getRange(4, 1, Math.max(eEnd - 4, 1), 7).getValues();
  out.expenses = [];
  for (var e = 0; e < eVals.length; e++) {
    var er = eVals[e];
    if (String(er[1]).trim() === "" && String(er[5]).trim() === "") continue;
    out.expenses.push({
      date: fmtDate_(er[0]), vendor: String(er[1]), category: String(er[2]),
      description: String(er[3]), method: String(er[4]), amount: Number(er[5]) || 0,
      deductible: String(er[6])
    });
  }

  var mileage = tab_("mileage");
  var mEnd = dataEndRow_(mileage, "mileage");
  var mVals = mileage.getRange(4, 1, Math.max(mEnd - 4, 1), 9).getValues();
  out.mileage = [];
  for (var m = 0; m < mVals.length; m++) {
    var mr = mVals[m];
    if (String(mr[1]).trim() === "") continue;
    out.mileage.push({
      date: fmtDate_(mr[0]), client: String(mr[1]), type: String(mr[2]),
      from: String(mr[3]), to: String(mr[4]),
      miles_one_way: Number(mr[5]) || 0, miles_rt: Number(mr[6]) || 0,
      deduction: Number(mr[7]) || 0, note: String(mr[8] || "")
    });
  }

  var leads = tab_("leads");
  var lVals = leads.getDataRange().getValues();
  out.leads = [];
  for (var l = 2; l < lVals.length; l++) {
    var lr = lVals[l];
    if (String(lr[1]).trim() === "") continue;
    out.leads.push({
      date_added: fmtDate_(lr[0]), name: String(lr[1]), phone: String(lr[2]), email: String(lr[3]),
      source: String(lr[4]), interest: String(lr[5]), status: String(lr[6]),
      follow_up: fmtDate_(lr[7]), notes: String(lr[8])
    });
  }

  var clients = tab_("clients");
  var cVals2 = clients.getDataRange().getValues();
  out.clients = [];
  for (var c2 = 2; c2 < cVals2.length; c2++) {
    var cr = cVals2[c2];
    if (String(cr[0]).trim() === "") continue;
    out.clients.push({
      name: String(cr[0]), phone: String(cr[1]), email: String(cr[2]), dupr: String(cr[3]),
      source: String(cr[4]), since: fmtDate_(cr[5]), status: String(cr[6]),
      last_session: fmtDate_(cr[7]), sessions_mo: Number(cr[8]) || 0, sessions_total: Number(cr[9]) || 0,
      package: String(cr[10]), included: cr[11] === "" ? "" : Number(cr[11]),
      used: cr[12] === "" ? "" : Number(cr[12]), left: cr[13] === "" ? "" : Number(cr[13]),
      pkg_status: String(cr[14]), pkg_value: cr[15] === "" ? "" : Number(cr[15]),
      total_paid: Number(cr[16]) || 0, outstanding: Number(cr[17]) || 0,
      method: String(cr[18]), last_paid: fmtDate_(cr[19]),
      stage: String(cr[20]), notes: String(cr[21])
    });
  }

  var sessions = findSheet(hq_(), "sessions");
  out.sessions = [];
  if (sessions) {
    var sVals = sessions.getDataRange().getValues();
    for (var si = 3; si < sVals.length; si++) {
      var sr = sVals[si];
      if (String(sr[1]).trim() === "") continue;
      out.sessions.push({
        date: fmtDate_(sr[0]), client: String(sr[1]),
        discipline: String(sr[2]), billing: String(sr[3]), notes: String(sr[4] || "")
      });
    }
  }

  return out;
}
