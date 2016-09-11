require('dotenv').config();

var _ = require('lodash');
var q = require('q');
var SlackBot = require('slackbots');
var fetch = require('node-fetch');
var MongoClient = require('mongodb').MongoClient;
var getRSS = require('./read_rss');

var natural = require('natural'),
  classifier = new natural.BayesClassifier();

var feeds = [];

function connectdb(callback) {
  MongoClient.connect(process.env.MONGO_URL, function (err, db) {
    if (err) console.log(err);
    if (!err) callback(db);
  });
}

// create a bot
var bot = new SlackBot({
  token: process.env.SLACK_API_TOKEN,
  name: 'newsbot'
});

bot.on('start', function () {
});

function getResponse(data) {
  var deferred = q.defer();
  var msg = data.text;

  var messageInfo = msg.split(' ');
  var command = messageInfo[0];

  var text = messageInfo.slice(1).join(' ');

  let responseText = "";

  console.log("[getResponse] Handle command: " + command);

  switch(command) {
    case 'like':
      trainClassifier(text, 'like');
      responseText = classifier.classify(text);
      break;
    case 'dislike':
      trainClassifier(text, 'dislike');
      responseText = classifier.classify(text);
      break;
    default:
      responseText = "I don't understand that command, sorry.";
      break;
  }
  deferred.resolve(responseText);
  return deferred.promise;
}

function handleMessage(data) {
  const ignoredTypes = ['bot_message', 'message_deleted'];
  if (_.includes(ignoredTypes, data.subtype)) return;
  if (data.bot_id) return;

  var isPrivateChat = data.channel[0] === 'D';
  if (!isPrivateChat) return;

  var msg = data.text;

  console.log("[HandleMessage] " + data.text)
  getResponse(data).then((response) => {
    if (isPrivateChat) {
      bot.getUserById(data.user).then((user) => {
        console.log("Post to user: " + user);
        bot.postMessageToUser(user.name, response, {});
      });
    } else {
      bot.getChannelById(data.channel).then((channel) => {
        console.log("Post to channel: " + channel);
        bot.postMessageToChannel(channel.name, response, {})
      });
    }
  });
}

function trainClassifier(text, reaction) {
  classifier.addDocument(text, reaction);
  classifier.train();

  connectdb((db) => {
    db.collection('classifier').update({kledal: true}, {raw: JSON.stringify(classifier), kledal: true}, { upsert: true });
  });
}

function handleReaction(data) {
  var itemChannel = data.item.channel;
  var reaction = data.reaction;

  var reactionMode = reaction === '+1' ? 'like' : 'dislike';

  console.log("Reaction in channel: " + itemChannel);
  var params = {
    channel: itemChannel,
    oldest: data.item.ts,
    inclusive: 1
  };

  bot._api('channels.history', params).then((response) => {
    var messages = response.messages;
    if (messages.length === 0) return;
    var fullMessage = messages.reverse()[0].text;

    var messageText = fullMessage.split(' -')[0];

    trainClassifier(messageText, reactionMode);

    var text = "I just classified <" + messageText + "> as " + reaction;
    bot.postMessage(data.user, text, {as_user: true});
  });
}

bot.on('message', function (data) {
  console.log(data);
  switch (data.type) {
    case 'reaction_added':
      handleReaction(data);
    case 'message':
      handleMessage(data);
      break;
  }
});

function seed(db) {
  console.log("Seed db");
  var feeds = [];
  feeds.push({url: "http://www.euroinvestor.dk/RSS/News.aspx"});
  feeds.push({url: "http://jyllands-posten.dk/?service=rssfeed&submode=topnyheder"});
  feeds.push({url: "http://rss.nytimes.com/services/xml/rss/nyt/Technology.xml"});
  feeds.push({url: "http://www.cnet.com/rss/news/"});
  feeds.push({url: "http://www.cnet.com/rss/iphone-update/"});
  feeds.push({url: "https://www.engadget.com/rss.xml"});
  feeds.push({url: "http://borsen.dk/rss/"});

  var collection = db.collection('feed_urls');
  collection.remove();
  collection.insertMany(feeds, (err, result) => {
    if (err) console.log(err);
  });
  return feeds;
}

function preloadClassifier(db) {
  var collection = db.collection('classifier');
  collection.find({kledal: true}).toArray((err, docs) => {

    if (docs.length == 1) {
      var data = docs[0];
      var raw = data.raw;
      classifier = natural.BayesClassifier.restore(JSON.parse(raw));
    }
  });
}

connectdb(function (db) {
  seed(db);

  preloadClassifier(db);
});

function postArticle(channel, article) {
  var mentions = "";
  if (classifier.classify(article.title) === 'like') {
    mentions = "<@kledal> ";
  }

  bot.postMessageToChannel(channel, `${article.title} - ${mentions}${article.link}`)
}

function fetchRSS() {
  connectdb((db) => {
    var collection = db.collection('feed_urls');
    return collection.find().toArray((err, result) => {
      parseRSS(result);
    });
  });
}

function parseRSS(feeds) {
  function postFeed(db, posted_urls) {
    for (var i = 0; i < feeds.length; i++) {
      var feed = feeds[i].url;

      getRSS(feed, (article) => {
        if (!_.find(posted_urls, {url: article.link})) {
          console.log("Not found: " + article.link);
          postArticle("allnews", article);

          db.collection('posted_urls').insertOne({url: article.link});
        }
      });
    }
  }

  connectdb(function (db) {
      var collection = db.collection('posted_urls');
      collection.find().toArray().then((result) => {
        postFeed(db, result);
      });
    }
  );
}

setInterval(fetchRSS, 60000);
