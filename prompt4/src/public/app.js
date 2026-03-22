(function () {
  'use strict';

  var shortenForm = document.getElementById('shorten-form');
  var urlInput = document.getElementById('url-input');
  var customCode = document.getElementById('custom-code');
  var expiresIn = document.getElementById('expires-in');
  var resultDiv = document.getElementById('result');
  var shortUrlLink = document.getElementById('short-url');
  var copyBtn = document.getElementById('copy-btn');
  var urlTableBody = document.querySelector('#url-table tbody');
  var statsSection = document.getElementById('stats-section');
  var statsDetail = document.getElementById('stats-detail');
  var closeStatsBtn = document.getElementById('close-stats');

  // -- 유틸 --

  function formatDate(dateStr) {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR');
  }

  function truncateUrl(url, max) {
    if (!url) return '';
    if (url.length <= max) return url;
    return url.substring(0, max) + '...';
  }

  // -- URL 단축 폼 제출 --

  shortenForm.addEventListener('submit', function (e) {
    e.preventDefault();

    var body = { url: urlInput.value };
    if (customCode.value.trim()) {
      body.customCode = customCode.value.trim();
    }
    if (expiresIn.value) {
      body.expiresIn = Number(expiresIn.value);
    }

    fetch('/api/shorten', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (!res.ok) {
          return res.json().then(function (data) {
            throw new Error(data.error || '요청에 실패했습니다.');
          });
        }
        return res.json();
      })
      .then(function (data) {
        shortUrlLink.href = data.shortUrl;
        shortUrlLink.textContent = data.shortUrl;
        resultDiv.classList.remove('hidden');
        shortenForm.reset();
        loadUrls();
      })
      .catch(function (err) {
        alert('단축 실패: ' + err.message);
      });
  });

  // -- 복사 버튼 --

  copyBtn.addEventListener('click', function () {
    var url = shortUrlLink.textContent;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(function () {
        copyBtn.textContent = '복사됨!';
        setTimeout(function () {
          copyBtn.textContent = '복사';
        }, 2000);
      }).catch(function () {
        alert('복사에 실패했습니다.');
      });
    } else {
      alert('이 브라우저에서는 복사 기능을 지원하지 않습니다.');
    }
  });

  // -- URL 목록 로드 --

  function loadUrls() {
    fetch('/api/urls')
      .then(function (res) {
        if (!res.ok) throw new Error('목록을 불러올 수 없습니다.');
        return res.json();
      })
      .then(function (urls) {
        renderUrlTable(urls);
      })
      .catch(function (err) {
        alert('목록 로드 실패: ' + err.message);
      });
  }

  function renderUrlTable(urls) {
    urlTableBody.innerHTML = '';

    if (!urls || urls.length === 0) {
      var row = document.createElement('tr');
      var cell = document.createElement('td');
      cell.colSpan = 5;
      cell.textContent = '등록된 URL이 없습니다.';
      cell.style.textAlign = 'center';
      cell.style.color = '#6B7280';
      row.appendChild(cell);
      urlTableBody.appendChild(row);
      return;
    }

    urls.forEach(function (item) {
      var tr = document.createElement('tr');

      var tdCode = document.createElement('td');
      tdCode.textContent = item.code;
      tr.appendChild(tdCode);

      var tdUrl = document.createElement('td');
      tdUrl.title = item.originalUrl;
      tdUrl.textContent = truncateUrl(item.originalUrl, 40);
      tr.appendChild(tdUrl);

      var tdClicks = document.createElement('td');
      tdClicks.textContent = item.clicks;
      tr.appendChild(tdClicks);

      var tdExpires = document.createElement('td');
      tdExpires.textContent = formatDate(item.expiresAt);
      tr.appendChild(tdExpires);

      var tdStats = document.createElement('td');
      var statsBtn = document.createElement('button');
      statsBtn.className = 'stats-btn';
      statsBtn.textContent = '통계';
      statsBtn.addEventListener('click', function () {
        loadStats(item.code);
      });
      tdStats.appendChild(statsBtn);
      tr.appendChild(tdStats);

      urlTableBody.appendChild(tr);
    });
  }

  // -- 통계 로드 --

  function loadStats(code) {
    fetch('/api/urls/' + encodeURIComponent(code) + '/stats')
      .then(function (res) {
        if (!res.ok) throw new Error('통계를 불러올 수 없습니다.');
        return res.json();
      })
      .then(function (data) {
        renderStats(data);
        statsSection.classList.remove('hidden');
        statsSection.scrollIntoView({ behavior: 'smooth' });
      })
      .catch(function (err) {
        alert('통계 로드 실패: ' + err.message);
      });
  }

  function renderStats(data) {
    var html = '';

    html += '<dl class="stats-info">';
    html += '<dt>코드</dt><dd>' + escapeHtml(data.code) + '</dd>';
    html += '<dt>원본 URL</dt><dd>' + escapeHtml(data.originalUrl) + '</dd>';
    html += '<dt>총 클릭수</dt><dd>' + data.clicks + '</dd>';
    html += '<dt>생성일</dt><dd>' + formatDate(data.createdAt) + '</dd>';
    html += '<dt>만료일</dt><dd>' + formatDate(data.expiresAt) + '</dd>';
    html += '</dl>';

    if (data.clickHistory && data.clickHistory.length > 0) {
      html += '<h3>최근 클릭 기록</h3>';
      html += '<div class="table-wrapper">';
      html += '<table>';
      html += '<thead><tr><th>시간</th><th>User Agent</th><th>IP</th></tr></thead>';
      html += '<tbody>';
      data.clickHistory.forEach(function (click) {
        html += '<tr>';
        html += '<td>' + formatDate(click.timestamp) + '</td>';
        html += '<td>' + escapeHtml(truncateUrl(click.userAgent || '-', 40)) + '</td>';
        html += '<td>' + escapeHtml(click.ip || '-') + '</td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      html += '</div>';
    } else {
      html += '<p style="color:#6B7280;">클릭 기록이 없습니다.</p>';
    }

    statsDetail.innerHTML = html;
  }

  function escapeHtml(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // -- 닫기 버튼 --

  closeStatsBtn.addEventListener('click', function () {
    statsSection.classList.add('hidden');
  });

  // -- 초기 로드 --

  loadUrls();
})();
