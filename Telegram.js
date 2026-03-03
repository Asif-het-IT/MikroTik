// Minimal Telegram helper: direct send function only. Queue/outbox removed for single-sheet mode.
function sendTelegramRaw_(botToken, chatId, htmlText) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      muteHttpExceptions: true,
      payload: {
        chat_id: chatId,
        text: String(htmlText).slice(0, 3900),
        parse_mode: "HTML",
        disable_web_page_preview: true
      }
    });
    const code = res.getResponseCode();
    const body = res.getContentText() || "";
    try {
      const j = JSON.parse(body);
      if (j && j.ok) return { ok: true, info: `HTTP_${code} OK` };
      const desc = (j && j.description) ? j.description : body;
      return { ok: false, info: `HTTP_${code} ${String(desc).slice(0, 800)}` };
    } catch (e) {
      return { ok: (code >= 200 && code < 300), info: `HTTP_${code} ${body}` };
    }
  } catch (err) {
    return { ok: false, info: `EXCEPTION ${String(err)}` };
  }
}

function sendTelegramRaw_(botToken, chatId, htmlText) {
  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = UrlFetchApp.fetch(url, {
      method: "post",
      muteHttpExceptions: true,
      payload: {
        chat_id: chatId,
        text: String(htmlText).slice(0, 3900),
        parse_mode: "HTML",
        disable_web_page_preview: true
      }
    });
    const code = res.getResponseCode();
      const body = res.getContentText() || "";
      try {
        const j = JSON.parse(body);
        if (j && j.ok) return { ok: true, info: `HTTP_${code} OK` };
        const desc = (j && j.description) ? j.description : body;
        return { ok: false, info: `HTTP_${code} ${String(desc).slice(0, 800)}` };
      } catch (e) {
        return { ok: (code >= 200 && code < 300), info: `HTTP_${code} ${body}` };
      }
  } catch (err) {
      return { ok: false, info: `EXCEPTION ${String(err)}` };
  }
}

function queueEmail_(ss, cfg, subject, body, isHtml) {
  const emailsRaw = cfgStr_(cfg, "EMAILS", "") || cfgStr_(cfg, "EMAIL_TO", "");
  if (!emailsRaw) return;
  const list = emailsRaw.split(/[,;]+/).map(x => x.trim()).filter(Boolean);
  if (!list.length) return;
  try {
    if (isHtml) {
      MailApp.sendEmail({ to: list.join(","), subject: String(subject || "NOC Monitoring").slice(0, 120), htmlBody: `<div style="font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:1.45">${body}</div>` });
    } else {
      MailApp.sendEmail(list.join(","), subject, body);
    }
  } catch (err) {
    try { logErr_(SpreadsheetApp.openById(SS_ID), "EMAIL", String(err), emailsRaw); } catch(_){}
  }
}