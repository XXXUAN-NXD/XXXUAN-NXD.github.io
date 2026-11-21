(() => {
  'use strict';

  const { normalizeUrl, sanitizeToFragment, setText, setSanitizedHtml, fetchJson, renderError, trapFocus, ModalManager, hexToRgb, normalizeHex6 } = window.XXXUAN;

  /* ============================================================
     一、28小时制时钟逻辑
     ============================================================ */
  const clockTimeEl = document.getElementById('clock-time');
  const clockDateEl = document.getElementById('clock-date');
  const clockTextEl = document.getElementById('clock-text');

  function updateClock() {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    const s = now.getSeconds();
    let displayH = h;
    let text = "";

    if (h < 4) {
      displayH = h + 24;
      if (displayH === 24) text = "位于时间的延长线上——当人们谈起今夜……";
      else if (displayH >= 25 && displayH <= 27) text = "夜深了，时间只属于还清醒的人";
    } else if (h >= 4 && h < 12) {
      text = "上午好——在忙吗？还是在摸鱼……";
    } else if (h >= 12 && h < 18) {
      text = "下午好——放松一下吧，何必如此（？装作）忙碌呢";
    } else {
      text = "日暮而息——欢迎取回你的时间……或者还有事要忙？";
    }

    const displayDate = new Date(now);
    if (h < 4) {
      displayDate.setDate(displayDate.getDate() - 1);
    }

    const year = displayDate.getFullYear();
    const month = displayDate.getMonth() + 1;
    const date = displayDate.getDate();
    const days = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const dayOfWeek = days[displayDate.getDay()];

    const dateStr = `${year}年${month}月${date}日 ${dayOfWeek}`;
    const timeStr = `${String(displayH).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;

    clockTimeEl.textContent = timeStr;
    clockDateEl.textContent = dateStr;
    clockTextEl.textContent = text;
  }

  let clockTimer = null;

  function scheduleNextClockTick() {
    if (clockTimer) clearTimeout(clockTimer);
    const delay = 1000 - (Date.now() % 1000);
    clockTimer = setTimeout(() => {
      updateClock();
      scheduleNextClockTick();
    }, delay);
  }

  function startClock() {
    updateClock();
    scheduleNextClockTick();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startClock();
  });

  startClock();

  /* ============================================================
     二、BGM 控制
     ============================================================ */
  const bgm = document.getElementById('bgm');
  const musicBtn = document.getElementById('music-btn');
  const bgmInfo = document.getElementById('bgm-info');
  const BGM_TEXT = 'BGM：25時の情熱Inst. -カンザキイオリ ©SEGA / ©Colorful Palette Inc.';
  let bgmToggling = false;
  let bgmErrorTimer = null;

  function setBgmUI(playing) {
    musicBtn.textContent = playing ? '⏸ 夜幕の静謐戻る' : '▶ ２５時の旋律';
    musicBtn.setAttribute('aria-pressed', String(playing));
    if (playing) {
      if (bgmErrorTimer) { clearTimeout(bgmErrorTimer); bgmErrorTimer = null; }
      bgmInfo.textContent = BGM_TEXT;
      bgmInfo.classList.add('show');
      bgmInfo.setAttribute('aria-hidden', 'false');
    } else {
      if (!bgmErrorTimer) {
        bgmInfo.classList.remove('show');
        bgmInfo.setAttribute('aria-hidden', 'true');
      }
    }
  }

  function showBgmError() {
    if (bgmErrorTimer) clearTimeout(bgmErrorTimer);
    bgmInfo.textContent = '音频加载失败，请检查网络后重试';
    bgmInfo.classList.add('show');
    bgmInfo.setAttribute('aria-hidden', 'false');
    bgmErrorTimer = setTimeout(() => {
      bgmErrorTimer = null;
      if (bgm.paused) {
        bgmInfo.textContent = BGM_TEXT;
        bgmInfo.classList.remove('show');
        bgmInfo.setAttribute('aria-hidden', 'true');
      }
    }, 3000);
  }

  bgm.addEventListener('play', () => setBgmUI(true));
  bgm.addEventListener('pause', () => setBgmUI(false));

  bgm.addEventListener('error', () => {
    console.error('BGM 播放出错');
    setBgmUI(false);
    showBgmError();
  }, true);

  musicBtn.addEventListener('click', async () => {
    if (bgmToggling) return;
    bgmToggling = true;
    musicBtn.disabled = true;
    try {
      if (!bgm.paused) { bgm.pause(); return; }
      await bgm.play();
    } catch (err) {
      console.error('BGM 播放失败：', err);
      setBgmUI(false);
      showBgmError();
    } finally {
      bgmToggling = false; musicBtn.disabled = false;
    }
  });

  /* ============================================================
     三、渐弱跳转音乐馆
     ============================================================ */
  let leavingToMusic = false;

  document.getElementById('go-to-music').addEventListener('click', () => {
    if (leavingToMusic) return;
    leavingToMusic = true;

    if (!bgm.paused) {
      let vol = bgm.volume;
      const fadeOut = setInterval(() => {
        if (vol > 0.05) {
          vol -= 0.05;
          bgm.volume = vol;
        } else {
          clearInterval(fadeOut);
          bgm.pause();
          window.location.href = 'music.html';
        }
      }, 50);
    } else {
      window.location.href = 'music.html';
    }
  });

  /* ============================================================
     四、通用工具
     工具函数已迁移到 common.js，通过 window.XXXUAN 引入
     ============================================================ */

  /* ============================================================
     五、弹窗统一管理（ModalManager 由公共层提供）
     ============================================================ */

  const pageRegions = [
    document.querySelector('.content'),
    document.querySelector('.projects'),
    document.querySelector('.music-btn'),
    document.querySelector('.color-picker-wrap')
  ].filter(Boolean);

  const modalManager = new ModalManager(pageRegions);

  /* ============================================================
     六、数据统计模块加载
     ============================================================ */
  function calculateDays() {
    const startDate = new Date('2026-10-19T00:00:00');
    const now = new Date();
    const startMs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate()).getTime();
    const nowMs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const diffMs = nowMs - startMs;
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    document.getElementById('stat-days').textContent = Math.max(0, days + 1) + ' DAYS';
  }
  calculateDays();

  async function loadConfig() {
    try {
      const data = await fetchJson('config.json');
      if (data && data.version) {
        document.getElementById('stat-version').textContent = 'v' + String(data.version);
      }
    } catch (err) {
      console.error('加载版本号失败：', err);
    }
  }
  loadConfig();

  /* ============================================================
     七、自我介绍模块
     ============================================================ */
  const introModal = document.getElementById('intro-modal');
  let introLoaded = false;

  async function loadIntro() {
    const introArea = document.getElementById('intro-content-area');
    try {
      if (location.protocol === 'file:') throw new Error('请用 Live Server 或部署到线上。');
      const data = await fetchJson('intro.json');
      if (!data || typeof data !== 'object' || typeof data.content !== 'string') {
        throw new Error('intro.json 格式不正确（应为 { "content": "..." }）');
      }
      setSanitizedHtml(introArea, data.content);
      introLoaded = true;
    } catch (err) {
      console.error('加载自我介绍失败：', err);
      introLoaded = false;
      renderError(introArea, `数据加载失败：${err.message}`, () => {
        loadIntro();
      });
    }
  }

  /* ============================================================
     八、创意工坊模块
     ============================================================ */
  const worksModal = document.getElementById('works-modal');
  const catalogModal = document.getElementById('catalog-modal');
  const detailView = document.getElementById('essay-detail-view');
  const detailBackBtn = document.getElementById('detail-back-btn');
  const worksListContainer = document.getElementById('works-list-container');
  const catalogListContainer = document.getElementById('catalog-list-container');
  const catalogTitle = document.getElementById('catalog-title');

  let worksData = [];
  let worksLoaded = false;

  function renderWorks() {
    worksListContainer.replaceChildren();

    if (!worksData.length) {
      const p = document.createElement('p');
      p.className = 'essay-empty';
      p.textContent = '这里还空空如也……';
      worksListContainer.appendChild(p);
      return;
    }

    const frag = document.createDocumentFragment();

    worksData.forEach((work, index) => {
      const card = document.createElement('div');
      card.className = 'essay-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const title = String(work.title || '无标题');
      card.setAttribute('aria-label', `查看作品：${title}`);

      const h3 = document.createElement('h3');
      setText(h3, title);

      const chapterCount = Array.isArray(work.chapters) ? work.chapters.length : 0;
      const span = document.createElement('span');
      span.className = 'essay-date';
      setText(span, `共 ${chapterCount} 个章节`);

      const p = document.createElement('p');
      setText(p, work.summary || '');

      card.append(h3, span, p);
      card.addEventListener('click', () => openCatalog(index, card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openCatalog(index, card);
        }
      });

      frag.appendChild(card);
    });

    worksListContainer.appendChild(frag);
  }

  async function loadWorks() {
    try {
      if (location.protocol === 'file:') throw new Error('请用 Live Server 或部署到线上。');
      const data = await fetchJson('works.json');
      if (!Array.isArray(data)) throw new Error('请敲打开发者：“JSON 顶层必须是数组”');
      worksData = data.filter(item => item && typeof item === 'object' && !Array.isArray(item));
      renderWorks();
    } catch (err) {
      console.error('加载工坊失败：', err);
      worksLoaded = false;
      renderError(worksListContainer, `数据加载失败：${err.message}`, () => {
        worksLoaded = true;
        loadWorks();
      });
    }
  }

  function openCatalog(workIndex, triggerEl) {
    const work = worksData[workIndex];
    if (!work) return;

    catalogTitle.textContent = `${work.title || '无标题'} - 目录`;
    catalogListContainer.replaceChildren();

    if (!Array.isArray(work.chapters) || !work.chapters.length) {
      const p = document.createElement('p');
      p.className = 'essay-empty';
      p.textContent = '这部作品还没有添加章节。';
      catalogListContainer.appendChild(p);
    } else {
      const frag = document.createDocumentFragment();

      work.chapters.forEach((chapter) => {
        const card = document.createElement('div');
        card.className = 'essay-card';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');

        const chapterTitle = String(chapter.title || '无标题');
        card.setAttribute('aria-label', `阅读章节：${chapterTitle}`);

        const h3 = document.createElement('h3');
        setText(h3, chapterTitle);

        const date = document.createElement('span');
        date.className = 'essay-date';
        setText(date, chapter.date || '');

        card.append(h3, date);
        card.addEventListener('click', () => openWorkDetail(chapter, work.title, card));
        card.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openWorkDetail(chapter, work.title, card);
          }
        });

        frag.appendChild(card);
      });

      catalogListContainer.appendChild(frag);
    }

    modalManager.open(catalogModal, { trigger: triggerEl });
  }

  function openWorkDetail(chapter, workTitle, triggerEl) {
    setText(document.getElementById('detail-title'), chapter.title || '无标题');
    setText(
      document.getElementById('detail-date'),
      `${chapter.date || ''} | 所属作品：${workTitle}`
    );
    setSanitizedHtml(document.getElementById('detail-body'), chapter.content || '');

    modalManager.open(detailView, {
      trigger: triggerEl,
      backLabel: '← 返回目录'
    });
  }

  /* ============================================================
     九、随笔模块
     ============================================================ */
  const essayModal = document.getElementById('essay-modal');
  const listContainer = document.getElementById('essay-list-container');
  let essaysData = [];
  let essaysLoaded = false;

  function openEssayDetail(index, triggerEl) {
    const essay = essaysData[index];
    if (!essay) return;

    setText(document.getElementById('detail-title'), essay.title || '无标题');
    setText(document.getElementById('detail-date'), essay.date || '');
    setSanitizedHtml(document.getElementById('detail-body'), essay.content || '');

    modalManager.open(detailView, {
      trigger: triggerEl,
      backLabel: '← 返回列表'
    });
  }

  function renderEssays() {
    listContainer.replaceChildren();

    if (!essaysData.length) {
      const p = document.createElement('p');
      p.className = 'essay-empty';
      p.textContent = '这里还空空如也……';
      listContainer.appendChild(p);
      return;
    }

    const frag = document.createDocumentFragment();

    essaysData.forEach((essay, index) => {
      const card = document.createElement('div');
      card.className = 'essay-card';
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const title = String(essay.title || '无标题');
      card.setAttribute('aria-label', `阅读随笔：${title}`);

      const h3 = document.createElement('h3');
      setText(h3, title);

      const date = document.createElement('span');
      date.className = 'essay-date';
      setText(date, essay.date || '');

      const p = document.createElement('p');
      setText(p, essay.summary || '');

      card.append(h3, date, p);
      card.addEventListener('click', () => openEssayDetail(index, card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEssayDetail(index, card);
        }
      });

      frag.appendChild(card);
    });

    listContainer.appendChild(frag);
  }

  async function loadEssays() {
    try {
      if (location.protocol === 'file:') throw new Error('请用 Live Server 或部署到线上。');
      const data = await fetchJson('essays.json');
      if (!Array.isArray(data)) throw new Error('JSON 顶层必须是数组');
      essaysData = data.filter(item => item && typeof item === 'object' && !Array.isArray(item));
      renderEssays();
    } catch (err) {
      console.error('加载随笔失败：', err);
      essaysLoaded = false;
      renderError(listContainer, `数据加载失败：${err.message}`, () => {
        essaysLoaded = true;
        loadEssays();
      });
    }
  }

  /* ============================================================
     十、友情链接模块
     ============================================================ */
  const linksModal = document.getElementById('links-modal');
  const linksContainer = document.getElementById('links-container');
  let linksLoaded = false;

  async function loadLinks() {
    try {
      if (location.protocol === 'file:') throw new Error('请用 Live Server 或部署到线上。');
      const data = await fetchJson('links.json');
      linksContainer.replaceChildren();

      if (!Array.isArray(data) || data.length === 0) {
        const p = document.createElement('p');
        p.className = 'essay-empty';
        p.textContent = '这里还空空如也……';
        linksContainer.appendChild(p);
        return;
      }

      const frag = document.createDocumentFragment();

      data.forEach((link) => {
        if (!link || typeof link !== 'object') return;
        const safeUrl = normalizeUrl(link.url);
        if (!safeUrl) return;

        const a = document.createElement('a');
        a.href = safeUrl;
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = 'friend-link';

        const infoDiv = document.createElement('div');
        infoDiv.className = 'friend-info';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'friend-name';
        nameSpan.textContent = link.name || '未命名站点';

        const urlSpan = document.createElement('span');
        urlSpan.className = 'friend-url';
        urlSpan.textContent = safeUrl;

        infoDiv.append(nameSpan, urlSpan);

        const descSpan = document.createElement('span');
        descSpan.className = 'friend-desc';
        descSpan.textContent = link.desc ? `${link.desc} →` : '访问 →';

        a.append(infoDiv, descSpan);
        frag.appendChild(a);
      });

      if (!frag.childNodes.length) {
        const p = document.createElement('p');
        p.className = 'essay-empty';
        p.textContent = '这里还空空如也……';
        linksContainer.appendChild(p);
        return;
      }

      linksContainer.appendChild(frag);
    } catch (err) {
      console.error('加载友链失败：', err);
      linksLoaded = false;
      renderError(linksContainer, `友链数据加载失败：${err.message}`, () => {
        linksLoaded = true;
        loadLinks();
      });
    }
  }

  /* ============================================================
     十一、UI 交互 + 懒加载接入
     ============================================================ */
  document.getElementById('open-essays').addEventListener('click', (e) => {
    modalManager.open(essayModal, { trigger: e.currentTarget });
    if (!essaysLoaded) { essaysLoaded = true; loadEssays(); }
  });
  document.getElementById('close-essay').addEventListener('click', () => modalManager.close(essayModal));

  document.getElementById('open-works').addEventListener('click', (e) => {
    modalManager.open(worksModal, { trigger: e.currentTarget });
    if (!worksLoaded) { worksLoaded = true; loadWorks(); }
  });
  document.getElementById('close-works').addEventListener('click', () => modalManager.close(worksModal));
  document.getElementById('close-catalog').addEventListener('click', () => modalManager.close(catalogModal));

  document.getElementById('open-intro').addEventListener('click', (e) => {
    modalManager.open(introModal, { trigger: e.currentTarget });
    if (!introLoaded) { introLoaded = true; loadIntro(); }
  });
  document.getElementById('close-intro').addEventListener('click', () => modalManager.close(introModal));

  const statsModal = document.getElementById('stats-modal');
  document.getElementById('open-stats').addEventListener('click', (e) => {
    modalManager.open(statsModal, { trigger: e.currentTarget });
  });
  document.getElementById('close-stats').addEventListener('click', () => modalManager.close(statsModal));

  document.getElementById('open-links').addEventListener('click', (e) => {
    modalManager.open(linksModal, { trigger: e.currentTarget });
    if (!linksLoaded) { linksLoaded = true; loadLinks(); }
  });
  document.getElementById('close-links').addEventListener('click', () => modalManager.close(linksModal));

  detailBackBtn.addEventListener('click', () => modalManager.closeTop());

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalManager.top) {
        modalManager.closeTop();
      }
      return;
    }
    const top = modalManager.top;
    if (top) trapFocus(top.el, e);
  });

  /* ============================================================
     十二、自定义主题色模块
     ============================================================ */
  const colorPicker = document.getElementById('theme-color-picker');
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');

  function applyThemeColor(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return;
    document.documentElement.style.setProperty('--accent', hex);
    document.documentElement.style.setProperty('--accent-rgb', rgb);
    if (themeColorMeta) themeColorMeta.setAttribute('content', hex);
  }

  let savedColor = null;
  try { savedColor = localStorage.getItem('archive-theme-color'); } catch {}
  const normalizedSaved = normalizeHex6(savedColor);
  if (normalizedSaved && hexToRgb(normalizedSaved)) {
    applyThemeColor(normalizedSaved);
    colorPicker.value = normalizedSaved;
  }

  function handleColorChange(e) {
    const newColor = e.target.value;
    applyThemeColor(newColor);
    try { localStorage.setItem('archive-theme-color', newColor); } catch {}
  }

  colorPicker.addEventListener('input', handleColorChange);
  colorPicker.addEventListener('change', handleColorChange);

})();