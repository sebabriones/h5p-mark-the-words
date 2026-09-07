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
    taskDescriptionText: '#333333',
    questionFontSize: 1,
    taskDescriptionFontSize: 1,
    correctBackground: '#b6e4ce',
    correctText: '#255c41',
    correctBorder: '#255c41',
    wrongBackground: '#fbd7d8',
    wrongText: '#b71c1c',
    wrongBorder: '#b71c1c',
    missedBackground: '#b6e4ce',
    missedText: '#255c41',
    missedBorder: '#255c41'
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
    taskDescriptionText: '--mtw-task-description-color',
    correctBackground: '--mtw-correct-bg',
    correctText: '--mtw-correct-color',
    correctBorder: '--mtw-correct-border',
    wrongBackground: '--mtw-wrong-bg',
    wrongText: '--mtw-wrong-color',
    wrongBorder: '--mtw-wrong-border',
    missedBackground: '--mtw-missed-bg',
    missedText: '--mtw-missed-color',
    missedBorder: '--mtw-missed-border'
  };

  var CSS_EM_VAR_KEYS = {
    questionFontSize: '--mtw-question-font-size',
    taskDescriptionFontSize: '--mtw-task-description-font-size'
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

  function isTruthy(value) {
    return value === true || value === 1 || value === '1' || value === 'true';
  }

  function pickString(value, fallback) {
    return (value === undefined || value === null || value === '') ?
      fallback :
      String(value);
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
    var solid = pickString(group && group[options.solidKey], options.fallbackSolid);
    var gradient;
    var angle;
    var colorStart;
    var colorEnd;

    if (!isTruthy(group && group[useGradientKey])) {
      return solid;
    }

    gradient = (group && group[gradientKey]) || {};
    angle = normalizeAngle(gradient.angle, 180);
    colorStart = pickString(gradient.colorStart, solid);
    colorEnd = pickString(gradient.colorEnd, colorStart);

    return buildLinearGradient(angle, colorStart, colorEnd);
  }

  function readAppearanceFields(appearance) {
    var words = (appearance && appearance.wordColors) || {};
    var text = (appearance && appearance.textColors) || {};
    var correct = (appearance && appearance.correctColors) || {};
    var wrong = (appearance && appearance.wrongColors) || {};
    var missed = (appearance && appearance.missedColors) || {};

    return {
      playAreaBackground: appearance && appearance.playAreaBackground,
      wordBackground: resolveFill(words, {
        solidKey: 'background',
        fallbackSolid: APPEARANCE_DEFAULTS.wordBackground
      }),
      wordText: words.text,
      wordBorder: words.border,
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
      taskDescriptionText: text.taskDescription,
      questionFontSize: text.questionFontSize,
      taskDescriptionFontSize: text.taskDescriptionFontSize,
      correctBackground: correct.background,
      correctText: correct.text,
      correctBorder: correct.border,
      wrongBackground: wrong.background,
      wrongText: wrong.text,
      wrongBorder: wrong.border,
      missedBackground: missed.background,
      missedText: missed.text,
      missedBorder: missed.border
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
      if (Object.prototype.hasOwnProperty.call(fields, key) &&
          fields[key] !== undefined &&
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

    return merged;
  }

  function getCssVarValue(merged, key) {
    if (Object.prototype.hasOwnProperty.call(CSS_EM_VAR_KEYS, key)) {
      return toEm(merged[key], APPEARANCE_DEFAULTS[key]);
    }

    return merged[key];
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
    }

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

    apply();
    setTimeout(apply, 0);
    setTimeout(apply, 50);
    setTimeout(apply, 200);
  }

  function scheduleAppearance($container, appearance) {
    var apply = function () {
      applyAppearanceVars($container, appearance);
    };

    apply();
    setTimeout(apply, 0);
    setTimeout(apply, 50);
    setTimeout(apply, 200);
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
