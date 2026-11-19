function getElements() {
  if (typeof document === 'undefined') return {};
  return {
    playerContainer: document.getElementById('persistent-audio-player'),
    audioElement: document.getElementById('main-audio-element'),
    playBtn: document.getElementById('audio-play'),
    titleEl: document.getElementById('audio-title'),
    currentTimeEl: document.getElementById('audio-current-time'),
    durationEl: document.getElementById('audio-duration'),
    progressSlider: document.getElementById('audio-progress-slider'),
    speedSelect: document.getElementById('audio-speed'),
    closeBtn: document.getElementById('audio-close'),
  };
}

let currentEpisode = null;

export function initAudioPlayer() {
  const {
    audioElement,
    playBtn,
    durationEl,
    speedSelect,
    progressSlider,
    closeBtn,
    playerContainer,
  } = getElements();
  if (!audioElement || !playBtn || !progressSlider || !closeBtn) return;

  // Restore state from localStorage
  const savedState =
    typeof localStorage !== 'undefined' ? localStorage.getItem('faguugu-audio-state') : null;
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      if (state.episode && state.url) {
        loadEpisode(state.episode, state.url, false);
        audioElement.currentTime = state.position || 0;
        if (state.speed && speedSelect) {
          audioElement.playbackRate = state.speed;
          speedSelect.value = state.speed;
        }
      }
    } catch (e) {
      console.error('Error restoring audio player state:', e);
    }
  }

  // Play/Pause event listener
  playBtn.addEventListener('click', togglePlay);

  // Time update event listener
  audioElement.addEventListener('timeupdate', () => {
    updateProgress();
    saveProgress();
  });

  // Pause and end events stop the ambient visualizer
  audioElement.addEventListener('pause', stopVisualizer);
  audioElement.addEventListener('ended', stopVisualizer);

  // Load duration when metadata is ready
  audioElement.addEventListener('loadedmetadata', () => {
    if (durationEl) durationEl.textContent = formatTime(audioElement.duration);
    updateProgress();
  });

  // Speed selection
  if (speedSelect) {
    speedSelect.addEventListener('change', (e) => {
      audioElement.playbackRate = parseFloat(e.target.value);
      saveProgress();
    });
  }

  // Accessible range input scrubbing logic
  progressSlider.addEventListener('input', () => {
    const dur = audioElement.duration;
    if (!Number.isFinite(dur) || dur <= 0) return;
    audioElement.currentTime = (Number(progressSlider.value) / 100) * dur;
    updateProgress();
  });

  // Close player
  closeBtn.addEventListener('click', () => {
    audioElement.pause();
    stopVisualizer();
    if (playerContainer) playerContainer.style.display = 'none';
    if (typeof document !== 'undefined' && document.body?.classList) {
      document.body.classList.toggle('has-audio-player', false);
    }
    if (typeof localStorage !== 'undefined') localStorage.removeItem('faguugu-audio-state');
  });

  // Expose play function to window
  if (typeof window !== 'undefined') {
    window.playEpisode = (title, url) => {
      loadEpisode(title, url, true);
    };
  }
}

function loadEpisode(title, url, shouldPlay = true) {
  const { playerContainer, audioElement, titleEl, playBtn } = getElements();
  if (!playerContainer || !audioElement || !titleEl || !playBtn) return;

  currentEpisode = { title, url };
  titleEl.textContent = title;
  audioElement.src = url;
  playerContainer.style.display = 'block';

  if (typeof document !== 'undefined' && document.body?.classList) {
    document.body.classList.toggle('has-audio-player', true);
  }

  // Set MediaSession metadata for mobile lockscreen integration
  if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: 'Family Guy Guys',
      album: 'Chronological Rewatch',
      artwork: [{ src: '/og/podcast-art-512.png', sizes: '512x512', type: 'image/png' }],
    });

    navigator.mediaSession.setActionHandler('play', () => audioElement.play());
    navigator.mediaSession.setActionHandler('pause', () => audioElement.pause());
  }

  if (shouldPlay) {
    audioElement.play().catch((err) => console.log('Playback start interrupted:', err));
    playBtn.textContent = '⏸';
    playBtn.setAttribute('aria-label', 'Pause');
    startVisualizer(audioElement);
  } else {
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play');
    stopVisualizer();
  }
}

function togglePlay() {
  const { audioElement, playBtn } = getElements();
  if (!audioElement || !playBtn) return;

  if (audioElement.paused) {
    audioElement.play().catch((err) => console.log('Playback resume interrupted:', err));
    playBtn.textContent = '⏸';
    playBtn.setAttribute('aria-label', 'Pause');
    startVisualizer(audioElement);
  } else {
    audioElement.pause();
    playBtn.textContent = '▶';
    playBtn.setAttribute('aria-label', 'Play');
    stopVisualizer();
  }
}

function updateProgress() {
  const { audioElement, currentTimeEl, progressSlider } = getElements();
  if (!audioElement || !currentTimeEl || !progressSlider) return;

  const current = audioElement.currentTime;
  const duration = Number.isFinite(audioElement.duration) ? audioElement.duration : 0;
  currentTimeEl.textContent = formatTime(current);

  if (duration > 0) {
    const percent = Math.min(100, Math.max(0, (current / duration) * 100));
    progressSlider.value = percent.toFixed(1);
  } else {
    progressSlider.value = '0';
  }
  progressSlider.setAttribute(
    'aria-valuetext',
    `${formatTime(current)} of ${formatTime(duration)}`
  );
}

function saveProgress() {
  const { audioElement } = getElements();
  if (!currentEpisode || !audioElement || typeof localStorage === 'undefined') return;
  const state = {
    episode: currentEpisode.title,
    url: currentEpisode.url,
    position: audioElement.currentTime,
    speed: audioElement.playbackRate,
  };
  localStorage.setItem('faguugu-audio-state', JSON.stringify(state));
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===== AMBIENT HALFTONE VISUALIZER =====
let audioCtx = null;
let analyser = null;
let source = null;
let visualizerActive = false;

function setupVisualizer(audioElement) {
  if (audioCtx || !audioElement || typeof window === 'undefined') return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    audioCtx = new AudioContextClass();
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 64; // small size for basic volume tracking

    // Connect audio element source to analyser
    source = audioCtx.createMediaElementSource(audioElement);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
  } catch (err) {
    console.error('Failed to initialize audio context for visualizer:', err);
  }
}

function startVisualizer(audioElement) {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  ) {
    return;
  }

  setupVisualizer(audioElement);
  if (!analyser) return;

  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }

  if (visualizerActive) return;
  visualizerActive = true;

  const dataArray = new Uint8Array(analyser.frequencyBinCount);

  function draw() {
    if (!visualizerActive) return;
    requestAnimationFrame(draw);

    if (audioCtx && audioCtx.state === 'suspended') return;

    analyser.getByteFrequencyData(dataArray);

    // Average volume
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const average = sum / dataArray.length; // 0 - 255

    // Map to halftone opacity range: 0.08 to 0.22
    const minOpacity = 0.08;
    const maxOpacity = 0.22;
    const opacity = minOpacity + (average / 255) * (maxOpacity - minOpacity);

    document.documentElement.style.setProperty('--halftone-opacity', opacity.toFixed(3));
  }

  draw();
}

function stopVisualizer() {
  visualizerActive = false;
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--halftone-opacity', '0.13'); // Reset to default
  }
}
