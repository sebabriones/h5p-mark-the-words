/*global H5P*/

var H5P = H5P || {};

/**
 * Keep helpers out of the global scope (shared names collide in CP editor).
 */
(function () {
/**
 * @param {*} value
 * @returns {boolean}
 */
function isTruthy(value) {
  return value === true || value === 1 || value === '1' || value === 'true';
}

/**
 * @param {H5P.MarkTheWordsCFRD} instance
 * @returns {Object|null}
 */
function getInstructionsOptions(instance) {
  var instructions = instance && instance.params && instance.params.instructions;
  var text;

  if (!instructions || !isTruthy(instructions.enabled)) {
    return null;
  }

  text = (instructions.text === undefined || instructions.text === null) ?
    '' :
    String(instructions.text).trim();

  if (!text) {
    return null;
  }

  return {
    id: instance.contentId || instance.id,
    text: text,
    displayMode: instructions.displayMode || 'both',
    introButtonLabel: instructions.introButtonLabel || 'Start',
    tabButtonLabel: instructions.tabButtonLabel || 'Instructions',
    tabButtonLabelOpen: instructions.tabButtonLabelOpen,
    appearance: H5P.jQuery.extend(true, {}, instructions.appearance || {}),
    animation: H5P.jQuery.extend(true, {}, instructions.animation || {}),
    startCollapsed: instructions.startCollapsed === undefined ?
      true :
      isTruthy(instructions.startCollapsed)
  };
}

/**
 * @param {H5P.MarkTheWordsCFRD} instance
 * @returns {boolean}
 */
function isEmbeddedInstance(instance) {
  return !!(instance && typeof instance.isRoot === 'function' && !instance.isRoot());
}

/**
 * @param {H5P.MarkTheWordsCFRD} instance
 * @param {H5P.jQuery} $fallbackContainer
 */
function scheduleInstructionsAttach(instance, $fallbackContainer) {
  if (isEmbeddedInstance(instance)) {
    return;
  }

  [0, 200, 500].forEach(function (delay) {
    setTimeout(function () {
      var instructions = getInstructionsOptions(instance);
      var $target = (instance.$playArea && instance.$playArea.length) ?
        instance.$playArea :
        ((instance.$instructionsTarget && instance.$instructionsTarget.length) ?
          instance.$instructionsTarget :
          $fallbackContainer);
      var attached;

      if (!instructions || !$target || !$target.length) {
        return;
      }

      if (
        $target.find('.h5p-instructions-root').length ||
        ($target.parent().length && $target.parent().children('.h5p-instructions-root').length)
      ) {
        instance.trigger('resize');
        return;
      }

      if (H5P.Instructions && typeof H5P.Instructions.attach === 'function') {
        attached = H5P.Instructions.attach($target, instructions);

        if (attached) {
          instance.trigger('resize');
        }
      }
    }, delay);
  });
}

/**
 * @param {H5P.MarkTheWordsCFRD} instance
 */
function refreshInstructionsScale(instance) {
  var instructions = getInstructionsOptions(instance);
  var $target = (instance.$playArea && instance.$playArea.length) ?
    instance.$playArea :
    ((instance.$instructionsTarget && instance.$instructionsTarget.length) ?
      instance.$instructionsTarget :
      null);

  if (!instructions || !$target || !$target.length) {
    return;
  }

  if (H5P.Instructions && typeof H5P.Instructions.updateScale === 'function') {
    H5P.Instructions.updateScale($target, instructions);
  }
}

/**
 * Wrap activity content in an inner play area; keep evaluation footer outside flex 16:9.
 *
 * @param {H5P.jQuery} $container
 * @returns {H5P.jQuery}
 */
function setupPlayAreaLayout($container) {
  var $ = H5P.jQuery;
  var $playArea = $container.children('.h5p-mtw-play-area').first();
  var playAreaSelectors = [
    '.h5p-question-content'
  ];

  if (!$playArea.length) {
    $playArea = $('<div>', { 'class': 'h5p-mtw-play-area' });
    $container.prepend($playArea);
  }

  playAreaSelectors.forEach(function (selector) {
    $container.children(selector).appendTo($playArea);
  });

  bindPlayAreaWheelContainment($playArea[0]);

  return $playArea;
}

/**
 * True if point lies inside an element box.
 *
 * @param {number} x
 * @param {number} y
 * @param {DOMRect} rect
 * @returns {boolean}
 */
function pointInRect(x, y, rect) {
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

/**
 * Find a visible Mark the Words play area under the pointer.
 * Course Presentation often delivers wheel to `.h5p-presentation-wrapper`
 * (hit-test bypasses the play area), so we resolve by geometry instead.
 *
 * @param {number} x
 * @param {number} y
 * @returns {HTMLElement|null}
 */
function findPlayAreaUnderPoint(x, y) {
  var nodes = document.querySelectorAll('.h5p-mtw-play-area');
  var i;
  var el;
  var rect;

  for (i = 0; i < nodes.length; i++) {
    el = nodes[i];
    rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) {
      continue;
    }
    if (pointInRect(x, y, rect)) {
      return el;
    }
  }

  return null;
}

/** Wheel delta scale (less than 1 = softer steps). */
var MTW_WHEEL_SCALE = 0.45;
/** Lerp factor per animation frame toward the target scrollTop. */
var MTW_WHEEL_LERP = 0.22;

/**
 * Normalize wheel deltaY to CSS pixels.
 *
 * @param {WheelEvent} event
 * @param {HTMLElement} playArea
 * @returns {number}
 */
function getWheelDeltaPixels(event, playArea) {
  var delta = event.deltaY;

  if (event.deltaMode === 1) {
    delta *= 16;
  }
  else if (event.deltaMode === 2) {
    delta *= playArea.clientHeight || 1;
  }

  return delta * MTW_WHEEL_SCALE;
}

/**
 * Animate play-area scrollTop toward its pending target.
 *
 * @param {HTMLElement} playArea
 */
function animatePlayAreaScroll(playArea) {
  var target;
  var current;
  var next;

  if (!playArea || playArea._mtwWheelRaf) {
    return;
  }

  playArea._mtwWheelRaf = window.requestAnimationFrame(function step() {
    target = playArea._mtwWheelTarget;
    current = playArea.scrollTop;

    if (typeof target !== 'number' || Math.abs(target - current) < 0.5) {
      if (typeof target === 'number') {
        playArea.scrollTop = target;
      }
      playArea._mtwWheelRaf = 0;
      return;
    }

    next = current + (target - current) * MTW_WHEEL_LERP;
    playArea.scrollTop = next;
    playArea._mtwWheelRaf = window.requestAnimationFrame(step);
  });
}

/**
 * Forward wheel to the play area under the pointer (document capture).
 * Needed inside Course Presentation where the event target is the slide wrapper.
 * Uses scaled delta + short lerp so the motion feels less abrupt.
 *
 * @param {HTMLElement|null} playAreaEl
 */
function bindPlayAreaWheelContainment(playAreaEl) {
  if (playAreaEl) {
    playAreaEl._mtwWheelBound = true;
  }

  if (window._mtwDocWheelBound) {
    return;
  }

  window._mtwDocWheelBound = true;
  document.addEventListener('wheel', function (event) {
    var playArea;
    var maxScroll;
    var deltaY;
    var base;
    var next;

    playArea = findPlayAreaUnderPoint(event.clientX, event.clientY);
    if (!playArea) {
      return;
    }

    deltaY = getWheelDeltaPixels(event, playArea);
    if (!deltaY) {
      return;
    }

    maxScroll = playArea.scrollHeight - playArea.clientHeight;
    if (maxScroll <= 1) {
      return;
    }

    base = (typeof playArea._mtwWheelTarget === 'number') ?
      playArea._mtwWheelTarget :
      playArea.scrollTop;
    next = Math.min(maxScroll, Math.max(0, base + deltaY));
    if (next === playArea.scrollTop && next === playArea._mtwWheelTarget) {
      return;
    }

    playArea._mtwWheelTarget = next;
    animatePlayAreaScroll(playArea);
    event.preventDefault();
    event.stopPropagation();
  }, { passive: false, capture: true });
}

/**
 * @param {string} html
 * @returns {string}
 */
function stripHtmlText(html) {
  var decoder = document.createElement('div');
  decoder.innerHTML = html || '';
  return (decoder.textContent || decoder.innerText || '').replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
}

/**
 * @param {object} context
 * @returns {boolean}
 */
function hasContextText(context) {
  return !!(context && context.text && stripHtmlText(context.text));
}

/**
 * @param {object} context
 * @returns {boolean}
 */
function hasContextImage(context) {
  var media = context && context.media;
  var type = media && media.type;
  return !!(type && type.library && type.params && type.params.file);
}

/**
 * @param {object} context
 * @returns {string|null}
 */
function getContextLayoutClass(context) {
  var hasText = hasContextText(context);
  var hasImage = hasContextImage(context);

  if (!hasText && !hasImage) {
    return null;
  }

  if (hasText && hasImage) {
    return 'h5p-mtw-context--both';
  }

  if (hasText) {
    return 'h5p-mtw-context--text-only';
  }

  return 'h5p-mtw-context--image-only';
}

/**
 * @param {object} context
 * @param {number} contentId
 * @param {H5P.jQuery} $container
 */
function attachContextImage(context, contentId, $container) {
  var media = context && context.media;
  var library = media && media.type;

  if (!library || !library.library || !$container || !$container.length) {
    return;
  }

  H5P.newRunnable(library, contentId, $container);
}

/**
 * Attach context image after the play area is in the DOM.
 *
 * @param {H5P.MarkTheWordsCFRD} instance
 */
function scheduleContextImageAttach(instance) {
  var pending = instance.pendingContextImage;

  if (!pending || !pending.$container || !pending.$container.length) {
    return;
  }

  [0, 50, 200].forEach(function (delay) {
    setTimeout(function () {
      if (!pending.$container || !pending.$container.length) {
        return;
      }

      if (pending.$container.children().length) {
        return;
      }

      attachContextImage(pending.context, instance.contentId, pending.$container);
    }, delay);
  });
}

/**
 * Migrate legacy top-level media (image above question) to context.media.
 *
 * @param {object} params
 */
function migrateMediaToContext(params) {
  var media;
  var library;

  if (!params || params.context || !params.media) {
    return;
  }

  media = params.media;
  if (!media.type) {
    delete params.media;
    return;
  }

  library = media.type;
  if (library && library.library && library.library.indexOf('H5P.Image') === 0) {
    params.context = {
      media: {
        type: library,
        disableImageZooming: media.disableImageZooming || false
      }
    };
  }

  delete params.media;
}

/**
 * Normalize overallFeedback array → CFRD object with popup colors.
 *
 * @param {object} params
 */
function migrateOverallFeedback(params) {
  if (!params) {
    return;
  }

  if (Array.isArray(params.overallFeedback)) {
    params.overallFeedback = {
      popupBackgroundColor: '#ffffff',
      feedbackTextColor: '#333333',
      feedbackBodyFontSize: 1,
      feedbackCloseIconSize: 1.2,
      overallFeedback: params.overallFeedback
    };
    return;
  }

  if (params.overallFeedback && typeof params.overallFeedback === 'object') {
    if (!params.overallFeedback.popupBackgroundColor) {
      params.overallFeedback.popupBackgroundColor = '#ffffff';
    }
    if (!params.overallFeedback.feedbackTextColor) {
      params.overallFeedback.feedbackTextColor = '#333333';
    }
    if (params.overallFeedback.feedbackBodyFontSize == null) {
      params.overallFeedback.feedbackBodyFontSize = 1;
    }
    if (params.overallFeedback.feedbackCloseIconSize == null) {
      params.overallFeedback.feedbackCloseIconSize = 1.2;
    }
  }
}

/**
 * Move inline scorebar/feedback out of the play area.
 *
 * @param {H5P.jQuery} $container
 */
function normalizeInlineEvaluationLayout($container) {
  var $ = H5P.jQuery;
  var $playArea = $container.children('.h5p-mtw-play-area').first();
  var $feedback;
  var $scorebar;
  var $buttons;

  if (!$playArea.length) {
    return;
  }

  $playArea.children('.h5p-question-feedback:not(.h5p-question-popup)').appendTo($container);
  $playArea.children('.h5p-question-scorebar').appendTo($container);

  $feedback = $container.children('.h5p-question-feedback:not(.h5p-question-popup)');
  $scorebar = $container.children('.h5p-question-scorebar');
  $buttons = $container.children('.h5p-question-buttons');

  if ($scorebar.length && $buttons.length) {
    $scorebar.insertBefore($buttons);
  }

  if ($feedback.length && $scorebar.length) {
    $feedback.insertBefore($scorebar);
  }
  else if ($feedback.length && $buttons.length) {
    $feedback.insertBefore($buttons);
  }
}

/**
 * @param {H5P.jQuery} $container
 * @param {H5P.MarkTheWordsCFRD} [instance]
 */
function scheduleInlineEvaluationLayout($container, instance) {
  [0, 50, 160, 350].forEach(function (delay) {
    setTimeout(function () {
      if ($container && $container.length) {
        normalizeInlineEvaluationLayout($container);

        // Avoid resize storms while the slide/play area is hidden (e.g. Course Presentation).
        if (instance && typeof instance.trigger === 'function' &&
            instance.$playArea && instance.$playArea.length &&
            instance.$playArea.is(':visible')) {
          instance.trigger('resize');
        }
      }
    }, delay);
  });
}

/**
 * One-shot deferred resize batch (attach / first layout). Concurrent calls are ignored.
 *
 * @param {H5P.MarkTheWordsCFRD} instance
 */
function scheduleDeferredResize(instance) {
  var delays;
  var remaining;

  if (!instance || instance._mtwDeferredResizePending) {
    return;
  }

  instance._mtwDeferredResizePending = true;
  delays = [50, 150, 350];
  remaining = 2 + delays.length;

  var done = function () {
    remaining -= 1;
    if (remaining <= 0) {
      instance._mtwDeferredResizePending = false;
    }
  };

  var fire = function () {
    if (typeof instance.trigger === 'function') {
      instance.trigger('resize');
    }
    done();
  };

  requestAnimationFrame(function () {
    fire();
    requestAnimationFrame(fire);
  });

  delays.forEach(function (delay) {
    setTimeout(fire, delay);
  });
}

/**
 * Single retry when resize arrives while the play area is not visible.
 * Prevents unbounded setTimeout/rAF chains in embedded Course Presentation slides.
 *
 * @param {H5P.MarkTheWordsCFRD} instance
 */
function scheduleHiddenResizeRetry(instance) {
  if (!instance || instance._mtwHiddenResizeScheduled) {
    return;
  }

  instance._mtwHiddenResizeScheduled = true;
  setTimeout(function () {
    instance._mtwHiddenResizeScheduled = false;
    if (instance.$playArea && instance.$playArea.length &&
        instance.$playArea.is(':visible') &&
        typeof instance.trigger === 'function') {
      instance.trigger('resize');
    }
  }, 200);
}

var PlayArea = H5P.MarkTheWordsCFRD && H5P.MarkTheWordsCFRD.PlayArea;
var AppearanceModule = H5P.MarkTheWordsCFRD && H5P.MarkTheWordsCFRD.Appearance;
var SavedWord = H5P.MarkTheWordsCFRD && H5P.MarkTheWordsCFRD.Word;
var SavedXapiGenerator = H5P.MarkTheWordsCFRD && H5P.MarkTheWordsCFRD.XapiGenerator;

/**
 * @param {H5P.MarkTheWordsCFRD} instance
 */
function applyActivityAppearance(instance) {
  var appearance;

  if (!AppearanceModule || !instance) {
    return;
  }

  appearance = instance.params && instance.params.appearance;

  // Vars on root + play area so line-height/colors inherit reliably.
  if (instance.$container && instance.$container.length) {
    AppearanceModule.scheduleAppearance(instance.$container, appearance);
    AppearanceModule.schedulePlayAreaRootBackground(instance.$container, appearance);
  }

  if (instance.$playArea && instance.$playArea.length) {
    AppearanceModule.scheduleAppearance(instance.$playArea, appearance);
  }
}

/**
 * @param {H5P.MarkTheWordsCFRD} instance
 */
function applyActionButtonAppearance(instance) {
  var actionButtons = instance.params &&
    instance.params.appearance &&
    instance.params.appearance.actionButtons;

  if (!actionButtons || typeof instance.setActionButtonAppearance !== 'function') {
    return;
  }

  if (H5P.QuestionCFRD.hasActionButtonAppearance &&
      H5P.QuestionCFRD.hasActionButtonAppearance(actionButtons)) {
    instance.setActionButtonAppearance(actionButtons);
  }
}

﻿/*global H5P*/

/**
 * Mark The Words module
 * @external {jQuery} $ H5P.jQuery
 */
H5P.MarkTheWordsCFRD = (function ($, Question, Word, KeyboardNav, XapiGenerator) {
  /**
   * Initialize module.
   *
   * @class H5P.MarkTheWordsCFRD
   * @extends H5P.QuestionCFRD
   * @param {Object} params Behavior settings
   * @param {Number} contentId Content identification
   * @param {Object} contentData Object containing task specific content data
   *
   * @returns {Object} MarkTheWords Mark the words instance
   */
  function MarkTheWords(params, contentId, contentData) {
    this.contentId = contentId;
    this.contentData = contentData;

    Question.call(this, 'mark-the-words');

    // Set default behavior.
    this.params = $.extend(true, {
      context: {},
      textField: "This is a *nice*, *flexible* content type.",
      overallFeedback: {
        popupBackgroundColor: '#ffffff',
        feedbackTextColor: '#333333',
        feedbackBodyFontSize: 1,
        feedbackCloseIconSize: 1.2,
        overallFeedback: []
      },
      behaviour: {
        enableRetry: true,
        enableSolutionsButton: true,
        enableCheckButton: true,
        showScorePoints: true,
        selectionMode: 'all',
        caseSensitive: false,
        penalizeWrongSelections: false,
        limitSelections: false,
        selectionLimitOptions: {
          maxSelections: 1,
          dimBlockedWords: false
        }
      },
      checkAnswerButton: "Check",
      submitAnswerButton: "Submit",
      tryAgainButton: "Retry",
      showSolutionButton: "Show solution",
      feedbackPopupCloseLabel: "Close",
      showFeedbackButtonLabel: "Show feedback",
      correctAnswer: "Correct!",
      incorrectAnswer: "Incorrect!",
      missedAnswer: "Correct answer not selected",
      displaySolutionDescription:  "Task is updated to contain the solution.",
      scoreBarLabel: 'You got :num out of :total points',
      a11yFullTextLabel: 'Full readable text',
      a11yClickableTextLabel: 'Full text where words can be marked',
      a11ySolutionModeHeader: 'Solution mode',
      a11yCheckingHeader: 'Checking mode',
      a11yCheck: 'Check the answers. The responses will be marked as correct, incorrect, or unanswered.',
      a11yShowSolution: 'Show the solution. The task will be marked with its correct solution.',
      a11yRetry: 'Retry the task. Reset all responses and start the task over again.',
      instructions: {},
      appearance: {}
    }, params);

    migrateMediaToContext(this.params);
    migrateOverallFeedback(this.params);

    this.contentData = contentData;
    if (this.contentData !== undefined && this.contentData.previousState !== undefined) {
      this.previousState = this.contentData.previousState;
    }

    this.keyboardNavigators = [];
    this.playAreaSize = PlayArea ? PlayArea.getDesignSize() : null;

    this.initMarkTheWords();
    this.XapiGenerator = new XapiGenerator(this);

    var self = this;

    // Tras Check, QuestionCFRD inserta la scorebar junto al content (dentro del play-area).
    var originalSetFeedback = self.setFeedback;
    if (typeof originalSetFeedback === 'function') {
      self.setFeedback = function (content, score, maxScore, scoreBarLabel, helpText, popupSettings) {
        var result = originalSetFeedback.apply(self, arguments);

        // Siempre reubicar scorebar fuera del play area; el popup se excluye en normalize.
        if (self.$container && self.$container.length) {
          scheduleInlineEvaluationLayout(self.$container, self);
        }

        return result;
      };
    }

    var originalAttach = self.attach;
    self.attach = function ($container) {
      self.$container = $container;
      originalAttach.call(self, $container);
      self.$playArea = setupPlayAreaLayout($container);
      scheduleContextImageAttach(self);
      scheduleInstructionsAttach(self, self.$playArea);

      if (window.ResizeObserver && !self.playAreaResizeObserver && self.$playArea.length) {
        self.playAreaResizeObserver = new ResizeObserver(function () {
          if (self._mtwIgnoreResizeObserver) {
            return;
          }
          if (!self.$playArea || !self.$playArea.length || !self.$playArea.is(':visible')) {
            return;
          }
          self.trigger('resize');
        });
        self.playAreaResizeObserver.observe(self.$playArea[0]);
      }

      scheduleDeferredResize(self);
      applyActivityAppearance(self);
      applyActionButtonAppearance(self);
      scheduleInlineEvaluationLayout($container, self);
    };

    self.on('resize', function (event) {
      if (event && event.data && event.data.repositionOnly) {
        return;
      }

      var design = self.playAreaSize;
      var rootEl;
      var layout;
      var fontSize;
      var scaleKey;
      var scaleChanged;

      if (!self.$playArea || !self.$playArea.length || !PlayArea || !design) {
        return;
      }

      if (!self.$playArea.is(':visible')) {
        scheduleHiddenResizeRetry(self);
        return;
      }

      rootEl = (self.$container && self.$container.length) ?
        self.$container[0] :
        self.$playArea[0];
      layout = PlayArea.getLayoutDimensions(rootEl);
      scaleKey = layout.scale.toFixed(4);
      fontSize = layout.fontSize + 'px';
      scaleChanged = self._mtwLastScaleKey !== scaleKey;

      self._mtwIgnoreResizeObserver = true;

      if (self.$container && self.$container.length) {
        self.$container.css({
          width: layout.widthPx,
          maxWidth: '100%',
          height: layout.heightPx
        });
      }

      self.$playArea.css({
        width: '100%',
        height: '',
        fontSize: fontSize,
        '--mtw-scale': scaleKey
      });

      // Appearance CSS vars only when scale changes (or first layout).
      if (scaleChanged) {
        self._mtwLastScaleKey = scaleKey;
        applyActivityAppearance(self);
        refreshInstructionsScale(self);
      }

      requestAnimationFrame(function () {
        self._mtwIgnoreResizeObserver = false;
      });
    });

    // Release ResizeObserver if the host tears down the question instance.
    if (typeof self.remove === 'function') {
      var originalRemove = self.remove;
      self.remove = function () {
        if (self.playAreaResizeObserver) {
          self.playAreaResizeObserver.disconnect();
          self.playAreaResizeObserver = null;
        }
        return originalRemove.apply(self, arguments);
      };
    }
    else {
      self.remove = function () {
        if (self.playAreaResizeObserver) {
          self.playAreaResizeObserver.disconnect();
          self.playAreaResizeObserver = null;
        }
      };
    }
  }

  MarkTheWords.prototype = Object.create(H5P.QuestionCFRD.prototype);
  MarkTheWords.prototype.constructor = MarkTheWords;

  /**
   * Initialize Mark The Words task
   */
  MarkTheWords.prototype.initMarkTheWords = function () {
    this.$inner = $('<div class="h5p-word-inner"></div>');

    this.addTaskTo(this.$inner);

    // Set user state
    this.setH5PUserState();
  };

  /**
   * Recursive function that creates html for the words
   * @method createHtmlForWords
   * @param  {Array}           nodes Array of dom nodes
   * @return {string}
   */
  MarkTheWords.prototype.createHtmlForWords = function (nodes) {
    var self = this;
    var html = '';
    var candidatesOnly = !!(self.params.behaviour &&
      self.params.behaviour.selectionMode === 'candidatesOnly');

    /**
     * Collapse doubled marker chars for detection (** / ++).
     * @param {string} wordString
     * @param {string} marker
     * @returns {string}
     */
    function removeDoubleMarkers(wordString, marker) {
      var index = wordString.indexOf(marker);
      var sliced = wordString;

      while (index !== -1) {
        if (wordString.indexOf(marker, index + 1) === index + 1) {
          sliced = wordString.slice(0, index) + wordString.slice(index + 2);
        }
        index = wordString.indexOf(marker, index + 1);
      }

      return sliced;
    }

    /**
     * Whether the token is wrapped as a selectable candidate marker.
     * @param {string} entry
     * @param {string} marker
     * @returns {boolean}
     */
    function isWrappedByMarker(entry, marker) {
      var wordString = removeDoubleMarkers(entry, marker);

      if (wordString.charAt(0) !== marker || wordString.length <= 2) {
        return false;
      }

      return wordString.charAt(wordString.length - 1) === marker ||
        wordString.charAt(wordString.length - 2) === marker;
    }

    /**
     * Strip wrapping marker and collapse doubled escapes (~~ → ~).
     * Used for locked plain text (~…~) so markers never show in the player.
     * @param {string} entry
     * @param {string} marker
     * @returns {string}
     */
    function stripMarkerForDisplay(entry, marker) {
      var wordString = removeDoubleMarkers(entry, marker);
      var content = entry;

      if (wordString.charAt(0) === marker && wordString.length > 2) {
        if (wordString.charAt(wordString.length - 1) === marker) {
          content = entry.slice(1, entry.length - 1);
        }
        else if (wordString.charAt(wordString.length - 2) === marker) {
          content = entry.slice(1, entry.length - 2);
        }
      }

      var index = content.indexOf(marker);
      while (index !== -1) {
        content = content.slice(0, index) + content.slice(index + 1);
        index = content.indexOf(marker, index + 1);
      }

      return content;
    }

    /**
     * In all-words modes every token is selectable except ~…~ (locked plain text).
     * In candidates-only mode, only *…* and +…+ become options.
     * @param {string} entry
     * @returns {boolean}
     */
    function shouldBeSelectable(entry) {
      if (isWrappedByMarker(entry, '~')) {
        return false;
      }

      if (!candidatesOnly) {
        return true;
      }

      return isWrappedByMarker(entry, '*') || isWrappedByMarker(entry, '+');
    }

    /**
     * Plain-text rendering for non-selectable tokens (strip lock markers).
     * @param {string} entry
     * @returns {string}
     */
    function plainTokenHtml(entry) {
      var text = entry;
      if (isWrappedByMarker(entry, '~')) {
        text = stripMarkerForDisplay(entry, '~');
      }
      return self.escapeHTML(text);
    }

    for (var i = 0; i < nodes.length; i++) {
      var node = nodes[i];

      if (node instanceof Text) {
        var text = $(node).text();
        var selectableStrings = H5P.MarkTheWordsCFRD.splitSelectableTokens(
          text.replace(/(&nbsp;|\r\n|\n|\r)/g, ' ')
        );

        if (selectableStrings) {
          selectableStrings.forEach(function (entry) {
            entry = entry.trim();

            // Words
            if (html) {
              // Add space before
              html += ' ';
            }

            // Remove prefix punctuations from word
            var prefix = entry.match(/^[\[\({⟨¿¡“"«„]+/);
            var start = 0;
            if (prefix !== null) {
              start = prefix[0].length;
              html += prefix;
            }

            // Remove suffix punctuations from word
            var suffix = entry.match(/[",….:;?!\]\)}⟩»”]+$/);
            var end = entry.length - start;
            if (suffix !== null) {
              end -= suffix[0].length;
            }

            // Word
            entry = entry.substr(start, end);
            if (entry.length) {
              if (shouldBeSelectable(entry)) {
                html += '<span class="h5p-word-selectable" role="option" aria-selected="false">' +
                  self.escapeHTML(entry) + '</span>';
              }
              else {
                html += plainTokenHtml(entry);
              }
            }

            if (suffix !== null) {
              html += suffix;
            }
          });
        }
        else if ((selectableStrings !== null) && text.length) {
          if (shouldBeSelectable(text)) {
            html += '<span class="h5p-word-selectable" role="option" aria-selected="false">' +
              this.escapeHTML(text) + '</span>';
          }
          else {
            html += plainTokenHtml(text);
          }
        }
      }
      else {
        if (node.nodeName === 'BR') {
          html += '<br/>';
        }
        else {
          var attributes = ' ';
          for (var j = 0; j < node.attributes.length; j++) {
            attributes +=node.attributes[j].name + '="' + node.attributes[j].nodeValue + '" ';
          }
          html += '<' + node.nodeName +  attributes + '>';
          html += self.createHtmlForWords(node.childNodes);
          html += '</' + node.nodeName + '>';
        }
      }
    }

    return html;
  };

  /**
   * Escapes HTML
   *
   * @param html
   * @returns {jQuery}
   */
  MarkTheWords.prototype.escapeHTML = function (html) {
    return $('<div>').text(html).html();
  };

  /**
   * Search for the last children in every paragraph and
   * return their indexes in an array
   *
   * @returns {Array}
   */
  MarkTheWords.prototype.getIndexesOfLineBreaks = function () {

    var indexes = [];
    var selectables = this.$wordContainer.find('span.h5p-word-selectable');

    selectables.each(function (index, selectable) {
      if ($(selectable).next().is('br')) {
        indexes.push(index);
      }

      if ($(selectable).parent('p') && !$(selectable).parent().is(':last-child') && $(selectable).is(':last-child')) {
        indexes.push(index);
      }
    });

    return indexes;
  };

  /**
   * Handle task and add it to container.
   * @param {jQuery} $container The object which our task will attach to.
   */
  MarkTheWords.prototype.addTaskTo = function ($container) {
    var self = this;
    self.selectableWords = [];
    self.answers = 0;

    self.$a11yLabelId = 'mark-the-words-aria-label-' + self.contentId;

    // Wrapper
    var $wordContainer = $('<div/>', {
      'class': 'h5p-word-selectable-words h5p-theme-lines' +
        (self.params.behaviour.selectionMode === 'candidatesOnly' ?
          ' h5p-mtw-selection-candidates-only' : ''),
      'aria-labelledby': self.$a11yLabelId,
      'aria-multiselectable': 'true',
      'role': 'listbox',
      html: self.createHtmlForWords($.parseHTML(self.params.textField))
    });

    let isNewParagraph = true;
    $wordContainer.find('[role="option"], br').each(function () {
      if ($(this).is('br')) {
        isNewParagraph = true;
        return;
      }

      if (isNewParagraph) {
        // Add keyboard navigation helper
        self.currentKeyboardNavigator = new KeyboardNav();

        // on word clicked
        self.currentKeyboardNavigator.on('select', function () {
          self.isAnswered = true;
          self.triggerXAPI('interacted');
          self.updateSelectionLimitUi();
        });

        self.keyboardNavigators.push(self.currentKeyboardNavigator);
        isNewParagraph = false;
      }
      self.currentKeyboardNavigator.addElement(this);

      // Add keyboard navigation to this element
      var selectableWord = new Word($(this), self.params);
      if (selectableWord.isAnswer()) {
        self.answers += 1;
      }
      self.selectableWords.push(selectableWord);
    });

    // Selection limit applies across all paragraphs / navigators
    if (self.isSelectionLimitEnabled()) {
      var selectionGuard = function () {
        return self.getSelectedCount() < self.getMaxSelections();
      };
      self.keyboardNavigators.forEach(function (navigator) {
        navigator.setSelectionGuard(selectionGuard);
      });
    }

    // Unique-word mode: max score is one point per distinct correct text.
    if (self.isUniqueWordScoring()) {
      self.answers = Object.keys(self.getUniqueAnswerGroups()).length;
    }

    self.blankIsCorrect = (self.answers === 0);
    if (self.blankIsCorrect) {
      self.answers = 1;
    }

    // A11y full readable text
    const $ariaTextWrapper = $('<div>', {
      'class': 'hidden-but-read',
    }).appendTo($container);
    $('<div>', {
      html: self.params.a11yFullTextLabel,
    }).appendTo($ariaTextWrapper);

    // Add space after each paragraph to read the sentences better
    const ariaText = $('<div>', {
      'html': $wordContainer.html().replace('</p>', ' </p>'),
    }).text();

    $('<div>', {
      text: ariaText,
    }).appendTo($ariaTextWrapper);

    // A11y clickable list label
    this.$a11yClickableTextLabel = $('<div>', {
      id: self.$a11yLabelId,
      'class': 'hidden-but-read',
      html: self.params.a11yClickableTextLabel,
      tabIndex: '-1',
    }).appendTo($container);

    $wordContainer.appendTo($container);
    self.$wordContainer = $wordContainer;
  };

  /**
   * Add check solution and retry buttons.
   */
  MarkTheWords.prototype.addButtons = function () {
    var self = this;
    self.$buttonContainer = $('<div/>', {
      'class': 'h5p-button-bar'
    });

    if (this.params.behaviour.enableCheckButton) {
      this.addButton('check-answer', this.params.checkAnswerButton, function () {
        self.isAnswered = true;
        var answers = self.calculateScore();
        self.feedbackSelectedWords();

        if (!self.showEvaluation(answers)) {
          // Only show if a correct answer was not found.
          if (self.params.behaviour.enableSolutionsButton && (answers.correct < self.answers)) {
            self.showButton('show-solution');
          }
          if (self.params.behaviour.enableRetry) {
            self.showButton('try-again');
          }
        }
        // Set focus to start of text
        self.$a11yClickableTextLabel.html(self.params.a11yCheckingHeader + ' - ' + self.params.a11yClickableTextLabel);
        self.$a11yClickableTextLabel.focus();

        self.hideButton('check-answer');
        self.trigger(self.XapiGenerator.generateAnsweredEvent());
        self.toggleSelectable(true);
      }, true, {
        'aria-label': this.params.a11yCheck,
      }, {
        contentData: this.contentData,
        textIfSubmitting: this.params.submitAnswerButton,
        icon: 'check'
      });
    }

    this.addButton(
      'show-solution',
      this.params.showSolutionButton,
      function () {
        self.setAllMarks();

        self.$a11yClickableTextLabel.html(self.params.a11ySolutionModeHeader + ' - ' + self.params.a11yClickableTextLabel);
        self.$a11yClickableTextLabel.focus();

        if (self.params.behaviour.enableRetry) {
          self.showButton('try-again');
        }
        self.hideButton('check-answer');
        self.hideButton('show-solution');

        self.read(self.params.displaySolutionDescription);
        self.toggleSelectable(true);
      },
      false,
      {
        'aria-label': this.params.a11yShowSolution,
      },
      {
        icon: 'show-results',
        styleType:'secondary'
      }
    );

    this.addButton(
      'try-again',
      this.params.tryAgainButton,
      this.resetTask.bind(this),
      false,
      {
        'aria-label': this.params.a11yRetry,
      },
      {
        icon: 'retry',
        styleType: 'secondary'
      }
    );

    this.addButton(
      'show-feedback',
      this.params.showFeedbackButtonLabel || 'Show feedback',
      function () {
        var answers = self.calculateScore();
        self.showEvaluation(answers);
        self.hideButton('show-feedback');
      },
      false,
      {},
      {
        icon: 'show-results',
        styleType: 'secondary'
      }
    );
    this.hideButton('show-feedback');
  };

  /**
   * Toggle whether words can be selected
   * @param {Boolean} disable
   */
  MarkTheWords.prototype.toggleSelectable = function (disable) {
    this.keyboardNavigators.forEach(function (navigator) {
      if (disable) {
        navigator.disableSelectability();
        navigator.removeAllTabbable();
      }
      else {
        navigator.enableSelectability();
        navigator.setTabbableAt((0));
      }
    });

    if (disable) {
      this.$wordContainer.removeAttr('aria-multiselectable').removeAttr('role');
      this.clearSelectionLimitUi();
    }
    else {
      this.$wordContainer.attr('aria-multiselectable', 'true')
        .attr('role', 'listbox');
      this.updateSelectionLimitUi();
    }
  };

  /**
   * Whether the author enabled a maximum number of simultaneous selections.
   *
   * @returns {boolean}
   */
  MarkTheWords.prototype.isSelectionLimitEnabled = function () {
    return !!(this.params.behaviour && this.params.behaviour.limitSelections);
  };

  /**
   * Selection-limit sub-options (nested group, with flat maxSelections fallback).
   *
   * @returns {Object}
   */
  MarkTheWords.prototype.getSelectionLimitOptions = function () {
    var behaviour = this.params.behaviour || {};
    var options = behaviour.selectionLimitOptions || {};
    return {
      maxSelections: options.maxSelections != null ?
        options.maxSelections : behaviour.maxSelections,
      dimBlockedWords: !!options.dimBlockedWords
    };
  };

  /**
   * Maximum words selectable at once when the limit is enabled.
   *
   * @returns {number}
   */
  MarkTheWords.prototype.getMaxSelections = function () {
    var max = parseInt(this.getSelectionLimitOptions().maxSelections, 10);
    return (isNaN(max) || max < 1) ? 1 : max;
  };

  /**
   * Whether blocked words should be visually dimmed at the selection limit.
   *
   * @returns {boolean}
   */
  MarkTheWords.prototype.shouldDimBlockedWords = function () {
    return this.isSelectionLimitEnabled() &&
      !!this.getSelectionLimitOptions().dimBlockedWords;
  };

  /**
   * Count currently selected selectable words.
   *
   * @returns {number}
   */
  MarkTheWords.prototype.getSelectedCount = function () {
    var count = 0;
    if (!this.selectableWords) {
      return 0;
    }
    this.selectableWords.forEach(function (word) {
      if (word.isSelected()) {
        count++;
      }
    });
    return count;
  };

  /**
   * Remove selection-limit visual lock classes.
   */
  MarkTheWords.prototype.clearSelectionLimitUi = function () {
    if (!this.$wordContainer) {
      return;
    }
    this.$wordContainer
      .removeClass('h5p-mtw-at-selection-limit')
      .removeClass('h5p-mtw-dim-blocked');
    this.$wordContainer.find('[role="option"]').removeClass('h5p-mtw-selection-blocked');
  };

  /**
   * When at the selection limit, lock unselected words (optional dimming).
   */
  MarkTheWords.prototype.updateSelectionLimitUi = function () {
    if (!this.$wordContainer || !this.isSelectionLimitEnabled()) {
      this.clearSelectionLimitUi();
      return;
    }

    var atLimit = this.getSelectedCount() >= this.getMaxSelections();
    var dimBlocked = this.shouldDimBlockedWords();

    this.$wordContainer.toggleClass('h5p-mtw-at-selection-limit', atLimit);
    this.$wordContainer.toggleClass('h5p-mtw-dim-blocked', atLimit && dimBlocked);

    this.$wordContainer.find('[role="option"]').each(function () {
      var $el = $(this);
      var selected = $el.attr('aria-selected') === 'true';
      $el.toggleClass('h5p-mtw-selection-blocked', atLimit && !selected);
    });
  };

  /**
   * Get Xapi Data.
   *
   * @see used in contracts {@link https://h5p.org/documentation/developers/contracts#guides-header-6}
   * @return {Object}
   */
  MarkTheWords.prototype.getXAPIData = function () {
    return {
      statement: this.XapiGenerator.generateAnsweredEvent().data.statement
    };
  };

  /**
   * Whether scoring groups identical correct answers as one point.
   *
   * @returns {boolean}
   */
  MarkTheWords.prototype.isUniqueWordScoring = function () {
    return !!(this.params.behaviour &&
      this.params.behaviour.selectionMode === 'allUniqueWord');
  };

  /**
   * Normalize answer text for unique-word grouping.
   *
   * @param {string} text
   * @returns {string}
   */
  MarkTheWords.prototype.normalizeAnswerKey = function (text) {
    var value = String(text || '');
    var behaviour = this.params.behaviour || {};
    var uniqueOpts = behaviour.uniqueWordOptions;
    // Flat field (current) with compat for the brief nested group shape.
    var caseSensitive = !!(behaviour.caseSensitive ||
      (uniqueOpts && uniqueOpts.caseSensitive));
    if (!caseSensitive) {
      return value.toLowerCase();
    }
    return value;
  };

  /**
   * Group correct answers by normalized text and whether any instance is selected.
   *
   * @returns {Object.<string, {covered: boolean, words: Array}>}
   */
  MarkTheWords.prototype.getUniqueAnswerGroups = function () {
    var self = this;
    var groups = {};

    self.selectableWords.forEach(function (word) {
      if (!word.isAnswer()) {
        return;
      }

      var key = self.normalizeAnswerKey(word.getAnswerText());
      if (!groups[key]) {
        groups[key] = {
          covered: false,
          words: []
        };
      }
      groups[key].words.push(word);
      if (word.isSelected()) {
        groups[key].covered = true;
      }
    });

    return groups;
  };

  /**
   * Apply unique-word feedback.
   * Check: covered → correct; wrong selections → incorrect; uncovered → unmarked.
   * Show solution: also reveal uncovered as “not selected”.
   *
   * @param {boolean} [withScorePoints]
   * @param {boolean} [revealUncovered]
   */
  MarkTheWords.prototype.applyUniqueWordFeedback = function (withScorePoints, revealUncovered) {
    var self = this;
    var groups = self.getUniqueAnswerGroups();
    var scorePoints = null;
    var awarded = {};

    if (withScorePoints && self.params.behaviour.showScorePoints) {
      scorePoints = new H5P.QuestionCFRD.ScorePoints();
    }

    self.selectableWords.forEach(function (entry) {
      entry.clearScorePoint();

      if (entry.isAnswer()) {
        var key = self.normalizeAnswerKey(entry.getAnswerText());
        var covered = !!(groups[key] && groups[key].covered);
        var points = null;

        if (!covered && !revealUncovered) {
          return;
        }

        if (scorePoints && covered && !awarded[key]) {
          points = scorePoints;
          awarded[key] = true;
        }

        entry.markUniqueGroupFeedback(covered, points, {
          revealUncovered: !!revealUncovered
        });
        return;
      }

      if (entry.isSelected()) {
        entry.markCheck(scorePoints);
      }
    });
  };

  /**
   * Mark selected words and reveal unselected correct answers (Show solution).
   *
   * @fires MarkTheWords#resize
   */
  MarkTheWords.prototype.setAllMarks = function () {
    var self = this;

    if (self.isUniqueWordScoring()) {
      self.applyUniqueWordFeedback(false, true);
    }
    else {
      self.selectableWords.forEach(function (entry) {
        entry.markCheck();
        entry.clearScorePoint();
      });
    }

    /**
     * Resize event
     *
     * @event MarkTheWords#resize
     */
    this.trigger('resize');
  };

  /**
   * Mark selected words as correct or wrong (Check). Does not mark omitted answers.
   *
   * @fires MarkTheWords#resize
   */
  MarkTheWords.prototype.feedbackSelectedWords = function () {
    var self = this;

    if (self.isUniqueWordScoring()) {
      self.applyUniqueWordFeedback(true, false);
      this.$wordContainer.addClass('h5p-disable-hover');
      this.trigger('resize');
      return;
    }

    var scorePoints;
    if (self.params.behaviour.showScorePoints) {
      scorePoints = new H5P.QuestionCFRD.ScorePoints();
    }

    this.selectableWords.forEach(function (entry) {
      if (entry.isSelected()) {
        entry.markCheck(scorePoints);
      }
    });

    this.$wordContainer.addClass('h5p-disable-hover');
    this.trigger('resize');
  };

  /**
   * Evaluate task and display score text for word markings.
   *
   * @fires MarkTheWords#resize
   * @return {Boolean} Returns true if maxScore was achieved.
   */
  MarkTheWords.prototype.showEvaluation = function (answers) {
    this.hideEvaluation();
    var score = answers.score;
    var max = this.answers;
    var ratio = max > 0 ? score / max : 0;
    var resolved = H5P.QuestionCFRD.resolveOverallFeedback(
      this.params.overallFeedback,
      ratio,
      this.contentId,
      score,
      max
    );
    var popupSettings;

    if (resolved && resolved.html && resolved.html.trim().length > 0) {
      popupSettings = {
        showAsPopup: true,
        closeText: this.params.feedbackPopupCloseLabel || 'Close',
        alwaysShowClose: true,
        dismissible: true,
        popupBackgroundColor: resolved.popupBackgroundColor,
        feedbackBodyFontSize: resolved.feedbackBodyFontSize,
        feedbackLeadFontSize: resolved.feedbackLeadFontSize,
        feedbackCloseIconSize: resolved.feedbackCloseIconSize,
        plainText: resolved.plainText,
        onClose: function () {
          this.showButton('show-feedback');
        }.bind(this)
      };
      this.hideButton('show-feedback');
    }

    this.setFeedback(
      resolved ? resolved.html : '',
      score,
      max,
      this.params.scoreBarLabel,
      false,
      popupSettings
    );

    this.trigger('resize');
    return score === max;
  };

  /**
   * Clear the evaluation text.
   *
   * @fires MarkTheWords#resize
   */
  MarkTheWords.prototype.hideEvaluation = function () {
    this.removeFeedback();
    this.trigger('resize');
  };

  /**
   * Calculate the score.
   *
   * @return {Answers}
   */
  MarkTheWords.prototype.calculateScore = function () {
    var self = this;

    /**
     * @typedef {Object} Answers
     * @property {number} correct The number of correct answers
     * @property {number} wrong The number of wrong answers
     * @property {number} missed The number of answers the user missed
     * @property {number} score The calculated score
     */
    var initial = {
      correct: 0,
      wrong: 0,
      missed: 0,
      score: 0
    };
    var answers;

    if (self.isUniqueWordScoring()) {
      var groups = self.getUniqueAnswerGroups();

      answers = self.selectableWords.reduce(function (result, word) {
        if (word.isWrong()) {
          result.wrong++;
        }
        return result;
      }, {
        correct: 0,
        wrong: 0,
        missed: 0,
        score: 0
      });

      Object.keys(groups).forEach(function (key) {
        if (groups[key].covered) {
          answers.correct++;
        }
        else {
          // Uncovered groups do not subtract; they only fail to add a point.
          answers.missed++;
        }
      });
    }
    else {
      // iterate over words, and calculate score
      answers = self.selectableWords.reduce(function (result, word) {
        if (word.isCorrect()) {
          result.correct++;
        }
        else if (word.isWrong()) {
          result.wrong++;
        }
        else if (word.isMissed()) {
          result.missed++;
        }

        return result;
      }, initial);
    }

    // if no wrong answers, and blank is correct
    if (answers.wrong === 0 && self.blankIsCorrect) {
      answers.correct = 1;
    }

    // Omitted correct answers never subtract. Wrong selections subtract only when enabled.
    if (self.params.behaviour && self.params.behaviour.penalizeWrongSelections) {
      answers.score = Math.max(answers.correct - answers.wrong, 0);
    }
    else {
      answers.score = answers.correct;
    }

    return answers;
  };

  /**
   * Clear styling on marked words.
   *
   * @fires MarkTheWords#resize
   */
  MarkTheWords.prototype.clearAllMarks = function () {
    this.selectableWords.forEach(function (entry) {
      entry.markClear();
    });

    this.$wordContainer.removeClass('h5p-disable-hover');
    this.trigger('resize');
  };

  /**
   * Returns true if task is checked or a word has been clicked
   *
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   * @returns {Boolean} Always returns true.
   */
  MarkTheWords.prototype.getAnswerGiven = function () {
    return this.blankIsCorrect ? true : this.isAnswered;
  };

  /**
   * Counts the score, which is correct answers subtracted by wrong answers.
   *
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   * @returns {Number} score The amount of points achieved.
   */
  MarkTheWords.prototype.getScore = function () {
    return this.calculateScore().score;
  };

  /**
   * Gets max score for this task.
   *
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   * @returns {Number} maxScore The maximum amount of points achievable.
   */
  MarkTheWords.prototype.getMaxScore = function () {
    return this.answers;
  };

  /**
   * Get title
   * @returns {string}
   */
  MarkTheWords.prototype.getTitle = function () {
    return H5P.createTitle((this.contentData && this.contentData.metadata && this.contentData.metadata.title) ? this.contentData.metadata.title : 'Mark the Words');
  };

  /**
   * Display the evaluation of the task, with proper markings.
   *
   * @fires MarkTheWords#resize
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   */
  MarkTheWords.prototype.showSolutions = function () {
    var answers = this.calculateScore();
    this.showEvaluation(answers);
    this.setAllMarks();
    this.read(this.params.displaySolutionDescription);
    this.hideButton('try-again');
    this.hideButton('show-solution');
    this.hideButton('check-answer');
    this.hideButton('show-feedback');
    this.$a11yClickableTextLabel.html(this.params.a11ySolutionModeHeader + ' - ' + this.params.a11yClickableTextLabel);

    this.toggleSelectable(true);
    this.trigger('resize');
  };

  /**
   * Resets the task back to its' initial state.
   *
   * @fires MarkTheWords#resize
   * @see {@link https://h5p.org/documentation/developers/contracts|Needed for contracts.}
   */
  MarkTheWords.prototype.resetTask = function () {
    this.isAnswered = false;
    this.clearAllMarks();
    this.hideEvaluation();
    this.hideButton('try-again');
    this.hideButton('show-solution');
    this.hideButton('show-feedback');
    this.showButton('check-answer');
    this.$a11yClickableTextLabel.html(this.params.a11yClickableTextLabel);

    this.toggleSelectable(false);

    // Nuevo intento: sin delete, setActivityStarted es no-op.
    delete this.activityStartTime;
    if (typeof this.setActivityStarted === 'function') {
      this.setActivityStarted();
    }

    this.trigger('resize');
  };

  /**
   * Returns an object containing the selected words
   *
   * @public
   * @returns {object} containing indexes of selected words
   */
  MarkTheWords.prototype.getCurrentState = function () {
    var selectedWordsIndexes = [];
    if (this.selectableWords === undefined) {
      return undefined;
    }

    this.selectableWords.forEach(function (selectableWord, swIndex) {
      if (selectableWord.isSelected()) {
        selectedWordsIndexes.push(swIndex);
      }
    });
    return selectedWordsIndexes;
  };

  /**
   * Sets answers to current user state
   */
  MarkTheWords.prototype.setH5PUserState = function () {
    var self = this;

    // Do nothing if user state is undefined
    if (this.previousState === undefined || this.previousState.length === undefined) {
      return;
    }

    // Select words from user state (respect selection limit if enabled)
    var maxAllowed = self.isSelectionLimitEnabled() ?
      self.getMaxSelections() : Number.POSITIVE_INFINITY;
    var applied = 0;

    this.previousState.forEach(function (answeredWordIndex) {
      if (isNaN(answeredWordIndex) || answeredWordIndex >= self.selectableWords.length || answeredWordIndex < 0) {
        throw new Error('Stored user state is invalid');
      }

      if (applied >= maxAllowed) {
        return;
      }

      self.isAnswered = true;
      self.selectableWords[answeredWordIndex].setSelected();
      applied++;
    });

    self.updateSelectionLimitUi();
  };

  /**
   * Register dom elements
   *
   * @see {@link https://github.com/h5p/h5p-question/blob/1558b6144333a431dd71e61c7021d0126b18e252/scripts/question.js#L1236|Called from H5P.Question}
   */
  MarkTheWords.prototype.registerDomElements = function () {
    var context = this.params.context;
    var contextLayoutClass = getContextLayoutClass(context);
    var contextTextId = 'mark-the-words-' + this.contentId + '-context';
    var $contextMedia;
    var contentClass = 'h5p-word';

    // creates aria descriptions for correct/incorrect/missed
    this.createDescriptionsDom().appendTo(this.$inner);

    if (contextLayoutClass) {
      var $layout = $('<div>', {
        'class': 'h5p-mtw-slide-layout'
      });
      var $contextAside = $('<aside>', {
        'class': 'h5p-mtw-context',
        'aria-label': 'Context'
      });
      var $questionColumn = $('<div>', {
        'class': 'h5p-mtw-question-column'
      });

      if (hasContextText(context)) {
        this.$inner.attr('aria-describedby', contextTextId);
        $contextAside.append($('<div>', {
          id: contextTextId,
          'class': 'h5p-mtw-context-text',
          html: context.text
        }));
      }

      if (hasContextImage(context)) {
        $contextMedia = $('<div>', {
          'class': 'h5p-mtw-context-media'
        });
        $contextAside.append($contextMedia);
      }

      $questionColumn.append(this.$inner);
      $layout.append($contextAside);
      $layout.append($questionColumn);

      this.setContent($('<div>', {
        'class': 'h5p-mtw-has-context ' + contextLayoutClass
      }).append($layout), {
        'class': contentClass + ' h5p-mtw-with-context'
      });

      if ($contextMedia && $contextMedia.length) {
        this.pendingContextImage = {
          context: context,
          $container: $contextMedia
        };
      }
    }
    else {
      this.setContent(this.$inner, {
        'class': contentClass
      });
    }

    // Register buttons
    this.addButtons();
  };

  /**
   * Creates dom with description to be used with aria-describedby
   * @return {jQuery}
   */
  MarkTheWords.prototype.createDescriptionsDom = function () {
    var self = this;
    var $el = $('<div class="h5p-mark-the-words-descriptions"></div>');

    $('<div id="' + Word.ID_MARK_CORRECT + '">' + self.params.correctAnswer + '</div>').appendTo($el);
    $('<div id="' + Word.ID_MARK_INCORRECT + '">' + self.params.incorrectAnswer + '</div>').appendTo($el);
    $('<div id="' + Word.ID_MARK_MISSED + '">' + self.params.missedAnswer + '</div>').appendTo($el);

    return $el;
  };

  return MarkTheWords;
}(H5P.jQuery, H5P.QuestionCFRD, SavedWord, H5P.KeyboardNav, SavedXapiGenerator));

H5P.MarkTheWordsCFRD.PlayArea = PlayArea;
H5P.MarkTheWordsCFRD.Appearance = AppearanceModule;
H5P.MarkTheWordsCFRD.Word = SavedWord;
H5P.MarkTheWordsCFRD.XapiGenerator = SavedXapiGenerator;


/**
 * Static utility method for parsing H5P.MarkTheWordsCFRD content item questions
 * into format useful for generating reports.
 *
 * Example input: "<p lang=\"en\">I like *pizza* and *burgers*.</p>"
 *
 * Produces the following:
 * [
 *   {
 *     type: 'text',
 *     content: 'I like '
 *   },
 *   {
 *     type: 'answer',
 *     correct: 'pizza',
 *   },
 *   {
 *     type: 'text',
 *     content: ' and ',
 *   },
 *   {
 *     type: 'answer',
 *     correct: 'burgers'
 *   },
 *   {
 *     type: 'text',
 *     content: '.'
 *   }
 * ]
 *
 * @param {string} question MarkTheWords textField (html)
 */
/**
 * Split a text node into selectable tokens.
 * A marked phrase with spaces (*Artemis II*, +Los Angeles+, ~locked phrase~) is one token.
 * A mark without spaces stays one whitespace token, so **, ++ and ~~ escapes remain intact.
 *
 * @param {string} str
 * @return {string[]}
 */
H5P.MarkTheWordsCFRD.splitSelectableTokens = function (str) {
  return String(str).match(/[\[\({⟨¿¡“"«„]*\*[^*]*\s[^*]*\*[,….:;?!\]\)}⟩»”]*|[\[\({⟨¿¡“"«„]*\+[^+]*\s[^+]*\+[,….:;?!\]\)}⟩»”]*|[\[\({⟨¿¡“"«„]*~[^~]*\s[^~]*~[,….:;?!\]\)}⟩»”]*|[^\s]+/g);
};

H5P.MarkTheWordsCFRD.parseText = function (question) {

  /**
   * Separate all words surrounded by a space and an asterisk and any other
   * sequence of non-whitespace characters from str into an array.
   *
   * @param {string} str
   * @returns {string[]} array of all words in the given string
   */
  function getWords(str) {
    return H5P.MarkTheWordsCFRD.splitSelectableTokens(str);
  }

  /**
   * Replace each HTML tag in str with the provided value and return the resulting string
   *
   * Regexp expression explained:
   *   <     - first character is '<'
   *   [^>]* - followed by zero or more occurences of any character except '>'
   *   >     - last character is '>'
   **/
  function replaceHtmlTags(str, value) {
    return str.replace(/<[^>]*>/g, value);
  }

  function startsAndEndsWith(char, str) {
    return str.startsWith(char) && str.endsWith(char);
  }

  function removeLeadingPunctuation(str) {
    return str.replace(/^[\[\({⟨¿¡“"«„]+/, '');
  }

  function removeTrailingPunctuation(str) {
    return str.replace(/[",….:;?!\]\)}⟩»”]+$/, '');
  }

  /**
   * Escape double markers (e.g. ** → *) and remove singles.
   * @param {string} str
   * @param {string} marker
   */
  function handleMarkers(str, marker) {
    var markerIndex = str.indexOf(marker);

    while (markerIndex !== -1) {
      str = str.slice(0, markerIndex) + str.slice(markerIndex + 1, str.length);
      markerIndex = str.indexOf(marker, markerIndex + 1);
    }
    return str;
  }

  /**
   * Escape double asterisks ** = *, and remove single asterisk.
   * @param {string} str
   */
  function handleAsterisks(str) {
    return handleMarkers(str, '*');
  }

  /**
   * Whether token is locked plain text (~…~) in all-words modes.
   * @param {string} str
   * @returns {boolean}
   */
  function isLockedPlain(str) {
    var collapsed = str;
    var index = str.indexOf('~');
    while (index !== -1) {
      if (str.indexOf('~', index + 1) === index + 1) {
        collapsed = str.slice(0, index) + str.slice(index + 2);
      }
      index = str.indexOf('~', index + 1);
    }
    return collapsed.charAt(0) === '~' && collapsed.length > 2 &&
      (collapsed.charAt(collapsed.length - 1) === '~' ||
        collapsed.charAt(collapsed.length - 2) === '~');
  }

  /**
   * Decode HTML entities (e.g. &nbsp;) from the given string using the DOM API
   * @param {string} str
   */
  function decodeHtmlEntities(str) {
    const el = document.createElement('textarea');
    el.innerHTML = str;
    return el.value;
  }

  const wordsWithAsterisksNotRemovedYet = getWords(replaceHtmlTags(decodeHtmlEntities(question), ' '))
    .map(function (w) {
      return w.trim();
    })
    .map(function (w) {
      return removeLeadingPunctuation(w);
    })
    .map(function (w) {
      return removeTrailingPunctuation(w);
    })
    .filter(function (w) {
      return !isLockedPlain(w);
    });

  const allSelectableWords = wordsWithAsterisksNotRemovedYet.map(function (w) {
    return handleMarkers(handleAsterisks(w), '~');
  });

  const correctWordIndexes = [];

  const correctWords = wordsWithAsterisksNotRemovedYet
    .filter(function (w, i) {
      if (startsAndEndsWith('*', w)) {
        correctWordIndexes.push(i);
        return true;
      }
      return false;
    })
    .map(function (w) {
      return handleAsterisks(w);
    });

  const printableQuestion = replaceHtmlTags(decodeHtmlEntities(question), ' ')
    .replace('\xa0', '\x20');

  return {
    alternatives: allSelectableWords,
    correctWords: correctWords,
    correctWordIndexes: correctWordIndexes,
    textWithPlaceholders: printableQuestion.match(/[^\s]+/g)
      .reduce(function (textWithPlaceholders, word, index) {
        word = removeTrailingPunctuation(
          removeLeadingPunctuation(word));

        return textWithPlaceholders.replace(word, '%' + index);
      }, printableQuestion)
  };
};
})();
