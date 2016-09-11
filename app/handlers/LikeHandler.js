var LikeHandler = {
  command: 'like',
  process: function (bot, command, data) {
    if (command !== 'like') return;
    var text = data.text.split(' ').slice(1).join(' ');
    bot._trainClassifier(text, 'like');

    bot.slackBot.postMessage(data.user, 'Saved to database.', { as_user: true })
  }
};
module.exports = LikeHandler;
