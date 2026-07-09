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
    return json_({ status: "ok", version: 16, hq: props_().getProperty("HQ_ID") ? "ready" : "not set up" });
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

  return out;
}
