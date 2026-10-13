# Daymark — Personal Life Event Tracker

A responsive, mobile-first event log served by Google Apps Script. Google Sheets is the only persistent store; Apps Script reads and writes the user-provided spreadsheet directly. There is no mock dataset, separate database, external analytics, AI service, or browser-held privileged credential.

## Deploy to the provided spreadsheet

1. Open [the Daymark spreadsheet](https://docs.google.com/spreadsheets/d/11BXs1kwoDycjSUULlaY6_clbd_yXtpFQC3yOoAF_Jc0/edit).
2. Choose **Extensions → Apps Script**. This creates a script bound to the spreadsheet.
3. Replace the starter `Code.gs` with this folder's `Code.gs`. Add HTML files named `Tracker`, `Styles`, and `Client`, copying the corresponding `.html` files. (The lowercase `index.html` is the separate Vercel launch page.) Set the manifest in Project Settings or replace `appsscript.json` with the provided manifest.
4. Save. In the editor, select and run `setupTracker` once. Review the Google permission prompt and authorize Sheets access. It creates the `Activities` and `Events` tabs with the required headers if they do not already exist. Existing nonempty tabs are retained; unexpected headers cause a clear error rather than being overwritten.
5. Run `runDateLogicTests` in the editor; it should return three passing date cases.
6. Choose **Deploy → New deployment → Web app**. Set **Execute as: User accessing the web app** and **Who has access: Only myself**. Deploy and authorize. Open the web app URL while signed into the same Google account that owns/has edit access to the spreadsheet.
7. To publish changes later, use **Deploy → Manage deployments → Edit → New version → Deploy**. The deployment URL remains the same.

The code includes the spreadsheet ID supplied in the request. Google authorization and web-app deployment happen in the user's Google account; this workspace cannot claim the app is connected until the live deployment is authorized and a real read/write round trip has been confirmed.

## Publish the source to GitHub

Run `Push-to-GitHub.cmd` from this folder on a machine with Git installed and authenticated for `AslamGeek/life-logs`. It clones the repository to a fresh temporary directory, copies these app files into the repository root, creates/pushes `main`, and asks for Git author name/email if Git has no configured identity. It does not overwrite a local checkout or store a GitHub token in the script. Review the Git output; the temporary clone is left in place after completion.

The Google Apps Script UI and Sheets backend run on Apps Script. The root `index.html` is a small Vercel launch page: it stores the Apps Script deployment URL in that browser and opens the actual tracker on Google. The repository-root `vercel.json` explicitly serves that page at `/`. After pushing, make sure the Vercel project's Root Directory is the repository root and redeploy the latest `main` commit. The page asks for the URL copied from Apps Script → Deploy → Manage deployments. It does not mirror event data or Google credentials into Vercel.

## Data model

`Activities`: `activity_id`, `name`, `category`, `tags`, `reminder_interval_days`, `created_at`, `updated_at`, `archived`.

`Events`: `event_id`, `activity_id`, `activity_name`, `occurred_at`, `recorded_at`, `notes`, `tags`, `updated_at`.

IDs are UUIDs and are the row reconciliation keys. Timestamps are ISO 8601 UTC strings; the browser displays them in the device's local timezone. Renaming an activity preserves its ID, so existing events continue to display the new name. Archiving never deletes events. Event retries carry the same event ID, edits update the matching row, and deletion locates the confirmed ID under a script lock.

## Included behavior

- Dashboard with monthly count, tracked activities, last occurrence, elapsed time, and recent events.
- Quick event entry with current local time, past-date editing, free-form activities, notes, and tags.
- Activity create/edit/archive/restore, categories, and reminder interval metadata.
- Search across event name, notes, and tags; activity/category filters; sort order; incremental history loading; edit and confirmed delete.
- Manual refresh and visible sync status. Spreadsheet edits appear on refresh/reload.
- Server-side validation, ID-based writes, and a `LockService` lock for writes.

## Privacy and limitations

The web app is restricted to the deploying user's Google account when deployed as described. The manifest requests the current-spreadsheet scope only, and the server verifies that the script is bound to the configured spreadsheet ID. Apps Script's authorization prompt grants access to that spreadsheet. Do not change access to “Anyone.” The app does not include another user's login/session layer; “Only myself” is its access control.

Google Sheets and Apps Script have request quotas, network latency, and limited concurrency compared with a database. A script lock serializes app writes, but cannot prevent simultaneous manual edits in the spreadsheet. There is no offline queue, background sync, or real-time synchronization. A manual refresh reads current sheet contents. Keep notes private: they are stored in the spreadsheet and are not sent to an AI/analytics service.

## Verification

Run `runDateLogicTests` from the Apps Script editor. Then perform the live checklist after deployment: create an activity and current event, add a retrospective event, refresh, check latest events and history search, edit and delete one event, then rename/archive an activity and confirm history remains. To check backend connectivity, the dashboard must show a successful sync and a newly saved event must appear in the `Events` tab. OAuth authorization and live Sheets write verification require the spreadsheet owner's Google account and cannot be completed from this local workspace.
