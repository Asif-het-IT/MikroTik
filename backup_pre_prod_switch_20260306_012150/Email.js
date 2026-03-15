this.HET = this.HET || {};

(function(ns) {
  if (ns.Email) return;

  function recipients_() {
    var raw = ns.Utils.safeString(ns.Config.get().EMAILS, '');
    if (!raw) return [];
    var parts = raw.split(',');
    var out = [];
    var i;
    for (i = 0; i < parts.length; i++) {
      var s = ns.Utils.safeString(parts[i], '');
      if (s) out.push(s);
    }
    return out;
  }

  function send(subject, plainBody, htmlBody) {
    var to = recipients_();
    if (!to.length) return;

    MailApp.sendEmail({
      to: to.join(','),
      subject: ns.Utils.trimToLimit(ns.Utils.safeString(subject, 'Monitoring Update'), 180),
      body: ns.Utils.safeString(plainBody, ''),
      htmlBody: htmlBody || '<pre>' + ns.Utils.safeString(plainBody, '') + '</pre>'
    });
  }

  ns.Email = {
    send: send
  };
})(this.HET);
