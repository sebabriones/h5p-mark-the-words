H5P.MarkTheWordsCFRD = H5P.MarkTheWordsCFRD || {};
H5P.MarkTheWordsCFRD.Word = (function () {
  /**
   * @constant
   *
   * @type {string}
  */
  Word.ID_MARK_MISSED = "h5p-description-missed";
  /**
   * @constant
   *
   * @type {string}
   */
  Word.ID_MARK_CORRECT = "h5p-description-correct";
  /**
   * @constant
   *
   * @type {string}
   */
  Word.ID_MARK_INCORRECT = "h5p-description-incorrect";

  /**
   * Class for keeping track of selectable words.
   *
   * @class
   * @param {jQuery} $word
   */
  function Word($word, params) {
    var self = this;
    self.params = params;
    H5P.EventDispatcher.call(self);

    var input = $word.text();
    var handledInput = input;
    var candidatesOnly = !!(params && params.behaviour &&
      params.behaviour.selectionMode === 'candidatesOnly');

    // Check if word is an answer (*…*)
    var isAnswer = checkForMarker('*');

    // In candidates-only mode, +…+ marks a selectable distractor
    var isPlusDistractor = !isAnswer && candidatesOnly && checkForMarker('+');

    if (isAnswer) {
      stripMarkerChar('*');
      $word.text(handledInput);
    }
    else if (isPlusDistractor) {
      stripMarkerChar('+');
      $word.text(handledInput);
    }
    else {
      // Escape double asterisks in plain selectable words (all-words mode)
      stripMarkerChar('*');
    }

    const ariaText = document.createElement('span');
    ariaText.classList.add('hidden-but-read');
    $word[0].appendChild(ariaText);

    /**
     * Collapse doubled marker chars (e.g. ** → *, ++ → +) for detection.
     *
     * @private
     * @param {String} wordString
     * @param {String} marker
     * @return {String}
     */
    function removeDoubleMarkers(wordString, marker) {
      var index = wordString.indexOf(marker);
      var slicedWord = wordString;

      while (index !== -1) {
        if (wordString.indexOf(marker, index + 1) === index + 1) {
          slicedWord = wordString.slice(0, index) +
            wordString.slice(index + 2, wordString.length);
        }
        index = wordString.indexOf(marker, index + 1);
      }

      return slicedWord;
    }

    /**
     * Detect leading/trailing marker (optionally with trailing punctuation).
     * Updates handledInput when a full wrap is found.
     *
     * @private
     * @param {String} marker
     * @return {Boolean}
     */
    function checkForMarker(marker) {
      var wordString = removeDoubleMarkers(input, marker);

      if (wordString.charAt(0) === marker && wordString.length > 2) {
        if (wordString.charAt(wordString.length - 1) === marker) {
          handledInput = input.slice(1, input.length - 1);
          return true;
        }
        // Punctuation after closing marker
        else if (wordString.charAt(wordString.length - 2) === marker) {
          handledInput = input.slice(1, input.length - 2);
          return true;
        }
        return false;
      }
      return false;
    }

    /**
     * Escape doubled markers (keep one) and remove singles from handledInput.
     * Same algorithm as upstream asterisk handling.
     *
     * @private
     * @param {String} marker
     */
    function stripMarkerChar(marker) {
      var index = handledInput.indexOf(marker);

      while (index !== -1) {
        handledInput = handledInput.slice(0, index) +
          handledInput.slice(index + 1, handledInput.length);
        index = handledInput.indexOf(marker, index + 1);
      }
    }

    /**
     * Removes any score points added to the marked word.
     */
    self.clearScorePoint = function () {
      const scorePoint = $word[0].querySelector('div');
      if (scorePoint) {
        scorePoint.parentNode.removeChild(scorePoint);
      }
    };

    /**
     * Get Word as a string
     *
     * @return {string} Word as text
     */
    this.getText = function () {
      return input;
    };

    /**
     * Clears all marks from the word.
     *
     * @public
     */
    this.markClear = function () {
      $word
        .attr('aria-selected', false)
        .removeAttr('aria-describedby');

      ariaText.innerHTML = '';
      this.clearScorePoint();
    };

    /**
     * Check if the word is correctly marked and style it accordingly.
     * Reveal result
     *
     * @public
     * @param {H5P.QuestionCFRD.ScorePoints} scorePoints
     */
    this.markCheck = function (scorePoints) {
      if (this.isSelected()) {
        $word.attr('aria-describedby', isAnswer ? Word.ID_MARK_CORRECT : Word.ID_MARK_INCORRECT);
        ariaText.innerHTML = isAnswer
          ? self.params.correctAnswer
          : self.params.incorrectAnswer;

        if (scorePoints) {
          $word[0].appendChild(scorePoints.getElement(isAnswer));
        }
      }
      else if (isAnswer) {
        $word.attr('aria-describedby', Word.ID_MARK_MISSED);
        ariaText.innerHTML = self.params.missedAnswer;
      }
    };

    /**
     * Checks if the word is marked correctly.
     *
     * @public
     * @returns {Boolean} True if the marking is correct.
     */
    this.isCorrect = function () {
      return (isAnswer && this.isSelected());
    };

    /**
     * Checks if the word is marked wrong.
     *
     * @public
     * @returns {Boolean} True if the marking is wrong.
     */
    this.isWrong = function () {
      return (!isAnswer && this.isSelected());
    };

    /**
     * Checks if the word is correct, but has not been marked.
     *
     * @public
     * @returns {Boolean} True if the marking is missed.
     */
    this.isMissed = function () {
      return (isAnswer && !this.isSelected());
    };

    /**
     * Checks if the word is an answer.
     *
     * @public
     * @returns {Boolean} True if the word is an answer.
     */
    this.isAnswer = function () {
      return isAnswer;
    };

    /**
     * Checks if the word is selected.
     *
     * @public
     * @returns {Boolean} True if the word is selected.
     */
    this.isSelected = function () {
      return $word.attr('aria-selected') === 'true';
    };

    /**
     * Sets that the Word is selected
     *
     * @public
     */
    this.setSelected = function () {
      $word.attr('aria-selected', 'true');
    };
  }
  Word.prototype = Object.create(H5P.EventDispatcher.prototype);
  Word.prototype.constructor = Word;

  return Word;
})();
