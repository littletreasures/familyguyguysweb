// Persistent Audio Player controller for familyguyguys.com

const playerContainer = document.getElementById('persistent-audio-player');
const audioElement = document.getElementById('main-audio-element');
const playBtn = document.getElementById('audio-play');
const titleEl = document.getElementById('audio-title');
const currentTimeEl = document.getElementById('audio-current-time');
const durationEl = document.getElementById('audio-duration');
const progressBar = document.getElementById('audio-progress-bar');
const progressBg = document.getElementById('audio-progress-bar-bg');
const speedSelect = document.getElementById('audio-speed');
const closeBtn = document.getElementById('audio-close');

let currentEpisode = null;

export function initAudioPlayer() {
  if (!audioElement) return;

  // Restore state from localStorage
  const savedState = localStorage.getItem('faguugu-audio-state');
  if (savedState) {
    try {
      const state = JSON.parse(savedState);
      if (state.episode && state.url) {
        loadEpisode(state.episode, state.url, false);
        audioElement.currentTime = state.position || 0;
        if (state.speed) {
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
    durationEl.textContent = formatTime(audioElement.duration);
  });

  // Speed selection
  speedSelect.addEventListener('change', (e) => {
    audioElement.playbackRate = parseFloat(e.target.value);
    saveProgress();
  });

  // Scrubbing logic
  progressBg.addEventListener('click', (e) => {
    const rect = progressBg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percentage = clickX / width;
    audioElement.currentTime = percentage * audioElement.duration;
    updateProgress();
  });

  // Close player
  closeBtn.addEventListener('click', () => {
    audioElement.pause();
    playerContainer.style.display = 'none';
    localStorage.removeItem('faguugu-audio-state');
  });

  // Expose play function to window
  window.playEpisode = (title, url) => {
    loadEpisode(title, url, true);
  };
}

function loadEpisode(title, url, shouldPlay = true) {
  if (!playerContainer || !audioElement) return;

  currentEpisode = { title, url };
  titleEl.textContent = title;
  audioElement.src = url;
  playerContainer.style.display = 'block';

  // Set MediaSession metadata for mobile lockscreen integration
  if ('mediaSession' in navigator) {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: title,
      artist: 'Family Guy Guys',
      album: 'Chronological Rewatch',
      artwork: [
        { src: '/og/podcast-art-512.png', sizes: '512x512', type: 'image/png' }
      ]
    });

    navigator.mediaSession.setActionHandler('play', () => audioElement.play());
    navigator.mediaSession.setActionHandler('pause', () => audioElement.pause());
  }

  if (shouldPlay) {
    audioElement.play().catch(err => console.log('Playback start interrupted:', err));
    playBtn.textContent = '⏸';
    startVisualizer();
  } else {
    playBtn.textContent = '▶';
    stopVisualizer();
  }
}

function togglePlay() {
  if (audioElement.paused) {
    audioElement.play().catch(err => console.log('Playback resume interrupted:', err));
    playBtn.textContent = '⏸';
    startVisualizer();
  } else {
    audioElement.pause();
    playBtn.textContent = '▶';
    stopVisualizer();
  }
}

function updateProgress() {
  const current = audioElement.currentTime;
  const duration = audioElement.duration || 0;
  currentTimeEl.textContent = formatTime(current);
  
  if (duration > 0) {
    const percent = (current / duration) * 100;
    progressBar.style.width = `${percent}%`;
  }
}

function saveProgress() {
  if (!currentEpisode) return;
  const state = {
    episode: currentEpisode.title,
    url: currentEpisode.url,
    position: audioElement.currentTime,
    speed: audioElement.playbackRate
  };
  localStorage.setItem('faguugu-audio-state', JSON.stringify(state));
}

function formatTime(seconds) {
  if (isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// ===== AMBIENT HALFTONE VISUALIZER =====
let audioCtx = null;
let analyser = null;
let source = null;
let visualizerActive = false;

function setupVisualizer() {
  if (audioCtx) return;

  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
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

function startVisualizer() {
  setupVisualizer();
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
  document.documentElement.style.setProperty('--halftone-opacity', '0.13'); // Reset to default
}
