<template>
  <div class="watch-page">
    <div class="theater-container">
      <!-- Breadcrumb Navigation -->
      <div class="theater-breadcrumb">
        <router-link to="/" class="bc-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span>Kembali ke Katalog</span>
        </router-link>
        <span class="bc-separator">/</span>
        <span class="bc-anime" v-if="anime">{{ anime.title?.english || anime.title?.romaji }}</span>
        <span class="bc-separator">/</span>
        <span class="bc-ep">Episode {{ currentEpisode }}</span>
      </div>

      <!-- Main Cinema Grid -->
      <div class="cinema-layout">
        <!-- Left: Video Player & Controls -->
        <div class="player-col">
          <div class="player-wrapper">
            <!-- Video Container -->
            <div class="video-container">
              <video 
                ref="videoRef" 
                class="cinema-video" 
                controls 
                playsinline
                @timeupdate="onTimeUpdate"
                @ended="onVideoEnded"
              ></video>

              <!-- Cinematic Loading Overlay -->
              <div v-if="isLoadingStream" class="player-loading-overlay">
                <div class="cinema-loader-core">
                  <div class="loader-orbit orbit-1"></div>
                  <div class="loader-orbit orbit-2"></div>
                  <div class="loader-center-dot">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#e50914">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                  </div>
                </div>
                <div class="loader-status-wrap">
                  <p class="loader-title">{{ loadingMessage || 'Menyiapkan Stream...' }}</p>
                  <span class="loader-sub">Menghubungkan ke node server CDN VIP Sub Indo</span>
                </div>
              </div>

              <!-- Resume Prompt Banner -->
              <div v-if="showResumeBanner" class="resume-prompt-banner">
                <div class="resume-text">
                  <span>Lanjutkan menonton dari <strong>{{ formatTime(savedResumeTime) }}</strong>?</span>
                </div>
                <div class="resume-actions">
                  <button class="btn btn-primary btn-xs" @click="applyResume(true)">Lanjutkan</button>
                  <button class="btn btn-secondary btn-xs" @click="applyResume(false)">Dari Awal</button>
                </div>
              </div>
            </div>

            <!-- Player Status / Stream Notice Bar -->
            <div class="stream-status-bar">
              <div class="status-left">
                <span class="pulse-indicator"></span>
                <span class="status-text">{{ streamStatusText || `Episode ${currentEpisode} Kodik Direct HLS CDN` }}</span>
              </div>
              <div class="status-right" v-if="currentSources.length > 0">
                <span class="badge-hls">Direct HLS (Anti-Buffer)</span>
              </div>
            </div>

            <!-- Player Switcher Controls (Audio, Quality, Subtitles) -->
            <div class="player-controls-row">
              <!-- Audio Dub / Sub Selector -->
              <div class="ctrl-group" v-if="currentSources.length > 1">
                <label>Pengisi Suara / Dub:</label>
                <div class="chips-list">
                  <button 
                    v-for="(src, idx) in currentSources" 
                    :key="idx" 
                    class="ctrl-chip"
                    :class="{ active: selectedSourceIndex === idx }"
                    @click="switchSource(idx)"
                  >
                    {{ src.title }}
                  </button>
                </div>
              </div>

              <!-- Quality Selector -->
              <div class="ctrl-group" v-if="availableVideos.length > 0">
                <label>Kualitas Video:</label>
                <div class="chips-list">
                  <button 
                    v-for="v in availableVideos" 
                    :key="v.quality" 
                    class="ctrl-chip"
                    :class="{ active: selectedQuality === Number(v.quality) }"
                    @click="switchQuality(Number(v.quality))"
                  >
                    {{ v.quality }}p
                  </button>
                </div>
              </div>

              <!-- Subtitle Selector -->
              <div class="ctrl-group" v-if="subtitlesList.length > 0">
                <label>Subtitle:</label>
                <div class="chips-list">
                  <button 
                    class="ctrl-chip" 
                    :class="{ active: selectedSubIndex === -1 }"
                    @click="switchSubtitle(-1)"
                  >
                    Nonaktif
                  </button>
                  <button 
                    v-for="(sub, sIdx) in subtitlesList" 
                    :key="sIdx" 
                    class="ctrl-chip"
                    :class="{ active: selectedSubIndex === sIdx }"
                    @click="switchSubtitle(sIdx)"
                  >
                    {{ sub.label }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Episode Navigation Bar -->
            <div class="ep-nav-bar">
              <button 
                class="btn btn-secondary nav-ep-btn" 
                :disabled="currentEpisode <= 1"
                @click="switchEpisode(currentEpisode - 1)"
              >
                ‹ Episode Sebelumnya
              </button>

              <div class="auto-next-toggle">
                <label class="toggle-label">
                  <input type="checkbox" v-model="autoNext" />
                  <span>Otomatis Putar Episode Berikutnya</span>
                </label>
              </div>

              <button 
                class="btn btn-primary nav-ep-btn" 
                :disabled="currentEpisode >= totalEpisodes"
                @click="switchEpisode(currentEpisode + 1)"
              >
                Episode Berikutnya ›
              </button>
            </div>
          </div>

          <!-- Anime Header & Synopsis Box -->
          <div class="anime-theater-meta" v-if="anime">
            <div class="meta-title-row">
              <div>
                <h1 class="theater-anime-title">{{ anime.title?.english || anime.title?.romaji }}</h1>
                <div class="theater-anime-sub">
                  <span>{{ anime.title?.romaji }}</span>
                  <span v-if="anime.seasonYear">• {{ anime.seasonYear }}</span>
                  <span>• {{ anime.format || 'TV' }}</span>
                  <span v-if="anime.averageScore">• ★ {{ (anime.averageScore / 10).toFixed(1) }}</span>
                </div>
              </div>

              <button class="btn btn-secondary fav-toggle-btn" @click="handleToggleFavorite">
                <svg width="16" height="16" viewBox="0 0 24 24" :fill="isFav ? '#e50914' : 'none'" :stroke="isFav ? '#e50914' : 'currentColor'" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                <span>{{ isFav ? 'Tersimpan' : 'Simpan Koleksi' }}</span>
              </button>
            </div>

            <!-- Indonesian Translation Box with Shared Server DB -->
            <div class="theater-synopsis-box">
              <div class="synopsis-top-bar">
                <span class="synopsis-label">Sinopsis Cerita:</span>
                <div class="synopsis-actions">
                  <span v-if="isIndonesian && isServerCached" class="server-cached-badge">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>
                    <span>Terjemahan Tersimpan di Server</span>
                  </span>

                  <button class="translate-toggle-btn" :disabled="isTranslating" @click="toggleTranslate">
                    <span v-if="isTranslating" class="spinner-small"></span>
                    <span>{{ isTranslating ? 'Menerjemahkan...' : (isIndonesian ? 'Tampilkan Bahasa Asli' : 'Terjemahkan ke Indonesia') }}</span>
                  </button>
                </div>
              </div>

              <p class="synopsis-paragraph">
                {{ currentSynopsis || 'Sinopsis belum tersedia.' }}
              </p>
            </div>

            <!-- Kusonime Batch Downloads Section -->
            <div class="batch-downloads-section" v-if="kusonimeDownloads.length > 0">
              <h3 class="section-subheading">📥 Link Download Batch Episode (Kusonime Sub Indo)</h3>
              <div class="batch-downloads-grid">
                <div v-for="(dl, dIdx) in kusonimeDownloads" :key="dIdx" class="download-quality-card">
                  <div class="dl-quality-label">{{ dl.quality }}</div>
                  <div class="dl-links-list">
                    <a 
                      v-for="(link, lIdx) in dl.links" 
                      :key="lIdx" 
                      :href="link.url" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      class="dl-btn"
                    >
                      {{ link.host }} ↗
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right: Episodes List Sidebar -->
        <div class="episodes-col">
          <div class="episodes-card">
            <div class="episodes-card-header">
              <h3 class="ep-sidebar-title">Daftar Episode</h3>
              <span class="ep-sidebar-count">{{ totalEpisodes }} Episode</span>
            </div>

            <!-- Search Episode Input -->
            <div class="ep-search-box">
              <input 
                type="text" 
                v-model="epFilterQuery" 
                placeholder="Cari episode (1, 2, 12...)" 
              />
            </div>

            <!-- Episodes Pills Grid -->
            <div class="episodes-scroll-list">
              <button 
                v-for="ep in filteredEpisodes" 
                :key="ep.num"
                class="ep-item-btn"
                :class="{ active: currentEpisode === ep.num }"
                @click="switchEpisode(ep.num)"
              >
                <div class="ep-btn-content">
                  <span class="ep-number-tag">Ep {{ ep.num }}</span>
                  <span class="ep-title-text">{{ ep.title }}</span>
                </div>
                <div v-if="currentEpisode === ep.num" class="ep-playing-dot"></div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import Hls from 'hls.js';
import { 
  getAnimeDetails, 
  getSafeImageUrl, 
  lookupTranslation, 
  translateSynopsis, 
  searchKusonime, 
  getKusonimeDownloads,
  apiUrl 
} from '../api.js';
import { 
  saveHistory, 
  updateWatchProgress, 
  getEpisodeProgress, 
  formatTime, 
  isFavorite, 
  toggleFavorite 
} from '../storage.js';

const route = useRoute();
const router = useRouter();

const videoRef = ref(null);
let hlsInstance = null;

const anime = ref(null);
const currentEpisode = ref(Number(route.query.ep) || 1);
const totalEpisodes = ref(1);
const episodesList = ref([]);
const epFilterQuery = ref('');
const autoNext = ref(true);

const currentSources = ref([]);
const selectedSourceIndex = ref(0);
const selectedQuality = ref(720);
const availableVideos = ref([]);
const subtitlesList = ref([]);
const selectedSubIndex = ref(-1);

const isLoadingStream = ref(true);
const loadingMessage = ref('Menghubungkan ke server Kodik HLS...');
const streamStatusText = ref('');

const originalSynopsis = ref('');
const indonesianSynopsis = ref('');
const isIndonesian = ref(false);
const isTranslating = ref(false);
const isServerCached = ref(false);

const isFav = ref(false);
const showResumeBanner = ref(false);
const savedResumeTime = ref(0);
const lastSavedTimestamp = ref(0);

const kusonimeDownloads = ref([]);

const filteredEpisodes = computed(() => {
  const q = epFilterQuery.value.trim().toLowerCase();
  if (!q) return episodesList.value;
  return episodesList.value.filter(e => String(e.num).includes(q) || e.title?.toLowerCase().includes(q));
});

const currentSynopsis = computed(() => {
  if (isIndonesian.value && indonesianSynopsis.value) {
    return indonesianSynopsis.value;
  }
  return originalSynopsis.value;
});

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
}

// ---------------- Stream & Playback Engine ----------------

async function initWatch() {
  const animeId = route.query.id;
  const ep = Number(route.query.ep) || 1;
  currentEpisode.value = ep;

  if (!animeId) {
    router.push('/');
    return;
  }

  try {
    const details = await getAnimeDetails(animeId);
    anime.value = details;
    originalSynopsis.value = stripHtml(details.description || '');
    isFav.value = isFavorite(details.id);

    // Calculate episodes list
    const epsCount = details.episodes || details.nextAiringEpisode?.episode - 1 || 12;
    totalEpisodes.value = Math.max(1, epsCount);

    const eps = [];
    for (let i = 1; i <= totalEpisodes.value; i++) {
      eps.push({ num: i, title: `Episode ${i}` });
    }
    episodesList.value = eps;

    // Check shared server translation in SQLite
    lookupTranslation(animeId).then(res => {
      if (res.found && res.translation) {
        indonesianSynopsis.value = res.translation;
        isIndonesian.value = true;
        isServerCached.value = true;
      }
    });

    // Check Kusonime downloads in background
    fetchKusonimeBatch(details);

    // Load stream for episode
    loadStream(ep);
  } catch (err) {
    console.error('Failed to init watch page:', err);
    loadingMessage.value = 'Gagal memuat anime: ' + err.message;
  }
}

async function loadStream(ep) {
  isLoadingStream.value = true;
  loadingMessage.value = `Menghubungkan ke server stream (Episode ${ep})...`;
  streamStatusText.value = `Menghubungkan ke Kodik HLS (Episode ${ep})...`;
  showResumeBanner.value = false;

  const title = anime.value?.title?.english || anime.value?.title?.romaji || '';
  const altTitle = anime.value?.title?.romaji || '';

  try {
    // 1. Fetch stream sources from backend
    const res = await fetch(apiUrl(`/api/yummy/streams?q=${encodeURIComponent(title)}&ep=${ep}`));
    const data = await res.json();

    // 2. Fetch subtitles
    fetchSubtitles(title, altTitle, ep);

    if (!data.sources || data.sources.length === 0) {
      // Fallback try romaji
      if (altTitle && altTitle !== title) {
        const altRes = await fetch(apiUrl(`/api/yummy/streams?q=${encodeURIComponent(altTitle)}&ep=${ep}`));
        const altData = await altRes.json();
        if (altData.sources && altData.sources.length > 0) {
          setupSources(altData.sources);
          return;
        }
      }
      loadingMessage.value = `Episode ${ep} belum tersedia di server Kodik.`;
      streamStatusText.value = 'Stream belum tersedia untuk episode ini.';
      return;
    }

    setupSources(data.sources);
  } catch (err) {
    console.error('Stream load error:', err);
    loadingMessage.value = 'Gagal memuat video stream: ' + err.message;
  }
}

function setupSources(sources) {
  currentSources.value = sources;
  selectedSourceIndex.value = 0;

  // Prefer Japanese audio with sub if available
  const subIdx = sources.findIndex(s => s.is_subtitles_original);
  if (subIdx !== -1) {
    selectedSourceIndex.value = subIdx;
  }

  playCurrentSource();
}

function playCurrentSource() {
  const source = currentSources.value[selectedSourceIndex.value];
  if (!source || !source.videos || source.videos.length === 0) {
    loadingMessage.value = 'Video tidak tersedia untuk pengisi suara ini.';
    return;
  }

  availableVideos.value = source.videos;

  // Match quality
  let video = source.videos.find(v => Number(v.quality) === selectedQuality.value);
  if (!video) {
    video = source.videos[source.videos.length - 1];
    selectedQuality.value = Number(video.quality);
  }

  streamStatusText.value = `Memutar: ${source.title} (${video.quality}p HLS)`;

  // Destroy previous Hls
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }

  const videoEl = videoRef.value;
  if (!videoEl) return;

  if (Hls.isSupported()) {
    hlsInstance = new Hls({
      maxBufferLength: 90,
      maxMaxBufferLength: 300,
      maxBufferSize: 120 * 1024 * 1024,
      maxBufferHole: 1.5,
      startFragPrefetch: true,
      progressive: true,
      lowLatencyMode: false,
      backBufferLength: 90,
      enableWorker: true
    });

    hlsInstance.loadSource(video.url);
    hlsInstance.attachMedia(videoEl);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      isLoadingStream.value = false;
      checkResumeProgress();
      videoEl.play().catch(e => {
        console.log('Autoplay deferred:', e);
      });
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            hlsInstance.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            hlsInstance.recoverMediaError();
            break;
          default:
            hlsInstance.destroy();
            break;
        }
      }
    });
  } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
    // Safari native HLS
    videoEl.src = video.url;
    videoEl.onloadedmetadata = () => {
      isLoadingStream.value = false;
      checkResumeProgress();
      videoEl.play().catch(e => console.log(e));
    };
  }
}

function switchSource(idx) {
  selectedSourceIndex.value = idx;
  playCurrentSource();
}

function switchQuality(q) {
  selectedQuality.value = q;
  playCurrentSource();
}

// ---------------- Subtitles ----------------

async function fetchSubtitles(title, altTitle, ep) {
  try {
    const res = await fetch(apiUrl(`/api/subtitles/search?title=${encodeURIComponent(title)}&alt=${encodeURIComponent(altTitle)}&ep=${ep}`));
    const data = await res.json();
    if (data.subtitles && data.subtitles.length > 0) {
      subtitlesList.value = data.subtitles;
      // Default to Indonesian if found
      const idIdx = data.subtitles.findIndex(s => s.lang === 'id' || s.label?.toLowerCase().includes('indo'));
      if (idIdx !== -1) {
        switchSubtitle(idIdx);
      }
    }
  } catch (e) {
    console.warn('Subtitles search error:', e);
  }
}

function switchSubtitle(idx) {
  selectedSubIndex.value = idx;
  const videoEl = videoRef.value;
  if (!videoEl) return;

  // Clear existing tracks
  const tracks = videoEl.querySelectorAll('track');
  tracks.forEach(t => t.remove());

  if (idx >= 0 && subtitlesList.value[idx]) {
    const sub = subtitlesList.value[idx];
    const track = document.createElement('track');
    track.kind = 'subtitles';
    track.label = sub.label;
    track.srclang = sub.lang || 'id';
    track.src = sub.url;
    track.default = true;
    videoEl.appendChild(track);
    track.mode = 'showing';
  }
}

// ---------------- Episode Navigation ----------------

function switchEpisode(epNum) {
  if (currentEpisode.value === epNum) return;

  // Save progress for current episode before leaving
  if (anime.value && videoRef.value && videoRef.value.currentTime > 5 && videoRef.value.duration > 0) {
    updateWatchProgress(anime.value.id, currentEpisode.value, videoRef.value.currentTime, videoRef.value.duration);
  }

  currentEpisode.value = epNum;
  router.push({ path: '/watch', query: { id: anime.value.id, ep: epNum } });
  saveHistory(anime.value, epNum, 0, 0);
  loadStream(epNum);
}

function onVideoEnded() {
  if (autoNext.value && currentEpisode.value < totalEpisodes.value) {
    switchEpisode(currentEpisode.value + 1);
  }
}

// ---------------- Resume & History Progress ----------------

function checkResumeProgress() {
  if (!anime.value) return;
  const prog = getEpisodeProgress(anime.value.id, currentEpisode.value);
  if (prog && prog.time > 15 && prog.duration > 30) {
    const remaining = prog.duration - prog.time;
    if (remaining > 20) {
      savedResumeTime.value = prog.time;
      showResumeBanner.value = true;
    }
  }
}

function applyResume(resume) {
  showResumeBanner.value = false;
  if (resume && videoRef.value && savedResumeTime.value > 0) {
    videoRef.value.currentTime = savedResumeTime.value;
  }
}

function onTimeUpdate() {
  const video = videoRef.value;
  if (!video || !anime.value || video.duration <= 0) return;

  const now = Date.now();
  if (now - lastSavedTimestamp.value > 5000) {
    lastSavedTimestamp.value = now;
    updateWatchProgress(anime.value.id, currentEpisode.value, video.currentTime, video.duration);
    saveHistory(anime.value, currentEpisode.value, video.currentTime, video.duration);
  }
}

function handleToggleFavorite() {
  if (!anime.value) return;
  isFav.value = toggleFavorite(anime.value);
}

// ---------------- Translation ----------------

async function toggleTranslate() {
  if (isIndonesian.value) {
    isIndonesian.value = false;
    return;
  }
  if (indonesianSynopsis.value) {
    isIndonesian.value = true;
    return;
  }
  isTranslating.value = true;
  try {
    const res = await translateSynopsis(originalSynopsis.value, anime.value.id);
    if (res.success && res.translation) {
      indonesianSynopsis.value = res.translation;
      isIndonesian.value = true;
      isServerCached.value = true;
    }
  } catch (err) {
    console.error('Translation error:', err);
  } finally {
    isTranslating.value = false;
  }
}

// ---------------- Kusonime Batch Downloads ----------------

async function fetchKusonimeBatch(animeData) {
  const query = animeData.title?.romaji || animeData.title?.english || '';
  try {
    const results = await searchKusonime(query, 1);
    if (results && results.length > 0) {
      const downloads = await getKusonimeDownloads(results[0].link);
      kusonimeDownloads.value = downloads || [];
    }
  } catch (e) {
    console.warn('Kusonime fetch error:', e);
  }
}

// Watch route changes
watch(() => route.query.ep, (newEp) => {
  if (newEp && Number(newEp) !== currentEpisode.value) {
    currentEpisode.value = Number(newEp);
    loadStream(currentEpisode.value);
  }
});

onMounted(() => {
  initWatch();
});

onUnmounted(() => {
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
});
</script>

<style scoped>
.watch-page {
  padding: 1.5rem 0 5rem 0;
  min-height: 90vh;
}

.theater-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.theater-breadcrumb {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.82rem;
  color: #94a3b8;
  margin-bottom: 1rem;
}

.bc-link {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: #cbd5e1;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.15s ease;
}

.bc-link:hover {
  color: #e50914;
}

.bc-separator {
  color: #475569;
}

.bc-anime {
  color: #fff;
  font-weight: 600;
  max-width: 300px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bc-ep {
  color: #e50914;
  font-weight: 700;
}

.cinema-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 1.5rem;
}

/* Player Column */
.player-col {
  display: flex;
  flex-direction: column;
  gap: 1.2rem;
}

.player-wrapper {
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.7);
}

.video-container {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #000;
}

.cinema-video {
  width: 100%;
  height: 100%;
  object-fit: contain;
  outline: none;
}

.player-loading-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(14, 17, 26, 0.94) 0%, rgba(6, 7, 10, 0.98) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1.5rem;
  color: #cbd5e1;
  z-index: 10;
  backdrop-filter: blur(6px);
}

.cinema-loader-core {
  position: relative;
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loader-orbit {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
}

.loader-orbit.orbit-1 {
  border-top-color: #e50914;
  border-right-color: #e50914;
  animation: orbitRotate 1.1s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  box-shadow: 0 0 16px rgba(229, 9, 20, 0.4);
}

.loader-orbit.orbit-2 {
  inset: 8px;
  border-bottom-color: #f43f5e;
  border-left-color: rgba(244, 63, 94, 0.3);
  animation: orbitRotateRev 1.6s cubic-bezier(0.5, 0, 0.5, 1) infinite;
}

.loader-center-dot {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 12px rgba(229, 9, 20, 0.3);
}

@keyframes orbitRotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

@keyframes orbitRotateRev {
  0% { transform: rotate(360deg); }
  100% { transform: rotate(0deg); }
}

.loader-status-wrap {
  text-align: center;
}

.loader-title {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
  margin: 0 0 4px 0;
  letter-spacing: 0.02em;
}

.loader-sub {
  font-size: 0.75rem;
  color: #94a3b8;
  letter-spacing: 0.04em;
}

.resume-prompt-banner {
  position: absolute;
  bottom: 60px;
  left: 20px;
  right: 20px;
  background: rgba(18, 20, 28, 0.95);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(229, 9, 20, 0.4);
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
  border-radius: 10px;
  padding: 0.75rem 1.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 15;
  animation: slideUp 0.25s ease;
}

.resume-text {
  font-size: 0.85rem;
  color: #fff;
}

.resume-actions {
  display: flex;
  gap: 0.5rem;
}

.btn-xs {
  padding: 0.3rem 0.75rem;
  font-size: 0.78rem;
  border-radius: 6px;
  font-weight: 700;
}

.stream-status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 1rem;
  background: rgba(18, 20, 28, 0.8);
  border-bottom: 1px solid #1e2230;
  font-size: 0.78rem;
}

.status-left {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.pulse-indicator {
  width: 8px;
  height: 8px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 8px #10b981;
}

.status-text {
  color: #cbd5e1;
  font-weight: 600;
}

.badge-hls {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
}

.player-controls-row {
  padding: 0.9rem 1.2rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  background: #0c0d12;
  border-bottom: 1px solid #1e2230;
}

.ctrl-group {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.ctrl-group label {
  font-size: 0.78rem;
  font-weight: 700;
  color: #94a3b8;
  min-width: 110px;
}

.chips-list {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.ctrl-chip {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.3rem 0.7rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.ctrl-chip:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.ctrl-chip.active {
  background: #e50914;
  border-color: #e50914;
  color: #fff;
  box-shadow: 0 0 10px rgba(229, 9, 20, 0.4);
}

.ep-nav-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 1.2rem;
  background: #12141c;
  flex-wrap: wrap;
  gap: 0.8rem;
}

.nav-ep-btn {
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.5rem 1rem;
  border-radius: 8px;
}

.auto-next-toggle {
  display: flex;
  align-items: center;
}

.toggle-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: #cbd5e1;
  cursor: pointer;
}

.toggle-label input {
  accent-color: #e50914;
  cursor: pointer;
}

/* Meta & Synopsis Box */
.anime-theater-meta {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 16px;
  padding: 1.5rem 1.8rem;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.meta-title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.theater-anime-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
  color: #fff;
  line-height: 1.2;
}

.theater-anime-sub {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  color: #94a3b8;
  margin-top: 0.3rem;
}

.fav-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.82rem;
  font-weight: 700;
  padding: 0.5rem 1rem;
  border-radius: 8px;
  flex-shrink: 0;
}

.theater-synopsis-box {
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 12px;
  padding: 1.2rem;
}

.synopsis-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.synopsis-label {
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
}

.synopsis-actions {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.server-cached-badge {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 700;
}

.translate-toggle-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.3);
  color: #ff4d58;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.translate-toggle-btn:hover:not(:disabled) {
  background: rgba(229, 9, 20, 0.25);
  color: #fff;
}

.synopsis-paragraph {
  font-size: 0.88rem;
  color: #cbd5e1;
  line-height: 1.6;
}

.batch-downloads-section {
  border-top: 1px solid #1e2230;
  padding-top: 1.2rem;
}

.section-subheading {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 0.85rem;
}

.batch-downloads-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 0.75rem;
}

.download-quality-card {
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 8px;
  padding: 0.75rem;
}

.dl-quality-label {
  font-size: 0.78rem;
  font-weight: 800;
  color: #eab308;
  margin-bottom: 0.5rem;
}

.dl-links-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.dl-btn {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.15s ease;
}

.dl-btn:hover {
  background: #e50914;
  border-color: #e50914;
  color: #fff;
}

/* Episodes Column (Right Sidebar) */
.episodes-card {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 16px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  height: 600px;
  position: sticky;
  top: 85px;
}

.episodes-card-header {
  padding: 1.1rem 1.2rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #1e2230;
}

.ep-sidebar-title {
  font-size: 1rem;
  font-weight: 800;
  color: #fff;
}

.ep-sidebar-count {
  font-size: 0.75rem;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 7px;
  border-radius: 4px;
}

.ep-search-box {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #1e2230;
}

.ep-search-box input {
  width: 100%;
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 8px;
  padding: 0.45rem 0.75rem;
  color: #fff;
  font-size: 0.8rem;
  outline: none;
  font-family: inherit;
}

.ep-search-box input:focus {
  border-color: #e50914;
}

.episodes-scroll-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.ep-item-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.65rem 0.85rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid transparent;
  border-radius: 8px;
  color: #cbd5e1;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.ep-item-btn:hover {
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
}

.ep-item-btn.active {
  background: rgba(229, 9, 20, 0.15);
  border-color: rgba(229, 9, 20, 0.5);
  color: #fff;
}

.ep-btn-content {
  display: flex;
  align-items: center;
  gap: 0.65rem;
}

.ep-number-tag {
  background: #08090c;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
  color: #e50914;
  border: 1px solid rgba(229, 9, 20, 0.3);
}

.ep-title-text {
  font-size: 0.82rem;
  font-weight: 600;
}

.ep-playing-dot {
  width: 8px;
  height: 8px;
  background: #e50914;
  border-radius: 50%;
  box-shadow: 0 0 8px #e50914;
}

.spinner-small {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

.spinner-large {
  display: inline-block;
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: #e50914;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes slideUp {
  from { transform: translateY(10px); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}

@media (max-width: 1024px) {
  .cinema-layout {
    grid-template-columns: 1fr;
  }
  .episodes-card {
    height: 380px;
    position: static;
  }
}
</style>
