this.HET = this.HET || {};

(function(ns) {
  if (ns.Telegram) return;

  function sendMessage(text) {
    var c = ns.Config.get();
    var bot = ns.Utils.safeString(c.TG_BOT, '');
    var chat = ns.Utils.safeString(c.TG_CHAT, '');
    if (!bot || !chat) return;

    var url = 'https://api.telegram.org/bot' + encodeURIComponent(bot) + '/sendMessage';
    UrlFetchApp.fetch(url, {
      method: 'post',
      muteHttpExceptions: true,
      payload: {
        chat_id: chat,
        text: ns.Utils.trimToLimit(ns.Utils.safeString(text, ''), 3900)
      }
    });
  }

  ns.Telegram = {
    sendMessage: sendMessage
  };
})(this.HET);
