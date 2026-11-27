import { google } from "googleapis";
import { randomUUID } from "node:crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const d = req.body || {};
    const required = ["name", "phone", "email", "college", "department", "year", "domain", "language", "startDate"];

    for (const field of required) {
      if (typeof d[field] !== "string" || !d[field].trim()) {
        return res.status(400).json({ error: `Please provide ${field}.` });
      }
    }

    if (!/^\d{4}-\d{2}$/.test(d.startDate) || Number(d.startDate.slice(5, 7)) < 1 || Number(d.startDate.slice(5, 7)) > 12) {
      return res.status(400).json({ error: "Please select a valid preferred start month." });
    }
    if (typeof d.motivation !== "undefined" && typeof d.motivation !== "string") {
      return res.status(400).json({ error: "Invalid motivation value." });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)) {
      return res.status(400).json({ error: "Please enter a valid email address." });
    }
    if (d.phone.replace(/\D/g, "").length < 7) {
      return res.status(400).json({ error: "Please enter a valid phone number." });
    }

    const resume = d.resume || null;
    let resumeLink = "";
    if (resume) {
      if (!resume.fileName || !resume.dataBase64 || typeof resume.dataBase64 !== "string") {
        return res.status(400).json({ error: "The resume upload is invalid. Please select the file again." });
      }
      const ext = String(resume.fileName).toLowerCase().match(/\.(pdf|doc|docx)$/)?.[1];
      if (!ext) {
        return res.status(400).json({ error: "Resume must be a PDF, DOC or DOCX file." });
      }
      const fileBuffer = Buffer.from(resume.dataBase64, "base64");
      if (!fileBuffer.length || fileBuffer.length > 3 * 1024 * 1024) {
        return res.status(400).json({ error: "Resume size must not exceed 3 MB." });
      }
      if (!process.env.GOOGLE_DRIVE_FOLDER_ID) {
        return res.status(503).json({ error: "Resume uploads are not configured yet. Please submit without a resume or contact EduTantr." });
      }
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const credentialsJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    if (!spreadsheetId || !credentialsJson) {
      console.error("Missing Google Sheets environment variables.");
      return res.status(500).json({ error: "The application system is not configured yet. Please contact EduTantr." });
    }

    const credentials = JSON.parse(credentialsJson);
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: [
        "https://www.googleapis.com/auth/spreadsheets",
        "https://www.googleapis.com/auth/drive"
      ]
    });
    const sheets = google.sheets({ version: "v4", auth });
    const drive = google.drive({ version: "v3", auth });

    const spreadsheet = await sheets.spreadsheets.get({ spreadsheetId });
    const tabExists = (spreadsheet.data.sheets || []).some(
      sheet => sheet.properties?.title === "Applications"
    );

    if (!tabExists) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title: "Applications" } } }] }
      });
    }

    const headers = [
      "Application ID", "Submitted At", "Name", "WhatsApp Number", "Email",
      "College", "College Mail ID", "Department", "Year", "Interested Domain",
      "Preferred Start Month", "Why This Internship", "Resume Link", "Language"
    ];

    const firstRow = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "Applications!A1:N1"
    });

    if (!firstRow.data.values?.length) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Applications!A1:N1",
        valueInputOption: "RAW",
        requestBody: { values: [headers] }
      });
    } else {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "Applications!K1:N1",
        valueInputOption: "RAW",
        requestBody: { values: [[
          "Preferred Start Month", "Why This Internship", "Resume Link", "Language"
        ]] }
      });
    }

    const applicationId = "ET-" + new Date().getFullYear() + "-" + randomUUID().slice(0, 8).toUpperCase();

    if (resume) {
      const ext = String(resume.fileName).toLowerCase().match(/\.(pdf|doc|docx)$/)[1];
      const mimeTypes = {
        pdf: "application/pdf",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      };
      const fileBuffer = Buffer.from(resume.dataBase64, "base64");
      const uploaded = await drive.files.create({
        requestBody: {
          name: `${applicationId}-resume.${ext}`,
          parents: [process.env.GOOGLE_DRIVE_FOLDER_ID]
        },
        media: {
          mimeType: mimeTypes[ext],
          body: fileBuffer
        },
        fields: "id,webViewLink"
      });
      resumeLink = uploaded.data.webViewLink || "";
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "Applications!A:N",
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: {
        values: [[
          applicationId,
          new Date().toISOString(),
          d.name.trim(),
          d.phone.trim(),
          d.email.trim(),
          d.college.trim(),
          (d.collegeEmail || "").trim(),
          d.department.trim(),
          d.year.trim(),
          d.domain.trim(),
          d.startDate.trim(),
          (d.motivation || "").trim(),
          resumeLink,
          d.language.trim()
        ]]
      }
    });

    return res.status(200).json({ success: true, applicationId });
  } catch (error) {
    console.error("EduTantr application API error:", error);
    return res.status(500).json({ error: "Unable to save your application. Please try again later." });
  }
}