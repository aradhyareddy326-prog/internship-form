# EduTantr Internship Application Website

## Files
- `index.html` — two-column responsive application page
- `logo.png` — EduTantr logo
- `api/applications.js` — Vercel serverless endpoint that appends submissions to Google Sheets
- `package.json` — Google Sheets API dependency
- `vercel.json` — Vercel configuration
- `.env.example` — names of required environment variables (not real credentials)

## Google Sheets setup
1. Create a Google Cloud project and enable the Google Sheets API.
2. Create a service account and generate a JSON key.
3. Create a Google spreadsheet.
4. Share the spreadsheet with the service-account email as Editor.
5. Copy the spreadsheet ID from its URL.
6. In Vercel Project Settings > Environment Variables, add:
   - `GOOGLE_SHEET_ID` = the spreadsheet ID
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = the complete JSON key content
7. Redeploy the Vercel project.

The API creates an `Applications` tab and its header row if they do not already exist. Each successful submission is appended as a new row.

## Deploy
Deploy this folder as the Vercel project root. The `index.html` file must be at the root, and the API must be at `api/applications.js`.

## Important
- Never put Google credentials in frontend code.
- Never commit the service-account JSON key to GitHub.
- Test with a sample application before sharing the form publicly.
