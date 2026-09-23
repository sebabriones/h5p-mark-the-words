var H5P = H5P || {};
H5P.MarkTheWordsCFRD = H5P.MarkTheWordsCFRD || {};

/**
 * Activity appearance defaults and CSS custom properties for Mark the Words CFRD.
 */
(function () {
  var APPEARANCE_DEFAULTS = {
    playAreaBackground: '#ffffff',
    wordBackground: 'transparent',
    wordText: '#333333',
    wordBorder: 'transparent',
    wordHoverBackground: '#ffffff',
    wordHoverText: '#333333',
    wordHoverBorder: '#1a73d9',
    wordSelectedBackground: '#cee0f4',
    wordSelectedText: '#333333',
    wordSelectedBorder: '#388eff',
    questionText: '#333333',
    contextText: '#555555',
    questionFontSize: 1,
    questionLineHeight: 1.7,
    contextFontSize: 1,
    contextLineHeight: 1.5,
    correctBackground: '#b6e4ce',
    correctText: '#255c41',
    correctBorder: '#255c41',
    wrongBackground: '#fbd7d8',
    wrongText: '#b71c1c',
    wrongBorder: '#b71c1c',
    missedBackground: '#b6e4ce',
    missedText: '#255c41',
    missedBorder: '#255c41',
    feedbackIconsShow: true,
    feedbackIconCorrectColor: '#255c41',
    feedbackIconWrongColor: '#b71c1c',
    feedbackIconSize: 1
  };

  var CSS_VAR_KEYS = {
    playAreaBackground: '--mtw-play-area-bg',
    wordBackground: '--mtw-word-bg',
    wordText: '--mtw-word-color',
    wordBorder: '--mtw-word-border',
    wordHoverBackground: '--mtw-word-hover-bg',
    wordHoverText: '--mtw-word-hover-color',
    wordHoverBorder: '--mtw-word-hover-border',
    wordSelectedBackground: '--mtw-word-selected-bg',
    wordSelectedText: '--mtw-word-selected-color',
    wordSelectedBorder: '--mtw-word-selected-border',
    questionText: '--mtw-question-color',
    contextText: '--mtw-context-color',
    correctBackground: '--mtw-correct-bg',
    correctText: '--mtw-correct-color',
    correctBorder: '--mtw-correct-border',
    wrongBackground: '--mtw-wrong-bg',
    wrongText: '--mtw-wrong-color',
    wrongBorder: '--mtw-wrong-border',
    missedBackground: '--mtw-missed-bg',
    missedText: '--mtw-missed-color',
    missedBorder: '--mtw-missed-border',
    feedbackIconCorrectColor: '--mtw-feedback-icon-correct-color',
    feedbackIconWrongColor: '--mtw-feedback-icon-wrong-color'
  };

  var CSS_EM_VAR_KEYS = {
    questionFontSize: '--mtw-question-font-size',
    contextFontSize: '--mtw-context-font-size',
    feedbackIconSize: '--mtw-feedback-icon-size'
  };

  var CSS_UNITLESS_VAR_KEYS = {
    questionLineHeight: '--mtw-question-line-height',
    contextLineHeight: '--mtw-context-line-height'
  };

  function toEm(value, fallback) {
    var num = (value !== undefined && value !== null && value !== '') ?
      Number(value) :
      Number(fallback);

    if (isNaN(num)) {
      num = Number(fallback);
    }

    return num + 'em';
  }

  function toUnitless(value, fallback) {
    var num = (value !== undefined && value !== null && value !== '') ?
      Number(value) :
      Number(fallback);

    if (isNaN(num)) {
      num = Number(fallback);
    }

    return String(num);
  }

  function isTruthy(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function pickString(value, fallback) {
    return (value === undefined || value === null || value === '') ?
      fallback :
      String(value);
  }

  /**
   * Empty / transparent / alpha-0 → use fallback.
   * ColorSelector preferredFormat hex turns transparent into #000000 on save;
   * that legacy case is handled only where opt-in (word background / border).
   */
  function isTransparentLike(value) {
    var normalized;
    var alphaMatch;

    if (value === undefined || value === null || value === '') {
      return true;
    }

    normalized = String(value).trim().toLowerCase();

    if (normalized === 'transparent' ||
        normalized === '#00000000' ||
        normalized === '#0000') {
      return true;
    }

    alphaMatch = normalized.match(/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (alphaMatch) {
      return alphaMatch[1] !== undefined && Number(alphaMatch[1]) === 0;
    }

    alphaMatch = normalized.match(/^hsla?\(\s*[\d.]+\s*,\s*[\d.%]+\s*,\s*[\d.%]+\s*(?:,\s*([\d.]+)\s*)?\)$/);
    if (alphaMatch) {
      return alphaMatch[1] !== undefined && Number(alphaMatch[1]) === 0;
    }

    return false;
  }

  function isLegacyTransparentBlack(value) {
    var normalized;

    if (value === undefined || value === null || value === '') {
      return false;
    }

    normalized = String(value).trim().toLowerCase();
    return normalized === '#000000' || normalized === '#000';
  }

  function coerceSurfaceColor(value, fallback, treatSolidBlackAsTransparent) {
    if (isTransparentLike(value)) {
      return fallback;
    }

    if (treatSolidBlackAsTransparent && isLegacyTransparentBlack(value)) {
      return fallback;
    }

    return pickString(value, fallback);
  }

  /**
   * Missing key → library fallback. Explicit empty / transparent → transparent
   * (so the author can clear hover/selected backgrounds).
   */
  function resolveAuthorColor(group, solidKey, fallbackSolid, treatSolidBlackAsTransparent) {
    var raw;

    if (!group || !Object.prototype.hasOwnProperty.call(group, solidKey)) {
      return fallbackSolid;
    }

    raw = group[solidKey];

    if (isTransparentLike(raw) ||
        (treatSolidBlackAsTransparent && isLegacyTransparentBlack(raw))) {
      return 'transparent';
    }

    return String(raw);
  }

  function normalizeAngle(value, fallback) {
    var normalized = parseInt(value, 10);

    if (isNaN(normalized)) {
      normalized = fallback;
    }

    return Math.max(0, Math.min(360, normalized));
  }

  function buildLinearGradient(angle, colorStart, colorEnd) {
    return 'linear-gradient(' + angle + 'deg, ' + colorStart + ', ' + colorEnd + ')';
  }

  function resolveFill(group, options) {
    var useGradientKey = options.useGradientKey || 'useGradientBackground';
    var gradientKey = options.gradientKey || 'gradientBackground';
    var treatBlack = options.treatSolidBlackAsTransparent === true;
    var solid = resolveAuthorColor(
      group,
      options.solidKey,
      options.fallbackSolid,
      treatBlack
    );
    var gradient;
    var angle;
    var colorStart;
    var colorEnd;

    if (!isTruthy(group && group[useGradientKey])) {
      return solid;
    }

    gradient = (group && group[gradientKey]) || {};
    angle = normalizeAngle(gradient.angle, 180);
    colorStart = Object.prototype.hasOwnProperty.call(gradient, 'colorStart') ?
      resolveAuthorColor(gradient, 'colorStart', solid, treatBlack) :
      solid;
    colorEnd = Object.prototype.hasOwnProperty.call(gradient, 'colorEnd') ?
      resolveAuthorColor(gradient, 'colorEnd', colorStart, treatBlack) :
      colorStart;

    return buildLinearGradient(angle, colorStart, colorEnd);
  }

  function readAppearanceFields(appearance) {
    var words = (appearance && appearance.wordColors) || {};
    var text = (appearance && appearance.textColors) || {};
    var correct = (appearance && appearance.correctColors) || {};
    var wrong = (appearance && appearance.wrongColors) || {};
    var missed = (appearance && appearance.missedColors) || {};
    var icons = (appearance && appearance.feedbackIcons) || {};

    return {
      playAreaBackground: appearance && appearance.playAreaBackground,
      wordBackground: resolveFill(words, {
        solidKey: 'background',
        fallbackSolid: APPEARANCE_DEFAULTS.wordBackground,
        treatSolidBlackAsTransparent: true
      }),
      wordText: words.text,
      wordBorder: Object.prototype.hasOwnProperty.call(words, 'border') ?
        resolveAuthorColor(words, 'border', 'transparent', true) :
        APPEARANCE_DEFAULTS.wordBorder,
      wordHoverBackground: resolveFill(words, {
        solidKey: 'hoverBackground',
        useGradientKey: 'useHoverGradientBackground',
        gradientKey: 'hoverGradientBackground',
        fallbackSolid: APPEARANCE_DEFAULTS.wordHoverBackground
      }),
      wordHoverText: words.hoverText,
      wordHoverBorder: words.hoverBorder,
      wordSelectedBackground: resolveFill(words, {
        solidKey: 'selectedBackground',
        useGradientKey: 'useSelectedGradientBackground',
        gradientKey: 'selectedGradientBackground',
        fallbackSolid: APPEARANCE_DEFAULTS.wordSelectedBackground
      }),
      wordSelectedText: words.selectedText,
      wordSelectedBorder: words.selectedBorder,
      questionText: text.question,
      contextText: text.context,
      questionFontSize: text.questionFontSize,
      questionLineHeight: text.questionLineHeight,
      contextFontSize: text.contextFontSize,
      contextLineHeight: text.contextLineHeight,
      correctBackground: correct.background,
      correctText: correct.text,
      correctBorder: correct.border,
      wrongBackground: wrong.background,
      wrongText: wrong.text,
      wrongBorder: wrong.border,
      missedBackground: missed.background,
      missedText: missed.text,
      missedBorder: missed.border,
      feedbackIconsShow: icons.show,
      feedbackIconCorrectColor: icons.correctColor,
      feedbackIconWrongColor: icons.wrongColor,
      feedbackIconSize: icons.size
    };
  }

  function mergeAppearance(appearance) {
    var merged = {};
    var key;
    var fields = readAppearanceFields(appearance);

    for (key in APPEARANCE_DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(APPEARANCE_DEFAULTS, key)) {
        merged[key] = APPEARANCE_DEFAULTS[key];
      }
    }

    for (key in fields) {
      if (!Object.prototype.hasOwnProperty.call(fields, key)) {
        continue;
      }

      if (key === 'feedbackIconsShow') {
        if (fields[key] !== undefined && fields[key] !== null && fields[key] !== '') {
          merged[key] = isTruthy(fields[key]);
        }
        continue;
      }

      if (fields[key] !== undefined &&
          fields[key] !== null &&
          fields[key] !== '') {
        merged[key] = fields[key];
      }
    }

    if (!fields.wordHoverText) {
      merged.wordHoverText = merged.wordText;
    }

    if (!fields.wordSelectedText) {
      merged.wordSelectedText = merged.wordText;
    }

    if (!fields.feedbackIconCorrectColor) {
      merged.feedbackIconCorrectColor = merged.correctText;
    }

    if (!fields.feedbackIconWrongColor) {
      merged.feedbackIconWrongColor = merged.wrongText;
    }

    return merged;
  }

  function getCssVarValue(merged, key) {
    if (Object.prototype.hasOwnProperty.call(CSS_EM_VAR_KEYS, key)) {
      return toEm(merged[key], APPEARANCE_DEFAULTS[key]);
    }

    if (Object.prototype.hasOwnProperty.call(CSS_UNITLESS_VAR_KEYS, key)) {
      return toUnitless(merged[key], APPEARANCE_DEFAULTS[key]);
    }

    return merged[key];
  }

  function applyFeedbackIconsVisibility($container, show) {
    var visible = show !== false;
    var i;
    var el;

    if (!$container || !$container.length) {
      return;
    }

    for (i = 0; i < $container.length; i++) {
      el = $container[i];

      if (!el || !el.classList) {
        continue;
      }

      if (visible) {
        el.classList.remove('h5p-mtw-feedback-icons-hidden');
      }
      else {
        el.classList.add('h5p-mtw-feedback-icons-hidden');
      }
    }
  }

  function applyAppearanceVars($container, appearance) {
    var merged = mergeAppearance(appearance);
    var key;
    var i;
    var el;

    if (!$container || !$container.length) {
      return merged;
    }

    for (i = 0; i < $container.length; i++) {
      el = $container[i];

      if (!el || !el.style) {
        continue;
      }

      for (key in CSS_VAR_KEYS) {
        if (Object.prototype.hasOwnProperty.call(CSS_VAR_KEYS, key)) {
          el.style.setProperty(CSS_VAR_KEYS[key], getCssVarValue(merged, key));
        }
      }

      for (key in CSS_EM_VAR_KEYS) {
        if (Object.prototype.hasOwnProperty.call(CSS_EM_VAR_KEYS, key)) {
          el.style.setProperty(CSS_EM_VAR_KEYS[key], getCssVarValue(merged, key));
        }
      }

      for (key in CSS_UNITLESS_VAR_KEYS) {
        if (Object.prototype.hasOwnProperty.call(CSS_UNITLESS_VAR_KEYS, key)) {
          el.style.setProperty(CSS_UNITLESS_VAR_KEYS[key], getCssVarValue(merged, key));
        }
      }
    }

    applyFeedbackIconsVisibility($container, merged.feedbackIconsShow);

    return merged;
  }

  function applyPlayAreaRootBackground($root, appearance) {
    var merged = mergeAppearance(appearance);
    var i;
    var el;
    var bg = merged.playAreaBackground;

    if (!$root || !$root.length) {
      return merged;
    }

    for (i = 0; i < $root.length; i++) {
      el = $root[i];

      if (!el || !el.style) {
        continue;
      }

      el.style.setProperty('--mtw-play-area-bg', bg);
      el.style.backgroundColor = bg;
    }

    return merged;
  }

  function schedulePlayAreaRootBackground($root, appearance) {
    var apply = function () {
      applyPlayAreaRootBackground($root, appearance);
    };

    // Immediate + one short retry (covers late DOM from Question/CP). Avoid 4× style storms.
    apply();
    setTimeout(apply, 50);
  }

  function scheduleAppearance($container, appearance) {
    var apply = function () {
      applyAppearanceVars($container, appearance);
    };

    apply();
    setTimeout(apply, 50);
  }

  H5P.MarkTheWordsCFRD.Appearance = {
    APPEARANCE_DEFAULTS: APPEARANCE_DEFAULTS,
    mergeAppearance: mergeAppearance,
    applyAppearanceVars: applyAppearanceVars,
    applyPlayAreaRootBackground: applyPlayAreaRootBackground,
    scheduleAppearance: scheduleAppearance,
    schedulePlayAreaRootBackground: schedulePlayAreaRootBackground
  };
})();
