/**
 * Dainik Bhaskar Superfast Speed News Player (दैनिक भास्कर स्पीड न्यूज़)
 * Native HTML5 DOM Audio Engine + Studio News Anchor MP3 Voiceovers
 * - Instant startup via preloaded data.js
 * - Synchronous auto-advance on story end (continuous mobile playback)
 * - 1.0x, 1.5x, 2.0x Dynamic Playback Speed
 * - Web Speech API & Timer fallback
 * - Fullscreen Pinch & Pan Zoom for Authentic Newspaper Clippings
 */

(function () {
  'use strict';

  // State
  let stories = [];
  let currentIndex = 0;
  let currentSpeed = 1.5; // Default 1.5x speed
  let isPlaying = false;
  let fallbackTimer = null;

  // DOM Elements
  const audioEl = document.getElementById('mainAudio');
  const newsCard = document.getElementById('newsCard');
  const currentDateEl = document.getElementById('currentDate');
  const categoryBadge = document.getElementById('categoryBadge');
  const storyCounter = document.getElementById('storyCounter');
  const newsHeadline = document.getElementById('newsHeadline');
  const clippingFrame = document.getElementById('clippingFrame');
  const clippingImg = document.getElementById('clippingImg');
  const voiceIndicator = document.getElementById('voiceIndicator');
  const voiceoverText = document.getElementById('voiceoverText');
  const pointsList = document.getElementById('pointsList');
  const progressBarContainer = document.getElementById('progressBarContainer');

  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const prevBtn = document.getElementById('prevBtn');
  const nextBtn = document.getElementById('nextBtn');

  // Zoom Modal Elements
  const zoomModal = document.getElementById('zoomModal');
  const zoomHeadline = document.getElementById('zoomHeadline');
  const zoomViewport = document.getElementById('zoomViewport');
  const zoomModalImg = document.getElementById('zoomModalImg');
  const zoomInBtn = document.getElementById('zoomInBtn');
  const zoomOutBtn = document.getElementById('zoomOutBtn');
  const zoomResetBtn = document.getElementById('zoomResetBtn');
  const zoomCloseBtn = document.getElementById('zoomCloseBtn');

  // Playlist Drawer Elements
  const playlistToggleBtn = document.getElementById('playlistToggleBtn');
  const playlistDrawer = document.getElementById('playlistDrawer');
  const drawerBackdrop = document.getElementById('drawerBackdrop');
  const drawerCloseBtn = document.getElementById('drawerCloseBtn');
  const drawerList = document.getElementById('drawerList');
  const totalStoriesBadge = document.getElementById('totalStoriesBadge');

  // Speed Buttons
  const speedButtons = document.querySelectorAll('.speed-btn');

  // Zoom Modal Pan & Pinch State
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialPinchDistance = null;

  // Initialize Data
  function initData() {
    if (window.SPEED_NEWS_DATA && window.SPEED_NEWS_DATA.stories) {
      applyData(window.SPEED_NEWS_DATA);
    } else {
      fetch('data.json')
        .then(r => r.json())
        .then(data => applyData(data))
        .catch(err => {
          console.error('Failed to load data.json:', err);
          newsHeadline.textContent = 'समाचार लोड करने में समस्या आई। कृपया पृष्ठ रीफ्रेश करें।';
        });
    }
  }

  function applyData(data) {
    if (data.date) {
      currentDateEl.textContent = data.date;
    }
    stories = data.stories || [];
    if (stories.length === 0) {
      newsHeadline.textContent = 'आज का स्पीड न्यूज़ बुलेटिन तैयार हो रहा है...';
      return;
    }

    totalStoriesBadge.textContent = stories.length;
    buildProgressSegments();
    buildPlaylistDrawer();
    renderStory(0);
  }

  // Build Progress Segments
  function buildProgressSegments() {
    progressBarContainer.innerHTML = '';
    stories.forEach((_, idx) => {
      const seg = document.createElement('div');
      seg.className = 'progress-segment';
      seg.dataset.index = idx;
      const inner = document.createElement('div');
      inner.className = 'progress-segment-inner';
      seg.appendChild(inner);

      seg.addEventListener('click', () => {
        jumpToStory(idx);
        if (isPlaying) startAudio();
      });
      progressBarContainer.appendChild(seg);
    });
  }

  // Build Playlist Drawer
  function buildPlaylistDrawer() {
    drawerList.innerHTML = '';
    stories.forEach((story, idx) => {
      const item = document.createElement('div');
      item.className = `drawer-item ${idx === currentIndex ? 'active' : ''}`;
      item.dataset.index = idx;
      item.innerHTML = `
        <div class="drawer-item-idx">${idx + 1}</div>
        <div class="drawer-item-body">
          <div class="drawer-item-cat">${escapeHtml(story.category || 'न्यूज़')}</div>
          <div class="drawer-item-title">${escapeHtml(story.headline || '')}</div>
        </div>
      `;
      item.addEventListener('click', () => {
        closeDrawer();
        jumpToStory(idx);
        startAudio();
      });
      drawerList.appendChild(item);
    });
  }

  // Render Story
  function renderStory(index) {
    if (index < 0 || index >= stories.length) return;
    currentIndex = index;
    const story = stories[index];

    // Clear fallback timer
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }

    // Meta
    categoryBadge.textContent = story.category || '⚡ स्पीड न्यूज़';
    storyCounter.textContent = `${index + 1} / ${stories.length}`;
    newsHeadline.textContent = story.headline || '';
    voiceoverText.textContent = story.voiceover || '';

    // Newspaper Clipping Image
    if (story.clipping_url) {
      clippingImg.src = story.clipping_url;
      clippingFrame.classList.remove('hidden');
    } else {
      clippingFrame.classList.add('hidden');
    }

    // Key points
    pointsList.innerHTML = '';
    if (story.key_points && story.key_points.length > 0) {
      story.key_points.forEach(pt => {
        const li = document.createElement('li');
        li.textContent = pt;
        pointsList.appendChild(li);
      });
    }

    // Prepare Audio Element
    if (story.audio_url) {
      audioEl.src = story.audio_url;
      audioEl.playbackRate = currentSpeed;
      audioEl.load();
    }

    // Update Progress Segments
    const segments = progressBarContainer.querySelectorAll('.progress-segment');
    segments.forEach((seg, i) => {
      const inner = seg.querySelector('.progress-segment-inner');
      if (i < currentIndex) {
        seg.classList.add('completed');
        inner.style.width = '100%';
      } else if (i === currentIndex) {
        seg.classList.remove('completed');
        inner.style.width = '0%';
      } else {
        seg.classList.remove('completed');
        inner.style.width = '0%';
      }
    });

    // Update Drawer Active Item
    drawerList.querySelectorAll('.drawer-item').forEach((item, i) => {
      item.classList.toggle('active', i === currentIndex);
    });
  }

  // Audio Playback Engine
  function startAudio() {
    isPlaying = true;
    updatePlayPauseUI(true);

    const story = stories[currentIndex];
    if (!story) return;

    // Ensure audio src is loaded
    if (!audioEl.src || !audioEl.src.includes(story.audio_url)) {
      audioEl.src = story.audio_url;
    }
    audioEl.playbackRate = currentSpeed;

    const playPromise = audioEl.play();
    if (playPromise !== undefined) {
      playPromise.then(() => {
        // Playback started successfully
        voiceIndicator.classList.add('speaking');
      }).catch(err => {
        console.warn('Audio play failed, falling back to Web Speech / Timer:', err);
        tryWebSpeech(story);
      });
    }
  }

  function pauseAudio() {
    isPlaying = false;
    audioEl.pause();
    updatePlayPauseUI(false);
    voiceIndicator.classList.remove('speaking');
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function togglePlayPause() {
    if (isPlaying) {
      pauseAudio();
    } else {
      startAudio();
    }
  }

  function jumpToStory(idx) {
    if (fallbackTimer) {
      clearInterval(fallbackTimer);
      fallbackTimer = null;
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    audioEl.pause();
    renderStory(idx);
  }

  function updatePlayPauseUI(playing) {
    if (playing) {
      playIcon.classList.add('hidden');
      pauseIcon.classList.remove('hidden');
    } else {
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
    }
  }

  // Synchronous Auto-Advance Handler (Crucial for Mobile Chain Playback)
  function handleStoryEnd() {
    const activeSeg = progressBarContainer.children[currentIndex];
    if (activeSeg) {
      const inner = activeSeg.querySelector('.progress-segment-inner');
      if (inner) inner.style.width = '100%';
      activeSeg.classList.add('completed');
    }

    if (currentIndex < stories.length - 1) {
      // Immediate synchronous transition ensures mobile gesture chain is preserved!
      const nextIdx = currentIndex + 1;
      jumpToStory(nextIdx);
      if (isPlaying) {
        startAudio();
      }
    } else {
      // Finished all stories
      isPlaying = false;
      updatePlayPauseUI(false);
      voiceIndicator.classList.remove('speaking');
    }
  }

  // Audio Event Listeners
  audioEl.addEventListener('play', () => {
    isPlaying = true;
    updatePlayPauseUI(true);
    voiceIndicator.classList.add('speaking');
  });

  audioEl.addEventListener('pause', () => {
    // Only update if not transitioning between tracks
    if (!audioEl.seeking) {
      voiceIndicator.classList.remove('speaking');
    }
  });

  audioEl.addEventListener('timeupdate', () => {
    if (!audioEl.duration) return;
    const activeSeg = progressBarContainer.children[currentIndex];
    if (activeSeg) {
      const inner = activeSeg.querySelector('.progress-segment-inner');
      if (inner) {
        const pct = (audioEl.currentTime / audioEl.duration) * 100;
        inner.style.width = pct + '%';
      }
    }
  });

  audioEl.addEventListener('ended', handleStoryEnd);

  audioEl.addEventListener('error', (e) => {
    console.warn('Audio element error, falling back:', e);
    const story = stories[currentIndex];
    if (story) tryWebSpeech(story);
  });

  // Fallback Engine 1: Web Speech API
  function tryWebSpeech(story) {
    if (!('speechSynthesis' in window)) {
      runVisualTimerFallback(story);
      return;
    }

    window.speechSynthesis.cancel();
    const textToSpeak = `${story.headline}। ${story.voiceover}`;
    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'hi-IN';
    utterance.rate = currentSpeed;

    utterance.onstart = () => {
      voiceIndicator.classList.add('speaking');
    };

    utterance.onend = () => {
      voiceIndicator.classList.remove('speaking');
      handleStoryEnd();
    };

    utterance.onerror = () => {
      voiceIndicator.classList.remove('speaking');
      runVisualTimerFallback(story);
    };

    window.speechSynthesis.speak(utterance);
  }

  // Fallback Engine 2: Visual Progress Timer (Ensures Bulletin NEVER Freezes)
  function runVisualTimerFallback(story) {
    if (fallbackTimer) clearInterval(fallbackTimer);
    voiceIndicator.classList.add('speaking');

    const activeSeg = progressBarContainer.children[currentIndex];
    const innerBar = activeSeg ? activeSeg.querySelector('.progress-segment-inner') : null;
    let pct = 0;
    const durationMs = 8000 / currentSpeed;
    const stepMs = 50;

    fallbackTimer = setInterval(() => {
      if (!isPlaying) {
        clearInterval(fallbackTimer);
        return;
      }
      pct += (stepMs / durationMs) * 100;
      if (innerBar) innerBar.style.width = Math.min(100, pct) + '%';
      if (pct >= 100) {
        clearInterval(fallbackTimer);
        fallbackTimer = null;
        voiceIndicator.classList.remove('speaking');
        handleStoryEnd();
      }
    }, stepMs);
  }

  // Speed Selector Buttons (1.0x, 1.5x, 2.0x)
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeed = parseFloat(btn.dataset.speed) || 1.5;
      audioEl.playbackRate = currentSpeed;
    });
  });

  // Controls
  playPauseBtn.addEventListener('click', togglePlayPause);

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      const wasPlaying = isPlaying;
      jumpToStory(currentIndex - 1);
      if (wasPlaying) startAudio();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < stories.length - 1) {
      const wasPlaying = isPlaying;
      jumpToStory(currentIndex + 1);
      if (wasPlaying) startAudio();
    }
  });

  // Zoom Lightbox Handlers
  function openZoomModal() {
    const story = stories[currentIndex];
    if (!story || !story.clipping_url) return;

    zoomHeadline.textContent = story.headline;
    zoomModalImg.src = story.clipping_url;
    zoomScale = 1;
    panX = 0;
    panY = 0;
    updateZoomTransform();
    zoomModal.classList.remove('hidden');
  }

  function closeZoomModal() {
    zoomModal.classList.add('hidden');
  }

  function updateZoomTransform() {
    zoomModalImg.style.transform = `translate(${panX}px, ${panY}px) scale(${zoomScale})`;
  }

  zoomInBtn.addEventListener('click', () => {
    zoomScale = Math.min(4, zoomScale + 0.4);
    updateZoomTransform();
  });

  zoomOutBtn.addEventListener('click', () => {
    zoomScale = Math.max(0.6, zoomScale - 0.4);
    updateZoomTransform();
  });

  zoomResetBtn.addEventListener('click', () => {
    zoomScale = 1;
    panX = 0;
    panY = 0;
    updateZoomTransform();
  });

  zoomCloseBtn.addEventListener('click', closeZoomModal);

  // Mouse Wheel Zoom
  zoomViewport.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    zoomScale = Math.max(0.6, Math.min(5, zoomScale + delta));
    updateZoomTransform();
  }, { passive: false });

  // Mouse Drag Pan
  zoomViewport.addEventListener('mousedown', (e) => {
    if (e.target !== zoomCloseBtn) {
      isDragging = true;
      startX = e.clientX - panX;
      startY = e.clientY - panY;
    }
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    panX = e.clientX - startX;
    panY = e.clientY - startY;
    updateZoomTransform();
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });

  // Touch Pinch & Pan on Mobile
  zoomViewport.addEventListener('touchstart', (e) => {
    if (e.touches.length === 1) {
      isDragging = true;
      startX = e.touches[0].clientX - panX;
      startY = e.touches[0].clientY - panY;
    } else if (e.touches.length === 2) {
      initialPinchDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }
  });

  zoomViewport.addEventListener('touchmove', (e) => {
    if (e.touches.length === 1 && isDragging) {
      panX = e.touches[0].clientX - startX;
      panY = e.touches[0].clientY - startY;
      updateZoomTransform();
    } else if (e.touches.length === 2 && initialPinchDistance) {
      const currentDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = currentDist / initialPinchDistance;
      zoomScale = Math.max(0.6, Math.min(5, zoomScale * factor));
      initialPinchDistance = currentDist;
      updateZoomTransform();
    }
  });

  zoomViewport.addEventListener('touchend', () => {
    isDragging = false;
    initialPinchDistance = null;
  });

  clippingFrame.addEventListener('click', openZoomModal);

  // Drawer Toggle Handlers
  function openDrawer() {
    playlistDrawer.classList.remove('hidden');
    drawerBackdrop.classList.remove('hidden');
  }

  function closeDrawer() {
    playlistDrawer.classList.add('hidden');
    drawerBackdrop.classList.add('hidden');
  }

  playlistToggleBtn.addEventListener('click', openDrawer);
  drawerCloseBtn.addEventListener('click', closeDrawer);
  drawerBackdrop.addEventListener('click', closeDrawer);

  // Keyboard Shortcuts
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeZoomModal();
      closeDrawer();
      return;
    }

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    if (e.code === 'Space') {
      e.preventDefault();
      togglePlayPause();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < stories.length - 1) {
        const wasPlaying = isPlaying;
        jumpToStory(currentIndex + 1);
        if (wasPlaying) startAudio();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) {
        const wasPlaying = isPlaying;
        jumpToStory(currentIndex - 1);
        if (wasPlaying) startAudio();
      }
    } else if (e.key.toLowerCase() === 'z') {
      openZoomModal();
    }
  });

  // Touch Swipe on News Card
  let touchStartX = 0;
  let touchEndX = 0;

  newsCard.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
  }, { passive: true });

  newsCard.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
  }, { passive: true });

  function handleSwipe() {
    const diff = touchEndX - touchStartX;
    if (Math.abs(diff) > 60) {
      const wasPlaying = isPlaying;
      if (diff < 0) {
        if (currentIndex < stories.length - 1) {
          jumpToStory(currentIndex + 1);
          if (wasPlaying) startAudio();
        }
      } else {
        if (currentIndex > 0) {
          jumpToStory(currentIndex - 1);
          if (wasPlaying) startAudio();
        }
      }
    }
  }

  function escapeHtml(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        "'": '&#39;',
        '"': '&quot;'
      }[tag] || tag)
    );
  }

  // Startup
  initData();

})();
