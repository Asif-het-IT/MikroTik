function HET_emailHtml_(subject, plainBody) {
  var safeSubject = hetEscapeHtml_(subject || 'het update');
  var safeBody = hetEscapeHtml_(plainBody || '').replace(/\n/g, '<br>');
  return '' +
    '<div style="font-family:Segoe UI, Trebuchet MS, sans-serif;background:#f5f7f2;padding:24px;color:#173f35;">' +
      '<div style="max-width:760px;margin:0 auto;background:#ffffff;border:1px solid #d9e2d1;border-radius:16px;overflow:hidden;">' +
        '<div style="background:linear-gradient(135deg,#173f35,#4f7c5b);padding:18px 24px;color:#ffffff;">' +
          '<div style="font-size:22px;font-weight:700;">' + hetEscapeHtml_(HET.cfg().NOC_TITLE || 'het') + '</div>' +
          '<div style="font-size:13px;opacity:.9;">' + safeSubject + '</div>' +
        '</div>' +
        '<div style="padding:24px;font-size:14px;line-height:1.7;">' + safeBody + '</div>' +
      '</div>' +
    '</div>';
}

function HET_sendEmail_(subject, htmlBody, plainBody, options) {
  var c = HET.cfg();
  var to = hetSafeStr_(c.EMAILS, 500);
  if (!to) return;
  options = options || {};

  var finalSubject = hetSafeStr_(subject || 'het update', 180);
  var finalPlain = plainBody || '';
  var finalHtml = htmlBody || HET_emailHtml_(finalSubject, finalPlain);

  var sendOptions = {
    htmlBody: finalHtml,
    name: HET.cfg().NOC_TITLE || 'het'
  };
  if (options.attachments && options.attachments.length) {
    sendOptions.attachments = options.attachments;
  }

  GmailApp.sendEmail(to, finalSubject, finalPlain, sendOptions);
}
