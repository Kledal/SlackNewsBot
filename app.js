require('dotenv').config();

var _ = require('lodash');
var q = require('q');
var SlackBot = require('slackbots');
var fetch = require('node-fetch');
var MongoClient = require('mongodb').MongoClient;
var getRSS = require('./read_rss');

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
  connectdb((db) => {
    var collection = db.collection('feed_urls').find({}).toArray()
      .then((result) => {
        var response = "";
        response = JSON.stringify(_.map(result, function (feed) {
          return feed.url;
        }));

        deferred.resolve(response);
      });
  });

  return deferred.promise;
}

function handleMessage(data) {
  if (data.subtype === 'bot_message') return;
  var isPrivateChat = data.channel[0] === 'D';
  var msg = data.text;

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

bot.on('message', function (data) {
  switch (data.type) {
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

  var collection = db.collection('feed_urls');
  collection.insertMany(feeds, (err, result) => {
    if (err) console.log(err);
  });
  return feeds;
}

connectdb(function (db) {
  var collection = db.collection('feed_urls');
  collection.find().toArray((err, result) => {
    if (result.length == 0) {
      feeds = seed(db);
    }
  });
});

function postArticle(channel, article) {
  bot.postMessageToChannel(channel, `${article.title} - ${article.link}`)
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

setInterval(fetchRSS, 5000);