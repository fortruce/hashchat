var Twitter = require('twitter-apponly'),
    assign = require('object-assign'),
    keys = require('./api-keys'),
    EventEmitter = require('events').EventEmitter;

var hashtags = [];
var tagIndex = {};

var client = new Twitter(keys.consumer_key, keys.consumer_secret);

var twitterSearchLimit = (60 / (450 / 15)) + 1; // minimum seconds b/w requests with buffer second

function addTag(tag) {
	hashtags.unshift(tag);
  tagIndex[tag] = {};
}

function removeTag(tag) {
	hashtags.splice(hashtags.indexOf(tag), 1);
  delete tagIndex[tag];
}

var TwitManager = assign({}, EventEmitter.prototype, {
  subscribe: function (tag, callback) {
    if (hashtags.indexOf(tag) === -1) {
      addTag(tag);
    }

    this.on(tag, callback);
  },

  unsubscribe: function (tag, callback) {
    this.removeListener(tag, callback);

    if (!this.listeners(tag).length) {
      removeTag(tag);
    }
  },

  emitTag: function (tag, statuses) {
    this.emit(tag, statuses);
  },

  _interval: setInterval(function() {
    if (!hashtags.length)
      return;

    var tag = hashtags.shift();
    query(tag)
      .then(function (body) {
        if (!tagIndex[tag]) {
          // no longer tracking tag
          return;
        }
        // add the tag back onto the query list
        hashtags.push(tag);

        var statuses = body.statuses;
        if (!statuses.length)
          return;

        if (tagIndex[tag].since_id) {
          // only emit if we know we have new tweets (since_id has been initialized)
          TwitManager.emitTag(tag, statuses);
        }

        // must use id_str since id's are too big for javascript floats
        tagIndex[tag].since_id = statuses[0].id_str;
      })
      .catch(console.error);
  }, twitterSearchLimit * 1000)
});

function query(tag) {
  tagIndex[tag].querying = true;

  var q = {
    q: '#' + tag,
    since_id: tagIndex[tag].since_id || 0,
    count: tagIndex[tag].since_id ? 100 : 1
  };

  return client.get('search/tweets', q);
}

module.exports = TwitManager;
