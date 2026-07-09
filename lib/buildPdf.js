const CLOUDCONVERT_API_KEY = process.env.CLOUDCONVERT_API_KEY;
const CC_BASE = "https://api.cloudconvert.com/v2";

async function ccRequest(path, options = {}) {
  const res = await fetch(`${CC_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${CLOUDCONVERT_API_KEY}`,
      ...(options.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`CloudConvert ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

/**
 * Converts an already-built DOCX buffer to PDF via CloudConvert, using
 * the LibreOffice engine server-side. This guarantees the PDF matches
 * the DOCX exactly (same source document, same footer/page-number
 * fields) and avoids running a headless browser inside a Vercel
 * serverless function, which has proven unreliable across Node/runtime
 * version changes.
 */
export async function convertDocxToPdf(docxBuffer) {
  if (!CLOUDCONVERT_API_KEY) {
    throw new Error("CLOUDCONVERT_API_KEY is not set");
  }

  // 1. Create a job: upload -> convert -> export
  const job = await ccRequest("/jobs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tasks: {
        "import-file": { operation: "import/upload" },
        "convert-file": {
          operation: "convert",
          input: "import-file",
          output_format: "pdf",
          engine: "libreoffice",
        },
        "export-file": { operation: "export/url", input: "convert-file" },
      },
    }),
  });

  const importTask = job.data.tasks.find((t) => t.name === "import-file");
  const uploadForm = importTask.result.form;

  // 2. Upload the DOCX buffer to the presigned upload URL CloudConvert gave us
  const formData = new FormData();
  Object.entries(uploadForm.parameters).forEach(([key, value]) => {
    formData.append(key, value);
  });
  formData.append(
    "file",
    new Blob([docxBuffer], {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }),
    "victim-impact-statement.docx"
  );

  const uploadRes = await fetch(uploadForm.url, { method: "POST", body: formData });
  if (!uploadRes.ok) {
    const text = await uploadRes.text();
    throw new Error(`CloudConvert upload failed: ${uploadRes.status} ${text}`);
  }

  // 3. Wait for the job to finish (CloudConvert holds the connection open until done)
  const finishedJob = await ccRequest(`/jobs/${job.data.id}/wait`);

  const exportTask = finishedJob.data.tasks.find((t) => t.name === "export-file");
  if (exportTask.status !== "finished") {
    throw new Error(`CloudConvert export task did not finish: ${JSON.stringify(exportTask)}`);
  }

  const fileUrl = exportTask.result.files[0].url;

  // 4. Download the resulting PDF
  const pdfRes = await fetch(fileUrl);
  if (!pdfRes.ok) {
    throw new Error(`Failed to download converted PDF: ${pdfRes.status}`);
  }
  const arrayBuffer = await pdfRes.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
