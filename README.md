# Daymark — Personal Life Event Tracker

The tracker UI is served by Vercel at the Vercel project URL. The browser stays on that URL. A Vercel serverless API relays data requests to Google Apps Script, which reads and writes the supplied Google Sheet. Apps Script never serves or redirects the app UI.

## One-time setup

1. In the provided Sheet, open **Extensions → Apps Script**. Replace `Code.gs` with this folder's `Code.gs`. Keep the Apps Script project bound to the supplied spreadsheet.
2. Save, then deploy Apps Script as a **Web app** with **Execute as: Me** and **Who has access: Anyone**. This deployment is an API endpoint called by Vercel; it is not the app's URL and the page never navigates there. Copy its `/exec` URL.
4. In the Apps Script editor, run `setupTracker` once and approve access to the Sheet.
5. In Vercel project settings, set `APPS_SCRIPT_URL` for Production to the Apps Script deployment `/exec` URL. This is the only Vercel environment variable required.
6. Push this folder to the GitHub repository and redeploy the latest commit in Vercel. Open the Vercel URL; the app stays on that domain.

The UI is a single self-contained `index.html` so layout, styling, and browser behavior ship together. Push changes to `index.html` and Vercel redeploys it. Backend changes go in `Code.gs`, then deploy a new Apps Script version; the Apps Script URL remains an internal API setting in Vercel.

## Files and data

- `index.html`: self-contained Vercel-hosted UI.
- `api/tracker.js`: Vercel server-side relay. It forwards only approved operations to Apps Script.
- `Code.gs`: Apps Script JSON API and Google Sheets data logic. Its `doGet()` only returns service metadata; it does not serve the UI.

The Sheet has `Activities` and `Events` tabs with stable IDs and the headers declared in `Code.gs`. The backend validates inputs and uses a script lock for writes. The browser does not store a Google credential or call `google.script.run`.

## GitHub and Vercel

Run `Push-to-GitHub.cmd` from this folder on a machine with Git installed and authenticated for `AslamGeek/life-logs`. It pushes the Vercel app and API source to `main`. Configure the Vercel project to deploy the repository root and set `APPS_SCRIPT_URL`. No Vercel `index.html` redirect page is used.

## Privacy

The Apps Script deployment and Vercel API are publicly callable. Anyone who finds the API can read, create, edit, or delete records in the connected Sheet. This simplified setup has no access key or sign-in gate.
