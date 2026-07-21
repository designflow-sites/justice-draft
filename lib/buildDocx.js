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

const HEADING_COLOR = "000000";
const BODY_FONT = "Georgia";

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
            font: BODY_FONT,
          }),
        ],
      }),
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Initials: ____________     ", size: 18, font: BODY_FONT }),
          new TextRun({ text: "Page ", size: 18, font: BODY_FONT }),
          new TextRun({ children: [PageNumber.CURRENT], size: 18, font: BODY_FONT }),
          new TextRun({ text: " of ", size: 18, font: BODY_FONT }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18, font: BODY_FONT }),
        ],
      }),
    ],
  });
}

function headingParagraph(text) {
  return new Paragraph({
    spacing: { before: 320, after: 120 },
    children: [
      new TextRun({ text, color: HEADING_COLOR, font: BODY_FONT, bold: true, size: 26 }),
    ],
  });
}

function buildDocumentDefinition(answers) {
  const children = [
    new Paragraph({
      spacing: { after: 240 },
      children: [new TextRun({ text: "Victim Impact Statement", font: BODY_FONT, size: 44 })],
    }),
  ];

  GENERAL_INFO.forEach(({ label, field }) => {
    if (hasAnswer(answers[field])) {
      children.push(
        new Paragraph({
          spacing: { after: 80 },
          children: [
            new TextRun({ text: `${label}: `, bold: true, font: BODY_FONT }),
            new TextRun({ text: answers[field].trim(), font: BODY_FONT }),
          ],
        })
      );
    }
  });

  SECTIONS.forEach(({ heading, field }) => {
    if (hasAnswer(answers[field])) {
      children.push(headingParagraph(heading));
      answers[field]
        .trim()
        .split(/\n{2,}/)
        .forEach((para) => {
          children.push(
            new Paragraph({
              spacing: { after: 160 },
              children: [new TextRun({ text: para.trim(), font: BODY_FONT })],
            })
          );
        });
    }
  });

  const signatoryName = resolveSignatoryName(answers);

  // Declaration + witness block: every paragraph in this block except the
  // very last one gets keepNext so Word/LibreOffice never splits the
  // block across a page boundary — it either starts on a fresh page or
  // stays fully on the current one.
  children.push(
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: "Declaration", color: HEADING_COLOR, font: BODY_FONT, bold: true, size: 26 })],
    }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 200 },
      children: [
        new TextRun({
          text: "I declare that this victim impact statement is true and correct to the best of my knowledge and belief.",
          font: BODY_FONT,
        }),
      ],
    }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Signed: ______________________________", font: BODY_FONT })],
    }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 120 },
      children: [
        new TextRun({ text: "Name: ", bold: true, font: BODY_FONT }),
        new TextRun({ text: signatoryName, font: BODY_FONT }),
      ],
    }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 320 },
      children: [new TextRun({ text: "Date: ______________________________", font: BODY_FONT })],
    }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: "Witness (only if a statutory declaration is required in your state)",
          font: BODY_FONT,
        }),
      ],
    }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Witness signature: ______________________________", font: BODY_FONT })],
    }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Witness name: ______________________________", font: BODY_FONT })],
    }),
    new Paragraph({
      keepNext: true,
      keepLines: true,
      spacing: { after: 120 },
      children: [new TextRun({ text: "Qualification of witness: ______________________________", font: BODY_FONT })],
    }),
    new Paragraph({
      keepLines: true,
      children: [new TextRun({ text: "Date: ______________________________", font: BODY_FONT })],
    })
  );

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: BODY_FONT },
        },
      },
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
