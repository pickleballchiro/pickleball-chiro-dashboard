/**
 * INSIGHT CHIROPRACTIC — Workshop Registration → Google Sheets
 *
 * HOW TO SET THIS UP (4 steps):
 *
 * 1. Open your Google Sheet for workshop registrations.
 *    - Add these headers in Row 1:
 *      Timestamp | Workshop | First Name | Last Name | Email | Phone | Notes
 *
 * 2. Click Extensions → Apps Script
 *    - Delete any existing code in the editor
 *    - Paste ALL of this file's contents
 *    - Click Save (Ctrl+S / Cmd+S)
 *
 * 3. Click Deploy → New deployment
 *    - Type: Web App
 *    - Execute as: Me
 *    - Who has access: Anyone
 *    - Click Deploy → Authorize → Allow
 *    - Copy the Web App URL shown (looks like https://script.google.com/macros/s/.../exec)
 *
 * 4. Open index.html and replace:
 *      const APPS_SCRIPT_URL = 'YOUR_APPS_SCRIPT_URL_HERE';
 *    with:
 *      const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';
 *
 * That's it — every form submission will now append a row to your Sheet.
 */

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();

    // Write headers if the sheet is empty
    if (sheet.getLastRow() === 0) {
      sheet.appendRow(['Timestamp', 'Workshop', 'First Name', 'Last Name', 'Email', 'Phone', 'Notes']);
    }

    sheet.appendRow([
      data.timestamp  || new Date().toISOString(),
      data.workshop   || 'Shoulder Pain Workshop',
      data.firstName  || '',
      data.lastName   || '',
      data.email      || '',
      data.phone      || '',
      data.notes      || ''
    ]);

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok' }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// Test this function manually inside Apps Script to verify your sheet connection:
function testWrite() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  sheet.appendRow([
    new Date().toISOString(),
    'Shoulder Pain Workshop',
    'Test',
    'User',
    'test@example.com',
    '5550001234',
    'Test submission — delete this row'
  ]);
  Logger.log('Test row written successfully.');
}
