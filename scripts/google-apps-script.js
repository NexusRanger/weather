/**
 * Weather Dashboard Location Record & Feedback Web App
 * Google Apps Script (Code.gs)
 *
 * Spreadsheet: Weather Dashboard Location Record
 * ID: 1F7mRsziPoYb5U4FvtLix1GlBgS4Do8LL5X36RZTLZXE
 */

const SPREADSHEET_ID = "1F7mRsziPoYb5U4FvtLix1GlBgS4Do8LL5X36RZTLZXE";

function doGet(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const action = (e && e.parameter && e.parameter.action) || 'getLocations';

  // 1. Fetch Approved Community Feedback for Dashboard
  if (action === 'getFeedback') {
    const feedbackSheet = ss.getSheetByName('Feedback');
    if (!feedbackSheet) {
      return jsonResponse({ status: 'success', data: [] });
    }
    const data = feedbackSheet.getDataRange().getValues();
    if (data.length <= 1) {
      return jsonResponse({ status: 'success', data: [] });
    }
    // Headers: Timestamp[0], Stars[1], Location[2], Comment[3], Status[4], AgentReply[5], Category[6]
    const approved = [];
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const status = String(row[4] || '').trim().toLowerCase();
      if (status === 'approved') {
        approved.push({
          timestamp: row[0],
          stars: Number(row[1]) || 5,
          location: row[2] || 'Local',
          comment: row[3] || '',
          status: 'Approved',
          agentReply: row[5] || '',
          category: row[6] || 'General'
        });
      }
    }
    // Return newest approved comments first
    approved.reverse();
    return jsonResponse({ status: 'success', data: approved });
  }

  // 2. Fetch 30-Day Map Location History (Default)
  const locSheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  const locData = locSheet.getDataRange().getValues();
  const pins = [];
  for (let i = 1; i < locData.length; i++) {
    const row = locData[i];
    if (row[0] && row[3] && row[4]) {
      pins.push({
        timestamp: row[0],
        name: row[1] || 'Unknown',
        postcode: row[2] || '',
        lat: Number(row[3]),
        lon: Number(row[4])
      });
    }
  }
  return jsonResponse({ status: 'success', data: pins });
}

function doPost(e) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let payload = {};
  try {
    payload = JSON.parse(e.postData.contents);
  } catch (err) {
    payload = e.parameter || {};
  }

  // Handle Feedback Submission
  if (payload.action === 'addFeedback') {
    let sheet = ss.getSheetByName('Feedback');
    if (!sheet) {
      sheet = ss.insertSheet('Feedback');
      sheet.appendRow(['Timestamp', 'Stars', 'Location', 'Comment', 'Status', 'Agent Reply', 'Category', 'Postcode', 'Latitude', 'Longitude']);
    }
    sheet.appendRow([
      payload.timestamp || new Date().toISOString(),
      payload.stars || 5,
      payload.name || 'Anonymous',
      payload.comment || '',
      'Pending',        // Default status for moderation
      '',               // Agent Reply blank initially
      '',               // Category
      payload.postcode || '',
      payload.lat || '',
      payload.lon || ''
    ]);
    return jsonResponse({ status: 'success', message: 'Feedback queued for moderation' });
  }

  // Handle Map Pin Logging (Default)
  const locSheet = ss.getSheetByName('Sheet1') || ss.getSheets()[0];
  locSheet.appendRow([
    payload.timestamp || new Date().toISOString(),
    payload.name || 'Current Location',
    payload.postcode || '',
    payload.lat || '',
    payload.lon || ''
  ]);
  return jsonResponse({ status: 'success', message: 'Location logged' });
}

function jsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
