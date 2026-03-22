(function () {
  "use strict";

  const API_BASE = "/api";

  // ===== DOM References =====
  const form = document.getElementById("shorten-form");
  const urlInput = document.getElementById("url-input");
  const slugInput = document.getElementById("slug-input");
  const expiresSelect = document.getElementById("expires-select");
  const submitBtn = document.getElementById("submit-btn");
  const resultSection = document.getElementById("result-section");
  const resultUrl = document.getElementById("result-url");
  const urlsTable = document.getElementById("urls-table");
  const urlsTbody = document.getElementById("urls-tbody");
  const urlsLoading = document.getElementById("urls-loading");
  const urlsEmpty = document.getElementById("urls-empty");
  const statsOverlay = document.getElementById("stats-overlay");
  const statsTitle = document.getElementById("stats-title");
  const statsTotal = document.getElementById("stats-total");
  const statsToday = document.getElementById("stats-today");
  const statsWeek = document.getElementById("stats-week");
  const statsChart = document.getElementById("stats-chart");
  const toastContainer = document.getElementById("toast-container");

  // ===== Shorten URL =====
  window.shortenUrl = async function (event) {
    event.preventDefault();

    const url = urlInput.value.trim();
    if (!url) return;

    const body = { url };
    const customSlug = slugInput.value.trim();
    if (customSlug) body.customSlug = customSlug;
    const expiresRaw = expiresSelect.value;
    if (expiresRaw) {
      const match = expiresRaw.match(/^(\d+)(h|d)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        body.expiresIn = match[2] === 'd' ? num * 24 : num;
      }
    }

    setSubmitLoading(true);

    try {
      const res = await fetch(`${API_BASE}/shorten`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to shorten URL");
      }

      const shortUrl = data.shortUrl || `${location.origin}/${data.slug}`;
      resultUrl.href = shortUrl;
      resultUrl.textContent = shortUrl;
      resultSection.hidden = false;

      toast("URL shortened successfully!", "success");

      // Reset form fields but keep the result visible
      urlInput.value = "";
      slugInput.value = "";
      expiresSelect.value = "";

      // Refresh the URL list
      loadUrls();
    } catch (err) {
      toast(err.message, "error");
    } finally {
      setSubmitLoading(false);
    }
  };

  function setSubmitLoading(loading) {
    submitBtn.disabled = loading;
    submitBtn.querySelector(".btn-text").hidden = loading;
    submitBtn.querySelector(".btn-loading").hidden = !loading;
  }

  // ===== Load URLs =====
  window.loadUrls = async function () {
    urlsLoading.hidden = false;
    urlsTable.hidden = true;
    urlsEmpty.hidden = true;

    try {
      const res = await fetch(`${API_BASE}/urls`);
      if (!res.ok) throw new Error("Failed to load URLs");

      const data = await res.json();
      const urls = Array.isArray(data) ? data : data.urls || [];

      if (urls.length === 0) {
        urlsEmpty.hidden = false;
        urlsTable.hidden = true;
      } else {
        renderTable(urls);
        urlsTable.hidden = false;
        urlsEmpty.hidden = true;
      }
    } catch (err) {
      toast(err.message, "error");
      urlsEmpty.hidden = false;
    } finally {
      urlsLoading.hidden = true;
    }
  };

  function renderTable(urls) {
    urlsTbody.innerHTML = "";

    urls.forEach(function (item) {
      const tr = document.createElement("tr");
      const shortUrl = item.shortUrl || `${location.origin}/${item.slug}`;

      tr.innerHTML =
        '<td class="cell-short"><a href="' + escapeHtml(shortUrl) + '" target="_blank" rel="noopener">' +
          escapeHtml("/" + item.slug) +
        "</a></td>" +
        '<td class="cell-original" title="' + escapeAttr(item.url || item.originalUrl || "") + '">' +
          escapeHtml(item.url || item.originalUrl || "") +
        "</td>" +
        '<td class="cell-clicks">' + (item.clicks != null ? item.clicks : 0) + "</td>" +
        '<td class="cell-date">' + formatDate(item.createdAt) + "</td>" +
        '<td class="cell-date">' + (item.expiresAt ? formatDate(item.expiresAt) : "Never") + "</td>" +
        '<td><div class="cell-actions">' +
          '<button class="btn btn-stats" data-slug="' + escapeAttr(item.slug) + '">Stats</button>' +
          '<button class="btn btn-danger" data-slug="' + escapeAttr(item.slug) + '">Delete</button>' +
        "</div></td>";

      // Bind event listeners
      tr.querySelector(".btn-stats").addEventListener("click", function () {
        showStats(this.dataset.slug);
      });
      tr.querySelector(".btn-danger").addEventListener("click", function () {
        deleteUrl(this.dataset.slug);
      });

      urlsTbody.appendChild(tr);
    });
  }

  // ===== Delete URL =====
  window.deleteUrl = async function (slug) {
    if (!confirm("Delete this shortened URL? This cannot be undone.")) return;

    try {
      const res = await fetch(`${API_BASE}/urls/${encodeURIComponent(slug)}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const data = await res.json().catch(function () { return {}; });
        throw new Error(data.error || "Failed to delete URL");
      }

      toast("URL deleted", "success");
      loadUrls();
    } catch (err) {
      toast(err.message, "error");
    }
  };

  // ===== Show Stats =====
  window.showStats = async function (slug) {
    statsTitle.textContent = "Stats for /" + slug;
    statsChart.innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    statsTotal.textContent = "-";
    statsToday.textContent = "-";
    statsWeek.textContent = "-";
    statsOverlay.classList.add("visible");
    document.body.style.overflow = "hidden";

    try {
      const res = await fetch(`${API_BASE}/urls/${encodeURIComponent(slug)}/stats`);
      if (!res.ok) throw new Error("Failed to load statistics");

      const data = await res.json();

      statsTotal.textContent = data.totalClicks != null ? data.totalClicks : (data.clicks != null ? data.clicks : 0);
      statsToday.textContent = data.todayClicks != null ? data.todayClicks : 0;
      statsWeek.textContent = data.weekClicks != null ? data.weekClicks : 0;

      // Render daily chart
      var dailyData = data.daily || data.dailyClicks || [];
      if (dailyData.length === 0) {
        dailyData = buildEmptyWeek();
      }
      renderChart(dailyData);
    } catch (err) {
      toast(err.message, "error");
      statsChart.innerHTML = '<p style="text-align:center;color:var(--text-dim);">Could not load chart data</p>';
    }
  };

  function hideStats() {
    statsOverlay.classList.remove("visible");
    document.body.style.overflow = "";
  }

  // X 버튼 클릭
  document.getElementById("close-stats-btn").addEventListener("click", hideStats);

  // 오버레이 배경 클릭
  statsOverlay.addEventListener("click", function (e) {
    if (e.target === statsOverlay) hideStats();
  });

  // ESC 키
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && statsOverlay.classList.contains("visible")) hideStats();
  });

  function buildEmptyWeek() {
    var days = [];
    for (var i = 6; i >= 0; i--) {
      var d = new Date();
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(0, 10), clicks: 0 });
    }
    return days;
  }

  function renderChart(dailyData) {
    var maxClicks = Math.max.apply(null, dailyData.map(function (d) { return d.clicks || 0; }));
    if (maxClicks === 0) maxClicks = 1;

    statsChart.innerHTML = "";

    dailyData.forEach(function (day) {
      var col = document.createElement("div");
      col.className = "bar-column";

      var clicks = day.clicks || 0;
      var heightPercent = (clicks / maxClicks) * 100;

      var value = document.createElement("span");
      value.className = "bar-value";
      value.textContent = clicks;

      var bar = document.createElement("div");
      bar.className = "bar";
      bar.style.height = Math.max(heightPercent, 3) + "%";
      bar.title = clicks + " clicks";

      var label = document.createElement("span");
      label.className = "bar-label";
      var dateObj = new Date(day.date + "T00:00:00");
      label.textContent = dateObj.toLocaleDateString("en", { month: "short", day: "numeric" });

      col.appendChild(value);
      col.appendChild(bar);
      col.appendChild(label);
      statsChart.appendChild(col);
    });
  }

  // ===== Copy to Clipboard =====
  window.copyToClipboard = async function () {
    var text = resultUrl.textContent;
    if (!text) return;

    var copyBtn = document.querySelector(".btn-copy");

    try {
      await navigator.clipboard.writeText(text);
      copyBtn.classList.add("copied");
      copyBtn.querySelector(".copy-label").textContent = "Copied!";
      toast("Copied to clipboard", "success");

      setTimeout(function () {
        copyBtn.classList.remove("copied");
        copyBtn.querySelector(".copy-label").textContent = "Copy";
      }, 2000);
    } catch (err) {
      // Fallback for older browsers
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();

      try {
        document.execCommand("copy");
        copyBtn.classList.add("copied");
        copyBtn.querySelector(".copy-label").textContent = "Copied!";
        toast("Copied to clipboard", "success");

        setTimeout(function () {
          copyBtn.classList.remove("copied");
          copyBtn.querySelector(".copy-label").textContent = "Copy";
        }, 2000);
      } catch (copyErr) {
        toast("Failed to copy", "error");
      }

      document.body.removeChild(textarea);
    }
  };

  // ===== Toast Notifications =====
  function toast(message, type) {
    var el = document.createElement("div");
    el.className = "toast toast-" + (type || "success");
    el.textContent = message;
    toastContainer.appendChild(el);

    setTimeout(function () {
      el.classList.add("toast-out");
      el.addEventListener("animationend", function () {
        el.remove();
      });
    }, 3000);
  }

  // ===== Utilities =====
  function escapeHtml(str) {
    var div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatDate(dateStr) {
    if (!dateStr) return "-";
    var d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  }

  // ===== Init =====
  loadUrls();
})();
