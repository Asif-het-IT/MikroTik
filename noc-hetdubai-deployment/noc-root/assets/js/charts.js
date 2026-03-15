window.NocCharts = (function () {
  function fmtBytes(n) {
    const val = Number(n || 0);
    if (val >= 1024 * 1024 * 1024) return `${(val / (1024 * 1024 * 1024)).toFixed(2)} GB`;
    if (val >= 1024 * 1024) return `${(val / (1024 * 1024)).toFixed(2)} MB`;
    if (val >= 1024) return `${(val / 1024).toFixed(2)} KB`;
    return `${val.toFixed(0)} B`;
  }

  function renderTopUsers(canvasId, rows) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || 600;
    const height = canvas.clientHeight || 220;
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#9eb4ce";
    ctx.font = "12px IBM Plex Mono";

    if (!rows || !rows.length) {
      ctx.fillText("No data available", 16, 24);
      return;
    }

    const maxVal = Math.max(...rows.map((r) => Number(r.total || 0)), 1);
    const chartLeft = 140;
    const chartRight = width - 16;
    const barHeight = 14;
    const gap = 8;

    rows.slice(0, 8).forEach((item, idx) => {
      const y = 20 + idx * (barHeight + gap);
      const value = Number(item.total || 0);
      const ratio = value / maxVal;
      const barWidth = Math.max(2, Math.floor((chartRight - chartLeft) * ratio));
      const label = (item.preferredName || item.comment || item.hostname || "unknown").slice(0, 18);

      ctx.fillStyle = "#9eb4ce";
      ctx.fillText(`${idx + 1}. ${label}`, 10, y + 11);

      ctx.fillStyle = "#2f6fed";
      ctx.fillRect(chartLeft, y, barWidth, barHeight);

      ctx.fillStyle = "#e9f2ff";
      ctx.fillText(fmtBytes(value), chartLeft + barWidth + 6, y + 11);
    });
  }

  return {
    renderTopUsers
  };
})();
