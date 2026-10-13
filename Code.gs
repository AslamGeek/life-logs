const SPREADSHEET_ID = '11BXs1kwoDycjSUULlaY6_clbd_yXtpFQC3yOoAF_Jc0';
const ACTIVITY_SHEET = 'Activities';
const EVENT_SHEET = 'Events';
const ACTIVITY_HEADERS = ['activity_id','name','category','tags','reminder_interval_days','created_at','updated_at','archived'];
const EVENT_HEADERS = ['event_id','activity_id','activity_name','occurred_at','recorded_at','notes','tags','updated_at'];

function doGet() {
  return HtmlService.createTemplateFromFile('Tracker').evaluate()
    .setTitle('Daymark — Personal Event Tracker')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

function include(filename) { return HtmlService.createHtmlOutputFromFile(filename).getContent(); }

function setupTracker() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== SPREADSHEET_ID) throw new Error('Open this Apps Script from the provided spreadsheet using Extensions → Apps Script.');
  ensureSheet_(ss, ACTIVITY_SHEET, ACTIVITY_HEADERS);
  ensureSheet_(ss, EVENT_SHEET, EVENT_HEADERS);
  return {ok:true, spreadsheet:ss.getName(), url:ss.getUrl(), initializedAt:new Date().toISOString()};
}

function getAppData() {
  const ss = openTracker_();
  const activities = readRows_(ss.getSheetByName(ACTIVITY_SHEET), ACTIVITY_HEADERS).map(row => ({
    id:String(row.activity_id), name:String(row.name), category:String(row.category || ''),
    tags:parseTags_(row.tags), reminderDays:row.reminder_interval_days === '' ? '' : Number(row.reminder_interval_days),
    createdAt:iso_(row.created_at), updatedAt:iso_(row.updated_at), archived:String(row.archived).toLowerCase() === 'true'
  }));
  const byId = Object.fromEntries(activities.map(a => [a.id,a]));
  const events = readRows_(ss.getSheetByName(EVENT_SHEET), EVENT_HEADERS).map(row => ({
    id:String(row.event_id), activityId:String(row.activity_id), activityName:byId[String(row.activity_id)]?.name || String(row.activity_name),
    occurredAt:iso_(row.occurred_at), recordedAt:iso_(row.recorded_at), notes:String(row.notes || ''),
    tags:parseTags_(row.tags), updatedAt:iso_(row.updated_at)
  })).filter(e => e.id && e.activityId && e.occurredAt).sort((a,b) => b.occurredAt.localeCompare(a.occurredAt));
  return {ok:true, activities, events, spreadsheetName:ss.getName(), syncedAt:new Date().toISOString()};
}

function saveActivity(input) {
  input = input || {};
  const name = text_(input.name, 'Activity name', 80);
  const category = text_(input.category || '', 'Category', 50);
  const tags = normalizeTags_(input.tags);
  const reminder = input.reminderDays === '' || input.reminderDays == null ? '' : Number(input.reminderDays);
  if (reminder !== '' && (!Number.isInteger(reminder) || reminder < 1 || reminder > 3650)) throw new Error('Reminder interval must be a whole number from 1 to 3650 days.');
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sheet = openTracker_().getSheetByName(ACTIVITY_SHEET), now = new Date().toISOString();
    const id = String(input.id || Utilities.getUuid());
    const rowNum = findRow_(sheet, 1, id), created = rowNum ? sheet.getRange(rowNum,6).getValue() : now;
    const row = [id,name,category,tags.join(', '),reminder,iso_(created) || now,now,input.archived === true];
    if (rowNum) sheet.getRange(rowNum,1,1,ACTIVITY_HEADERS.length).setValues([row]);
    else sheet.appendRow(row);
    return {ok:true,id};
  } finally { lock.releaseLock(); }
}

function saveEvent(input) {
  input = input || {};
  const activityId = text_(input.activityId, 'Activity', 100);
  const occurredAt = validDate_(input.occurredAt, 'Event date and time');
  const notes = text_(input.notes || '', 'Notes', 2000);
  const tags = normalizeTags_(input.tags);
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const ss = openTracker_(), activitySheet = ss.getSheetByName(ACTIVITY_SHEET), eventSheet = ss.getSheetByName(EVENT_SHEET);
    const arow = findRow_(activitySheet,1,activityId);
    if (!arow) throw new Error('That activity no longer exists. Refresh and try again.');
    const activity = activitySheet.getRange(arow,1,1,ACTIVITY_HEADERS.length).getValues()[0];
    const id = String(input.id || Utilities.getUuid()), rowNum = findRow_(eventSheet,1,id), now = new Date().toISOString();
    if (!rowNum) eventSheet.appendRow([id,activityId,String(activity[1]),occurredAt,now,notes,tags.join(', '),now]);
    else eventSheet.getRange(rowNum,1,EVENT_HEADERS.length).setValues([[id,activityId,String(activity[1]),occurredAt,iso_(eventSheet.getRange(rowNum,5).getValue()) || now,notes,tags.join(', '),now]]);
    return {ok:true,id};
  } finally { lock.releaseLock(); }
}

function deleteEvent(eventId) {
  const id = text_(eventId, 'Event ID', 100), lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sheet = openTracker_().getSheetByName(EVENT_SHEET), row = findRow_(sheet,1,id);
    if (!row) throw new Error('This event was already removed or no longer exists. Refresh the history.');
    sheet.deleteRow(row); return {ok:true,id};
  } finally { lock.releaseLock(); }
}

function runDateLogicTests() {
  const cases = [
    {label:'same day', got:elapsedLabel_(new Date().toISOString(),new Date()), expected:'Today'},
    {label:'one day', got:elapsedLabel_(new Date(Date.now()-86400000).toISOString(),new Date()), expected:'1 day ago'},
    {label:'future event', got:elapsedLabel_(new Date(Date.now()+86400000).toISOString(),new Date()), expected:'Scheduled'}
  ];
  const failed = cases.filter(c => c.got !== c.expected);
  if (failed.length) throw new Error(JSON.stringify(failed));
  return {passed:cases.length, cases};
}

function elapsedLabel_(occurredAt, now) {
  const diff = now.getTime() - new Date(occurredAt).getTime();
  if (diff < 0) return 'Scheduled';
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  return days === 1 ? '1 day ago' : days + ' days ago';
}

function openTracker_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss || ss.getId() !== SPREADSHEET_ID) throw new Error('This app is not bound to the configured spreadsheet.');
  ensureSheet_(ss,ACTIVITY_SHEET,ACTIVITY_HEADERS); ensureSheet_(ss,EVENT_SHEET,EVENT_HEADERS);
  return ss;
}
function ensureSheet_(ss,name,headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) sheet.getRange(1,1,1,headers.length).setValues([headers]);
  const existing = sheet.getRange(1,1,1,headers.length).getDisplayValues()[0];
  if (headers.some((h,i) => existing[i] !== h)) throw new Error('The ' + name + ' tab has unexpected columns. Expected: ' + headers.join(', '));
  sheet.setFrozenRows(1);
  return sheet;
}
function readRows_(sheet,headers) {
  if (sheet.getLastRow() < 2) return [];
  const values = sheet.getRange(2,1,sheet.getLastRow()-1,headers.length).getValues();
  return values.map(row => Object.fromEntries(headers.map((h,i) => [h,row[i]])));
}
function findRow_(sheet,col,id) {
  if (sheet.getLastRow() < 2) return 0;
  const hit = sheet.getRange(2,col,sheet.getLastRow()-1,1).createTextFinder(id).matchEntireCell(true).findNext();
  return hit ? hit.getRow() : 0;
}
function text_(value,label,max) {
  const result = String(value == null ? '' : value).trim();
  if (!result || result.length > max) throw new Error(label + ' is required and must be at most ' + max + ' characters.');
  return result;
}
function validDate_(value,label) {
  const date = new Date(String(value || ''));
  if (!value || Number.isNaN(date.getTime())) throw new Error(label + ' must be a valid date and time.');
  return date.toISOString();
}
function normalizeTags_(value) {
  const list = Array.isArray(value) ? value : String(value || '').split(',');
  return [...new Set(list.map(x => String(x).trim()).filter(Boolean).map(x => x.slice(0,30)))].slice(0,12);
}
function parseTags_(value) { return normalizeTags_(String(value || '')); }
function iso_(value) {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}
