/**
 * Dainik Bhaskar Speed News Player (दैनिक भास्कर सुपरफास्ट स्पीड न्यूज़)
 * Features:
 * - High-speed voiceover (1.0x, 1.5x, 2.0x) using Web Speech API
 * - Auto-advancing news bulletins (TV style)
 * - Authentic newspaper clipping viewer with Full-Screen Pinch & Pan Zoom
 * - Playlist drawer, touch swipe, and keyboard navigation
 */

(function () {
  'use strict';

  // State
  let stories = [];
  let currentIndex = 0;
  let isPlaying = false;
  let currentSpeed = 1.5; // Default 1.5x speed as requested!
  let hindiVoice = null;
  let currentUtterance = null;
  let progressInterval = null;
  let autoAdvanceTimer = null;

  // Zoom Modal Pan & Pinch State
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

  // Initialize Speech Synthesis
  function initSpeechEngine() {
    if (!('speechSynthesis' in window)) {
      console.warn('Speech Synthesis not supported in this browser.');
      return;
    }

    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      // Look for Hindi voice
      hindiVoice = voices.find(v => v.lang.startsWith('hi') || v.lang.includes('Hindi')) ||
                   voices.find(v => v.lang.startsWith('mr') || v.lang.startsWith('gu')) ||
                   voices[0];
    };

    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }

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
        playCurrentStory();
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

  // Audio Playback
  function playCurrentStory() {
    stopCurrentAudio();
    const story = stories[currentIndex];
    if (!story) return;

    isPlaying = true;
    updatePlayPauseUI(true);
    voiceIndicator.classList.add('speaking');

    if (!('speechSynthesis' in window)) {
      // If speech synthesis not supported, simulate countdown
      simulatePlayback(story);
      return;
    }

    const textToSpeak = `${story.category}. ${story.headline}. ${story.voiceover}`;
    currentUtterance = new SpeechSynthesisUtterance(textToSpeak);
    currentUtterance.lang = 'hi-IN';
    if (hindiVoice) currentUtterance.voice = hindiVoice;
    currentUtterance.rate = currentSpeed;
    currentUtterance.pitch = 1.0;

    // Track smooth progress for active segment
    const activeSegment = progressBarContainer.children[currentIndex];
    const innerBar = activeSegment ? activeSegment.querySelector('.progress-segment-inner') : null;
    
    // Estimate duration based on word count and speed
    const wordCount = textToSpeak.split(/\s+/).length;
    const estimatedSeconds = Math.max(4, (wordCount / (2.5 * currentSpeed)));
    const startTime = Date.now();

    clearInterval(progressInterval);
    progressInterval = setInterval(() => {
      if (!isPlaying || !innerBar) return;
      const elapsed = (Date.now() - startTime) / 1000;
      const pct = Math.min(100, (elapsed / estimatedSeconds) * 100);
      innerBar.style.width = pct + '%';
    }, 50);

    currentUtterance.onend = () => {
      voiceIndicator.classList.remove('speaking');
      clearInterval(progressInterval);
      if (innerBar) innerBar.style.width = '100%';

      if (isPlaying) {
        // Auto advance to next story after brief 0.4s pause!
        autoAdvanceTimer = setTimeout(() => {
          if (currentIndex < stories.length - 1) {
            jumpToStory(currentIndex + 1);
            playCurrentStory();
          } else {
            // Finished playlist
            isPlaying = false;
            updatePlayPauseUI(false);
          }
        }, 400);
      }
    };

    currentUtterance.onerror = (e) => {
      console.warn('Speech error, advancing:', e);
      voiceIndicator.classList.remove('speaking');
      clearInterval(progressInterval);
    };

    window.speechSynthesis.cancel(); // clear previous
    window.speechSynthesis.speak(currentUtterance);
  }

  function simulatePlayback(story) {
    const activeSegment = progressBarContainer.children[currentIndex];
    const innerBar = activeSegment ? activeSegment.querySelector('.progress-segment-inner') : null;
    let pct = 0;
    const duration = 6000 / currentSpeed;
    const step = 50;

    progressInterval = setInterval(() => {
      pct += (step / duration) * 100;
      if (innerBar) innerBar.style.width = Math.min(100, pct) + '%';
      if (pct >= 100) {
        clearInterval(progressInterval);
        if (currentIndex < stories.length - 1) {
          jumpToStory(currentIndex + 1);
          playCurrentStory();
        } else {
          isPlaying = false;
          updatePlayPauseUI(false);
        }
      }
    }, step);
  }

  function pauseAudio() {
    isPlaying = false;
    updatePlayPauseUI(false);
    voiceIndicator.classList.remove('speaking');
    clearInterval(progressInterval);
    clearTimeout(autoAdvanceTimer);
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }

  function stopCurrentAudio() {
    clearInterval(progressInterval);
    clearTimeout(autoAdvanceTimer);
    voiceIndicator.classList.remove('speaking');
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
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

  function jumpToStory(idx) {
    stopCurrentAudio();
    renderStory(idx);
  }

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

  // Zoom Interactions (Pan & Zoom)
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

  // Clipping Click Opens Zoom
  clippingFrame.addEventListener('click', openZoomModal);

  // Playback Button Listeners
  playPauseBtn.addEventListener('click', () => {
    if (isPlaying) {
      pauseAudio();
    } else {
      playCurrentStory();
    }
  });

  prevBtn.addEventListener('click', () => {
    if (currentIndex > 0) {
      jumpToStory(currentIndex - 1);
      if (isPlaying) playCurrentStory();
    }
  });

  nextBtn.addEventListener('click', () => {
    if (currentIndex < stories.length - 1) {
      jumpToStory(currentIndex + 1);
      if (isPlaying) playCurrentStory();
    }
  });

  // Speed Selector Buttons
  speedButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      speedButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentSpeed = parseFloat(btn.dataset.speed) || 1.5;

      // If currently playing, restart with new speed seamlessly
      if (isPlaying) {
        playCurrentStory();
      }
    });
  });

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
      if (isPlaying) pauseAudio();
      else playCurrentStory();
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentIndex < stories.length - 1) {
        jumpToStory(currentIndex + 1);
        if (isPlaying) playCurrentStory();
      }
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentIndex > 0) {
        jumpToStory(currentIndex - 1);
        if (isPlaying) playCurrentStory();
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
      if (diff < 0) {
        // Swipe left -> Next
        if (currentIndex < stories.length - 1) {
          jumpToStory(currentIndex + 1);
          if (isPlaying) playCurrentStory();
        }
      } else {
        // Swipe right -> Prev
        if (currentIndex > 0) {
          jumpToStory(currentIndex - 1);
          if (isPlaying) playCurrentStory();
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

  // Run on start
  initSpeechEngine();
  loadData();

})();
