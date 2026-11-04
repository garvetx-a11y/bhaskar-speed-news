/**
 * Dainik Bhaskar Superfast Speed News Player (दैनिक भास्कर स्पीड न्यूज़)
 * Powered by HTML5 Audio Engine & Edge-TTS / gTTS Studio Audio
 * - 1.0x, 1.5x, 2.0x Dynamic Playback Speed
 * - 100% Reliable Cross-Platform Audio (Mobile, Linux, Android, iOS, Brave)
 * - Automatic Auto-Advance when story ends (TV speed news bulletin)
 * - Fullscreen Pinch & Pan Zoom for Authentic Newspaper Clippings
 */

(function () {
  'use strict';

  // State
  let stories = [];
  let currentIndex = 0;
  let currentSpeed = 1.5; // Default 1.5x speed as requested!
  let isPlaying = false;

  // HTML5 Audio Player
  const audioPlayer = new Audio();
  audioPlayer.preload = 'auto';

  // Zoom Modal State
  let zoomScale = 1;
  let panX = 0;
  let panY = 0;
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let initialPinchDistance = null;

  // DOM Elements
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

  // Load Data
  async function loadData() {
    try {
      const resp = await fetch('data.json?t=' + Date.now());
      if (!resp.ok) throw new Error('data.json not found');
      const data = await resp.json();

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
    } catch (err) {
      console.error('Failed to load news data:', err);
      newsHeadline.textContent = 'खबरें लोड करने में समस्या आई। कृपया पृष्ठ रीफ्रेश करें।';
    }
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

    // Set Audio Source
    if (story.audio_url) {
      audioPlayer.src = story.audio_url;
      audioPlayer.playbackRate = currentSpeed;
    }

    // Preload next story audio
    if (index + 1 < stories.length && stories[index + 1].audio_url) {
      const preloadLink = document.createElement('link');
      preloadLink.rel = 'prefetch';
      preloadLink.href = stories[index + 1].audio_url;
      document.head.appendChild(preloadLink);
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

  // Playback Control
  function startAudio() {
    isPlaying = true;
    audioPlayer.playbackRate = currentSpeed;
    const playPromise = audioPlayer.play();
    if (playPromise !== undefined) {
      playPromise.catch(err => {
        console.warn('Playback blocked or pending user gesture:', err);
      });
    }
  }

  function pauseAudio() {
    isPlaying = false;
    audioPlayer.pause();
  }

  function togglePlayPause() {
    if (isPlaying) {
      pauseAudio();
    } else {
      startAudio();
    }
  }

  function jumpToStory(idx) {
    audioPlayer.pause();
    renderStory(idx);
  }

  // Audio Event Listeners
  audioPlayer.addEventListener('play', () => {
    isPlaying = true;
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    voiceIndicator.classList.add('speaking');
  });

  audioPlayer.addEventListener('pause', () => {
    isPlaying = false;
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    voiceIndicator.classList.remove('speaking');
  });

  audioPlayer.addEventListener('timeupdate', () => {
    if (!audioPlayer.duration) return;
    const activeSeg = progressBarContainer.children[currentIndex];
    if (activeSeg) {
      const inner = activeSeg.querySelector('.progress-segment-inner');
      if (inner) {
        const pct = (audioPlayer.currentTime / audioPlayer.duration) * 100;
        inner.style.width = pct + '%';
      }
    }
  });

  // AUTO-ADVANCE: When story audio finishes, smoothly move to next story!
  audioPlayer.addEventListener('ended', () => {
    const activeSeg = progressBarContainer.children[currentIndex];
    if (activeSeg) {
      const inner = activeSeg.querySelector('.progress-segment-inner');
      if (inner) inner.style.width = '100%';
      activeSeg.classList.add('completed');
    }

    if (currentIndex < stories.length - 1) {
      // Auto-play next story after a 0.35s natural transition pause
      setTimeout(() => {
        jumpToStory(currentIndex + 1);
        startAudio();
      }, 350);
    } else {
      // Reached end of playlist
      isPlaying = false;
      playIcon.classList.remove('hidden');
      pauseIcon.classList.add('hidden');
      voiceIndicator.classList.remove('speaking');
    }
  });

  audioPlayer.addEventListener('error', (e) => {
    console.warn('Audio playback error on story:', currentIndex, e);
    voiceIndicator.classList.remove('speaking');
  });

  // Speed Selector Buttons (1.0x, 1.5x, 2.0x)
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeed = parseFloat(btn.dataset.speed) || 1.5;
      audioPlayer.playbackRate = currentSpeed;
    });
  });

  // Play / Pause Button Listener
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
        // Swipe left -> Next
        if (currentIndex < stories.length - 1) {
          jumpToStory(currentIndex + 1);
          if (wasPlaying) startAudio();
        }
      } else {
        // Swipe right -> Prev
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

  // Load playlist data on startup
  loadData();

})();
