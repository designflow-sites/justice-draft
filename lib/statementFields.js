// Single source of truth for field order + labels.
// Reorder/add/remove here and both the DOCX and PDF outputs update together.

export const SECTIONS = [
  { heading: "How I felt at the time", field: "felt_at_time" },
  { heading: "Emotional wellbeing", field: "emotional_wellbeing" },
  { heading: "Relationships", field: "relationships" },
  { heading: "Physical health", field: "physical_health" },
  { heading: "Financial impact", field: "financial_impact" },
  { heading: "Daily life and routine", field: "daily_life" },
  { heading: "Sense of safety", field: "sense_of_safety" },
  { heading: "Spiritual and cultural wellbeing", field: "spiritual_cultural" },
  { heading: "Who I was before this happened", field: "before" },
  { heading: "What I want the court or assessor to know", field: "court_assessor" },
];

export const GENERAL_INFO = [
  { label: "Name", field: "name" },
  { label: "Type of offence", field: "offence_type" },
  { label: "When the harm occurred", field: "harm_date" },
  { label: "Name of offender", field: "offender_name" },
  { label: "Matter number", field: "matter_number" },
];

export function hasAnswer(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function resolveSignatoryName(answers) {
  if (hasAnswer(answers.signatory_name)) return answers.signatory_name.trim();
  if (hasAnswer(answers.name)) return answers.name.trim();
  return "";
}
