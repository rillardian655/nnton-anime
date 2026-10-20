<template>
  <div class="watch-page-container">
    <!-- Main Left Column -->
    <div class="theater-main">
      
      <!-- Top Breadcrumb Bar -->
      <div class="theater-breadcrumb-bar">
        <router-link to="/" class="bc-link">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span>Kembali ke Beranda</span>
        </router-link>
        <span class="bc-sep">/</span>
        <span class="bc-title" v-if="anime">{{ anime.title?.english || anime.title?.romaji }}</span>
        <span class="bc-sep">/</span>
        <span class="bc-ep">Episode {{ currentEpisode }}</span>
      </div>

      <!-- Video Player Viewport -->
      <div class="theater-player-box" id="theaterBox">
        <video 
          ref="videoRef" 
          class="native-hls-player" 
          controls 
          playsinline 
          webkit-playsinline
          x5-playsinline
          preload="auto"
          @timeupdate="onTimeUpdate"
          @ended="onVideoEnded"
          @play="onVideoPlay"
          @playing="onVideoPlaying"
          @canplay="onVideoCanPlay"
          @pause="onVideoPause"
          @seeked="onVideoSeeked"
        ></video>

        <!-- Floating Resume Prompt Banner -->
        <div v-if="showResumeBanner" class="watch-resume-banner">
          <div class="resume-banner-info">
            <div>
              <p class="resume-title">Lanjutkan Tontonan?</p>
              <p class="resume-subtitle">Sebelumnya menonton sampai menit <strong>{{ formatTime(savedResumeTime) }}</strong> ({{ resumePercentage }}%)</p>
            </div>
          </div>
          <div class="resume-banner-actions">
            <button class="btn btn-primary btn-sm" @click="applyResume(true)">Lanjutkan</button>
            <button class="btn btn-secondary btn-sm" @click="applyResume(false)" style="font-size: 0.75rem; padding: 0.35rem 0.6rem;">Dari Awal</button>
            <button class="resume-close-btn" @click="showResumeBanner = false" title="Tutup">✕</button>
          </div>
        </div>

        <!-- Non-blocking Loading State -->
        <div v-if="isLoadingStream && !showPlayOverlay" class="player-loader">
          <span class="spinner" style="width: 34px; height: 34px; border-width: 3px;"></span>
          <p style="margin-top: 0.75rem; font-size: 0.88rem; font-weight: 600;">{{ loadingMessage || 'Menghubungkan ke stream video Kodik...' }}</p>
        </div>

        <!-- Manual Play Button Overlay if Autoplay Deferred -->
        <div v-if="showPlayOverlay" class="manual-play-overlay" @click="startManualPlayback">
          <div class="manual-play-icon">
            <svg width="38" height="38" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
          </div>
          <span class="manual-play-text">Klik untuk Memutar Video (Episode {{ currentEpisode }})</span>
        </div>
      </div>

      <!-- Server & Stream Status Notice + Real-time Watch Progress Tracker -->
      <div class="stream-notice-row">
        <div class="player-server-notice">
          <span>{{ streamStatusText || `Memuat informasi stream Episode ${currentEpisode}...` }}</span>
          <span class="badge-tag badge-genre" v-if="isBufferingStable" style="font-size: 0.72rem; margin-left: 6px;">Buffer Cepat Aktif</span>
          <a 
            v-if="activeDirectUrl" 
            :href="activeDirectUrl" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-secondary btn-sm btn-m3u8"
            title="Buka link m3u8 asli di tab baru"
          >
            M3U8 Asli ↗
          </a>
        </div>
        
        <div class="watch-progress-badge" v-if="watchDuration > 0">
          Posisi: <strong style="color: #fff; margin-left: 3px;">{{ formatTime(watchCurrentTime) }}</strong> / {{ formatTime(watchDuration) }} ({{ watchPercentage }}% <span v-if="bufferAheadSec > 0" class="buffer-text">• Buffer {{ bufferAheadSec }}s</span>)
        </div>
      </div>

      <!-- Quick Episode Navigator & Auto-Next Toggle -->
      <div class="ep-nav-toolbar">
        <div class="ep-nav-buttons">
          <button 
            class="btn btn-secondary btn-sm nav-btn" 
            :disabled="currentEpisode <= 1"
            @click="switchEpisode(currentEpisode - 1)"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Episode Sebelumnya</span>
          </button>
          
          <button 
            class="btn btn-primary btn-sm nav-btn" 
            :disabled="currentEpisode >= totalEpisodes"
            @click="switchEpisode(currentEpisode + 1)"
          >
            <span>Episode Berikutnya</span>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </button>
        </div>

        <label class="auto-next-label">
          <input type="checkbox" v-model="autoNext" style="accent-color: #e50914;" />
          <span>Putar Otomatis Episode Selanjutnya</span>
        </label>
      </div>

      <!-- Player Stream Settings: Audio Track, Quality, Subtitles -->
      <div class="theater-controls-bar">
        <!-- Audio Dub Track -->
        <div class="control-row">
          <span class="control-row-label">Audio Dub</span>
          <div class="control-row-chips" v-if="currentSources.length > 0">
            <button 
              v-for="(src, idx) in currentSources" 
              :key="idx" 
              class="chip-btn" 
              :class="{ active: selectedSourceIndex === idx }"
              @click="switchSource(idx)"
            >
              {{ src.is_subtitles_original ? 'Original Sub (Jepang)' : src.title }}
            </button>
          </div>
          <span v-else class="control-empty-text">Memuat daftar pengisi suara...</span>
        </div>

        <!-- Video Resolution -->
        <div class="control-row">
          <span class="control-row-label">Resolusi</span>
          <div class="control-row-chips" v-if="availableVideos.length > 0">
            <button 
              v-for="v in availableVideos" 
              :key="v.quality" 
              class="chip-btn" 
              :class="{ active: selectedQuality === Number(v.quality) }"
              @click="switchQuality(Number(v.quality))"
            >
              {{ v.quality }}p
            </button>
          </div>
          <span v-else class="control-empty-text">Pilihan resolusi otomatis</span>
        </div>

        <!-- Subtitles Track -->
        <div class="control-row">
          <span class="control-row-label">Subtitle</span>
          <div class="control-row-chips">
            <button 
              class="chip-btn" 
              :class="{ active: selectedSubIndex === -1 }"
              @click="switchSubtitle(-1)"
            >
              Mati
            </button>
            <button 
              v-for="(sub, sIdx) in subtitlesList" 
              :key="sIdx" 
              class="chip-btn" 
              :class="{ active: selectedSubIndex === sIdx }"
              @click="switchSubtitle(sIdx)"
            >
              {{ sub.label }}
            </button>
            <span v-if="isSearchingSubtitles" class="control-empty-text">
              <span class="spinner-tiny"></span> Mencari SubtitleCat...
            </span>
          </div>
        </div>
      </div>

      <!-- Anime Metadata & Synopsis Card -->
      <div class="watch-info-card" v-if="anime">
        <div class="watch-info-header">
          <div class="watch-title-group">
            <h1 class="anime-main-title">{{ anime.title?.english || anime.title?.romaji }}</h1>
            <p class="anime-alt-title">{{ anime.title?.romaji }} <span v-if="anime.title?.native">({{ anime.title?.native }})</span></p>
          </div>

          <div class="watch-header-actions">
            <button class="btn btn-secondary btn-sm" @click="handleToggleFavorite">
              <svg width="15" height="15" viewBox="0 0 24 24" :fill="isFav ? '#e50914' : 'none'" :stroke="isFav ? '#e50914' : 'currentColor'" stroke-width="2">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
              </svg>
              <span>{{ isFav ? 'Tersimpan di Koleksi' : 'Simpan Koleksi' }}</span>
            </button>
          </div>
        </div>

        <!-- Catch Line Badges Row -->
        <div class="watch-badges-row">
          <span class="badge-tag badge-score" v-if="anime.averageScore">★ {{ (anime.averageScore / 10).toFixed(1) }}</span>
          <span class="badge-tag badge-genre">{{ anime.format || 'TV' }}</span>
          <span class="badge-tag badge-genre" :class="{ 'badge-ongoing': anime.status === 'RELEASING' }">
            {{ anime.status === 'RELEASING' ? 'Sedang Rilis' : 'Tamat' }}
          </span>
          <span class="badge-tag badge-genre" v-if="anime.studios?.nodes?.[0]?.name">
            {{ anime.studios.nodes[0].name }}
          </span>
          <span class="badge-tag badge-genre badge-ep-count">{{ totalEpisodes }} Episode Rilis</span>
        </div>

        <!-- Dedicated Genre Tags Row -->
        <div class="dashboard-genre-tags" v-if="anime.genres && anime.genres.length > 0">
          <span class="genre-label">Genre:</span>
          <router-link 
            v-for="g in anime.genres" 
            :key="g" 
            :to="`/?genre=${encodeURIComponent(g)}`" 
            class="genre-pill" 
            :title="`Filter anime genre ${g}`"
          >
            {{ g }}
          </router-link>
        </div>

        <!-- Cross-Database ARM Mapping -->
        <div class="watch-arm-badges" v-if="armMapping">
          <span class="arm-tag" v-if="armMapping.anilist">AniList: {{ armMapping.anilist }}</span>
          <span class="arm-tag" v-if="armMapping.myanimelist">MAL: {{ armMapping.myanimelist }}</span>
          <span class="arm-tag" v-if="armMapping.themoviedb">TMDB: {{ armMapping.themoviedb }}</span>
          <span class="arm-tag" v-if="armMapping.imdb">IMDb: {{ armMapping.imdb }}</span>
          <span class="arm-tag" v-if="armMapping.anidb">AniDB: {{ armMapping.anidb }}</span>
          <span class="arm-tag" v-if="armMapping.kitsu">Kitsu: {{ armMapping.kitsu }}</span>
        </div>

        <!-- Synopsis with Real-time Translation -->
        <div class="synopsis-section">
          <div class="synopsis-top-bar">
            <span class="synopsis-heading">Sinopsis</span>
            <div class="synopsis-actions">
              <span v-if="isIndonesian && isServerCached" class="cached-pill">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>
                <span>Tersimpan di Server</span>
              </span>
              <button class="btn btn-secondary btn-sm btn-translate" :disabled="isTranslating" @click="toggleTranslate">
                <span v-if="isTranslating" class="spinner-tiny"></span>
                <span>{{ isTranslating ? 'Menerjemahkan...' : (isIndonesian ? 'Lihat Bahasa Asli' : 'Terjemahkan ke Indonesia') }}</span>
              </button>
            </div>
          </div>
          <div class="synopsis-box">{{ currentSynopsis || 'Sinopsis belum tersedia.' }}</div>
        </div>

        <!-- Batch Download Links from Kusonime -->
        <div class="batch-downloads-section" v-if="kusonimeDownloads.length > 0">
          <h3 class="section-subheading">Download Batch (Subtitle Indonesia)</h3>
          <div class="downloads-container">
            <div v-for="(dl, dIdx) in kusonimeDownloads" :key="dIdx" class="download-box">
              <div class="download-quality-title">Resolusi: {{ dl.quality }}</div>
              <div class="download-links-list">
                <a 
                  v-for="(link, lIdx) in dl.links" 
                  :key="lIdx" 
                  :href="link.url" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="legal-badge"
                >
                  {{ link.host }} ↗
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Rekomendasi Anime Terkait -->
      <div class="watch-info-card" v-if="recommendationsList.length > 0">
        <h3 class="section-subheading">Anime Terkait</h3>
        <div class="recs-grid">
          <div 
            v-for="item in recommendationsList" 
            :key="item.id" 
            class="rec-card"
            @click="navigateToAnime(item.id)"
          >
            <div class="rec-poster-box">
              <img :src="getSafeImageUrl(item.coverImage?.large)" :alt="item.title?.romaji" class="rec-poster" />
              <span class="rec-score-badge" v-if="item.averageScore">★ {{ (item.averageScore / 10).toFixed(1) }}</span>
            </div>
            <div class="rec-info">
              <h4 class="rec-title">{{ item.title?.english || item.title?.romaji }}</h4>
            </div>
          </div>
        </div>
      </div>

    </div>

    <!-- Right Sidebar (Real-time Episodes List) -->
    <aside class="theater-sidebar">
      <div class="sidebar-section-title">
        <span>Daftar Episode</span>
        <span class="badge-tag badge-genre">{{ totalEpisodes }} Episode Rilis</span>
      </div>

      <!-- Episode Notice if Ongoing -->
      <div v-if="airingNotice" class="sidebar-airing-notice">
        <span class="live-dot"></span>
        <span>{{ airingNotice }}</span>
      </div>

      <!-- Search / Filter for Episodes -->
      <input 
        type="text" 
        v-model="epSearchQuery" 
        placeholder="Cari nomor ep..." 
        class="ep-search-sidebar"
      />

      <!-- Episodes Grid -->
      <div class="watch-episodes-grid">
        <button 
          v-for="ep in filteredEpisodes" 
          :key="ep.num"
          class="watch-ep-pill"
          :class="{ active: currentEpisode === ep.num }"
          @click="switchEpisode(ep.num)"
        >
          Ep {{ ep.num }}
        </button>
      </div>
    </aside>
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
let safetyTimer = null;

const anime = ref(null);
const currentEpisode = ref(Number(route.query.ep) || 1);
const totalEpisodes = ref(1);
const episodesList = ref([]);
const epSearchQuery = ref('');
const autoNext = ref(true);
const airingNotice = ref('');

const currentSources = ref([]);
const selectedSourceIndex = ref(0);
const selectedQuality = ref(720);
const availableVideos = ref([]);
const subtitlesList = ref([]);
const selectedSubIndex = ref(-1);
const isSearchingSubtitles = ref(false);

const isLoadingStream = ref(true);
const loadingMessage = ref('Menghubungkan ke stream video Kodik...');
const streamStatusText = ref('');
const showPlayOverlay = ref(false);
const isBufferingStable = ref(false);
const bufferAheadSec = ref(0);

const watchCurrentTime = ref(0);
const watchDuration = ref(0);
const lastSavedTime = ref(0);

const originalSynopsis = ref('');
const indonesianSynopsis = ref('');
const isIndonesian = ref(false);
const isTranslating = ref(false);
const isServerCached = ref(false);

const isFav = ref(false);
const showResumeBanner = ref(false);
const savedResumeTime = ref(0);
const armMapping = ref(null);
const kusonimeDownloads = ref([]);

const filteredEpisodes = computed(() => {
  const q = epSearchQuery.value.trim().toLowerCase();
  if (!q) return episodesList.value;
  return episodesList.value.filter(e => String(e.num).includes(q));
});

const currentSynopsis = computed(() => {
  if (isIndonesian.value && indonesianSynopsis.value) {
    return indonesianSynopsis.value;
  }
  return originalSynopsis.value;
});

const activeDirectUrl = computed(() => {
  const source = currentSources.value[selectedSourceIndex.value];
  if (!source || !source.videos) return '';
  const video = source.videos.find(v => Number(v.quality) === selectedQuality.value) || source.videos[0];
  return video?.direct_url || '';
});

const recommendationsList = computed(() => {
  if (!anime.value?.recommendations?.nodes) return [];
  return anime.value.recommendations.nodes
    .map(n => n.mediaRecommendation)
    .filter(Boolean)
    .slice(0, 6);
});

const watchPercentage = computed(() => {
  if (watchDuration.value <= 0) return 0;
  return Math.min(100, Math.round((watchCurrentTime.value / watchDuration.value) * 100));
});

const resumePercentage = computed(() => {
  if (watchDuration.value <= 0 || savedResumeTime.value <= 0) return 0;
  return Math.min(100, Math.round((savedResumeTime.value / watchDuration.value) * 100));
});

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
}

// ---------------- Episode Count Logic ----------------
function computeEpisodeCount(details) {
  let count = 1;
  airingNotice.value = '';

  if (details.status === 'RELEASING') {
    if (details.nextAiringEpisode && details.nextAiringEpisode.episode) {
      count = Math.max(1, details.nextAiringEpisode.episode - 1);

      const hours = Math.floor(details.nextAiringEpisode.timeUntilAiring / 3600);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      const timeStr = days > 0 ? `${days} hari ${remHours} jam` : `${hours} jam`;
      airingNotice.value = `Episode ${details.nextAiringEpisode.episode} rilis dalam ${timeStr}`;
    } else if (details.episodes) {
      count = details.episodes;
    }
  } else {
    count = details.episodes || 12;
  }

  totalEpisodes.value = count;
  episodesList.value = Array.from({ length: count }, (_, i) => ({
    num: i + 1,
    title: `Episode ${i + 1}`
  }));
}

// Query YummyAnime server for exact stream episodes
async function fetchYummyEpisodes(details) {
  const searchTerm = details.title?.english || details.title?.romaji;
  try {
    const res = await fetch(apiUrl(`/api/yummy/episodes?q=${encodeURIComponent(searchTerm)}`));
    const data = await res.json();
    if (data.episodes && data.episodes.length > 0) {
      let validEps = data.episodes.map(e => ({
        num: Number(e.num),
        title: `Episode ${e.num}`
      })).filter(e => !isNaN(e.num) && e.num > 0);

      if (validEps.length > 0) {
        validEps.sort((a, b) => a.num - b.num);
        if (details.status === 'RELEASING' && totalEpisodes.value > 0) {
          validEps = validEps.filter(e => e.num <= totalEpisodes.value);
        }
        if (validEps.length > 0) {
          episodesList.value = validEps;
          totalEpisodes.value = validEps.length;
        }
      }
    }
  } catch (err) {
    console.warn('Yummy episodes fallback:', err);
  }
}

// ---------------- Watch Initialization & Stream ----------------
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

    // Document title
    document.title = `${details.title?.english || details.title?.romaji} — Episode ${ep} | AniPulse Theater`;

    // 1. Accurate Episode Count
    computeEpisodeCount(details);

    // 2. Immediate History Record
    saveHistory(details, ep, 0, 0);

    // 3. Query YummyAnime episodes in background
    fetchYummyEpisodes(details);

    // 4. Fetch ARM Mapping
    fetchArmMapping(details.id);

    // 5. Fetch persistent SQLite translation
    lookupTranslation(animeId).then(res => {
      if (res.found && res.translation) {
        indonesianSynopsis.value = res.translation;
        isIndonesian.value = true;
        isServerCached.value = true;
      }
    });

    // 6. Fetch Kusonime Batch Downloads
    fetchKusonime(details);

    // 7. Load Episode Stream
    loadEpisodeStream(ep);

  } catch (err) {
    console.error('Failed to init watch:', err);
    loadingMessage.value = 'Gagal memuat anime: ' + err.message;
    isLoadingStream.value = false;
  }
}

async function loadEpisodeStream(ep) {
  isLoadingStream.value = true;
  showPlayOverlay.value = false;
  showResumeBanner.value = false;
  loadingMessage.value = `Menghubungkan ke Kodik HLS (Episode ${ep})...`;
  streamStatusText.value = `Menghubungkan ke server stream (Episode ${ep})...`;

  const title = anime.value?.title?.english || anime.value?.title?.romaji || '';
  const altTitle = anime.value?.title?.romaji || '';

  try {
    // 1. Fetch Subtitles in parallel
    fetchSubtitles(title, altTitle, ep);

    // 2. Fetch Streams from backend
    let res = await fetch(apiUrl(`/api/yummy/streams?q=${encodeURIComponent(title)}&ep=${ep}`));
    let data = await res.json();

    // Fallback to Romaji title if empty
    if ((!data.sources || data.sources.length === 0) && altTitle && altTitle !== title) {
      res = await fetch(apiUrl(`/api/yummy/streams?q=${encodeURIComponent(altTitle)}&ep=${ep}`));
      data = await res.json();
    }

    // Fallback to cleaned title (without Season suffix)
    if (!data.sources || data.sources.length === 0) {
      const simplified = title.replace(/\s+(Season|\bS\b|\bPart\b|\bII\b|\b2nd\b).*$/i, '').trim();
      if (simplified && simplified !== title && simplified !== altTitle) {
        res = await fetch(apiUrl(`/api/yummy/streams?q=${encodeURIComponent(simplified)}&ep=${ep}`));
        data = await res.json();
      }
    }

    if (!data.sources || data.sources.length === 0) {
      loadingMessage.value = `Episode ${ep} belum tersedia di server Kodik.`;
      streamStatusText.value = `Episode ${ep} belum tersedia di server Kodik.`;
      isLoadingStream.value = false;
      return;
    }

    currentSources.value = data.sources;
    selectedSourceIndex.value = 0;

    // Prefer original Japanese sub audio track
    const subIdx = data.sources.findIndex(s => s.is_subtitles_original);
    if (subIdx !== -1) {
      selectedSourceIndex.value = subIdx;
    }

    playSelectedSource();

  } catch (err) {
    console.error('Stream load error:', err);
    loadingMessage.value = 'Gagal memuat video: ' + err.message;
    streamStatusText.value = 'Gagal memuat video: ' + err.message;
    isLoadingStream.value = false;
  }
}

function playSelectedSource() {
  const source = currentSources.value[selectedSourceIndex.value];
  if (!source || !source.videos || source.videos.length === 0) {
    loadingMessage.value = 'Video tidak tersedia untuk pengisi suara ini.';
    isLoadingStream.value = false;
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

  // Destroy previous HLS instance
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  clearTimeout(safetyTimer);

  const videoEl = videoRef.value;
  if (!videoEl) return;

  // Non-blocking safety timer: dismiss overlay within 3.5s
  safetyTimer = setTimeout(() => {
    isLoadingStream.value = false;
  }, 3500);

  // Use direct Kodik Solodcdn URL as primary/reliable stream (supports CORS: * and full HTTPS)
  // Fallback to apiUrl(video.url) if needed
  const streamUrl = video.direct_url || apiUrl(video.url);

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
      enableWorker: true,
      highBufferWatchdogPeriod: 2,
      nudgeOffset: 0.2,
      nudgeMaxRetry: 10,
      fragLoadingTimeOut: 35000,
      fragLoadingMaxRetry: 8,
      fragLoadingRetryDelay: 500,
      levelLoadingTimeOut: 20000,
      manifestLoadingTimeOut: 20000
    });

    hlsInstance.loadSource(streamUrl);
    hlsInstance.attachMedia(videoEl);

    hlsInstance.on(Hls.Events.MANIFEST_PARSED, () => {
      isLoadingStream.value = false;
      checkResumeProgress();
      videoEl.play().catch(e => {
        console.log('Autoplay deferred by browser:', e);
        showPlayOverlay.value = true;
      });
    });

    hlsInstance.on(Hls.Events.LEVEL_LOADED, () => {
      isLoadingStream.value = false;
    });

    hlsInstance.on(Hls.Events.ERROR, (event, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            // Switch to direct_url or retry
            if (video.direct_url && streamUrl !== video.direct_url) {
              console.log('HLS Network fallback to direct_url:', video.direct_url);
              hlsInstance.loadSource(video.direct_url);
              hlsInstance.startLoad();
              return;
            }
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
    // Safari / WebKit native HLS
    videoEl.src = streamUrl;
    videoEl.onloadedmetadata = () => {
      isLoadingStream.value = false;
      checkResumeProgress();
      videoEl.play().catch(e => {
        showPlayOverlay.value = true;
      });
    };
  }
}

function startManualPlayback() {
  showPlayOverlay.value = false;
  if (videoRef.value) {
    videoRef.value.play().catch(e => console.log('Play error:', e));
  }
}

function onVideoPlay() {
  isLoadingStream.value = false;
  showPlayOverlay.value = false;
}

function onVideoPlaying() {
  isLoadingStream.value = false;
  showPlayOverlay.value = false;
}

function onVideoCanPlay() {
  isLoadingStream.value = false;
}

function switchSource(idx) {
  selectedSourceIndex.value = idx;
  playSelectedSource();
}

function switchQuality(q) {
  selectedQuality.value = q;
  playSelectedSource();
}

function switchEpisode(epNum) {
  if (currentEpisode.value === epNum) return;

  // Save current episode progress
  const videoEl = videoRef.value;
  if (anime.value && videoEl && videoEl.currentTime > 2 && videoEl.duration > 0) {
    updateWatchProgress(anime.value.id, currentEpisode.value, videoEl.currentTime, videoEl.duration);
  }

  currentEpisode.value = epNum;
  lastSavedTime.value = 0;
  showResumeBanner.value = false;

  // Update URL without full refresh
  router.replace({ query: { ...route.query, ep: epNum } });
  document.title = `${anime.value?.title?.english || anime.value?.title?.romaji} — Episode ${epNum} | AniPulse Theater`;

  // Save entry for new episode
  saveHistory(anime.value, epNum, 0, 0);

  // Load stream for new episode
  loadEpisodeStream(epNum);
}

// ---------------- Video Event Handlers ----------------
function onTimeUpdate() {
  const videoEl = videoRef.value;
  if (!videoEl || !videoEl.duration || videoEl.duration <= 0) return;

  const cur = videoEl.currentTime;
  const dur = videoEl.duration;
  watchCurrentTime.value = cur;
  watchDuration.value = dur;

  // Calculate buffer ahead
  let buffered = 0;
  for (let i = 0; i < videoEl.buffered.length; i++) {
    if (videoEl.buffered.start(i) <= cur && cur <= videoEl.buffered.end(i)) {
      buffered = Math.round(videoEl.buffered.end(i) - cur);
      break;
    }
  }
  bufferAheadSec.value = buffered;
  isBufferingStable.value = buffered >= 10;

  // Save progress every 3 seconds or on seek
  if (Math.abs(cur - lastSavedTime.value) >= 3) {
    lastSavedTime.value = cur;
    if (anime.value) {
      updateWatchProgress(anime.value.id, currentEpisode.value, cur, dur);
    }
  }
}

function onVideoPause() {
  const videoEl = videoRef.value;
  if (anime.value && videoEl && videoEl.duration > 0 && videoEl.currentTime > 2) {
    updateWatchProgress(anime.value.id, currentEpisode.value, videoEl.currentTime, videoEl.duration);
  }
}

function onVideoSeeked() {
  const videoEl = videoRef.value;
  if (anime.value && videoEl && videoEl.duration > 0) {
    updateWatchProgress(anime.value.id, currentEpisode.value, videoEl.currentTime, videoEl.duration);
  }
}

function onVideoEnded() {
  if (autoNext.value && currentEpisode.value < totalEpisodes.value) {
    switchEpisode(currentEpisode.value + 1);
  }
}

// ---------------- Resume Progress ----------------
function checkResumeProgress() {
  if (!anime.value) return;
  const saved = getEpisodeProgress(anime.value.id, currentEpisode.value);
  if (saved && saved.currentTime > 5 && (!saved.duration || saved.currentTime < (saved.duration - 15))) {
    savedResumeTime.value = saved.currentTime;
    showResumeBanner.value = true;
    setTimeout(() => {
      showResumeBanner.value = false;
    }, 12000);
  } else {
    savedResumeTime.value = 0;
    showResumeBanner.value = false;
  }
}

function applyResume(resume) {
  showResumeBanner.value = false;
  const videoEl = videoRef.value;
  if (!videoEl) return;

  if (resume && savedResumeTime.value > 0) {
    videoEl.currentTime = savedResumeTime.value;
    videoEl.play().catch(() => {});
  } else {
    videoEl.currentTime = 0;
    videoEl.play().catch(() => {});
    if (anime.value) {
      updateWatchProgress(anime.value.id, currentEpisode.value, 0, videoEl.duration || 0);
    }
  }
}

// ---------------- Subtitles ----------------
async function fetchSubtitles(title, altTitle, ep) {
  isSearchingSubtitles.value = true;
  try {
    const res = await fetch(apiUrl(`/api/subtitles/search?title=${encodeURIComponent(title)}&alt_title=${encodeURIComponent(altTitle)}&ep=${ep}`));
    const data = await res.json();
    if (data.subtitles && data.subtitles.length > 0) {
      subtitlesList.value = data.subtitles;
      // Default to Indonesian if found
      const idIdx = data.subtitles.findIndex(s => s.lang === 'id' || s.label?.toLowerCase().includes('indo'));
      if (idIdx !== -1) {
        selectedSubIndex.value = idIdx;
        applySubtitleTrack(data.subtitles[idIdx]);
      }
    }
  } catch (err) {
    console.warn('Subtitles search error:', err);
  } finally {
    isSearchingSubtitles.value = false;
  }
}

function switchSubtitle(idx) {
  selectedSubIndex.value = idx;
  if (idx === -1) {
    applySubtitleTrack(null);
  } else {
    applySubtitleTrack(subtitlesList.value[idx]);
  }
}

function applySubtitleTrack(sub) {
  const videoEl = videoRef.value;
  if (!videoEl) return;

  const tracks = videoEl.querySelectorAll('track');
  tracks.forEach(t => t.remove());

  if (!sub) return;

  const track = document.createElement('track');
  track.kind = 'subtitles';
  track.label = sub.label;
  track.srclang = sub.lang;
  track.src = apiUrl(sub.vtt_url);
  track.default = true;

  videoEl.appendChild(track);

  if (videoEl.textTracks && videoEl.textTracks.length > 0) {
    for (let i = 0; i < videoEl.textTracks.length; i++) {
      videoEl.textTracks[i].mode = 'showing';
    }
  }
}

// ---------------- ARM & Kusonime & Translation ----------------
async function fetchArmMapping(id) {
  try {
    const res = await fetch(apiUrl(`/api/arm/lookup?id=${id}`));
    const data = await res.json();
    if (!data.error) {
      armMapping.value = data;
    }
  } catch (_) {
    armMapping.value = null;
  }
}

async function fetchKusonime(details) {
  kusonimeDownloads.value = [];
  const title = details.title?.romaji || details.title?.english;
  if (!title) return;
  try {
    const res = await searchKusonime(title, 2);
    if (res && res.length > 0 && res[0].link) {
      const dlRes = await getKusonimeDownloads(res[0].link);
      if (dlRes && dlRes.downloads) {
        kusonimeDownloads.value = dlRes.downloads;
      }
    }
  } catch (_) {}
}

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

function handleToggleFavorite() {
  if (!anime.value) return;
  isFav.value = toggleFavorite(anime.value);
}

function navigateToAnime(id) {
  router.push(`/watch?id=${id}&ep=1`);
}

// ---------------- Keyboard Shortcuts ----------------
function handleKeydown(e) {
  if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
  const videoEl = videoRef.value;
  if (!videoEl) return;

  switch (e.code) {
    case 'Space':
      e.preventDefault();
      if (videoEl.paused) videoEl.play(); else videoEl.pause();
      break;
    case 'ArrowRight':
      e.preventDefault();
      videoEl.currentTime = Math.min(videoEl.duration || 9999, videoEl.currentTime + 10);
      break;
    case 'ArrowLeft':
      e.preventDefault();
      videoEl.currentTime = Math.max(0, videoEl.currentTime - 10);
      break;
    case 'ArrowUp':
      e.preventDefault();
      videoEl.volume = Math.min(1, videoEl.volume + 0.1);
      break;
    case 'ArrowDown':
      e.preventDefault();
      videoEl.volume = Math.max(0, videoEl.volume - 0.1);
      break;
    case 'KeyF':
      e.preventDefault();
      const theaterBox = document.getElementById('theaterBox');
      if (!document.fullscreenElement) {
        theaterBox?.requestFullscreen().catch(() => {});
      } else {
        document.exitFullscreen().catch(() => {});
      }
      break;
    case 'KeyM':
      e.preventDefault();
      videoEl.muted = !videoEl.muted;
      break;
  }
}

watch(() => route.query.ep, (newEp) => {
  if (newEp && Number(newEp) !== currentEpisode.value) {
    currentEpisode.value = Number(newEp);
    loadEpisodeStream(currentEpisode.value);
  }
});

watch(() => route.query.id, (newId) => {
  if (newId && anime.value && Number(newId) !== Number(anime.value.id)) {
    initWatch();
  }
});

onMounted(() => {
  initWatch();
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown);
  clearTimeout(safetyTimer);
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
});
</script>

<style scoped>
.watch-page-container {
  max-width: 1600px;
  margin: 0 auto;
  padding: 1.5rem 1.75rem 4rem;
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 2rem;
  align-items: start;
}

@media (max-width: 1100px) {
  .watch-page-container {
    grid-template-columns: 1fr;
    padding: 1rem 1.25rem 3rem;
  }
}

.theater-main {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  min-width: 0;
}

/* Breadcrumb */
.theater-breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  color: #94a3b8;
  flex-wrap: wrap;
}

.bc-link {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  color: #94a3b8;
  transition: color 0.15s;
}

.bc-link:hover {
  color: #fff;
}

.bc-sep {
  color: #475569;
}

.bc-title {
  color: #cbd5e1;
  font-weight: 600;
}

.bc-ep {
  color: #e50914;
  font-weight: 700;
}

/* Player Viewport */
.theater-player-box {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
  border: 1px solid #2a3044;
  aspect-ratio: 16 / 9;
  max-height: 75vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

.native-hls-player {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  display: block;
}

.player-loader {
  position: absolute;
  inset: 0;
  background: rgba(8, 9, 12, 0.88);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 20;
  color: #fff;
  pointer-events: none;
}

.manual-play-overlay {
  position: absolute;
  inset: 0;
  background: rgba(8, 9, 12, 0.7);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  z-index: 25;
  cursor: pointer;
  transition: background 0.2s;
}

.manual-play-overlay:hover {
  background: rgba(8, 9, 12, 0.85);
}

.manual-play-icon {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background: #e50914;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(229, 9, 20, 0.6);
  padding-left: 5px;
  transition: transform 0.2s;
}

.manual-play-overlay:hover .manual-play-icon {
  transform: scale(1.1);
}

.manual-play-text {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

/* Resume Prompt Banner */
.watch-resume-banner {
  position: absolute;
  bottom: 4.5rem;
  left: 1.5rem;
  background: rgba(18, 20, 28, 0.95);
  border: 1px solid #e50914;
  border-radius: 8px;
  padding: 0.75rem 1rem;
  display: flex;
  align-items: center;
  gap: 1.25rem;
  z-index: 30;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(10px);
  animation: slideUp 0.25s ease;
}

.resume-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
}

.resume-subtitle {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 0.1rem;
}

.resume-banner-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.resume-close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.9rem;
  padding: 0.2rem 0.4rem;
  cursor: pointer;
}

/* Stream Notice Bar */
.stream-notice-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.2rem;
}

.player-server-notice {
  font-size: 0.82rem;
  color: #94a3b8;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-m3u8 {
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.watch-progress-badge {
  font-size: 0.78rem;
  color: #94a3b8;
  background: #181b26;
  border: 1px solid #2a3044;
  padding: 0.25rem 0.65rem;
  border-radius: 4px;
}

.buffer-text {
  color: #10b981;
}

/* Ep Nav Toolbar */
.ep-nav-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  background: #12141c;
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  border: 1px solid #1e2230;
}

.ep-nav-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  padding: 0.45rem 0.85rem;
}

.auto-next-label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.82rem;
  cursor: pointer;
  color: #94a3b8;
  user-select: none;
}

/* Controls Bar */
.theater-controls-bar {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 10px;
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.control-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.control-row-label {
  font-size: 0.8rem;
  font-weight: 700;
  color: #94a3b8;
  min-width: 90px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.control-row-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.chip-btn {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.3rem 0.65rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.15s;
}

.chip-btn:hover {
  background: #242938;
  color: #fff;
  border-color: #3b4257;
}

.chip-btn.active {
  background: #e50914;
  color: #fff;
  border-color: #e50914;
  font-weight: 700;
}

.control-empty-text {
  font-size: 0.8rem;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

/* Info Card */
.watch-info-card {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 12px;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.watch-info-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  flex-wrap: wrap;
}

.anime-main-title {
  font-size: 1.5rem;
  font-weight: 800;
  line-height: 1.25;
}

.anime-alt-title {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.watch-badges-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.badge-tag {
  display: inline-flex;
  align-items: center;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  background: #181b26;
  border: 1px solid #2a3044;
  color: #cbd5e1;
}

.badge-score {
  background: #eab308;
  color: #000;
  font-weight: 800;
  border-color: #eab308;
}

.badge-ongoing {
  background: rgba(16, 185, 129, 0.15);
  color: #34d399;
  border-color: rgba(16, 185, 129, 0.35);
}

.badge-ep-count {
  background: rgba(229, 9, 20, 0.12);
  color: #ff6b72;
  border-color: rgba(229, 9, 20, 0.3);
  font-weight: 700;
}

.dashboard-genre-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  align-items: center;
}

.genre-label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #94a3b8;
}

.genre-pill {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #cbd5e1;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 9999px;
  text-decoration: none;
  transition: all 0.15s;
}

.genre-pill:hover {
  background: #e50914;
  color: #fff;
  border-color: #e50914;
}

.watch-arm-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.arm-tag {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #94a3b8;
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

/* Synopsis */
.synopsis-section {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.synopsis-top-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.synopsis-heading {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

.synopsis-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cached-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  font-size: 0.72rem;
  color: #10b981;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

.btn-translate {
  font-size: 0.75rem;
  padding: 0.25rem 0.65rem;
}

.synopsis-box {
  background: #181b26;
  border: 1px solid #1e2230;
  border-radius: 8px;
  padding: 1rem;
  font-size: 0.88rem;
  line-height: 1.6;
  color: #cbd5e1;
}

/* Batch Downloads */
.batch-downloads-section {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.section-subheading {
  font-size: 0.95rem;
  font-weight: 700;
  color: #fff;
}

.downloads-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.download-box {
  background: #181b26;
  border: 1px solid #2a3044;
  border-radius: 6px;
  padding: 0.65rem 0.85rem;
}

.download-quality-title {
  font-weight: 700;
  color: #fff;
  font-size: 0.8rem;
  margin-bottom: 0.35rem;
}

.download-links-list {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.legal-badge {
  background: #12141c;
  border: 1px solid #2a3044;
  color: #cbd5e1;
  font-size: 0.75rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.15s;
}

.legal-badge:hover {
  background: #e50914;
  color: #fff;
  border-color: #e50914;
}

/* Recs Grid */
.recs-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.85rem;
  margin-top: 0.5rem;
}

.rec-card {
  cursor: pointer;
  text-decoration: none;
}

.rec-poster-box {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid #2a3044;
  background: #181b26;
}

.rec-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.25s;
}

.rec-card:hover .rec-poster {
  transform: scale(1.05);
}

.rec-score-badge {
  position: absolute;
  top: 0.35rem;
  right: 0.35rem;
  background: rgba(0, 0, 0, 0.75);
  color: #eab308;
  font-weight: 800;
  font-size: 0.7rem;
  padding: 0.15rem 0.4rem;
  border-radius: 4px;
  backdrop-filter: blur(4px);
}

.rec-title {
  font-size: 0.8rem;
  line-height: 1.25;
  color: #fff;
  margin-top: 0.45rem;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Right Sidebar */
.theater-sidebar {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 12px;
  padding: 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  position: sticky;
  top: 5rem;
  max-height: calc(100vh - 6.5rem);
  overflow-y: auto;
}

.sidebar-section-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.sidebar-airing-notice {
  background: #181b26;
  border: 1px solid rgba(229, 9, 20, 0.35);
  padding: 0.6rem 0.85rem;
  border-radius: 6px;
  font-size: 0.8rem;
  color: #fca5a5;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.live-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 6px #ef4444;
  animation: pulse 1.5s infinite;
}

.ep-search-sidebar {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #fff;
  padding: 0.45rem 0.75rem;
  border-radius: 6px;
  font-size: 0.82rem;
  outline: none;
  width: 100%;
}

.ep-search-sidebar:focus {
  border-color: #e50914;
}

.watch-episodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(68px, 1fr));
  gap: 0.5rem;
  max-height: 480px;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.watch-ep-pill {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #94a3b8;
  padding: 0.6rem 0.35rem;
  border-radius: 6px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
  user-select: none;
}

.watch-ep-pill:hover {
  background: #1f2433;
  color: #fff;
  border-color: #3b4257;
}

.watch-ep-pill.active {
  background: #e50914;
  color: #fff;
  font-weight: 700;
  border-color: #e50914;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #e50914;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

.spinner-tiny {
  width: 11px;
  height: 11px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  display: inline-block;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(1.15); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
