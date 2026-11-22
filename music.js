(() => {
  'use strict';

  const { normalizeUrl, setText, fetchJson, renderError, trapFocus, ModalManager, hexToRgb } = window.XXXUAN;

  /* ================= 1. 主题色同步 ================= */
  let savedColor = null;
  try { savedColor = localStorage.getItem('archive-theme-color'); } catch {}
  if (savedColor) {
    const rgb = hexToRgb(savedColor);
    if (rgb) {
      document.documentElement.style.setProperty('--accent', savedColor);
      document.documentElement.style.setProperty('--accent-rgb', rgb);
    }
  }

  /* ================= 2. DOM 元素 ================= */
  const albumContainer = document.getElementById('album-container');
  const songsModal = document.getElementById('songs-modal');
  const closeSongsBtn = document.getElementById('close-songs');
  const songsContainer = document.getElementById('songs-container');
  const modalAlbumTitle = document.getElementById('modal-album-title');
  const copyrightBar = document.getElementById('modal-copyright-bar');
  const copyrightText = document.getElementById('modal-copyright-text');
  const searchContainer = document.getElementById('search-container');
  const searchInput = document.getElementById('search-input');

  const lyricsModal = document.getElementById('lyrics-modal');
  const closeLyricsBtn = document.getElementById('close-lyrics');
  const lyricsTitle = document.getElementById('lyrics-title');
  const lyricsContent = document.getElementById('lyrics-content');

  const globalPlayer = document.getElementById('global-player');
  const mainPlayBtn = document.getElementById('main-play-btn');
  const playModeBtn = document.getElementById('play-mode-btn');
  const lyricBtn = document.getElementById('lyric-btn');
  // 👇 新增：上一首 / 下一首按钮
  const prevBtn = document.getElementById('prev-btn');
  const nextBtn = document.getElementById('next-btn');

  const playerTitle = document.getElementById('player-title');
  const playerArtist = document.getElementById('player-artist');
  const progressInner = document.getElementById('progress-inner');
  const playerProgress = document.getElementById('player-progress');
  const timeDisplay = document.getElementById('time-display');

  const audio = document.getElementById('global-audio');

  /* ================= 3. ModalManager ================= */
  const pageRegions = [
    document.querySelector('.nav-bar'),
    document.querySelector('.album-gallery')
  ].filter(Boolean);

  const modalManager = new ModalManager(pageRegions);

  /* ================= 4. 状态 ================= */
  let musicData = [];
  let currentPlaylist = [];
  let currentSongObj = null;
  let currentAlbum = null;
  let playMode = 0;

  try {
    const savedMode = parseInt(localStorage.getItem('music-play-mode'), 10);
    if (!isNaN(savedMode)) playMode = Math.min(2, Math.max(0, savedMode));
  } catch {}

  /* ================= 5. 工具 ================= */
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function checkOverflow(el) {
    if (!el) return;
    const container = el.parentElement; // .marquee-container
    if (!container) return;
    if (el.scrollWidth > container.clientWidth) {
      el.classList.add('is-overflowing');
      const distance = el.scrollWidth - container.clientWidth;
      el.style.setProperty('--scroll-distance', `-${distance}px`);
      el.style.setProperty('--scroll-duration', `${Math.max(3, distance / 30)}s`);
    } else {
      el.classList.remove('is-overflowing');
    }
  }

  function makeCoverPlaceholder() {
    const div = document.createElement('div');
    div.className = 'album-cover';
    div.style.cssText = 'background:linear-gradient(45deg,var(--accent),#0055ff);display:flex;align-items:center;justify-content:center;font-size:30px;';
    div.textContent = '🎵';
    return div;
  }

  function updateModeUI() {
    if (playMode === 0) { playModeBtn.textContent = '🔁'; playModeBtn.title = '列表循环'; }
    else if (playMode === 1) { playModeBtn.textContent = '🔂'; playModeBtn.title = '单曲循环'; }
    else { playModeBtn.textContent = '🔀'; playModeBtn.title = '随机播放'; }
  }

  function syncPlayState() {
    const cards = songsContainer.querySelectorAll('.song-card');
    cards.forEach((card, index) => {
      const song = currentPlaylist[index];
      const isPlaying = !!(currentSongObj && !audio.paused && song && song.src === currentSongObj.src);
      card.classList.toggle('playing', isPlaying);
      const icon = card.querySelector('.play-icon');
      if (icon) icon.textContent = isPlaying ? '⏸' : '▶';
    });
    if (currentSongObj) {
      mainPlayBtn.textContent = audio.paused ? '▶' : '⏸';
    }
  }

  function updatePlayerInfo(song) {
    setText(playerTitle, song.title || '未知曲目');
    setText(playerArtist, song.artist || '未知曲师');
    requestAnimationFrame(() => {
      checkOverflow(playerTitle);
      checkOverflow(playerArtist);
    });
  }

  function updateLyricButton(song) {
    const hasLyrics = !!(song.lyrics && song.lyrics.trim() !== '');
    lyricBtn.disabled = !hasLyrics;
    lyricBtn.title = hasLyrics ? '查看歌词' : '歌词待上传，请敲打开发者';
  }

  function handlePlayError(err) {
    console.error('播放失败', err);
    syncPlayState();
    alert('无法播放该音频，请检查路径或网络。');
  }

  /* ================= 6. 加载数据 ================= */
  async function loadMusic() {
    musicData = [];
    try {
      const data = await fetchJson('music.json');
      if (!Array.isArray(data)) throw new Error('music.json 顶层必须是数组');
      musicData = data.filter(a => a && typeof a === 'object' && !Array.isArray(a));

      const allSongs = [];
      musicData.forEach(album => {
        if (Array.isArray(album.songs) && album.songs.length > 0) {
          album.songs.forEach(song => {
            if (song && typeof song === 'object') {
              allSongs.push(Object.assign({}, song, { _originAlbum: album.album_name }));
            }
          });
        }
      });

      const virtualAlbum = {
        album_name: 'Musical-XXXUAN',
        album_cover: 'music/Musical-XXXUAN.webp',
        description: '全部歌曲',
        copyright: '音频及图片素材来源于网络，仅供个人编程学习、测试与欣赏使用，请勿用于任何商业用途。',
        songs: allSongs,
        isVirtual: true
      };

      musicData.unshift(virtualAlbum);
      renderAlbums();
    } catch (err) {
      console.error('加载音乐数据失败:', err);
      renderError(albumContainer, `加载失败：${err.message}`, () => {
        loadMusic();
      });
    }
  }

  /* ================= 7. 渲染专辑 ================= */
  function renderAlbums() {
    albumContainer.replaceChildren();
    const frag = document.createDocumentFragment();

    musicData.forEach((album) => {
      const card = document.createElement('div');
      card.className = 'album-card' + (album.isVirtual ? ' all-songs' : '');
      card.setAttribute('role', 'button');
      card.setAttribute('tabindex', '0');

      const nameText = String(album.album_name || '未命名专辑');
      card.setAttribute('aria-label', `打开专辑：${nameText}`);

      const count = Array.isArray(album.songs) ? album.songs.length : 0;
      const coverUrl = album.album_cover ? normalizeUrl(album.album_cover) : null;

      if (coverUrl) {
        const img = document.createElement('img');
        img.className = 'album-cover';
        img.src = coverUrl;
        img.alt = nameText;
        img.addEventListener('error', () => {
          img.replaceWith(makeCoverPlaceholder());
        });
        card.appendChild(img);
      } else {
        card.appendChild(makeCoverPlaceholder());
      }

      const nameEl = document.createElement('div');
      nameEl.className = 'album-name';
      setText(nameEl, nameText);

      const descEl = document.createElement('div');
      descEl.className = 'album-desc';
      setText(descEl, album.description || '');

      const countEl = document.createElement('div');
      countEl.className = 'album-count';
      setText(countEl, `共 ${count} 首曲目`);

      card.append(nameEl, descEl, countEl);

      card.addEventListener('click', () => openAlbum(album, card));
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openAlbum(album, card);
        }
      });

      frag.appendChild(card);
    });

    albumContainer.appendChild(frag);
  }

  /* ================= 8. 打开专辑 ================= */
  function openAlbum(album, triggerEl) {
    currentAlbum = album;
    setText(modalAlbumTitle, album.album_name || '专辑');

    if (album.copyright) {
      setText(copyrightText, album.copyright);
      copyrightBar.style.display = 'block';
    } else {
      copyrightBar.style.display = 'none';
    }

    if (album.isVirtual) {
      searchContainer.style.display = 'block';
      searchInput.value = '';
    } else {
      searchContainer.style.display = 'none';
    }

    renderSongs(Array.isArray(album.songs) ? album.songs : []);
    modalManager.open(songsModal, { trigger: triggerEl });
  }

  /* ================= 9. 渲染歌曲 ================= */
  function renderSongs(songList) {
    songsContainer.replaceChildren();
    currentPlaylist = Array.isArray(songList) ? songList.slice() : [];

    if (currentPlaylist.length === 0) {
      const p = document.createElement('p');
      p.style.cssText = 'color:#888; text-align:center; width:100%;';
      p.textContent = '没有找到对应的歌曲。';
      songsContainer.appendChild(p);
      return;
    }

    const frag = document.createDocumentFragment();

    currentPlaylist.forEach((song) => {
      const songCard = document.createElement('div');
      songCard.className = 'song-card';
      songCard.setAttribute('role', 'button');
      songCard.setAttribute('tabindex', '0');
      songCard.setAttribute('aria-label', `播放：${song.title || '未知曲目'}`);

      const coverUrl = (song.cover && normalizeUrl(song.cover))
        || (currentAlbum && currentAlbum.album_cover && normalizeUrl(currentAlbum.album_cover))
        || null;

      if (coverUrl) {
        const img = document.createElement('img');
        img.className = 'song-cover-thumb';
        img.src = coverUrl;
        img.alt = String(song.title || '');
        img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
        songCard.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.className = 'song-cover-thumb';
        ph.style.cssText = 'background:rgba(255,255,255,0.08);display:flex;align-items:center;justify-content:center;font-size:20px;';
        ph.textContent = '🎵';
        songCard.appendChild(ph);
      }

      const info = document.createElement('div');
      info.className = 'song-info';

      const titleWrap = document.createElement('div');
      titleWrap.className = 'marquee-container';
      const titleEl = document.createElement('p');
      titleEl.className = 'song-title marquee-text';
      setText(titleEl, song.title || '未知曲目');
      titleWrap.appendChild(titleEl);
      info.appendChild(titleWrap);

      const artistWrap = document.createElement('div');
      artistWrap.className = 'marquee-container';
      const artistEl = document.createElement('p');
      artistEl.className = 'song-artist marquee-text';
      setText(artistEl, song.artist || '未知曲师');
      artistWrap.appendChild(artistEl);
      info.appendChild(artistWrap);

      if (song.notes) {
        const notesWrap = document.createElement('div');
        notesWrap.className = 'marquee-container';
        const notesEl = document.createElement('p');
        notesEl.className = 'song-notes marquee-text';
        setText(notesEl, song.notes);
        notesWrap.appendChild(notesEl);
        info.appendChild(notesWrap);
      }

      songCard.appendChild(info);

      const playIcon = document.createElement('div');
      playIcon.className = 'play-icon';
      playIcon.textContent = '▶';
      songCard.appendChild(playIcon);

      songCard.addEventListener('click', () => togglePlay(song));
      songCard.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          togglePlay(song);
        }
      });

      frag.appendChild(songCard);
    });

    songsContainer.appendChild(frag);

    syncPlayState();

    requestAnimationFrame(() => {
      songsContainer.querySelectorAll('.marquee-text').forEach(checkOverflow);
    });
  }

  /* ================= 10. 搜索（防抖） ================= */
  let searchTimer;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      if (!currentAlbum || !currentAlbum.isVirtual) return;
      const kw = searchInput.value.trim().toLowerCase();

      if (!kw) {
        renderSongs(currentAlbum.songs);
        return;
      }

      const filtered = (currentAlbum.songs || []).filter(song => {
        if (!song) return false;
        const title = song.title ? String(song.title).toLowerCase() : '';
        const artist = song.artist ? String(song.artist).toLowerCase() : '';
        const notes = song.notes ? String(song.notes).toLowerCase() : '';
        return title.includes(kw) || artist.includes(kw) || notes.includes(kw);
      });
      renderSongs(filtered);
    }, 300);
  });

  /* ================= 11. 播放逻辑 ================= */
  function togglePlay(song) {
    if (!song || !song.src) return;

    if (currentSongObj && currentSongObj.src === song.src) {
      if (audio.paused) {
        audio.play().catch(handlePlayError);
      } else {
        audio.pause();
      }
      return;
    }
    playSong(song);
  }

  function playSong(song) {
    if (!song || !song.src) return;
    const safeSrc = normalizeUrl(song.src);
    if (!safeSrc) return;
    currentSongObj = song;
    audio.src = safeSrc;
    timeDisplay.textContent = '00:00 / 00:00';
    updatePlayerInfo(song);
    updateLyricButton(song);
    audio.play().catch(handlePlayError);
  }

  // 👇 新增：下一首逻辑
  function playNext() {
    if (currentPlaylist.length === 0) return;
    const currentIndex = currentSongObj ? currentPlaylist.findIndex(s => s && s.src === currentSongObj.src) : -1;
    let nextIndex;

    if (playMode === 0 || playMode === 1) {
      // 顺序播放 / 单曲循环：手动下一首都走列表顺序
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + 1) % currentPlaylist.length;
    } else {
      // 随机播放：随机选一首，不和当前重复
      if (currentPlaylist.length === 1) {
        nextIndex = 0;
      } else {
        let safety = 0;
        do {
          nextIndex = Math.floor(Math.random() * currentPlaylist.length);
          safety++;
        } while (nextIndex === currentIndex && safety < 50);
      }
    }

    const nextSong = currentPlaylist[nextIndex];
    if (nextSong) playSong(nextSong);
  }

  // 👇 新增：上一首逻辑
  function playPrev() {
    if (currentPlaylist.length === 0) return;
    const currentIndex = currentSongObj ? currentPlaylist.findIndex(s => s && s.src === currentSongObj.src) : -1;
    let prevIndex;

    if (playMode === 0 || playMode === 1) {
      // 顺序播放 / 单曲循环：手动上一首都走列表倒序
      prevIndex = currentIndex === -1 ? 0 : (currentIndex - 1 + currentPlaylist.length) % currentPlaylist.length;
    } else {
      // 随机播放：随机选一首，不和当前重复
      if (currentPlaylist.length === 1) {
        prevIndex = 0;
      } else {
        let safety = 0;
        do {
          prevIndex = Math.floor(Math.random() * currentPlaylist.length);
          safety++;
        } while (prevIndex === currentIndex && safety < 50);
      }
    }

    const prevSong = currentPlaylist[prevIndex];
    if (prevSong) playSong(prevSong);
  }

  /* ================= 12. 播放模式 ================= */
  updateModeUI();

  playModeBtn.addEventListener('click', () => {
    playMode = (playMode + 1) % 3;
    updateModeUI();
    try { localStorage.setItem('music-play-mode', playMode); } catch {}
  });

  // 👇 修改：ended 事件复用 playNext，单曲循环自然播完仍重播
  audio.addEventListener('ended', () => {
    if (currentPlaylist.length === 0 || !currentSongObj) return;

    // 单曲循环：自然播完重头再来；手动切歌已在 playNext/playPrev 中跳出
    if (playMode === 1) {
      audio.currentTime = 0;
      audio.play().catch(handlePlayError);
      return;
    }

    // 列表循环 / 随机：自动下一首
    playNext();
  });

  /* ================= 13. 播放器交互 ================= */
  mainPlayBtn.addEventListener('click', () => {
    if (!currentSongObj) return;
    if (audio.paused) {
      audio.play().catch(handlePlayError);
    } else {
      audio.pause();
    }
  });

  // 👇 新增：上一首 / 下一首按钮点击事件
  nextBtn.addEventListener('click', () => {
    if (!currentSongObj && currentPlaylist.length > 0) {
      playSong(currentPlaylist[0]);
    } else {
      playNext();
    }
  });

  prevBtn.addEventListener('click', () => {
    if (!currentSongObj && currentPlaylist.length > 0) {
      playSong(currentPlaylist[0]);
    } else {
      playPrev();
    }
  });

  audio.addEventListener('play', () => {
    mainPlayBtn.textContent = '⏸';
    globalPlayer.classList.add('show');
    syncPlayState();
  });

  audio.addEventListener('pause', () => {
    mainPlayBtn.textContent = '▶';
    syncPlayState();
  });

  audio.addEventListener('timeupdate', () => {
    if (audio.duration) {
      const percent = (audio.currentTime / audio.duration) * 100;
      progressInner.style.width = `${percent}%`;
      timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    }
  });

  audio.addEventListener('loadedmetadata', () => {
    timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
  });

  playerProgress.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = playerProgress.getBoundingClientRect();
    if (rect.width === 0) return;
    let percent = (e.clientX - rect.left) / rect.width;
    percent = Math.min(1, Math.max(0, percent));
    audio.currentTime = percent * audio.duration;
  });

  /* ================= 14. 歌词弹窗 ================= */
  lyricBtn.addEventListener('click', () => {
    if (!currentSongObj || !currentSongObj.lyrics) return;
    setText(lyricsTitle, `歌词 - ${currentSongObj.title || '未知曲目'}`);
    lyricsContent.textContent = currentSongObj.lyrics;
    modalManager.open(lyricsModal, { trigger: lyricBtn });
  });

  /* ================= 15. 关闭按钮 ================= */
  closeSongsBtn.addEventListener('click', () => modalManager.close(songsModal));
  closeLyricsBtn.addEventListener('click', () => modalManager.close(lyricsModal));

  /* ================= 16. 全局 keydown（Esc / Tab / 左右键切歌） ================= */
  document.addEventListener('keydown', (e) => {
    // 👇 新增：左右键切歌（在输入框里打字时不触发）
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      e.preventDefault();
      if (e.key === 'ArrowLeft') playPrev();
      else playNext();
      return;
    }

    if (e.key === 'Escape') {
      if (modalManager.top) modalManager.closeTop();
      return;
    }
    const top = modalManager.top;
    if (top) trapFocus(top.el, e);
  });

  /* ================= 17. 返回主页渐弱 ================= */
  document.getElementById('back-to-home').addEventListener('click', (e) => {
    e.preventDefault();
    const targetUrl = 'index.html';
    if (audio.paused) { window.location.href = targetUrl; return; }

    let vol = audio.volume;
    const fadeOut = setInterval(() => {
      if (vol > 0.05) {
        vol -= 0.05;
        audio.volume = vol;
      } else {
        clearInterval(fadeOut);
        audio.pause();
        window.location.href = targetUrl;
      }
    }, 50);
  });

  /* ================= 18. resize 重测滚动 ================= */
  window.addEventListener('resize', () => {
    document.querySelectorAll('.marquee-text').forEach(checkOverflow);
  });

  /* ================= 启动 ================= */
  loadMusic();
})();