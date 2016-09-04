require('dotenv').config();

var _ = require('lodash');
var SlackBot = require('slackbots');
var fetch = require('node-fetch');

var getRSS = require('./read_rss');

// create a bot
var bot = new SlackBot({
  token: process.env.SLACK_API_TOKEN, // Add a bot https://my.slack.com/services/new/bot and put the token
  name: 'newsbot'
});

bot.on('start', function () {
});


var posted_urls = [];
var feeds = [];

feeds.push("http://www.euroinvestor.dk/RSS/News.aspx");
//feeds.push("http://jyllands-posten.dk/?service=rssfeed&submode=topnyheder");
//feeds.push("http://rss.nytimes.com/services/xml/rss/nyt/Technology.xml");
//feeds.push("http://www.cnet.com/rss/news/");
//feeds.push("http://www.cnet.com/rss/iphone-update/");

function postArticle(channel, article) {
  bot.postMessageToChannel(channel, `${article.title} - ${article.link}`)
}

function fetchRSS() {
  for (var i = 0; i < feeds.length; i++) {
    var feed = feeds[i];

    getRSS(feed, (article) => {
      if (!_.includes(posted_urls, article.link)) {
        postArticle("allnews", article);
        posted_urls.push(article.link);
      }
    });
  }
}

setInterval(fetchRSS, 5000);