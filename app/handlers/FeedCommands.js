var _ = require('lodash');

var ListFeeds = {
  command: 'list-feed',
  process: (bot, command, data) => {
    if (command !== 'list-feed') return;
    bot.db.collection('feed_urls').find({}).toArray((err, docs) => {
      var text = "";
      _.each(docs, (doc) => {
        text += `\nFeed: ${doc.url}`;
      });

      bot.slackBot.postMessage(data.user, text, {as_user: true});
    });
  }
};

module.exports = {ListFeeds: ListFeeds};