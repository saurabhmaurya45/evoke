/**
 * Shared RSVP form controller.
 */
(function () {
  'use strict';

  function byId(id) {
    return id ? document.getElementById(id) : null;
  }

  function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function sanitizeGuestCount(value) {
    var digits = String(value || '').replace(/\D/g, '').slice(0, 2);
    if (!digits) return '';
    var count = parseInt(digits, 10);
    if (isNaN(count)) return '';
    count = Math.max(1, Math.min(99, count));
    return String(count);
  }

  function setGuestCount(input, value) {
    if (!input) return;
    var next = sanitizeGuestCount(value);
    input.value = next || '1';
  }

  function init(config) {
    var options = config || {};
    var form = byId(options.formId);
    if (!form) return null;

    var wishesMode = options.mode === 'wishes';
    var guestsWrap = byId(options.guestsWrapId);
    var reasonWrap = byId(options.reasonWrapId);
    var guestsInput = byId(options.guestsInputId);
    var reasonInput = byId(options.reasonInputId);
    var decreaseBtn = byId(options.decreaseBtnId);
    var increaseBtn = byId(options.increaseBtnId);
    var thanks = byId(options.thanksId);
    var thanksText = byId(options.thanksTextId);
    var nameInput = byId(options.nameInputId);
    var submitButton = byId(options.submitButtonId) || form.querySelector('button[type="submit"]');
    var attendanceInputs = form.querySelectorAll(options.attendanceSelector || 'input[name="attendance"]');
    var hiddenClass = options.hiddenClass || 'is-hidden';
    var visibleClass = options.visibleClass || 'is-visible';
    var declineThankYou = options.declineThankYou || "Thank you for letting us know. We'll miss celebrating with you and hope to see you soon.";

    function showGuests() {
      if (guestsWrap) {
        guestsWrap.hidden = false;
        guestsWrap.classList.add(visibleClass);
      }
      if (reasonWrap) {
        reasonWrap.classList.remove(visibleClass);
        reasonWrap.hidden = true;
      }
      if (reasonInput) reasonInput.value = '';
      setGuestCount(guestsInput, guestsInput && guestsInput.value ? guestsInput.value : '1');
    }

    function showReason() {
      if (guestsWrap) {
        guestsWrap.classList.remove(visibleClass);
        guestsWrap.hidden = true;
      }
      if (reasonWrap) {
        reasonWrap.hidden = false;
        reasonWrap.classList.add(visibleClass);
      }
    }

    if (wishesMode) {
      if (reasonWrap) {
        reasonWrap.hidden = false;
        reasonWrap.classList.add(visibleClass);
      }
    } else {
      Array.prototype.forEach.call(attendanceInputs, function (input) {
        input.addEventListener('change', function () {
          if (!input.checked) return;
          if (input.value === 'yes') showGuests();
          if (input.value === 'no') showReason();
        });
      });

      if (guestsInput) {
        guestsInput.addEventListener('input', function () {
          guestsInput.value = sanitizeGuestCount(guestsInput.value);
        });

        guestsInput.addEventListener('blur', function () {
          setGuestCount(guestsInput, guestsInput.value);
        });
      }

      if (decreaseBtn) {
        decreaseBtn.addEventListener('click', function () {
          var current = parseInt((guestsInput && guestsInput.value) || '1', 10);
          if (isNaN(current)) current = 1;
          setGuestCount(guestsInput, Math.max(1, current - 1));
        });
      }

      if (increaseBtn) {
        increaseBtn.addEventListener('click', function () {
          var current = parseInt((guestsInput && guestsInput.value) || '1', 10);
          if (isNaN(current)) current = 1;
          setGuestCount(guestsInput, Math.min(99, current + 1));
        });
      }

      var checkedAttendance = currentAttendance();
      if (checkedAttendance) {
        if (checkedAttendance.value === 'yes') showGuests();
        if (checkedAttendance.value === 'no') showReason();
      }
    }

    function setSubmitting(isSubmitting) {
      if (!submitButton) return;
      submitButton.disabled = !!isSubmitting;
      if (!submitButton.dataset.originalLabel) {
        submitButton.dataset.originalLabel = submitButton.textContent;
      }
      submitButton.textContent = isSubmitting ? 'Sending...' : submitButton.dataset.originalLabel;
    }

    function currentAttendance() {
      return form.querySelector((options.attendanceSelector || 'input[name="attendance"]') + ':checked');
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();

      var inviteMeta = typeof options.getInviteMeta === 'function' ? options.getInviteMeta() : null;
      var name = nameInput ? trimString(nameInput.value) : '';
      var wish = reasonInput ? trimString(reasonInput.value) : '';
      var submitResponse = options.submitResponse
        || (window.RsvpStore && window.RsvpStore.submitResponse);

      if (!name) {
        if (nameInput) nameInput.focus();
        return;
      }

      if (!submitResponse) {
        window.alert('RSVP service is not available right now. Please try again later.');
        return;
      }

      var payload;
      var triggerHearts = false;
      var successMessage;

      if (wishesMode) {
        if (!wish) {
          if (reasonInput) reasonInput.focus();
          return;
        }

        payload = {
          guestName: name,
          attendance: 'attending',
          guestCount: 1,
          message: wish
        };
        triggerHearts = true;
        successMessage = typeof options.getSuccessMessage === 'function'
          ? options.getSuccessMessage(payload, inviteMeta)
          : 'Thank you for your response!';
      } else {
        var attending = currentAttendance();
        if (!attending) return;

        payload = {
          guestName: name,
          attendance: attending.value === 'no' ? 'not_attending' : 'attending',
          guestCount: attending.value === 'yes' ? parseInt((guestsInput && guestsInput.value) || '1', 10) : 0,
          message: attending.value === 'no' ? wish : ''
        };
        triggerHearts = attending.value === 'yes';
        successMessage = attending.value === 'no'
          ? declineThankYou
          : (typeof options.getSuccessMessage === 'function'
            ? options.getSuccessMessage(payload, inviteMeta)
            : 'Thank you for your response!');
      }

      setSubmitting(true);

      function showThanks() {
        if (triggerHearts && typeof options.onAttendYes === 'function') {
          options.onAttendYes();
        }

        form.classList.add(hiddenClass);
        if (thanks) {
          thanks.hidden = false;
          thanks.classList.remove('is-animating-in');
          void thanks.offsetWidth;
          thanks.classList.add('is-animating-in');
        }
        if (thanksText) {
          thanksText.textContent = successMessage;
        }
      }

      function restoreForm() {
        form.classList.remove(hiddenClass);
        if (thanks) {
          thanks.hidden = true;
          thanks.classList.remove('is-animating-in');
        }
      }

      /* Show success immediately; keep saving in the background. */
      showThanks();

      Promise.resolve(submitResponse(inviteMeta, payload))
        .catch(function (error) {
          console.warn('RSVP submit failed:', error);
          restoreForm();
          window.alert(error && error.message
            ? error.message
            : 'Something went wrong while saving your RSVP. Please try again.');
        })
        .then(function () {
          setSubmitting(false);
        });
    });

    return {
      showGuests: showGuests,
      showReason: showReason
    };
  }

  window.RsvpForm = {
    init: init,
    sanitizeGuestCount: sanitizeGuestCount
  };
})();
