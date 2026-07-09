// PICKLEBALL CHIRO -- Google Sheets Webhook v28
var SHEET_IDS = {
  mileage:  "17e-O3auikpGd41qX8TXwzYmyJrmSD1u869Hf1Ch_asI",
  finance:  "1vOLOVPz4K4jQwx3R4DBEoZyDXvE3KGYa6c8xZuYXyGw",
  business: "1p-GyHNvvlo5Bbwpr3iIfdm32UUTc77faOxVxRczX4mU"
};
var MILEAGE_RATE = 0.725;

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

// startRow: 1-indexed row to begin scanning (skip title/header rows)
function firstEmptyRow(sheet, startRow) {
  startRow = startRow || 2;
  var col = sheet.getRange("A:A").getValues();
  for (var i = startRow - 1; i < col.length; i++) {
    if (String(col[i][0]).trim() === "") return i + 1;
  }
  return col.length + 1;
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
      case "fix_income_formulas":    result = fixIncomeFormulas();       break;
      case "delete_duplicate_rows":  result = deleteDuplicateRows(data); break;
      case "delete_rows":            result = deleteRows(data);          break;
      case "fix_income_breakdown":   result = fixIncomeBreakdown();      break;
      case "set_cell":               result = setCell(data);             break;
      case "clean_mileage_junk":        result = cleanMileageJunk();          break;
      case "fix_mileage_deductions":    result = fixMileageDeductions();      break;
      case "read_cells":                result = readCells(data);                   break;
      case "fix_mileage_templates":     result = fixMileageTemplates();             break;
      default: result = { status: "error", message: "Unknown action: " + action };
    }
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  var ss = SpreadsheetApp.openById(SHEET_IDS.finance);
  var names = ss.getSheets().map(function(s){ return s.getName(); }).join(" | ");
  return ContentService.createTextOutput(JSON.stringify({ status: "ok", version: 15, finance_sheets: names }))
    .setMimeType(ContentService.MimeType.JSON);
}

function today() {
  return Utilities.formatDate(new Date(), "America/New_York", "MM/dd/yyyy");
}

function logMileage(data) {
  var ss = SpreadsheetApp.openById(SHEET_IDS.mileage);
  var sheet = ss.getSheets()[0];
  var oneWay = Number(data.miles_one_way);
  var rt = oneWay * 2;
  var deduction = parseFloat((rt * MILEAGE_RATE).toFixed(2));
  var row = firstEmptyRow(sheet, 2);
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
  var ss = SpreadsheetApp.openById(SHEET_IDS.finance);
  var sheet = findSheet(ss, "Income");
  if (!sheet) {
    var names = ss.getSheets().map(function(s){ return s.getName(); }).join(", ");
    throw new Error("Income sheet not found. Sheets: " + names);
  }
  var row = firstEmptyRow(sheet, 4);
  sheet.getRange(row, 1, 1, 6).setValues([[
    data.date || today(),
    data.client_source,
    data.income_type,
    data.notes || "",
    data.payment_method,
    Number(data.amount)
  ]]);
  // Build running-total formula directly Ñ always correct regardless of what's above
  var runningFormula = '=IF(F' + row + '<>"",G' + (row-1) + '+F' + row + ',IF(G' + (row-1) + '<>"",G' + (row-1) + ',""))';
  sheet.getRange(row, 7).setFormula(runningFormula);
  // Copy data validation (dropdowns) from row above
  var cVal = sheet.getRange(row - 1, 3).getDataValidation();
  var eVal = sheet.getRange(row - 1, 5).getDataValidation();
  if (cVal) sheet.getRange(row, 3).setDataValidation(cVal);
  if (eVal) sheet.getRange(row, 5).setDataValidation(eVal);
  // Format amount as currency
  sheet.getRange(row, 6).setNumberFormat('"$"#,##0.00');
  return { status: "ok", message: "Income logged -- $" + data.amount + " from " + data.client_source };
}

function logExpense(data) {
  var ss = SpreadsheetApp.openById(SHEET_IDS.finance);
  var sheet = findSheet(ss, "Expenses");
  if (!sheet) {
    var names = ss.getSheets().map(function(s){ return s.getName(); }).join(", ");
    throw new Error("Expenses sheet not found. Sheets: " + names);
  }
  var row = firstEmptyRow(sheet, 4);
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
  var ss = SpreadsheetApp.openById(SHEET_IDS.business);
  var sheet = findSheet(ss, "Leads");
  if (!sheet) {
    var names = ss.getSheets().map(function(s){ return s.getName(); }).join(", ");
    throw new Error("Leads sheet not found. Sheets: " + names);
  }
  var row = firstEmptyRow(sheet, 2);
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
  var ss = SpreadsheetApp.openById(SHEET_IDS.business);
  var sheet = findSheet(ss, "Leads");
  if (!sheet) throw new Error("Leads sheet not found");
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

function addClient(data) {
  var ss = SpreadsheetApp.openById(SHEET_IDS.business);
  var sheet = findSheet(ss, "Clients");
  if (!sheet) {
    var names = ss.getSheets().map(function(s){ return s.getName(); }).join(", ");
    throw new Error("Clients sheet not found. Sheets: " + names);
  }
  var row = firstEmptyRow(sheet, 2);
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
    data.sessions_left || "",
    data.pkg_status || "",
    data.pkg_value || "",
    data.total_paid || 0,
    data.outstanding || 0,
    data.payment_method || "",
    data.last_paid || data.date || today(),
    "",
    data.notes || ""
  ]]);
  return { status: "ok", message: "Client added -- " + data.name };
}

function updateClient(data) {
  var ss = SpreadsheetApp.openById(SHEET_IDS.business);
  var sheet = findSheet(ss, "Clients");
  if (!sheet) throw new Error("Clients sheet not found");
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

// One-time repair: rebuild running-total formulas from scratch in Income sheet
// Starts at row 5 (row 4 is the first data row and uses =F4 as its base)
function fixIncomeFormulas() {
  var ss = SpreadsheetApp.openById(SHEET_IDS.finance);
  var sheet = findSheet(ss, "Income");
  if (!sheet) throw new Error("Income sheet not found");
  var lastRow = sheet.getLastRow();
  var fixed = 0;
  for (var r = 5; r <= lastRow; r++) {
    var fVal = sheet.getRange(r, 6).getValue();
    if (fVal !== "" && fVal !== 0) {
      // Always build the formula directly Ñ never copy-and-shift from the row above
      var newFormula = '=IF(F' + r + '<>"",G' + (r-1) + '+F' + r + ',IF(G' + (r-1) + '<>"",G' + (r-1) + ',""))';
      sheet.getRange(r, 7).setFormula(newFormula);
      sheet.getRange(r, 6).setNumberFormat('"$"#,##0.00');
      fixed++;
    }
  }
  return { status: "ok", message: "Fixed " + fixed + " income row(s)" };
}

// Delete duplicate rows by name in Clients or Leads tab, keeping only the first occurrence
function deleteDuplicateRows(data) {
  var ss = SpreadsheetApp.openById(SHEET_IDS.business);
  var tabName = data.tab || "Clients";
  var sheet = findSheet(ss, tabName);
  if (!sheet) throw new Error(tabName + " sheet not found");
  var name = data.name;
  var values = sheet.getDataRange().getValues();
  var rowsToDelete = [];
  var firstSeen = false;
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][0]).toLowerCase().trim() === String(name).toLowerCase().trim()) {
      if (!firstSeen) { firstSeen = true; }
      else { rowsToDelete.push(i + 1); }
    }
  }
  // Delete from bottom up to preserve row numbers
  for (var j = rowsToDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(rowsToDelete[j]);
  }
  return { status: "ok", message: "Deleted " + rowsToDelete.length + " duplicate row(s) for " + name };
}

// Delete a range of rows by row number (1-indexed). sheet: "mileage", "finance", or "business". tab: optional sheet tab name.
function deleteRows(data) {
  var ssId = SHEET_IDS[data.sheet];
  if (!ssId) throw new Error("Unknown sheet key: " + data.sheet);
  var ss = SpreadsheetApp.openById(ssId);
  var sheet = data.tab ? findSheet(ss, data.tab) : ss.getSheets()[0];
  if (!sheet) throw new Error("Sheet tab not found");
  var startRow = Number(data.start_row);
  var endRow = Number(data.end_row || data.start_row);
  var numRows = endRow - startRow + 1;
  sheet.deleteRows(startRow, numRows);
  return { status: "ok", message: "Deleted rows " + startRow + " to " + endRow + " from " + sheet.getName() };
}

// Fix the Income tab breakdown section and G55 double-count.
// Scans for the breakdown label rows by text and rewrites their SUMIF formulas.
// Also clears the running-total formula in the 2026 TOTAL INCOME row.
function fixIncomeBreakdown() {
  var ss = SpreadsheetApp.openById(SHEET_IDS.finance);
  var sheet = findSheet(ss, "Income");
  if (!sheet) throw new Error("Income sheet not found");
  var lastRow = sheet.getLastRow();
  var values = sheet.getDataRange().getValues();
  var fixed = [];

  // Map of breakdown label text ? income type value in column C
  var labelToType = {
    "pickleball lessons":        "Pickleball Lessons",
    "mobile chiro visits":       "Mobile Chiro Visit",
    "digital products (guides)": "Digital Products (Guides)",
    "package sales":             "Package Sales",
    "tournament / other":        "Tournament / Other"
  };

  // Data lives in rows 4 onward (1-indexed); use a wide range to be safe
  var dataRange = "$C$4:$C$200";
  var amtRange  = "$F$4:$F$200";

  for (var i = 0; i < values.length; i++) {
    var rowNum = i + 1;
    if (rowNum < 50) continue; // skip data rows Ñ breakdown section is always below row 50
    // Fix the "2026 TOTAL INCOME" row Ñ clear the running-total cell so it doesn't double-count
    var rowText = String(values[i][3]).toLowerCase().trim(); // column D
    var colEText = String(values[i][4]).toLowerCase().trim(); // column E
    var colFText = String(values[i][5]).toLowerCase().trim(); // column F (amount col for totals)
    var colBText = String(values[i][1]).toLowerCase().trim(); // column B

    // Detect total income row by column E or F having "total income" text
    if (colEText.indexOf("total income") !== -1 || colFText.indexOf("total income") !== -1 ||
        String(values[i][3]).toLowerCase().indexOf("total income") !== -1 ||
        String(values[i][2]).toLowerCase().indexOf("total income") !== -1) {
      sheet.getRange(rowNum, 7).setValue(""); // clear G in total row
      fixed.push("Cleared G" + rowNum + " (total income row)");
    }

    // Detect breakdown label rows and rewrite their SUMIF
    var cellText = "";
    for (var c = 0; c < values[i].length; c++) {
      var t = String(values[i][c]).toLowerCase().trim();
      if (labelToType[t] !== undefined) { cellText = t; break; }
    }
    if (cellText) {
      var incomeType = labelToType[cellText];
      var formula = '=SUMIF(' + dataRange + ',"' + incomeType + '",' + amtRange + ')';
      // Write into col F and col G of this row (breakdown section uses both)
      sheet.getRange(rowNum, 6).setFormula(formula);
      sheet.getRange(rowNum, 7).setFormula(formula);
      fixed.push("Fixed row " + rowNum + " (" + incomeType + ")");
    }
  }

  return { status: "ok", message: fixed.length ? fixed.join("; ") : "Nothing to fix Ñ check row structure" };
}

// Delete junk/test/duplicate rows from the Mileage Log by content Ñ never by hardcoded row number.
// Removes any row where client name = "Test" and any duplicate where same date+client already appeared.
function cleanMileageJunk() {
  var ss = SpreadsheetApp.openById(SHEET_IDS.mileage);
  var sheet = ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  var seen = {};
  var toDelete = [];
  for (var i = 1; i < values.length; i++) {
    var client = String(values[i][1]).trim();
    var date   = String(values[i][0]).trim();
    var miles  = String(values[i][5]).trim();
    if (client === "" && date === "") continue; // blank row, skip
    // Delete anything with "test" in the client name
    if (client.toLowerCase() === "test") { toDelete.push(i + 1); continue; }
    // Skip note/header-like rows (no numeric miles value)
    if (isNaN(Number(miles)) || miles === "") continue;
    // Delete duplicates Ñ keep first occurrence of date+client
    var key = date + "|" + client.toLowerCase();
    if (seen[key]) { toDelete.push(i + 1); } else { seen[key] = true; }
  }
  for (var j = toDelete.length - 1; j >= 0; j--) {
    sheet.deleteRow(toDelete[j]);
  }
  return { status: "ok", message: "Deleted " + toDelete.length + " junk/duplicate row(s) from Mileage Log" };
}

// Set a single cell value or formula in any sheet. sheet: "mileage","finance","business". tab: optional.
// Pass value for a plain value, formula for a formula string (e.g. "=G6+F7").
function setCell(data) {
  var ssId = SHEET_IDS[data.sheet];
  if (!ssId) throw new Error("Unknown sheet key: " + data.sheet);
  var ss = SpreadsheetApp.openById(ssId);
  var sheet = data.tab ? findSheet(ss, data.tab) : ss.getSheets()[0];
  if (!sheet) throw new Error("Sheet tab not found");
  var cell = sheet.getRange(data.cell);
  if (data.formula !== undefined) {
    cell.setFormula(data.formula);
  } else {
    cell.setValue(data.value);
  }
  if (data.format) cell.setNumberFormat(data.format);
  return { status: "ok", message: "Set " + data.cell + " in " + sheet.getName() };
}

// Fix mileage template formulas in empty rows (H10:H53) to use 0.725 instead of 0.7.
function fixMileageTemplates() {
  var ss = SpreadsheetApp.openById(SHEET_IDS.mileage);
  var sheet = ss.getSheets()[0];
  var fixed = 0;
  for (var row = 10; row <= 53; row++) {
    var hCell = sheet.getRange(row, 8);
    var formula = hCell.getFormula();
    if (formula && formula.indexOf("0.7") !== -1 && formula.indexOf("0.725") === -1) {
      var newFormula = formula.replace(/\*0\.7\b/g, "*" + MILEAGE_RATE);
      hCell.setFormula(newFormula);
      fixed++;
    }
  }
  return { status: "ok", message: "Updated " + fixed + " template formula(s) to $" + MILEAGE_RATE + "/mile." };
}

// Read one or more cells and return their values/formulas. sheet: "mileage","finance","business". cells: ["H3","H9",...]
function readCells(data) {
  var ssId = SHEET_IDS[data.sheet];
  if (!ssId) throw new Error("Unknown sheet key: " + data.sheet);
  var ss = SpreadsheetApp.openById(ssId);
  var sheet = data.tab ? findSheet(ss, data.tab) : ss.getSheets()[0];
  if (!sheet) throw new Error("Sheet tab not found");
  var results = {};
  var cells = data.cells || [];
  for (var i = 0; i < cells.length; i++) {
    var r = sheet.getRange(cells[i]);
    results[cells[i]] = { value: r.getValue(), formula: r.getFormula() };
  }
  return { status: "ok", cells: results };
}

// Recalculate every mileage deduction at $0.725/mile by scanning column G (Total Miles RT).
// Finds the header row by looking for "Miles (One Way)" in any column, then restores
// column H header to "Deduction ($)" and overwrites each data row's deduction.
// Skips year-total/summary rows (detected by "year" or "total" in column A).
// Restores the year-total H cell to a proper SUM formula.
function fixMileageDeductions() {
  var ss = SpreadsheetApp.openById(SHEET_IDS.mileage);
  var sheet = ss.getSheets()[0];
  var values = sheet.getDataRange().getValues();
  var headerRow = -1;
  var fixed = 0;
  var firstDataRow = -1;
  var lastDataRow  = -1;
  var yearTotalRow = -1;

  // Find header row by scanning for "Miles (One Way)" text
  for (var i = 0; i < values.length; i++) {
    var row = values[i];
    for (var c = 0; c < row.length; c++) {
      if (String(row[c]).toLowerCase().indexOf("miles (one way)") !== -1) {
        headerRow = i;
        break;
      }
    }
    if (headerRow !== -1) break;
  }

  if (headerRow === -1) return { status: "error", message: "Could not find header row in Mileage Log" };

  // Restore header cell H in the header row
  sheet.getRange(headerRow + 1, 8).setValue("Deduction ($)");

  // Fix deductions for data rows; detect and skip year-total/summary rows
  for (var r = headerRow + 1; r < values.length; r++) {
    var colA = String(values[r][0]).trim().toUpperCase();
    var isYearTotal = colA.indexOf("YEAR") !== -1 || colA.indexOf("TOTAL") !== -1;
    var totalMiles = Number(values[r][6]); // col G = Total Miles (RT)

    if (isYearTotal) {
      yearTotalRow = r + 1; // 1-indexed sheet row
      continue;
    }
    if (isNaN(totalMiles) || totalMiles <= 0) continue;

    var deduction = Math.round(totalMiles * MILEAGE_RATE * 100) / 100;
    var cell = sheet.getRange(r + 1, 8); // col H, 1-indexed
    cell.setValue(deduction);
    cell.setNumberFormat('"$"#,##0.00');
    fixed++;
    if (firstDataRow === -1) firstDataRow = r + 1;
    lastDataRow = r + 1;
  }

  // Restore year-total H cell to an open-ended SUM formula so it auto-includes new entries
  if (yearTotalRow !== -1 && firstDataRow !== -1) {
    var sumCell = sheet.getRange(yearTotalRow, 8);
    sumCell.setFormula("=SUM(H" + firstDataRow + ":H" + (yearTotalRow - 1) + ")");
    sumCell.setNumberFormat('"$"#,##0.00');
  }

  return { status: "ok", message: "Fixed " + fixed + " deduction(s) at $" + MILEAGE_RATE + "/mile. Year-total formula restored." };
}