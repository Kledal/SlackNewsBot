require('dotenv').config();

var _ = require('lodash');
var q = require('q');
var fetch = require('node-fetch');
var MongoClient = require('mongodb').MongoClient;
var getRSS = require('./read_rss');
var Bot = require('./app/bot');

var natural = require('natural');

function connectdb(callback) {
  MongoClient.connect(process.env.MONGO_URL, function (err, db) {
    if (err) console.log(err);
    if (!err) callback(db);
  });
}

var bot = new Bot();

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

connectdb(function (db) {
  seed(db);
});

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
          bot.postArticle("allnews", article);

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
