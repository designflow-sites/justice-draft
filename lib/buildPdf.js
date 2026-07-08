import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";
import { SECTIONS, GENERAL_INFO, hasAnswer, resolveSignatoryName } from "./statementFields.js";

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildBodyHtml(answers) {
  let html = `<h1>Victim Impact Statement</h1>`;

  const generalLines = GENERAL_INFO.filter(({ field }) => hasAnswer(answers[field]))
    .map(({ label, field }) => `<p class="info"><strong>${label}:</strong> ${escapeHtml(answers[field].trim())}</p>`)
    .join("\n");
  html += generalLines;

  SECTIONS.forEach(({ heading, field }) => {
    if (!hasAnswer(answers[field])) return;
    html += `<h2>${escapeHtml(heading)}</h2>`;
    answers[field]
      .trim()
      .split(/\n{2,}/)
      .forEach((para) => {
        html += `<p>${escapeHtml(para.trim())}</p>`;
      });
  });

  const signatoryName = resolveSignatoryName(answers);

  html += `
    <h2>Declaration</h2>
    <p>I declare that this victim impact statement is true and correct to the best of my knowledge and belief.</p>
    <p>Signed: ______________________________</p>
    <p><strong>Name:</strong> ${escapeHtml(signatoryName)}</p>
    <p>Date: ______________________________</p>
    <p class="witness-heading">Witness (only if a statutory declaration is required in your state)</p>
    <p>Witness signature: ______________________________</p>
    <p>Witness name: ______________________________</p>
    <p>Qualification of witness: ______________________________</p>
    <p>Date: ______________________________</p>
  `;

  return html;
}

function buildFullHtml(answers) {
  return `<!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0.9in; }
      body { font-family: Helvetica, Arial, sans-serif; font-size: 12px; color: #1a1a1a; }
      h1 { font-size: 26px; font-weight: 400; margin-bottom: 12px; }
      h2 { font-size: 15px; color: #2f5f9e; margin-top: 22px; margin-bottom: 6px; }
      p { margin: 0 0 10px 0; line-height: 1.4; }
      p.info { margin: 0 0 4px 0; }
      p.witness-heading { margin-top: 18px; }
    </style>
  </head>
  <body>${buildBodyHtml(answers)}</body>
  </html>`;
}

// Puppeteer's footerTemplate supports the special classes "pageNumber" and
// "totalPages" — this is what lets the footer show correct counts without
// us tracking pagination manually.
const FOOTER_TEMPLATE = `
  <div style="width:100%; font-size:8px; color:#666; text-align:center; font-family:Helvetica,Arial,sans-serif;">
    <div style="border-top:1px solid #999; margin:0 0.9in; padding-top:4px;">
      Created with Justice Draft, an online writing tool. The words in this statement are the author's own.
    </div>
    <div>
      Initials: ____________&nbsp;&nbsp;&nbsp;
      Page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>
  </div>
`;

export async function buildPdfBuffer(answers) {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    await page.setContent(buildFullHtml(answers), { waitUntil: "networkidle0" });
    const pdfBuffer = await page.pdf({
      format: "Letter",
      printBackground: true,
      displayHeaderFooter: true,
      headerTemplate: "<span></span>", // empty header
      footerTemplate: FOOTER_TEMPLATE,
      margin: { top: "0.9in", bottom: "1in", left: "0.9in", right: "0.9in" },
    });
    return pdfBuffer;
  } finally {
    await browser.close();
  }
}
