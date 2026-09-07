H5P.MarkTheWordsCFRD = H5P.MarkTheWordsCFRD || {};

/**
 * Mark the words XapiGenerator
 */
H5P.MarkTheWordsCFRD.XapiGenerator = (function ($) {

  /**
   * Xapi statements Generator
   * @param {H5P.MarkTheWordsCFRD} markTheWords
   * @constructor
   */
  function XapiGenerator(markTheWords) {

    /**
     * Generate answered event
     * @return {H5P.XAPIEvent}
     */
    this.generateAnsweredEvent = function () {
      var xAPIEvent = markTheWords.createXAPIEventTemplate('answered');

      // Extend definition
      var objectDefinition = createDefinition(markTheWords);
      $.extend(true, xAPIEvent.getVerifiedStatementValue(['object', 'definition']), objectDefinition);

      // Set score
      xAPIEvent.setScoredResult(markTheWords.getScore(),
        markTheWords.getMaxScore(),
        markTheWords,
        true,
        markTheWords.getScore() === markTheWords.getMaxScore()
      );

      // Extend user result
      var userResult = {
        response: getUserSelections(markTheWords)
      };

      $.extend(xAPIEvent.getVerifiedStatementValue(['result']), userResult);

      return xAPIEvent;
    };
  }

  /**
   * Create object definition for question
   *
   * @param {H5P.MarkTheWordsCFRD} markTheWords
   * @return {Object} Object definition
   */
  function createDefinition(markTheWords) {
    var definition = {};
    var description = '';
    var metadataTitle = markTheWords.contentData &&
      markTheWords.contentData.metadata &&
      markTheWords.contentData.metadata.title;
    var instructions = markTheWords.params.instructions;
    var decoder;

    if (instructions && instructions.enabled && instructions.text) {
      decoder = document.createElement('div');
      decoder.innerHTML = instructions.text;
      description = (decoder.textContent || decoder.innerText || '').replace(/[\n\r]+|[\s]{2,}/g, ' ').trim();
    }

    if (!description && metadataTitle) {
      description = String(metadataTitle);
    }

    if (!description && markTheWords.params.textField) {
      decoder = document.createElement('div');
      decoder.innerHTML = markTheWords.params.textField;
      description = (decoder.textContent || decoder.innerText || '')
        .replace(/\*/g, '')
        .replace(/\+/g, '')
        .replace(/[\n\r]+|[\s]{2,}/g, ' ')
        .trim();
    }

    definition.description = {
      'en-US': description || 'Mark the Words'
    };
    definition.type = 'http://adlnet.gov/expapi/activities/cmi.interaction';
    definition.interactionType = 'choice';
    definition.correctResponsesPattern = [getCorrectResponsesPattern(markTheWords)];
    definition.choices = getChoices(markTheWords);
    definition.extensions = {
      'https://h5p.org/x-api/line-breaks': markTheWords.getIndexesOfLineBreaks()
    };
    return definition;
  }

  /**
   * Get all choices that it is possible to choose between
   *
   * @param {H5P.MarkTheWordsCFRD} markTheWords
   * @return {Array}
   */
  function getChoices(markTheWords) {
    return markTheWords.selectableWords.map(function (word, index) {
      var text = word.getText();

      if (text.charAt(0) === '*' && text.charAt(text.length - 1) === '*') {
        text = text.substr(1, text.length - 2);
      }
      else if (text.charAt(0) === '+' && text.charAt(text.length - 1) === '+') {
        text = text.substr(1, text.length - 2);
      }

      return {
        id: index.toString(),
        description: {
          'en-US': $('<div>' + text + '</div>').text()
        }
      };
    });
  }

  /**
   * Get selected words as a user response pattern
   *
   * @param {H5P.MarkTheWordsCFRD} markTheWords
   * @return {string}
   */
  function getUserSelections(markTheWords) {
    return markTheWords.selectableWords
      .reduce(function (prev, word, index) {
        if (word.isSelected()) {
          prev.push(index);
        }
        return prev;
      }, []).join('[,]');
  }

  /**
   * Get correct response pattern from correct words
   *
   * @param {H5P.MarkTheWordsCFRD} markTheWords
   * @return {string}
   */
  function getCorrectResponsesPattern(markTheWords) {
    return markTheWords.selectableWords
      .reduce(function (prev, word, index) {
        if (word.isAnswer()) {
          prev.push(index);
        }
        return prev;
      }, []).join('[,]');
  }

  return XapiGenerator;
})(H5P.jQuery);
