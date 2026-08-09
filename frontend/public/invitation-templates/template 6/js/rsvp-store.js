/**
 * Shared RSVP Firestore store.
 * Uses collection "wedding-invites", document ID = wedding slug.
 */
(function () {
  'use strict';

  var COLLECTION = 'wedding-invites';
  var RESPONSE_SUBCOLLECTION = 'responses';

  function getDb() {
    return window.appDb || null;
  }

  function getFieldValue() {
    return typeof firebase !== 'undefined' && firebase.firestore && firebase.firestore.FieldValue
      ? firebase.firestore.FieldValue
      : null;
  }

  function trimString(value) {
    return typeof value === 'string' ? value.trim() : '';
  }

  function slugify(value) {
    return trimString(value)
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  function buildDisplayName(groomName, brideName) {
    var groom = trimString(groomName);
    var bride = trimString(brideName);
    if (groom && bride) return groom + ' & ' + bride;
    return groom || bride || '';
  }

  function normalizeInviteMeta(metaOrSlug) {
    if (typeof metaOrSlug === 'string') {
      return { slug: slugify(metaOrSlug) };
    }

    var meta = metaOrSlug || {};
    var groomName = trimString(meta.groomName);
    var brideName = trimString(meta.brideName);
    var slug = slugify(meta.slug || buildDisplayName(groomName, brideName));

    return {
      slug: slug,
      groomName: groomName,
      brideName: brideName,
      displayName: trimString(meta.displayName) || buildDisplayName(groomName, brideName),
      templateId: trimString(meta.templateId)
    };
  }

  function normalizeResponsePayload(payload) {
    var raw = payload || {};
    var attendance = raw.attendance === 'not_attending' ? 'not_attending' : 'attending';
    var guestCount = parseInt(raw.guestCount, 10);
    if (isNaN(guestCount)) guestCount = attendance === 'attending' ? 1 : 0;
    guestCount = attendance === 'attending'
      ? Math.max(1, Math.min(99, guestCount))
      : 0;

    return {
      guestName: trimString(raw.guestName),
      attendance: attendance,
      guestCount: guestCount,
      message: trimString(raw.message)
    };
  }

  function getInviteDocRef(slug) {
    var db = getDb();
    if (!db || !slug) return null;
    return db.collection(COLLECTION).doc(slug);
  }

  var ensuredInviteSlugs = {};

  function ensureInvite(metaOrSlug) {
    var meta = normalizeInviteMeta(metaOrSlug);
    var ref = getInviteDocRef(meta.slug);
    var FieldValue = getFieldValue();

    if (!ref || !meta.slug) {
      return Promise.reject(new Error('RSVP invite is missing a valid slug.'));
    }

    if (ensuredInviteSlugs[meta.slug]) {
      return Promise.resolve(meta);
    }

    return ref.get().then(function (doc) {
      var existing = doc.exists ? (doc.data() || {}) : {};
      var payload = {};
      var shouldWrite = !doc.exists;

      if (!existing.slug && meta.slug) {
        payload.slug = meta.slug;
        shouldWrite = true;
      }
      if (meta.displayName && meta.displayName !== existing.displayName) {
        payload.displayName = meta.displayName;
        shouldWrite = true;
      }
      if (meta.groomName && meta.groomName !== existing.groomName) {
        payload.groomName = meta.groomName;
        shouldWrite = true;
      }
      if (meta.brideName && meta.brideName !== existing.brideName) {
        payload.brideName = meta.brideName;
        shouldWrite = true;
      }
      if (meta.templateId && meta.templateId !== existing.templateId) {
        payload.templateId = meta.templateId;
        shouldWrite = true;
      }

      if (!shouldWrite) {
        ensuredInviteSlugs[meta.slug] = true;
        return meta;
      }

      payload.updatedAt = FieldValue ? FieldValue.serverTimestamp() : new Date();
      if (!doc.exists) {
        payload.createdAt = FieldValue ? FieldValue.serverTimestamp() : new Date();
      }

      return ref.set(payload, { merge: true }).then(function () {
        ensuredInviteSlugs[meta.slug] = true;
        return meta;
      });
    });
  }

  function submitResponse(metaOrSlug, payload) {
    var meta = normalizeInviteMeta(metaOrSlug);
    var response = normalizeResponsePayload(payload);
    var ref = getInviteDocRef(meta.slug);
    var FieldValue = getFieldValue();

    if (!ref || !meta.slug) {
      return Promise.reject(new Error('RSVP invite is missing a valid slug.'));
    }
    if (!response.guestName) {
      return Promise.reject(new Error('Guest name is required.'));
    }

    /* Write the response and ensure invite meta in parallel for faster UX. */
    var writeResponse = ref.collection(RESPONSE_SUBCOLLECTION).add({
      guestName: response.guestName,
      attendance: response.attendance,
      guestCount: response.guestCount,
      message: response.message,
      submittedAt: FieldValue ? FieldValue.serverTimestamp() : new Date()
    });

    return Promise.all([writeResponse, ensureInvite(meta)]).then(function (results) {
      return results[0];
    });
  }

  function fetchInvite(metaOrSlug) {
    var meta = normalizeInviteMeta(metaOrSlug);
    var ref = getInviteDocRef(meta.slug);

    if (!ref || !meta.slug) {
      return Promise.reject(new Error('RSVP invite is missing a valid slug.'));
    }

    return ref.get().then(function (doc) {
      var data = doc.exists ? doc.data() || {} : {};
      return {
        slug: meta.slug,
        groomName: trimString(data.groomName) || meta.groomName || '',
        brideName: trimString(data.brideName) || meta.brideName || '',
        displayName: trimString(data.displayName) || meta.displayName || buildDisplayName(data.groomName, data.brideName) || meta.slug,
        templateId: trimString(data.templateId) || meta.templateId || '',
        exists: doc.exists
      };
    });
  }

  function fetchResponses(slug) {
    var ref = getInviteDocRef(slug);
    if (!ref || !slug) {
      return Promise.reject(new Error('RSVP invite is missing a valid slug.'));
    }

    return ref.collection(RESPONSE_SUBCOLLECTION).get().then(function (snapshot) {
      var responses = [];
      snapshot.forEach(function (doc) {
        var data = doc.data() || {};
        responses.push({
          id: doc.id,
          guestName: trimString(data.guestName),
          attendance: data.attendance === 'not_attending' ? 'not_attending' : 'attending',
          guestCount: typeof data.guestCount === 'number' ? data.guestCount : 0,
          message: trimString(data.message),
          submittedAt: data.submittedAt && typeof data.submittedAt.toDate === 'function'
            ? data.submittedAt.toDate()
            : (data.submittedAt ? new Date(data.submittedAt) : null)
        });
      });

      responses.sort(function (a, b) {
        var aTime = a.submittedAt instanceof Date && !isNaN(a.submittedAt.getTime()) ? a.submittedAt.getTime() : 0;
        var bTime = b.submittedAt instanceof Date && !isNaN(b.submittedAt.getTime()) ? b.submittedAt.getTime() : 0;
        return bTime - aTime;
      });

      return responses;
    });
  }

  function summarizeResponses(responses) {
    var attending = [];
    var notAttending = [];
    var totalAttendance = 0;

    (responses || []).forEach(function (response) {
      if (response.attendance === 'not_attending') {
        notAttending.push(response);
        return;
      }

      totalAttendance += response.guestCount || 0;
      attending.push(response);
    });

    return {
      totalAttendance: totalAttendance,
      notAttendingCount: notAttending.length,
      attendingResponses: attending.length,
      attending: attending,
      notAttending: notAttending
    };
  }

  function fetchInviteDashboard(metaOrSlug) {
    var meta = normalizeInviteMeta(metaOrSlug);
    if (!meta.slug) {
      return Promise.reject(new Error('RSVP invite is missing a valid slug.'));
    }

    return fetchInvite(meta)
      .then(function (invite) {
        if (!invite.exists && (meta.groomName || meta.brideName || meta.displayName || meta.templateId)) {
          return ensureInvite(meta).then(function () {
            return fetchInvite(meta);
          });
        }
        return invite;
      })
      .then(function (invite) {
        return Promise.all([Promise.resolve(invite), fetchResponses(meta.slug)]);
      })
      .then(function (results) {
        var invite = results[0];
        var responses = results[1];
        return {
          invite: invite,
          responses: responses,
          summary: summarizeResponses(responses)
        };
      });
  }

  function subscribeInviteDashboard(metaOrSlug, onData, onError) {
    var meta = normalizeInviteMeta(metaOrSlug);
    var ref = getInviteDocRef(meta.slug);
    var unsubs = [];
    var currentInvite = null;
    var currentResponses = [];

    if (!ref || !meta.slug) {
      if (typeof onError === 'function') {
        onError(new Error('RSVP invite is missing a valid slug.'));
      }
      return function () {};
    }

    function emit() {
      if (typeof onData !== 'function') return;
      onData({
        invite: currentInvite || {
          slug: meta.slug,
          groomName: meta.groomName || '',
          brideName: meta.brideName || '',
          displayName: meta.displayName || buildDisplayName(meta.groomName, meta.brideName) || meta.slug,
          templateId: meta.templateId || '',
          exists: false
        },
        responses: currentResponses.slice(),
        summary: summarizeResponses(currentResponses)
      });
    }

    function mapInvite(doc) {
      var data = doc.exists ? doc.data() || {} : {};
      return {
        slug: meta.slug,
        groomName: trimString(data.groomName) || meta.groomName || '',
        brideName: trimString(data.brideName) || meta.brideName || '',
        displayName: trimString(data.displayName) || meta.displayName || buildDisplayName(data.groomName, data.brideName) || meta.slug,
        templateId: trimString(data.templateId) || meta.templateId || '',
        exists: doc.exists
      };
    }

    function mapResponses(snapshot) {
      var responses = [];
      snapshot.forEach(function (doc) {
        var data = doc.data() || {};
        responses.push({
          id: doc.id,
          guestName: trimString(data.guestName),
          attendance: data.attendance === 'not_attending' ? 'not_attending' : 'attending',
          guestCount: typeof data.guestCount === 'number' ? data.guestCount : 0,
          message: trimString(data.message),
          submittedAt: data.submittedAt && typeof data.submittedAt.toDate === 'function'
            ? data.submittedAt.toDate()
            : (data.submittedAt ? new Date(data.submittedAt) : null)
        });
      });

      responses.sort(function (a, b) {
        var aTime = a.submittedAt instanceof Date && !isNaN(a.submittedAt.getTime()) ? a.submittedAt.getTime() : 0;
        var bTime = b.submittedAt instanceof Date && !isNaN(b.submittedAt.getTime()) ? b.submittedAt.getTime() : 0;
        return bTime - aTime;
      });

      return responses;
    }

    ensureInvite(meta)
      .then(function () {
        unsubs.push(ref.onSnapshot(function (doc) {
          currentInvite = mapInvite(doc);
          emit();
        }, function (error) {
          if (typeof onError === 'function') onError(error);
        }));

        unsubs.push(ref.collection(RESPONSE_SUBCOLLECTION).onSnapshot(function (snapshot) {
          currentResponses = mapResponses(snapshot);
          emit();
        }, function (error) {
          if (typeof onError === 'function') onError(error);
        }));
      })
      .catch(function (error) {
        if (typeof onError === 'function') onError(error);
      });

    return function unsubscribe() {
      unsubs.forEach(function (unsub) {
        if (typeof unsub === 'function') unsub();
      });
    };
  }

  function clearInviteResponses(metaOrSlug) {
    var meta = normalizeInviteMeta(metaOrSlug);
    var ref = getInviteDocRef(meta.slug);

    if (!ref || !meta.slug) {
      return Promise.reject(new Error('RSVP invite is missing a valid slug.'));
    }

    function clearBatch() {
      return ref.collection(RESPONSE_SUBCOLLECTION).limit(200).get().then(function (snapshot) {
        if (snapshot.empty) return;

        var batch = getDb().batch();
        snapshot.forEach(function (doc) {
          batch.delete(doc.ref);
        });

        return batch.commit().then(clearBatch);
      });
    }

    return clearBatch().then(function () {
      var FieldValue = getFieldValue();
      return ref.set({
        updatedAt: FieldValue ? FieldValue.serverTimestamp() : new Date()
      }, { merge: true });
    });
  }

  window.RsvpStore = {
    COLLECTION: COLLECTION,
    RESPONSE_SUBCOLLECTION: RESPONSE_SUBCOLLECTION,
    slugify: slugify,
    normalizeInviteMeta: normalizeInviteMeta,
    normalizeResponsePayload: normalizeResponsePayload,
    ensureInvite: ensureInvite,
    submitResponse: submitResponse,
    fetchInvite: fetchInvite,
    fetchResponses: fetchResponses,
    fetchInviteDashboard: fetchInviteDashboard,
    subscribeInviteDashboard: subscribeInviteDashboard,
    clearInviteResponses: clearInviteResponses
  };
})();
