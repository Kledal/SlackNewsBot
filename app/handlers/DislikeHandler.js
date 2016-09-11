var DislikeHandler = {
  command: 'dislike',
  process: function (bot, command, data) {
    if (command !== 'dislike') return;
    var text = data.text.split(' ').slice(1).join(' ');
    bot._trainClassifier(text, 'dislike');

    bot.slackBot.postMessage(data.user, 'Saved to database.', { as_user: true })
  }
};
module.exports = DislikeHandler;
