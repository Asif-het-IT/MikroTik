function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  try {
    if (String(p.page || '').toLowerCase() === 'dashboard') {
      return HET_renderDashboardPage_();
    }
    hetRequireToken_(e);
    if (String(p.admin || '').toLowerCase() === 'setup') {
      return hetJson_(HET_adminSetup_());
    }
    if (String(p.admin || '').toLowerCase() === 'applyprops') {
      applyScriptProperties();
      return hetJson_({ ok: true, message: 'Script properties applied.' });
    }
    if (String(p.admin || '').toLowerCase() === 'status') {
      return hetJson_(HET_adminStatus_());
    }
    if (String(p.admin || '').toLowerCase() === 'cleanup') {
      return hetJson_(HET_adminCleanupLegacyProps_());
    }
    if (String(p.admin || '').toLowerCase() === 'migrateromanurdu') {
      return hetJson_(HET_adminMigrateRomanUrdu_());
    }
    if (String(p.admin || '').toLowerCase() === 'migrateenglish') {
      return hetJson_(HET_adminMigrateEnglish_());
    }
    if (String(p.admin || '').toLowerCase() === 'dropnoisyoutbox') {
      return hetJson_(runDropNoisyOutbox_AlertsBridge());
    }
    if (String(p.admin || '').toLowerCase() === 'droppendingoutbox') {
      return hetJson_(runDropPendingOutbox_AlertsBridge());
    }
    if (String(p.admin || '').toLowerCase() === 'runalertcycle') {
      runAlertCycle();
      return hetJson_({ ok: true, message: 'Alert cycle executed.' });
    }
    if (String(p.admin || '').toLowerCase() === 'rundailyreport') {
      HET_dailyReport();
      return hetJson_({ ok: true, message: 'Daily report executed.' });
    }
    if (String(p.admin || '').toLowerCase() === 'senddailytelegram') {
      return hetJson_(sendDailySummaryTelegramNow());
    }
    if (String(p.admin || '').toLowerCase() === 'livereporttelegram') {
      return hetJson_(sendLiveSummaryTelegramNow());
    }
    if (String(p.admin || '').toLowerCase() === 'report' || String(p.admin || '').toLowerCase() === '/report') {
      return hetJson_(sendLiveSummaryTelegramNow());
    }
    if (String(p.admin || '').toLowerCase() === 'senddailyemail') {
      return hetJson_(sendDailySummaryEmailNow());
    }
    if (String(p.admin || '').toLowerCase() === 'refreshdashboard') {
      if (typeof runDashboardRefresh === 'function') {
        runDashboardRefresh();
      } else {
        HET_dashRefresh();
      }
      return hetJson_({ ok: true, message: 'Dashboard refreshed.' });
    }
    if (String(p.admin || '').toLowerCase() === 'docsync') {
      return hetJson_(updateHetDocumentation());
    }
    if (String(p.admin || '').toLowerCase() === 'verifytriggers') {
      return hetJson_(verifyTriggers());
    }
    if (String(p.admin || '').toLowerCase() === 'runtimehealth') {
      return hetJson_(typeof HET_getRuntimeHealth_ === 'function' ? HET_getRuntimeHealth_() : { ok: false, error: 'Runtime helper missing' });
    }
    if (String(p.admin || '').toLowerCase() === 'runruntimehealthcheck') {
      return hetJson_(typeof runRuntimeHealthCheck === 'function' ? runRuntimeHealthCheck() : { ok: false, error: 'Runtime check helper missing' });
    }
    if (String(p.admin || '').toLowerCase() === 'maintenance') {
      return hetJson_(typeof runMaintenanceCycle === 'function' ? runMaintenanceCycle() : { ok: false, error: 'Maintenance helper missing' });
    }
    if (String(p.admin || '').toLowerCase() === 'refreshtopusers') {
      return hetJson_(typeof HET_writeTopUserSheets_ === 'function' ? HET_writeTopUserSheets_() : { ok: false, error: 'Top users helper missing' });
    }
    if (String(p.admin || '').toLowerCase() === 'topusers') {
      return hetJson_(typeof HET_getTopUsersApi_ === 'function'
        ? HET_getTopUsersApi_(p.limit || 10, p.period || 'daily')
        : { ok: false, error: 'Top users helper missing' });
    }
    if (String(p.admin || '').toLowerCase() === 'runmonthlytopusers') {
      return hetJson_(typeof HET_monthlyTopUsersReport_ === 'function'
        ? HET_monthlyTopUsersReport_()
        : { ok: false, error: 'Monthly top users helper missing' });
    }
    if (String(p.admin || '').toLowerCase() === 'runcommands') {
      return hetJson_(HET_runCommandCycle_());
    }
    if (String(p.admin || '').toLowerCase() === 'summary') {
      return hetJson_(HET_adminSmartSummary_(p));
    }
    if (String(p.admin || '').toLowerCase() === 'brief') {
      return hetJson_(HET_adminSmartSummary_(p));
    }
    if (String(p.admin || '').toLowerCase() === 'seedcommands') {
      return hetJson_(HET_seedCommandTests_());
    }
    if (String(p.admin || '').toLowerCase() === 'tgdebug') {
      if (typeof HET_adminTelegramDebug_ === 'function') {
        return hetJson_(HET_adminTelegramDebug_());
      }
      return hetJson_({ ok: false, error: 'Telegram debug helper missing' });
    }
    if (String(p.admin || '').toLowerCase() === 'tgpoll') {
      if (typeof HET_adminTelegramPollNow_ === 'function') {
        return hetJson_(HET_adminTelegramPollNow_());
      }
      return hetJson_({ ok: false, error: 'Telegram poll helper missing' });
    }
    hetEnsureRuntimeReady_();

    var type = hetSafeStr_(p.type, 50).toLowerCase();
    if (!type) {
      hetAppendRaw_(true, 'unknown', p.site || '', p.router || '', { reason: 'missing type', p: p });
      return hetText_('OK');
    }

    if (type === 'test') return hetText_('OK');

    HET_ingest(e);
    return hetText_('OK');
  } catch (err) {
    try {
      hetAppendRaw_(true, 'exception', p.site || '', p.router || '', { message: String(err) });
    } catch (_) {}
    if (p && p.admin) {
      return hetJson_({ ok: false, admin: String(p.admin), error: String(err) });
    }
    return hetText_('OK');
  }
}

function doPost(e) {
  var payload = {};
  var rawBody = '';
  try {
    if (e && e.postData && e.postData.contents) {
      rawBody = String(e.postData.contents || '');
      try {
        payload = JSON.parse(rawBody);
      } catch (_) {
        payload = (e && e.parameter) ? e.parameter : {};
      }
    } else {
      payload = (e && e.parameter) ? e.parameter : {};
    }

    // Some gateways can send nested fields as JSON strings inside form payload.
    if (payload && typeof payload.message === 'string') {
      payload.message = hetSafeJsonParse_(payload.message, payload.message);
    }
    if (payload && typeof payload.edited_message === 'string') {
      payload.edited_message = hetSafeJsonParse_(payload.edited_message, payload.edited_message);
    }
    if (payload && typeof payload.channel_post === 'string') {
      payload.channel_post = hetSafeJsonParse_(payload.channel_post, payload.channel_post);
    }
    if (payload && typeof payload.edited_channel_post === 'string') {
      payload.edited_channel_post = hetSafeJsonParse_(payload.edited_channel_post, payload.edited_channel_post);
    }

    if (typeof HET_tgDebugLog_ === 'function' && typeof HET_isTelegramUpdate_ === 'function' && HET_isTelegramUpdate_(payload)) {
      HET_tgDebugLog_('doPost_receive', {
        hasPostData: !!(e && e.postData),
        contentLength: rawBody ? rawBody.length : 0,
        hasMessage: !!(payload && payload.message),
        hasEditedMessage: !!(payload && payload.edited_message),
        hasChannelPost: !!(payload && payload.channel_post),
        updateId: payload && payload.update_id
      });
    }

    if (typeof HET_isTelegramUpdate_ === 'function' && HET_isTelegramUpdate_(payload)) {
      if (typeof HET_handleTelegramUpdate_ === 'function') {
        return hetJson_(HET_handleTelegramUpdate_(payload));
      }
      return hetJson_({ ok: false, error: 'Telegram handler missing' });
    }

    return doGet({ parameter: payload || {} });
  } catch (err) {
    try {
      if (typeof HET_tgDebugLog_ === 'function') {
        HET_tgDebugLog_('doPost_error', {
          error: String(err),
          hasPayload: !!payload,
          updateId: payload && payload.update_id
        });
      }
      hetAppendRaw_(true, 'telegram_webhook_exception', '', '', {
        message: String(err),
        updateId: payload && payload.update_id ? payload.update_id : '',
        hasMessage: !!(payload && payload.message),
        hasChannelPost: !!(payload && payload.channel_post)
      });
    } catch (_) {}
    return hetText_('OK');
  }
}
