import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  Footer,
  PageNumber,
  AlignmentType,
  BorderStyle,
} from "docx";
import { SECTIONS, GENERAL_INFO, hasAnswer, resolveSignatoryName } from "./statementFields.js";

const NAVY = "000080";
const FONT = "Georgia";

function buildFooter() {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        border: {
          top: { style: BorderStyle.SINGLE, size: 4, color: "999999", space: 4 },
        },
        children: [
          new TextRun({
            text: "Created with Justice Draft, an online writing tool. The words in this statement are the author's own.",
            size: 16,
            color: "666666",
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Initials: ____________     ", size: 18 }),
          new TextRun({ text: "Page ", size: 18 }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18 }),
          new TextRun({ text: " of ", size: 18 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 }),
        ],
      }),
    ],
  });
}

function buildDocumentDefinition(answers) {
  const children = [
    new Paragraph({ text: "Victim Impact Statement", heading: HeadingLevel.TITLE, spacing: { after: 240 } }),
  ];

  GENERAL_INFO.forEach(({ label, field }) => {
    if (hasAnswer(answers[field])) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [new TextRun({ text: `${label}: `, bold: true }), new TextRun(answers[field].trim())],
        })
      );
    }
  });

  SECTIONS.forEach(({ heading, field }) => {
    if (hasAnswer(answers[field])) {
      children.push(
        new Paragraph({ text: heading, heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } })
      );
      answers[field]
        .trim()
        .split(/\n{2,}/)
        .forEach((para) => {
          children.push(new Paragraph({ spacing: { after: 160 }, children: [new TextRun(para.trim())] }));
        });
    }
  });

  const signatoryName = resolveSignatoryName(answers);

  children.push(
    new Paragraph({ text: "Declaration", heading: HeadingLevel.HEADING_1, spacing: { before: 320, after: 120 } }),
    new Paragraph({
      spacing: { after: 200 },
      children: [
        new TextRun(
          "I declare that this victim impact statement is true and correct to the best of my knowledge and belief."
        ),
      ],
    }),
    // --- Signature block: keepNext chains these three paragraphs together
    // so they never split across a page boundary. keepLines guards each
    // individual paragraph's own lines too (belt-and-braces, since these
    // are one-liners anyway).
    new Paragraph({
      spacing: { after: 120 },
      keepNext: true,
      keepLines: true,
      children: [new TextRun("Signed: ______________________________")],
    }),
    new Paragraph({
      spacing: { after: 120 },
      keepNext: true,
      keepLines: true,
      children: [new TextRun({ text: "Name: ", bold: true }), new TextRun(signatoryName)],
    }),
    new Paragraph({
      spacing: { after: 320 },
      keepLines: true,
      children: [new TextRun("Date: ______________________________")],
    }),
    // --- Witness block: same keep-together treatment, as its own
    // independent group (not chained to the signature block above it).
    new Paragraph({
      text: "Witness (only if a statutory declaration is required in your state)",
      spacing: { after: 120 },
      keepNext: true,
      keepLines: true,
    }),
    new Paragraph({
      spacing: { after: 120 },
      keepNext: true,
      keepLines: true,
      children: [new TextRun("Witness signature: ______________________________")],
    }),
    new Paragraph({
      spacing: { after: 120 },
      keepNext: true,
      keepLines: true,
      children: [new TextRun("Witness name: ______________________________")],
    }),
    new Paragraph({
      spacing: { after: 120 },
      keepNext: true,
      keepLines: true,
      children: [new TextRun("Qualification of witness: ______________________________")],
    }),
    new Paragraph({
      keepLines: true,
      children: [new TextRun("Date: ______________________________")],
    })
  );

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 22 }, // 11pt body text, Georgia everywhere by default
        },
      },
      paragraphStyles: [
        {
          id: "Title",
          name: "Title",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT, color: NAVY, bold: true, size: 52 },
        },
        {
          id: "Heading1",
          name: "heading 1",
          basedOn: "Normal",
          next: "Normal",
          quickFormat: true,
          run: { font: FONT, color: NAVY, bold: true, size: 30 },
          paragraph: { spacing: { before: 320, after: 120 } },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        footers: { default: buildFooter() },
        children,
      },
    ],
  });
}

export async function buildDocxBuffer(answers) {
  const doc = buildDocumentDefinition(answers);
  return Packer.toBuffer(doc);
}
