/* ============================================================
   XXXUAN-Archive 公共层 common.js
   只放“两个页面都要用”的工具：URL 校验 / sanitize / fetch / 弹窗 / 颜色
   业务逻辑不放这里。
   ============================================================ */
(() => {
  'use strict';

  /* ---------- URL 校验 ---------- */
  function normalizeUrl(raw) {
    if (typeof raw !== 'string' || !raw.trim()) return null;
    try {
      const u = new URL(raw.trim(), location.href);
      if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
      if (u.username || u.password) return null;
      return u.href;
    } catch {
      return null;
    }
  }

  /* ---------- HTML sanitize ---------- */
  const SANITIZE_ALLOWED_TAGS = new Set([
    'P', 'BR', 'STRONG', 'B', 'EM', 'I', 'U', 'S',
    'A', 'UL', 'OL', 'LI',
    'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
    'BLOCKQUOTE', 'CODE', 'PRE', 'SPAN', 'DIV', 'HR',
    'SUB', 'SUP', 'MARK', 'DEL', 'INS',
    'IMG'
  ]);

  const DROP_TAGS = new Set([
    'SCRIPT', 'STYLE', 'IFRAME', 'OBJECT', 'EMBED',
    'LINK', 'META', 'BASE', 'FORM', 'INPUT', 'BUTTON',
    'TEXTAREA', 'SELECT', 'OPTION', 'SVG', 'MATH'
  ]);

  const SANITIZE_TAG_ATTRS = {
    'A': new Set(['href', 'title', 'target', 'rel']),
    'IMG': new Set(['src', 'alt', 'title', 'width', 'height', 'loading'])
  };

  function sanitizeToFragment(html) {
    const template = document.createElement('template');
    template.innerHTML = String(html ?? '');

    function cleanNode(node) {
      if (node.nodeType === Node.TEXT_NODE) return;
      if (node.nodeType !== Node.ELEMENT_NODE) { node.remove(); return; }

      const tag = node.tagName;

      if (DROP_TAGS.has(tag)) { node.remove(); return; }

      if (!SANITIZE_ALLOWED_TAGS.has(tag)) {
        const text = document.createTextNode(node.textContent || '');
        node.replaceWith(text);
        return;
      }

      const allowedAttrs = SANITIZE_TAG_ATTRS[tag] || new Set();
      for (const attr of Array.from(node.attributes)) {
        if (!allowedAttrs.has(attr.name.toLowerCase())) {
          node.removeAttribute(attr.name);
        }
      }

      if (tag === 'A') {
        const safeHref = normalizeUrl(node.getAttribute('href'));
        if (!safeHref) {
          const text = document.createTextNode(node.textContent || '');
          node.replaceWith(text);
          return;
        }
        node.setAttribute('href', safeHref);
        node.setAttribute('rel', 'noopener noreferrer');
        if (node.getAttribute('target') !== '_blank') {
          node.removeAttribute('target');
        }
      }

      if (tag === 'IMG') {
        const safeSrc = normalizeUrl(node.getAttribute('src'));
        if (!safeSrc) {
          // 非法 src：不留破图，降级为 alt 文本
          const alt = node.getAttribute('alt');
          const text = document.createTextNode(alt ? alt : '');
          node.replaceWith(text);
          return;
        }
        node.setAttribute('src', safeSrc);
        if (!node.hasAttribute('loading')) {
          node.setAttribute('loading', 'lazy');
        }
      }

      Array.from(node.childNodes).forEach(cleanNode);
    }

    Array.from(template.content.childNodes).forEach(cleanNode);
    return template.content;
  }

  function setText(el, text) {
    if (el) el.textContent = String(text ?? '');
  }

  function setSanitizedHtml(el, html) {
    if (el) el.replaceChildren(sanitizeToFragment(html));
  }

  /* ---------- fetch JSON ---------- */
  async function fetchJson(url) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    try {
      const res = await fetch(url, { cache: 'no-cache', signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('请求超时，请检查网络后重试');
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /* ---------- 错误渲染 ---------- */
  function renderError(container, message, retryCallback) {
    container.replaceChildren();
    const wrap = document.createElement('div');
    wrap.className = 'error-container';

    const p = document.createElement('p');
    p.className = 'essay-error';
    p.textContent = message;

    const btn = document.createElement('button');
    btn.className = 'retry-btn';
    btn.type = 'button';
    btn.textContent = '🔄 重新加载';
    btn.addEventListener('click', () => {
      container.replaceChildren();
      const loading = document.createElement('p');
      loading.className = 'essay-empty';
      loading.textContent = '正在重新加载...';
      container.appendChild(loading);

      retryCallback();
    });

    wrap.append(p, btn);
    container.appendChild(wrap);
  }

  /* ---------- 焦点工具 ---------- */
  const FOCUSABLE_SELECTOR = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function getFocusable(container) {
    return Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR))
      .filter(el => el.offsetParent !== null || el === document.activeElement);
  }

  function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    const items = getFocusable(container);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    const active = document.activeElement;
    if (e.shiftKey) {
      if (active === first || !container.contains(active)) {
        e.preventDefault(); last.focus();
      }
    } else {
      if (active === last || !container.contains(active)) {
        e.preventDefault(); first.focus();
      }
    }
  }

  /* ---------- 弹窗栈 ---------- */
  class ModalManager {
    constructor(regions) {
      this.regions = regions;
      this.stack = [];
      this.savedScrollY = 0;
      this.supportsInert = 'inert' in HTMLElement.prototype;
    }

    get top() {
      return this.stack.length ? this.stack[this.stack.length - 1] : null;
    }

    get depth() {
      return this.stack.length;
    }

    isOpen(el) {
      return this.stack.some(s => s.el === el);
    }

    _applyInert(el, value) {
      if (this.supportsInert) {
        el.inert = value;
      } else {
        if (value) {
          el.setAttribute('aria-hidden', 'true');
          el.style.pointerEvents = 'none';
        } else {
          el.removeAttribute('aria-hidden');
          el.style.pointerEvents = '';
        }
      }
    }

    _isMobile() {
      return window.matchMedia('(max-width: 820px)').matches;
    }

    _sync() {
      const anyOpen = this.depth > 0;

      this.regions.forEach(el => this._applyInert(el, anyOpen));

      this.stack.forEach((s, idx) => {
        const isTop = idx === this.stack.length - 1;
        this._applyInert(s.el, !isTop);
        s.el.setAttribute('aria-hidden', String(!isTop));
        if (isTop) s.el.setAttribute('aria-modal', 'true');
        else s.el.removeAttribute('aria-modal');
      });

      const locked = document.body.classList.contains('modal-open');
      if (anyOpen && !locked) {
        if (this._isMobile()) {
          this.savedScrollY = window.scrollY || window.pageYOffset || 0;
          document.body.style.top = `-${this.savedScrollY}px`;
        }
        document.body.classList.add('modal-open');
      } else if (!anyOpen && locked) {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        if (this._isMobile()) {
          window.scrollTo(0, this.savedScrollY);
        }
      }
    }

    open(el, opts = {}) {
      if (!el || this.isOpen(el)) return;

      const entry = {
        el,
        trigger: opts.trigger || document.activeElement,
        backLabel: opts.backLabel || null
      };

      if (entry.backLabel) {
        const backBtn = el.querySelector('.back-btn');
        if (backBtn) backBtn.textContent = entry.backLabel;
      }

      this.stack.push(entry);
      el.classList.add('is-open');
      el.setAttribute('aria-hidden', 'false');
      this._sync();

      requestAnimationFrame(() => {
        el.scrollTop = 0;
        const target =
          el.querySelector('.back-btn') ||
          el.querySelector('.close-btn') ||
          el.querySelector('button, [href]');
        target?.focus({ preventScroll: true });
      });
    }

    close(el) {
      const idx = this.stack.findIndex(s => s.el === el);
      if (idx === -1) return;

      const isTop = idx === this.stack.length - 1;
      const [entry] = this.stack.splice(idx);

      el.classList.remove('is-open');
      el.setAttribute('aria-hidden', 'true');
      this._sync();

      if (isTop) {
        if (entry.trigger && document.contains(entry.trigger) && typeof entry.trigger.focus === 'function') {
          entry.trigger.focus({ preventScroll: true });
        }
      } else if (this.top) {
        const newTop = this.top.el;
        const target = newTop.querySelector('.back-btn, .close-btn');
        target?.focus({ preventScroll: true });
      }
    }

    closeTop() {
      if (this.top) this.close(this.top.el);
    }
  }

  /* ---------- 颜色工具 ---------- */
  function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return `${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)}`;
  }

  function normalizeHex6(hex) {
    const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return null;
    let h = m[1];
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    return `#${h.toLowerCase()}`;
  }

  /* ---------- 导出 ---------- */
  window.XXXUAN = {
    normalizeUrl,
    sanitizeToFragment,
    setText,
    setSanitizedHtml,
    fetchJson,
    renderError,
    getFocusable,
    trapFocus,
    ModalManager,
    hexToRgb,
    normalizeHex6
  };
})();