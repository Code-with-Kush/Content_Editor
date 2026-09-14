/**
 * ============================================================================
 * FILE: public/assets/ContentGenerator/js/input-security.js
 *
 * PURPOSE:
 * - Strip executable JavaScript payload patterns from the standalone content
 *   generator document before its legacy handlers consume user-entered values.
 *
 * STAMP: 2026-06-08
 * ============================================================================
 */
(function registerContentGeneratorInputSecurity() {
  var SANITIZABLE_TEXT_INPUT_TYPES = {
    '': true,
    email: true,
    search: true,
    tel: true,
    text: true,
    textarea: true,
    url: true
  };

  var JAVASCRIPT_ENTRY_PATTERNS = [
    { pattern: /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, replacement: '' },
    { pattern: /<\s*script\b[^>]*\/?\s*>/gi, replacement: '' },
    { pattern: /<\s*\/\s*script\s*>/gi, replacement: '' },
    { pattern: /\bon[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, replacement: '' },
    { pattern: /\bjavascript\s*:/gi, replacement: '' },
    { pattern: /\bvbscript\s*:/gi, replacement: '' },
    { pattern: /\bdata\s*:\s*text\/html/gi, replacement: '' },
    { pattern: /\bexpression\s*\(/gi, replacement: '(' }
  ];

  function sanitizePlainTextValue(value) {
    var normalizedValue = typeof value === 'string' ? value : value == null ? '' : String(value);

    return JAVASCRIPT_ENTRY_PATTERNS.reduce(function (sanitizedValue, entry) {
      return sanitizedValue.replace(entry.pattern, entry.replacement);
    }, normalizedValue);
  }

  /**
   * STAMP: 2026-06-08
   * The HTML slide composer keeps regular markup but removes script tags,
   * inline event handlers, and unsafe JavaScript-style URI payloads.
   */
  function sanitizeHtmlValue(value) {
    var template = document.createElement('template');
    template.innerHTML = typeof value === 'string' ? value : value == null ? '' : String(value);

    Array.prototype.slice.call(template.content.querySelectorAll('script')).forEach(function (node) {
      node.remove();
    });

    Array.prototype.slice.call(template.content.querySelectorAll('*')).forEach(function (element) {
      Array.prototype.slice.call(element.attributes).forEach(function (attribute) {
        var attributeName = (attribute.name || '').toLowerCase();
        var attributeValue = attribute.value || '';
        var isUnsafeEventAttribute = attributeName.indexOf('on') === 0;
        var isUnsafeUriAttribute =
          (attributeName === 'href' ||
            attributeName === 'src' ||
            attributeName === 'xlink:href' ||
            attributeName === 'formaction') &&
          /^(?:\s*javascript:|\s*vbscript:|\s*data:text\/html)/i.test(attributeValue);

        if (isUnsafeEventAttribute || isUnsafeUriAttribute) {
          element.removeAttribute(attribute.name);
        }
      });
    });

    return template.innerHTML;
  }

  function isSanitizableTarget(target) {
    if (!target || target.disabled || target.readOnly) return false;

    // STAMP: 2026-08-13 - The advanced ContentData editor must preserve raw
    // JSON exactly while the user types, cuts, copies, and pastes. It is never
    // executed here and its Apply action separately requires valid JSON.
    if (target.dataset && target.dataset.cgRawJson === 'true') return false;

    if (target.tagName === 'TEXTAREA') return true;

    if (target.tagName === 'INPUT') {
      return Boolean(SANITIZABLE_TEXT_INPUT_TYPES[(target.type || '').toLowerCase()]);
    }

    return false;
  }

  function getNextSanitizedValue(target) {
    if (target && target.dataset && target.dataset.cgHtmlInput === 'true') {
      return sanitizeHtmlValue(target.value);
    }

    return sanitizePlainTextValue(target.value);
  }

  function applySanitizedValue(target) {
    if (!isSanitizableTarget(target)) return;

    var nextValue = getNextSanitizedValue(target);
    if (nextValue === target.value) return;

    target.value = nextValue;
  }

  document.addEventListener(
    'input',
    function (event) {
      applySanitizedValue(event && event.target);
    },
    true
  );

  document.addEventListener(
    'change',
    function (event) {
      applySanitizedValue(event && event.target);
    },
    true
  );
})();
