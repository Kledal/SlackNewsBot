var FeedParser = require('feedparser');
var request = require('request');


function getRSS(url, cb) {
  var req = request(url);
  var feedparser = new FeedParser();

  req.on('error', function (error) {
  });
  req.on('response', function (res) {
    var stream = this;
    if (res.statusCode != 200) return this.emit('error', new Error('Bad status code'));
    stream.pipe(feedparser);
  });


  feedparser.on('error', function (error) {
  });

  feedparser.on('readable', function () {
    var item;
    while (item = this.read()) {
      cb(item);
    }
  });
}

module.exports = getRSS;