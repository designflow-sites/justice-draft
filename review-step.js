(function () {
  'use strict';

  // Keep this label order/wording in sync with SECTIONS + GENERAL_INFO in
  // lib/statementFields.js on the backend, so the review preview matches
  // the final document's section headings.
  const FIELD_LABELS = [
    ['Full Name', 'Name'],
    ['Type of Offense', 'Type of offence'],
    ['When it Happened', 'When the harm occurred'],
    ['Name of Offender', 'Name of offender'],
    ['Question 01', 'How I felt at the time'],
    ['Question 02', 'Emotional wellbeing'],
    ['Question 03', 'Relationships'],
    ['Question 04', 'Physical health'],
    ['Question 05', 'Financial impact'],
    ['Question 06', 'Daily life and routine'],
    ['Question 07', 'Sense of safety'],
    ['Question 08', 'Spiritual and cultural wellbeing'],
    ['Question 09', 'Who I was before this happened'],
    ['Question 10', 'What I want the court or assessor to know'],
  ];

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function hasAnswer(value) {
    return typeof value === 'string' && value.trim().length > 0;
  }

  function collectFormData() {
    const data = {};
    document.querySelectorAll(
      '[data-form="multistep"] input, [data-form="multistep"] textarea, [data-form="multistep"] select'
    ).forEach(function (el) {
      const name = el.name || el.id;
      if (!name) return;
      if (el.type === 'checkbox') {
        if (!data[name]) data[name] = [];
        if (el.checked) data[name].push(el.value);
      } else if (el.type === 'radio') {
        if (el.checked) data[name] = el.value;
      } else {
        data[name] = el.value;
      }
    });
    return data;
  }

  function renderReviewHtml(formData) {
    let html = '';
    FIELD_LABELS.forEach(function ([fieldName, label]) {
      const value = formData[fieldName];
      if (!hasAnswer(value)) return;
      html +=
        '<div class="jd-review-item" style="margin-bottom:24px;">' +
        '<div style="font-weight:600;color:#000080;margin-bottom:4px;">' + escapeHtml(label) + '</div>' +
        '<div style="white-space:pre-wrap;line-height:1.5;">' + escapeHtml(value.trim()) + '</div>' +
        '</div>';
    });
    if (!html) {
      html = '<p>No answers to review yet.</p>';
    }
    return html;
  }

  function populateReviewStep() {
    const output = document.querySelector('[data-review="output"]');
    if (!output) return;
    output.innerHTML = renderReviewHtml(collectFormData());
  }

  function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }

  // Poll for the review step becoming visible, same lightweight pattern
  // used elsewhere in this form for step-tracking. Only re-populates on
  // the hidden -> visible transition, not on every tick.
  let wasVisible = false;
  setInterval(function () {
    const reviewStep = document.querySelector('[data-review-step="true"]');
    const nowVisible = isVisible(reviewStep);
    if (nowVisible && !wasVisible) {
      populateReviewStep();
    }
    wasVisible = nowVisible;
  }, 250);

})();
