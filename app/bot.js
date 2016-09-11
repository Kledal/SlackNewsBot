var natural = require('natural');
var _ = require('lodash');
var MongoClient = require('mongodb').MongoClient;
var SlackBot = require('slackbots');
var util = require('util');
var EventEmitter = require('events').EventEmitter;

var LikeHandler = require('./handlers/LikeHandler');
var DislikeHandler = require('./handlers/DislikeHandler');
var HelpHandler = require('./handlers/HelpHandler');
var FeedCommands = require('./handlers/FeedCommands');

const ignoredTypes = ['bot_message', 'message_deleted'];

function Bot() {
  this.commandHandlers = [
    DislikeHandler,
    LikeHandler,
    HelpHandler,
    FeedCommands.ListFeeds];


  this.db = null;
  this._connectToMongoDb();

  this.classifier = new natural.BayesClassifier();

  this.on('dbReady', () => {
    console.log("[BOT] dbReady event fired.");
    this._preloadClassifier();
  });

  this.slackBot = new SlackBot({
    token: process.env.SLACK_API_TOKEN,
    name: 'newsbot'
  });
  this._setupSlackEvents();
}

util.inherits(Bot, EventEmitter);

Bot.prototype.postArticle = function (channel, article) {
  var mentions = "";
  if (this.classifier.classify(article.title) === 'like') {
    mentions = "<@kledal> ";
  }

  this.slackBot.postMessageToChannel(channel, `${article.title} - ${mentions}${article.link}`)
};


Bot.prototype._setupSlackEvents = function () {
  this.slackBot.on('message', (data) => {
    console.log(data);
    switch (data.type) {
      case 'reaction_added':
        this._handleReaction(data);
      case 'message':
        this._handleMessage(data);
        break;
    }
  });
};

Bot.prototype._connectToMongoDb = function () {
  MongoClient.connect(process.env.MONGO_URL, (err, db) => {
    if (err) console.log(err);
    this.db = db;
    this.emit('dbReady')
  });
};

Bot.prototype._handleReaction = function (data) {
  var itemChannel = data.item.channel;
  var reaction = data.reaction;

  var reactionMode = reaction === '+1' ? 'like' : 'dislike';

  console.log("Reaction in channel: " + itemChannel);
  var params = {
    channel: itemChannel,
    oldest: data.item.ts,
    inclusive: 1
  };

  this.slackBot._api('channels.history', params).then((response) => {
    var messages = response.messages;
    if (messages.length === 0) return;
    var fullMessage = messages.reverse()[0].text;

    var messageText = fullMessage.split(' -')[0];

    this.trainClassifier(messageText, reactionMode);

    var text = "I just classified <" + messageText + "> as " + reaction;
    this.slackBot.postMessage(data.user, text, {as_user: true});
  });
};

Bot.prototype._handleMessage = function (data) {
  if (_.includes(ignoredTypes, data.subtype)) return;
  if (data.bot_id) return;

  var isPrivateChat = data.channel[0] === 'D';
  if (!isPrivateChat) return;

  var messageInfo = data.text.split(' ');
  var command = messageInfo[0];
  _.each(this.commandHandlers, (handler) => {
    handler.process(this, command, data);
  });
};

Bot.prototype._trainClassifier = function (text, reaction) {
  this.classifier.addDocument(text, reaction);
  this.classifier.train();

  this.db.collection('classifier').update({kledal: true}, {
    raw: JSON.stringify(this.classifier),
    kledal: true
  }, {upsert: true});
};

Bot.prototype._preloadClassifier = function () {
  var collection = this.db.collection('classifier');
  collection.find({kledal: true}).toArray((err, docs) => {

    if (docs.length == 1) {
      var data = docs[0];
      var raw = data.raw;
      this.classifier = natural.BayesClassifier.restore(JSON.parse(raw));
    }
  });
};

module.exports = Bot;