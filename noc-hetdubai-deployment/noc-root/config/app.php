<?php
declare(strict_types=1);

/*
 * Server-side only. Never expose this file publicly.
 * config/.htaccess already blocks direct browser access.
 *
 * NOC_ENDPOINT = Apps Script deployed web app URL
 *   -> Google Apps Script editor -> Deploy -> Manage Deployments -> Copy /exec URL
 *   -> Example: https://script.google.com/macros/s/AKfycbxxxxxxxxxxxxxxx/exec
 *
 * NOC_TOKEN = monitor token set in applyScriptProperties() in Setup.js
 */
const NOC_ENDPOINT = 'https://script.google.com/macros/s/AKfycbx40IW46YtUHZ8_YTLMnU48VIRZwnyqhgVFRJNutKKLZ8MrucMBTxP9yfqf_Dk6_g1O/exec';
const NOC_TOKEN    = 'MONITOR_TOKEN_2026';
