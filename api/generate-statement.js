import { Resend } from "resend";
import { buildDocxBuffer } from "../lib/buildDocx.js";
import { convertDocxToPdf } from "../lib/buildPdf.js";

const resend = new Resend(process.env.RESEND_API_KEY);

// Maps the field names Webflow's "Statement Form" actually uses to the
// internal keys buildDocx.js expects. Confirmed against the live site on
// 2026-07-08 — Questions 01-10 run in the same order as the template's
// sections. There is currently no "Matter number" field on the live form,
// so matter_number will always come through empty (which is fine — the
// generator already hides empty general-info lines).
const WEBFLOW_FIELD_MAP = {
  "Full Name": "name",
  "Email": "email",
  "Type of Offense": "offence_type",
  "When it Happened": "harm_date",
  "Name of Offender": "offender_name",
  "Question 01": "felt_at_time",
  "Question 02": "emotional_wellbeing",
  "Question 03": "relationships",
  "Question 04": "physical_health",
  "Question 05": "financial_impact",
  "Question 06": "daily_life",
  "Question 07": "sense_of_safety",
  "Question 08": "spiritual_cultural",
  "Question 09": "before",
  "Question 10": "court_assessor",
};

function translateWebflowPayload(raw) {
  const translated = {};
  Object.entries(raw).forEach(([key, value]) => {
    const mappedKey = WEBFLOW_FIELD_MAP[key];
    if (mappedKey) translated[mappedKey] = value;
  });
  return translated;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (req.query.key !== process.env.WEBHOOK_SHARED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const rawPayload = req.body?.payload?.data ?? req.body;
    const answers = translateWebflowPayload(rawPayload);

    const recipientEmail = answers.email;
    if (!recipientEmail) {
      return res.status(400).json({ error: "No recipient email in submission" });
    }

    // Build the DOCX first, then convert that exact file to PDF —
    // guarantees both attachments match, and avoids running a headless
    // browser inside this function.
    const docxBuffer = await buildDocxBuffer(answers);
    const pdfBuffer = await convertDocxToPdf(docxBuffer);

    await resend.emails.send({
      from: "Justice Draft <statements@justicedraft.com.au>",
      to: recipientEmail,
      subject: "Your Victim Impact Statement",
      html: "<p>Attached is a copy of your completed Victim Impact Statement, in both Word and PDF formats. Please print, sign, and date the declaration page by hand, and initial each page.</p>",
      attachments: [
        { filename: "victim-impact-statement.docx", content: docxBuffer.toString("base64") },
        { filename: "victim-impact-statement.pdf", content: pdfBuffer.toString("base64") },
      ],
    });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("generate-statement failed:", err);
    return res.status(500).json({ error: "Failed to generate or send statement" });
  }
}
