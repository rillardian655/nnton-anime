<template>
  <div class="watch-page-container">
    <div class="theater-main">
      
      <!-- Top Breadcrumb Bar (Clean mobile-native back link) -->
      <div class="theater-breadcrumb-bar">
        <router-link to="/" class="bc-link">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span class="bc-anime-title">{{ anime?.title?.english || anime?.title?.romaji || 'Kembali ke Beranda' }}</span>
        </router-link>
      </div>

      <!-- Video Player Viewport -->
      <div class="theater-player-box" id="theaterBox">
        <!-- Embed Stream Player (MultiEmbed / 2Embed / VidSrc failover) -->
        <iframe 
          v-if="activeEmbedUrl && isAuthenticated"
          :src="activeEmbedUrl" 
          class="native-hls-player native-embed-iframe"
          frameborder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowfullscreen
        ></iframe>

        <!-- Direct HLS / MP4 Player (Kodik / AniLibria streams) -->
        <video 
          v-show="!activeEmbedUrl"
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

        <!-- VIP Locked Access Screen (Displayed when user is not logged in) -->
        <div v-if="!isAuthenticated" class="vip-locked-theater-overlay">
          <div class="vip-locked-backdrop-glow"></div>
          <div class="vip-locked-card">
            <div class="vip-locked-badge">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#e50914" stroke-width="2.5">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <span>AKSES KHUSUS VIP & UNDANGAN</span>
            </div>
            
            <h2 class="vip-locked-title">Streaming Video Terkunci</h2>
            <p class="vip-locked-desc">
              Aplikasi ini bersifat privat khusus anggota terdaftar. Masuk dengan akun yang dibuatkan Admin atau klaim Kode Undangan resmi untuk mulai menonton anime.
            </p>

            <div class="vip-locked-actions">
              <button class="btn btn-primary vip-btn-glow" @click="showLoginModal = true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
                  <polyline points="10 17 15 12 10 7"></polyline>
                  <line x1="15" y1="12" x2="3" y2="12"></line>
                </svg>
                <span>Masuk Akun VIP</span>
              </button>

              <button class="btn btn-secondary vip-btn-invite" @click="showInviteModal = true">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2">
                  <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
                  <line x1="12" y1="9" x2="12" y2="15"></line>
                </svg>
                <span>Klaim Kode Undangan</span>
              </button>
            </div>
            
            <div class="vip-locked-footer-hint">
              <span>👑 Dikelola oleh Admin &bull; Akses Terbatas & Privat</span>
            </div>
          </div>
        </div>


        <!-- Floating Skip Opening Overlay Button (Appears during opening 0:00 - 3:00) -->
        <transition name="fade-scale">
          <button 
            v-if="canShowSkipOpOverlay" 
            class="skip-op-overlay-btn" 
            @click.stop="skipOpening(false)"
            title="Lompati lagu opening 85 detik"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <polygon points="11 4 21 12 11 20 11 4"></polygon>
            </svg>
            <span>Lewati Opening (+85s)</span>
          </button>
        </transition>

        <!-- Toast Notification (Opening dilewati +85s) -->
        <transition name="toast-slide">
          <div v-if="showSkipToast" class="player-action-toast">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <polygon points="11 4 21 12 11 20 11 4"></polygon>
            </svg>
            <span>{{ skipToastMessage }}</span>
          </div>
        </transition>

        <!-- Floating Resume Prompt Banner -->
        <div v-if="showResumeBanner" class="watch-resume-banner">
          <div class="resume-banner-info">
            <div>
              <p class="resume-title">Lanjutkan Tontonan?</p>
              <p class="resume-subtitle">Sebelumnya sampai menit <strong>{{ formatTime(savedResumeTime) }}</strong> ({{ resumePercentage }}%)</p>
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

      <!-- Episode Heading, Total Count & Actions Row (Matching User's Screenshot) -->
      <div class="theater-title-row">
        <div class="title-left">
          <h1 class="episode-heading">
            Episode {{ currentEpisode }}
            <span class="total-ep-accent">{{ totalEpisodes }} ep</span>
          </h1>
        </div>
        <div class="title-actions">
          <button class="btn-skip-pill" @click="skipOpening(false)" title="Lompati lagu intro opening 85 detik">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 4 15 12 5 20 5 4"></polygon>
              <polygon points="11 4 21 12 11 20 11 4"></polygon>
            </svg>
            <span>Skip Opening</span>
          </button>
          <button class="btn-fav-pill" @click="handleToggleFavorite" :class="{ 'is-saved': isFav }" :title="isFav ? 'Tersimpan di koleksi' : 'Simpan ke koleksi'">
            <svg width="14" height="14" viewBox="0 0 24 24" :fill="isFav ? '#ff4d2e' : 'none'" :stroke="isFav ? '#ff4d2e' : 'currentColor'" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            <span>{{ isFav ? 'Tersimpan' : 'Koleksi' }}</span>
          </button>
        </div>
      </div>

      <!-- Versi (Server / Audio Dub) & Stream Settings Row (Matches Miru screenshot) -->
      <div class="theater-version-container">
        <div class="version-item">
          <label class="version-label">Versi</label>
          <div class="version-select-box">
            <select 
              v-model="selectedSourceIndex" 
              @change="switchSource(selectedSourceIndex)" 
              class="version-native-select"
            >
              <option v-if="isLoadingStream && currentSources.length === 0" disabled :value="0">
                Memuat server stream...
              </option>
              <option v-else-if="currentSources.length === 0" disabled :value="0">
                Server tidak tersedia
              </option>
              <option 
                v-for="(src, idx) in currentSources" 
                :key="idx" 
                :value="idx"
              >
                {{ src.title || (src.is_subtitles_original ? 'Kodik (Sub Original)' : `Server ${idx + 1}`) }}
              </option>
            </select>
            <div class="version-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- Quality selector -->
        <div class="version-item" v-if="availableVideos.length > 0">
          <label class="version-label">Resolusi</label>
          <div class="version-select-box">
            <select 
              v-model="selectedQuality" 
              @change="switchQuality(selectedQuality)" 
              class="version-native-select"
            >
              <option v-for="v in availableVideos" :key="v.quality" :value="Number(v.quality)">
                {{ v.quality }}p {{ v.type === 'mp4' ? 'Direct MP4' : 'HD' }}
              </option>
            </select>
            <div class="version-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>

        <!-- Subtitle selector -->
        <div class="version-item" v-if="subtitlesList.length > 0">
          <label class="version-label">Subtitle</label>
          <div class="version-select-box">
            <select 
              v-model="selectedSubIndex" 
              @change="switchSubtitle(selectedSubIndex)" 
              class="version-native-select"
            >
              <option :value="-1">Mati (Tanpa Subtitle)</option>
              <option v-for="(sub, sIdx) in subtitlesList" :key="sIdx" :value="sIdx">
                {{ sub.label }}
              </option>
            </select>
            <div class="version-chevron">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Episode Picker Grid (Matches Miru buttons: 1, 2, 3... right under Versi) -->
      <div class="theater-episodes-section">
        <!-- If total episodes > 25, show range chunks -->
        <div class="ep-chunk-tabs" v-if="episodeChunks.length > 1">
          <button 
            v-for="(chunk, cIdx) in episodeChunks" 
            :key="cIdx"
            class="chunk-tab-btn"
            :class="{ active: currentChunkIndex === cIdx }"
            @click="currentChunkIndex = cIdx"
          >
            {{ chunk.label }}
          </button>
        </div>

        <div class="theater-ep-cards-grid">
          <button 
            v-for="ep in visibleEpisodes" 
            :key="ep.num"
            class="ep-card-btn"
            :class="{ active: currentEpisode === ep.num }"
            @click="switchEpisode(ep.num)"
          >
            {{ ep.num }}
          </button>
        </div>
      </div>

      <!-- Episode Quick Navigation & Auto Options -->
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

        <div class="player-switches-group">
          <label class="auto-switch-label">
            <input type="checkbox" v-model="autoSkipOp" @change="onAutoSkipOpChanged" style="accent-color: #ff4d2e;" />
            <span>Auto-Skip Opening (+85s)</span>
          </label>
          <label class="auto-switch-label">
            <input type="checkbox" v-model="autoNext" style="accent-color: #ff4d2e;" />
            <span>Putar Otomatis Next</span>
          </label>
        </div>
      </div>

      <!-- Real-time Watch Progress Tracker & Stream Status Notice -->
      <div class="stream-notice-row">
        <div class="player-server-notice">
          <span>{{ streamStatusText || `Memuat stream Episode ${currentEpisode}...` }}</span>
          <span class="badge-tag badge-genre" v-if="isBufferingStable" style="font-size: 0.72rem; margin-left: 6px;">Buffer Stabil</span>
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

      <!-- Anime Metadata & Synopsis Card -->
      <div class="watch-info-card" v-if="anime">
        <div class="watch-info-header">
          <div class="watch-title-group">
            <h2 class="anime-main-title">{{ anime.title?.english || anime.title?.romaji }}</h2>
            <p class="anime-alt-title">{{ anime.title?.romaji }} <span v-if="anime.title?.native">({{ anime.title?.native }})</span></p>
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
          <span class="badge-tag badge-genre badge-ep-count">{{ totalEpisodes }} Episode</span>
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
  apiUrl,
  getAuthToken,
  safeFetchJson
} from '../api.js';
import { 
  isAuthenticated, 
  showLoginModal, 
  showInviteModal 
} from '../stores/auth.js';
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

// Skip Opening & Mobile Episode Chunking
const autoSkipOp = ref(localStorage.getItem('anipulse_auto_skip_op') === 'true');
const showSkipToast = ref(false);
const skipToastMessage = ref('');
const hasAutoSkippedThisEp = ref(false);
const currentChunkIndex = ref(0);

const canShowSkipOpOverlay = computed(() => {
  return watchCurrentTime.value > 0.5 && watchCurrentTime.value <= 180 && !isLoadingStream.value;
});

const episodeChunks = computed(() => {
  const chunks = [];
  const total = totalEpisodes.value || 1;
  const chunkSize = 25;
  for (let i = 0; i < total; i += chunkSize) {
    const start = i + 1;
    const end = Math.min(i + chunkSize, total);
    chunks.push({
      start,
      end,
      label: `${start} - ${end}`
    });
  }
  return chunks;
});

const visibleEpisodes = computed(() => {
  if (totalEpisodes.value <= 25) {
    return episodesList.value;
  }
  const chunk = episodeChunks.value[currentChunkIndex.value];
  if (!chunk) return episodesList.value;
  return episodesList.value.filter(e => e.num >= chunk.start && e.num <= chunk.end);
});

function onAutoSkipOpChanged() {
  localStorage.setItem('anipulse_auto_skip_op', autoSkipOp.value ? 'true' : 'false');
}

function skipOpening(isAuto = false) {
  const videoEl = videoRef.value;
  if (!videoEl) return;
  const target = Math.min((videoEl.duration || Infinity), videoEl.currentTime + 85);
  videoEl.currentTime = target;
  hasAutoSkippedThisEp.value = true;
  skipToastMessage.value = isAuto ? 'Auto-Skip: Lewati Opening (+85s)' : 'Opening dilewati (+85s)';
  showSkipToast.value = true;
  setTimeout(() => {
    showSkipToast.value = false;
  }, 2200);
}

const currentSources = ref([]);
const selectedSourceIndex = ref(0);
const activeEmbedUrl = ref('');
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
  const altTerm = details.title?.romaji || '';
  try {
    const res = await fetch(apiUrl(`/api/yummy/episodes?q=${encodeURIComponent(searchTerm)}&alt=${encodeURIComponent(altTerm)}`));
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

    // 5. Fetch persistent SQLite translation (or auto-translate in background)
    lookupTranslation(animeId).then(async (res) => {
      if (res.found && res.translation) {
        indonesianSynopsis.value = res.translation;
        isIndonesian.value = true;
        isServerCached.value = true;
      } else if (originalSynopsis.value) {
        try {
          const trRes = await translateSynopsis(originalSynopsis.value, animeId);
          if (trRes.translation) {
            indonesianSynopsis.value = trRes.translation;
            isIndonesian.value = true;
            isServerCached.value = true;
          }
        } catch (_) {}
      }
    });

    // 6. Fetch Kusonime Batch Downloads
    fetchKusonime(details);

    // 7. Load Episode Stream (Only if authenticated)
    if (isAuthenticated.value) {
      loadEpisodeStream(ep);
    } else {
      isLoadingStream.value = false;
      showLoginModal.value = true;
    }

  } catch (err) {
    console.error('Failed to init watch:', err);
    loadingMessage.value = 'Gagal memuat anime: ' + err.message;
    isLoadingStream.value = false;
  }
}

function getBackupEmbedSources(animeObj, ep) {
  const animeId = animeObj?.id || '';
  return [
    {
      title: 'Server MultiEmbed (HD Multi-Sub)',
      type: 'embed',
      is_subtitles_original: true,
      embed_url: `https://multiembed.mov/?video_id=${animeId}&anime=1&s=1&e=${ep}`
    },
    {
      title: 'Server 2Embed (Cadangan)',
      type: 'embed',
      is_subtitles_original: false,
      embed_url: `https://www.2embed.cc/embed/anime/${animeId}/${ep}`
    },
    {
      title: 'Server VidSrc (Cloud Player)',
      type: 'embed',
      is_subtitles_original: false,
      embed_url: `https://vidsrc.me/embed/anime?id=${animeId}&ep=${ep}`
    }
  ];
}

async function loadEpisodeStream(ep) {
  if (!isAuthenticated.value) {
    isLoadingStream.value = false;
    showLoginModal.value = true;
    return;
  }

  isLoadingStream.value = true;
  showPlayOverlay.value = false;
  showResumeBanner.value = false;
  hasAutoSkippedThisEp.value = false;
  loadingMessage.value = `Menghubungkan ke server stream (Episode ${ep})...`;
  streamStatusText.value = `Menghubungkan ke server stream (Episode ${ep})...`;

  const title = anime.value?.title?.english || anime.value?.title?.romaji || '';
  const altTitle = anime.value?.title?.romaji || '';
  const backupSources = getBackupEmbedSources(anime.value, ep);

  try {
    // 1. Fetch Subtitles in parallel
    fetchSubtitles(title, altTitle, ep);

    // 2. Fetch Streams with auth token
    const token = getAuthToken();
    const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
    const tokenQuery = token ? `&token=${encodeURIComponent(token)}` : '';

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    let res = null;
    try {
      res = await fetch(apiUrl(`/api/yummy/streams?q=${encodeURIComponent(title)}&alt=${encodeURIComponent(altTitle)}&ep=${ep}${tokenQuery}`), {
        headers: authHeaders,
        signal: controller.signal
      });
    } catch (netErr) {
      console.warn('Backend fetch timeout/error, using embed failover:', netErr.message);
    } finally {
      clearTimeout(timeoutId);
    }

    let dataSources = [];
    if (res && res.ok) {
      const data = await safeFetchJson(res, 'Stream Episode');
      if (data && Array.isArray(data.sources) && data.sources.length > 0) {
        dataSources = data.sources;
      }
    }

    // Fallback to Romaji title explicitly if empty
    if (dataSources.length === 0 && altTitle && altTitle !== title) {
      try {
        const altRes = await fetch(apiUrl(`/api/yummy/streams?q=${encodeURIComponent(altTitle)}&ep=${ep}${tokenQuery}`), {
          headers: authHeaders
        });
        if (altRes.ok) {
          const altData = await safeFetchJson(altRes, 'Stream Episode Alt');
          if (altData && Array.isArray(altData.sources) && altData.sources.length > 0) {
            dataSources = altData.sources;
          }
        }
      } catch (_) {}
    }

    // Combine backend HLS sources with backup embed sources
    const mergedSources = [...dataSources, ...backupSources];
    currentSources.value = mergedSources;
    selectedSourceIndex.value = 0;

    // Prefer original Japanese sub audio track
    const subIdx = mergedSources.findIndex(s => s.is_subtitles_original);
    if (subIdx !== -1) {
      selectedSourceIndex.value = subIdx;
    }

    playSelectedSource();

  } catch (err) {
    console.warn('Stream load error, activating fallback embed servers:', err);
    currentSources.value = backupSources;
    selectedSourceIndex.value = 0;
    playSelectedSource();
  }
}

function playSelectedSource() {
  const source = currentSources.value[selectedSourceIndex.value];
  if (!source) {
    loadingMessage.value = 'Server stream tidak ditemukan.';
    isLoadingStream.value = false;
    return;
  }

  // Destroy previous HLS instance if any
  if (hlsInstance) {
    hlsInstance.destroy();
    hlsInstance = null;
  }
  clearTimeout(safetyTimer);

  // If source is an iframe embed player
  if (source.type === 'embed' || source.embed_url) {
    const videoEl = videoRef.value;
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
    }
    activeEmbedUrl.value = source.embed_url;
    availableVideos.value = [];
    isLoadingStream.value = false;
    showPlayOverlay.value = false;
    streamStatusText.value = `Memutar: ${source.title}`;
    return;
  }

  // Direct HLS / MP4 playback
  activeEmbedUrl.value = '';
  if (!source.videos || source.videos.length === 0) {
    const firstEmbed = currentSources.value.find(s => s.embed_url);
    if (firstEmbed) {
      activeEmbedUrl.value = firstEmbed.embed_url;
      streamStatusText.value = `Memutar: ${firstEmbed.title}`;
    } else {
      loadingMessage.value = 'Video tidak tersedia untuk server ini.';
    }
    isLoadingStream.value = false;
    return;
  }

  availableVideos.value = source.videos;

  // Match quality
  let video = source.videos.find(v => Number(v.quality) === selectedQuality.value);
  if (!video) {
    video = source.videos[0];
    selectedQuality.value = Number(video.quality);
  }

  // Destroy previous HLS instance if any
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

  const isMp4 = video.type === 'mp4' || (video.direct_url && video.direct_url.includes('.mp4')) || (video.url && video.url.includes('.mp4'));

  if (isMp4) {
    streamStatusText.value = `Memutar: ${source.title} (${video.quality}p MP4)`;
    const playUrl = apiUrl(video.url) || video.direct_url;

    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.src = playUrl;
    videoEl.load();

    const onCanPlay = () => {
      isLoadingStream.value = false;
      checkResumeProgress();
      videoEl.play().catch(e => {
        console.log('Autoplay deferred by browser:', e);
        showPlayOverlay.value = true;
      });
      videoEl.removeEventListener('canplay', onCanPlay);
    };
    videoEl.addEventListener('canplay', onCanPlay);

    const onError = () => {
      console.warn('MP4 playback error, trying alternate stream URL...');
      const altUrl = (video.direct_url && videoEl.src.includes(video.direct_url)) ? (video.url ? apiUrl(video.url) : null) : video.direct_url;
      if (altUrl && videoEl.src !== altUrl) {
        videoEl.src = altUrl;
        videoEl.load();
        videoEl.play().catch(e => {
          showPlayOverlay.value = true;
        });
      }
      videoEl.removeEventListener('error', onError);
    };
    videoEl.addEventListener('error', onError);
    return;
  }

  streamStatusText.value = `Memutar: ${source.title} (${video.quality}p HLS)`;
  const directHlsUrl = video.direct_url || '';
  const proxyHlsUrl = video.url ? apiUrl(video.url) : '';
  let currentHlsUrl = directHlsUrl || proxyHlsUrl;

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

    hlsInstance.loadSource(currentHlsUrl);
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
            // Failover between direct CDN URL and backend proxy
            if (proxyHlsUrl && currentHlsUrl !== proxyHlsUrl) {
              console.log('HLS Network failover to proxy URL:', proxyHlsUrl);
              currentHlsUrl = proxyHlsUrl;
              hlsInstance.loadSource(proxyHlsUrl);
              hlsInstance.startLoad();
              return;
            } else if (directHlsUrl && currentHlsUrl !== directHlsUrl) {
              console.log('HLS Network failover to direct URL:', directHlsUrl);
              currentHlsUrl = directHlsUrl;
              hlsInstance.loadSource(directHlsUrl);
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
  if (!isAuthenticated.value) {
    showLoginModal.value = true;
    return;
  }
  if (currentEpisode.value === epNum) return;

  // Save current episode progress
  const videoEl = videoRef.value;
  if (anime.value && videoEl && videoEl.currentTime > 2 && videoEl.duration > 0) {
    updateWatchProgress(anime.value.id, currentEpisode.value, videoEl.currentTime, videoEl.duration);
  }

  currentEpisode.value = epNum;
  lastSavedTime.value = 0;
  showResumeBanner.value = false;
  hasAutoSkippedThisEp.value = false;

  // Keep chunk tab in sync
  if (totalEpisodes.value > 25) {
    const idx = Math.floor((epNum - 1) / 25);
    if (idx >= 0 && idx < episodeChunks.value.length) {
      currentChunkIndex.value = idx;
    }
  }

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

  // Auto-skip opening if enabled and during intro (1s - 6s)
  if (autoSkipOp.value && !hasAutoSkippedThisEp.value && cur >= 1 && cur <= 6) {
    hasAutoSkippedThisEp.value = true;
    skipOpening(true);
  }

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

  const enableTrackMode = () => {
    if (track.track) {
      track.track.mode = 'showing';
    }
    if (videoEl.textTracks && videoEl.textTracks.length > 0) {
      for (let i = 0; i < videoEl.textTracks.length; i++) {
        videoEl.textTracks[i].mode = 'showing';
      }
    }
  };

  track.addEventListener('load', enableTrackMode);
  videoEl.appendChild(track);
  enableTrackMode();
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

watch(isAuthenticated, (isAuth) => {
  if (isAuth && anime.value) {
    loadEpisodeStream(currentEpisode.value);
  } else if (!isAuth) {
    if (hlsInstance) {
      hlsInstance.destroy();
      hlsInstance = null;
    }
    const videoEl = videoRef.value;
    if (videoEl) {
      videoEl.pause();
      videoEl.removeAttribute('src');
      videoEl.load();
    }
  }
});

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
  max-width: 1400px;
  margin: 0 auto;
  padding: 1.25rem 1.5rem 4rem;
}

.theater-main {
  display: flex;
  flex-direction: column;
  gap: 1.15rem;
  min-width: 0;
}

/* Breadcrumb */
.theater-breadcrumb-bar {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.bc-link {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease;
}

.bc-link:hover {
  color: #fff;
}

.bc-anime-title {
  color: #cbd5e1;
}

/* Player Viewport */
.theater-player-box {
  position: relative;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85);
  border: 1px solid #1e2230;
  aspect-ratio: 16 / 9;
  width: 100%;
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

.native-hls-player::cue,
video::cue {
  background-color: rgba(10, 12, 18, 0.85);
  color: #ffffff;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 1.12rem;
  font-weight: 600;
  line-height: 1.4;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.9), 0 0 2px rgba(0, 0, 0, 1);
  padding: 0.2rem 0.6rem;
  border-radius: 4px;
}

/* Floating Skip Opening Button */
.skip-op-overlay-btn {
  position: absolute;
  bottom: 4.5rem;
  right: 1.5rem;
  background: rgba(18, 20, 28, 0.92);
  border: 1px solid #ff4d2e;
  color: #fff;
  font-size: 0.88rem;
  font-weight: 700;
  padding: 0.55rem 1.15rem;
  border-radius: 9999px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  cursor: pointer;
  backdrop-filter: blur(12px);
  box-shadow: 0 6px 22px rgba(255, 77, 46, 0.45);
  z-index: 30;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}

.skip-op-overlay-btn:hover {
  background: #ff4d2e;
  transform: scale(1.05);
  box-shadow: 0 8px 28px rgba(255, 77, 46, 0.65);
}

.player-action-toast {
  position: absolute;
  top: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(12, 14, 20, 0.95);
  border: 1px solid #ff4d2e;
  color: #fff;
  font-size: 0.85rem;
  font-weight: 700;
  padding: 0.5rem 1.25rem;
  border-radius: 9999px;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  z-index: 35;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  pointer-events: none;
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
  background: #ff4d2e;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(255, 77, 46, 0.6);
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
  border: 1px solid #ff4d2e;
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

/* VIP Locked Theater Overlay */
.vip-locked-theater-overlay {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(20, 10, 15, 0.96) 0%, rgba(6, 7, 10, 0.99) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 40;
  padding: 1.5rem;
  text-align: center;
  backdrop-filter: blur(16px);
}

.vip-locked-backdrop-glow {
  display: none;
}

.vip-locked-card {
  position: relative;
  z-index: 2;
  max-width: 460px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.9rem;
}

.vip-locked-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.3);
  color: #ef4444;
  font-size: 0.74rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  padding: 0.35rem 0.85rem;
  border-radius: 9999px;
  text-transform: uppercase;
}

.vip-locked-title {
  font-size: 1.55rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
  margin: 0;
}

.vip-locked-desc {
  font-size: 0.9rem;
  color: #94a3b8;
  line-height: 1.55;
  margin: 0;
}

.vip-locked-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.85rem;
  flex-wrap: wrap;
  margin-top: 0.4rem;
}

.vip-btn-glow {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #e50914;
  color: #fff;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.65rem 1.3rem;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s;
}

.vip-btn-glow:hover {
  background: #b91c1c;
}

.vip-btn-invite {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(234, 179, 8, 0.4);
  color: #fbbf24;
  font-weight: 700;
  font-size: 0.9rem;
  padding: 0.65rem 1.3rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
}

.vip-btn-invite:hover {
  background: rgba(234, 179, 8, 0.18);
  border-color: #fbbf24;
  transform: translateY(-2px);
}

.vip-locked-footer-hint {
  font-size: 0.76rem;
  color: #64748b;
  margin-top: 0.4rem;
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

/* Episode Title & Total Count Row (Miru style) */
.theater-title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
}

.episode-heading {
  font-size: 1.65rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
  margin: 0;
}

.total-ep-accent {
  font-size: 1.15rem;
  font-weight: 800;
  color: #ff4d2e;
}

.title-actions {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.btn-skip-pill {
  background: rgba(255, 77, 46, 0.12);
  border: 1px solid rgba(255, 77, 46, 0.35);
  color: #ff4d2e;
  padding: 0.45rem 0.95rem;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  transition: all 0.2s ease;
}

.btn-skip-pill:hover {
  background: #ff4d2e;
  color: #fff;
  border-color: #ff4d2e;
}

.btn-fav-pill {
  background: #18181c;
  border: 1px solid #2a2e3d;
  color: #cbd5e1;
  padding: 0.45rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  white-space: nowrap;
  user-select: none;
  -webkit-user-select: none;
  transition: all 0.2s ease;
}

.btn-fav-pill:hover, .btn-fav-pill.is-saved {
  background: rgba(255, 77, 46, 0.15);
  border-color: #ff4d2e;
  color: #fff;
}

/* Versi (Server / Audio Dub) Container (Matches Miru screenshot) */
.theater-version-container {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 0.85rem;
}

.version-item {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.version-label {
  font-size: 0.82rem;
  color: #94a3b8;
  font-weight: 600;
}

.version-select-box {
  position: relative;
  background: #18181c;
  border: 1px solid #2a2e3d;
  border-radius: 8px;
  transition: border-color 0.15s ease;
}

.version-select-box:hover, .version-select-box:focus-within {
  border-color: #ff4d2e;
}

.version-native-select {
  width: 100%;
  background: transparent;
  border: none;
  color: #fff;
  font-size: 0.86rem;
  font-weight: 600;
  padding: 0.65rem 2rem 0.65rem 0.85rem;
  appearance: none;
  -webkit-appearance: none;
  outline: none;
  cursor: pointer;
}

.version-native-select option {
  background: #12141c;
  color: #fff;
}

.version-chevron {
  position: absolute;
  right: 0.75rem;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
  pointer-events: none;
  display: flex;
  align-items: center;
}

/* Episode Picker Cards Grid (Miru buttons: 1, 2, 3...) */
.theater-episodes-section {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.ep-chunk-tabs {
  display: flex;
  gap: 0.4rem;
  overflow-x: auto;
  padding-bottom: 0.25rem;
}

.chunk-tab-btn {
  background: #18181c;
  border: 1px solid #2a2e3d;
  color: #94a3b8;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s ease;
}

.chunk-tab-btn.active {
  background: rgba(255, 77, 46, 0.2);
  border-color: #ff4d2e;
  color: #fff;
}

.theater-ep-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
  gap: 0.6rem;
}

.ep-card-btn {
  height: 52px;
  background: #18181c;
  border: 1px solid #2a2e3d;
  border-radius: 8px;
  color: #fff;
  font-size: 1.15rem;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s ease;
  user-select: none;
}

.ep-card-btn:hover {
  background: #242938;
  border-color: #3b4257;
  transform: translateY(-1px);
}

.ep-card-btn.active {
  background: #ff4d2e !important;
  border-color: #ff4d2e !important;
  color: #fff !important;
  box-shadow: 0 4px 16px rgba(255, 77, 46, 0.45);
}

/* Ep Nav Toolbar */
.ep-nav-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 0.75rem;
  background: #12141c;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  border: 1px solid #1e2230;
}

.ep-nav-buttons {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  flex-wrap: wrap;
}

.nav-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.85rem;
  padding: 0.45rem 0.85rem;
}

.player-switches-group {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
}

.auto-switch-label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.8rem;
  color: #94a3b8;
  cursor: pointer;
  user-select: none;
}

/* Stream Notice Row */
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
  font-size: 1.35rem;
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
  background: rgba(255, 77, 46, 0.12);
  color: #ff6b72;
  border-color: rgba(255, 77, 46, 0.3);
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
  background: #ff4d2e;
  color: #fff;
  border-color: #ff4d2e;
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
  background: #ff4d2e;
  color: #fff;
  border-color: #ff4d2e;
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

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #ff4d2e;
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

/* Animations for Skip Opening */
.fade-scale-enter-active, .fade-scale-leave-active {
  transition: all 0.2s ease;
}
.fade-scale-enter-from, .fade-scale-leave-to {
  opacity: 0;
  transform: scale(0.9);
}

.toast-slide-enter-active, .toast-slide-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.toast-slide-enter-from, .toast-slide-leave-to {
  opacity: 0;
  transform: translate(-50%, -12px);
}

/* Mobile Responsiveness matching the native Miru screenshot */
@media (max-width: 768px) {
  .watch-page-container {
    padding: 0 0 3.5rem 0;
  }

  .theater-main {
    gap: 0.85rem;
  }

  .theater-breadcrumb-bar {
    padding: 0.65rem 0.85rem 0.15rem 0.85rem;
  }

  .theater-player-box {
    border-radius: 0;
    border-left: none;
    border-right: none;
  }

  .skip-op-overlay-btn {
    bottom: 3.5rem;
    right: 0.75rem;
    font-size: 0.78rem;
    padding: 0.45rem 0.85rem;
  }

  .theater-title-row {
    padding: 0 0.85rem;
  }

  .episode-heading {
    font-size: 1.45rem;
  }

  .theater-version-container {
    padding: 0 0.85rem;
    grid-template-columns: 1fr;
    gap: 0.65rem;
  }

  .theater-episodes-section {
    padding: 0 0.85rem;
  }

  .theater-ep-cards-grid {
    grid-template-columns: repeat(auto-fill, minmax(50px, 1fr));
    gap: 0.5rem;
  }

  .ep-card-btn {
    height: 48px;
    font-size: 1.05rem;
  }

  .ep-nav-toolbar {
    margin: 0 0.85rem;
    padding: 0.65rem 0.75rem;
  }

  .stream-notice-row {
    padding: 0 0.85rem;
  }

  .watch-info-card {
    margin: 0 0.85rem;
    padding: 1rem;
    border-radius: 10px;
  }
}
</style>
