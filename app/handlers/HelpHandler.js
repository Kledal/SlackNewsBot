var _ = require('lodash');

var HelpHandler = {
  command: 'help',
  process: function (bot, command, data) {
    if (command !== 'help') return;

    var text = "Currently I support these commands:";
    _.each(bot.commandHandlers, (handler) => {
      text += `\n${handler.command}`;
    });
    bot.slackBot.postMessage(data.user, text, {as_user: true});
  }
};

module.exports = HelpHandler;
