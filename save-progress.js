<!-- 
  Justice Draft — Save Progress Script
  Add this to: Webflow → Start Your Statement page → Page Settings → Before </body> tag
  BEFORE PUBLISHING: replace https://justice-draft-save-progress.vercel.app with your actual Vercel deployment URL
  e.g. https://justice-draft-api.vercel.app
-->
(function () {
  'use strict';
  // ─── CONFIG ───────────────────────────────────────────────────────────────
  const API_BASE = 'https://justice-draft-save-progress.vercel.app'; // e.g. https://justice-draft-api.vercel.app
  // ──────────────────────────────────────────────────────────────────────────
  // ── Collect all current Formly/Webflow form field values ──────────────────
  function collectFormData() {
    const data = {};
    // Grabs every named input, textarea, select, and radio/checkbox
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
  // ── Get the currently visible step index ──────────────────────────────────
  function getCurrentStep() {
    const steps = document.querySelectorAll('[data-form="step"]');
    for (let i = 0; i < steps.length; i++) {
      const style = window.getComputedStyle(steps[i]);
      if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
        return i;
      }
    }
    return 0;
  }
  // ── Restore saved form data into the fields ────────────────────────────────
  function restoreFormData(formData) {
    Object.entries(formData).forEach(function ([name, value]) {
      // Text / textarea / select
      const textEl = document.querySelector(
        '[data-form="multistep"] input[name="' + name + '"], ' +
        '[data-form="multistep"] input[id="' + name + '"], ' +
        '[data-form="multistep"] textarea[name="' + name + '"], ' +
        '[data-form="multistep"] textarea[id="' + name + '"], ' +
        '[data-form="multistep"] select[name="' + name + '"], ' +
        '[data-form="multistep"] select[id="' + name + '"]'
      );
      if (textEl && textEl.type !== 'checkbox' && textEl.type !== 'radio') {
        textEl.value = value;
        textEl.dispatchEvent(new Event('input', { bubbles: true }));
        textEl.dispatchEvent(new Event('change', { bubbles: true }));
        return;
      }
      // Checkboxes (value is an array)
      if (Array.isArray(value)) {
        document.querySelectorAll(
          '[data-form="multistep"] input[type="checkbox"][name="' + name + '"], ' +
          '[data-form="multistep"] input[type="checkbox"][id="' + name + '"]'
        ).forEach(function (cb) {
          cb.checked = value.includes(cb.value);
          cb.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return;
      }
      // Radio buttons
      const radio = document.querySelector(
        '[data-form="multistep"] input[type="radio"][name="' + name + '"][value="' + value + '"], ' +
        '[data-form="multistep"] input[type="radio"][id="' + name + '"][value="' + value + '"]'
      );
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }
  // ── Navigate to a specific step index ────────────────────────────────────
  function goToStep(targetIndex) {
    const steps = document.querySelectorAll('[data-form="step"]');
    if (!steps.length) return;
    // Clamp to valid range, skip step 0 (the "Start" card)
    const index = Math.min(Math.max(targetIndex, 1), steps.length - 1);
    // Hide all steps first
    steps.forEach(function (step) {
      step.style.display = 'none';
    });
    // Show the target step
    if (steps[index]) {
      steps[index].style.display = '';
    }
    // Update step counter displays
    document.querySelectorAll('[data-text="current-step"]').forEach(function (el) {
      el.textContent = index;
    });
    // Update progress bar if present
    const progressBar = document.querySelector('[data-form="progress-indicator"]');
    if (progressBar && steps.length > 1) {
      const pct = ((index) / (steps.length - 1)) * 100;
      progressBar.style.width = pct + '%';
    }
  }
  // ── Save progress handler ─────────────────────────────────────────────────
  async function handleSave(email) {
    const formData = collectFormData();
    const currentStep = getCurrentStep();
    const response = await fetch(API_BASE + '/api/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, formData, currentStep }),
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || 'Failed to save progress');
    }
    return result;
  }
  // ── Check for resume token on page load ──────────────────────────────────
  async function checkForResumeToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resume');
    if (!token) return;
    try {
      const response = await fetch(API_BASE + '/api/get-progress?token=' + encodeURIComponent(token));
      const result = await response.json();
      if (!response.ok) {
        showResumeError(result.error || 'Unable to load your saved progress.');
        return;
      }
      // Restore the form data and navigate to the saved step
      // Small timeout to let Formly/Webflow initialise first
      setTimeout(function () {
        restoreFormData(result.formData);
        goToStep(result.currentStep);
        showResumeSuccess();
      }, 600);
    } catch (err) {
      console.error('Resume error:', err);
      showResumeError('Unable to load your saved progress. Please try again.');
    }
  }
  // ── UI: show a small toast/banner ─────────────────────────────────────────
  function showToast(message, type) {
    // Remove any existing toast
    const existing = document.getElementById('jd-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'jd-toast';
    toast.style.cssText = [
      'position: fixed',
      'bottom: 24px',
      'left: 50%',
      'transform: translateX(-50%)',
      'background: ' + (type === 'error' ? '#c0392b' : '#1a1a1a'),
      'color: #fff',
      'padding: 12px 20px',
      'border-radius: 8px',
      'font-size: 14px',
      'font-weight: 500',
      'z-index: 9999',
      'box-shadow: 0 4px 16px rgba(0,0,0,0.18)',
      'transition: opacity 0.3s ease',
      'max-width: 90vw',
      'text-align: center',
    ].join(';');
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 4000);
  }
  function showResumeSuccess() {
    showToast('✓ Your progress has been restored. Carry on from where you left off.', 'success');
  }
  function showResumeError(msg) {
    showToast('⚠ ' + msg, 'error');
  }
  // ── Wire up the save panel UI ─────────────────────────────────────────────
  function initSaveUI() {
    // The panel is injected by Webflow (see the save-panel div added to the navbar)
    const panel = document.getElementById('jd-save-panel');
    const emailInput = document.getElementById('jd-save-email');
    const sendBtn = document.getElementById('jd-save-send');
    const cancelBtn = document.getElementById('jd-save-cancel');
    const triggerLinks = document.querySelectorAll('[data-save-trigger]');
    if (!panel || !emailInput || !sendBtn) return;
    // Open panel when trigger links are clicked
    triggerLinks.forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        panel.classList.add('is-open');
        emailInput.focus();
      });
    });
    // Cancel / close
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function () {
        panel.classList.remove('is-open');
        emailInput.value = '';
        resetSendButton();
      });
    }
    // Close on Escape key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && panel.classList.contains('is-open')) {
        panel.classList.remove('is-open');
        emailInput.value = '';
        resetSendButton();
      }
    });
    // Send button
    sendBtn.addEventListener('click', async function () {
      const email = emailInput.value.trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        emailInput.style.borderColor = '#e74c3c';
        emailInput.focus();
        return;
      }
      emailInput.style.borderColor = '';
      sendBtn.disabled = true;
      sendBtn.textContent = 'Sending…';
      try {
        await handleSave(email);
        // Success state
        sendBtn.textContent = '✓ Email sent!';
        sendBtn.style.background = '#27ae60';
        emailInput.value = '';
        setTimeout(function () {
          panel.classList.remove('is-open');
          resetSendButton();
        }, 2500);
      } catch (err) {
        sendBtn.disabled = false;
        sendBtn.textContent = 'Send link';
        showToast('⚠ ' + (err.message || 'Something went wrong. Please try again.'), 'error');
      }
    });
    // Allow Enter key in email input
    emailInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendBtn.click();
    });
  }
  function resetSendButton() {
    const sendBtn = document.getElementById('jd-save-send');
    if (!sendBtn) return;
    sendBtn.disabled = false;
    sendBtn.textContent = 'Send link';
    sendBtn.style.background = '';
  }
  // ── Boot ──────────────────────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    initSaveUI();
    checkForResumeToken();
  });
})();
