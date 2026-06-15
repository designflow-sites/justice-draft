(function () {
  'use strict';

  const API_BASE = 'https://justice-draft-save-progress.vercel.app';

  // ── Collect all form field values ─────────────────────────────────────────
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

  // ── Restore saved form data ────────────────────────────────────────────────
  function restoreFormData(formData) {
    Object.entries(formData).forEach(function ([name, value]) {
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
      const radio = document.querySelector(
        '[data-form="multistep"] input[type="radio"][name="' + name + '"][value="' + value + '"]'
      );
      if (radio) {
        radio.checked = true;
        radio.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  }

  // ── Navigate to a specific step ───────────────────────────────────────────
  function goToStep(targetIndex) {
    const steps = document.querySelectorAll('[data-form="step"]');
    if (!steps.length) return;
    const index = Math.min(Math.max(targetIndex, 1), steps.length - 1);
    steps.forEach(function (step) { step.style.display = 'none'; });
    if (steps[index]) steps[index].style.display = '';
    document.querySelectorAll('[data-text="current-step"]').forEach(function (el) {
      el.textContent = index;
    });
    const progressBar = document.querySelector('[data-form="progress-indicator"]');
    if (progressBar && steps.length > 1) {
      progressBar.style.width = ((index) / (steps.length - 1) * 100) + '%';
    }
  }

  // ── Toast notification ────────────────────────────────────────────────────
  function showToast(message, type) {
    const existing = document.getElementById('jd-toast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'jd-toast';
    toast.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:' +
      (type === 'error' ? '#c0392b' : '#1a1a1a') +
      ';color:#fff;padding:12px 20px;border-radius:8px;font-size:14px;font-weight:500;z-index:99999;box-shadow:0 4px 16px rgba(0,0,0,0.18);transition:opacity 0.3s ease;max-width:90vw;text-align:center;';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 300);
    }, 4000);
  }

  // ── Open / close modal ────────────────────────────────────────────────────
  function openModal() {
    var panel = document.getElementById('jd-save-panel');
    if (panel) {
      panel.style.display = 'flex';
      panel.classList.add('is-open');
      var input = document.getElementById('jd-save-email');
      if (input) setTimeout(function () { input.focus(); }, 100);
    }
  }

  function closeModal() {
    var panel = document.getElementById('jd-save-panel');
    if (panel) {
      panel.classList.remove('is-open');
      // Give CSS transition time to finish before hiding
      setTimeout(function () {
        if (!panel.classList.contains('is-open')) {
          panel.style.display = 'none';
        }
      }, 300);
    }
    var input = document.getElementById('jd-save-email');
    if (input) input.value = '';
  }

  // ── Save progress ─────────────────────────────────────────────────────────
  async function handleSave(email) {
    const formData = collectFormData();
    const currentStep = getCurrentStep();
    const response = await fetch(API_BASE + '/api/save-progress', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, formData, currentStep }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Failed to save progress');
    return result;
  }

  // ── Resume from token ─────────────────────────────────────────────────────
  async function checkForResumeToken() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('resume');
    if (!token) return;
    try {
      const response = await fetch(API_BASE + '/api/get-progress?token=' + encodeURIComponent(token));
      const result = await response.json();
      if (!response.ok) {
        showToast('⚠ ' + (result.error || 'Unable to load your saved progress.'), 'error');
        return;
      }
      setTimeout(function () {
        restoreFormData(result.formData);
        goToStep(result.currentStep);
        showToast('✓ Your progress has been restored. Carry on from where you left off.', 'success');
      }, 600);
    } catch (err) {
      showToast('⚠ Unable to load your saved progress. Please try again.', 'error');
    }
  }

  // ── Wire everything up ────────────────────────────────────────────────────
  function init() {
    // Open modal when save triggers are clicked
    document.querySelectorAll('[data-save-trigger]').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        openModal();
      });
    });

    // Close on X button
    var cancelBtn = document.getElementById('jd-save-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', function (e) {
        e.preventDefault();
        closeModal();
      });
    }

    // Close on overlay click
    var overlay = document.getElementById('jd-save-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeModal);
    }

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeModal();
    });

    // Intercept the Webflow form submission
    var saveForm = document.getElementById('jd-save-panel');
    if (saveForm) {
      var form = saveForm.querySelector('form');
      if (form) {
        form.addEventListener('submit', async function (e) {
          e.preventDefault();
          e.stopPropagation();

          var emailInput = document.getElementById('jd-save-email');
          var sendBtn = document.getElementById('jd-save-send');
          var email = emailInput ? emailInput.value.trim() : '';

          if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            if (emailInput) emailInput.style.borderColor = '#e74c3c';
            return;
          }
          if (emailInput) emailInput.style.borderColor = '';

          if (sendBtn) {
            sendBtn.disabled = true;
            sendBtn.value = 'Sending…';
          }

          try {
            await handleSave(email);
            // Show Webflow success state
            if (form) form.style.display = 'none';
            var successMsg = saveForm.querySelector('.success-message, .w-form-done');
            if (successMsg) successMsg.style.display = 'block';
          } catch (err) {
            if (sendBtn) {
              sendBtn.disabled = false;
              sendBtn.value = 'Save Progress';
            }
            showToast('⚠ ' + (err.message || 'Something went wrong. Please try again.'), 'error');
          }
        });
      }
    }

    checkForResumeToken();
  }

  document.addEventListener('DOMContentLoaded', init);

})();
