<template>
  <div class="modal-overlay" v-if="anime" @click.self="$emit('close')">
    <div class="detail-card">
      <button class="modal-close-btn" @click="$emit('close')" aria-label="Tutup">✕</button>

      <!-- Banner / Backdrop Header -->
      <div class="detail-banner-wrap">
        <img 
          :src="getSafeImageUrl(anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large)" 
          :alt="anime.title?.romaji" 
          class="detail-banner-img" 
        />
        <div class="detail-banner-gradient"></div>

        <div class="detail-banner-content">
          <div class="badge-row">
            <span class="score-badge" v-if="anime.averageScore">★ {{ (anime.averageScore / 10).toFixed(1) }}</span>
            <span class="format-badge">{{ anime.format || 'TV' }}</span>
            <span class="status-badge" :class="{ 'status-releasing': anime.status === 'RELEASING' }">
              {{ anime.status === 'RELEASING' ? 'Sedang Rilis' : 'Tamat' }}
            </span>
            <span class="year-badge" v-if="anime.seasonYear">{{ anime.seasonYear }}</span>
          </div>
          <h2 class="detail-title">{{ anime.title?.english || anime.title?.romaji }}</h2>
          <div class="detail-sub">{{ anime.title?.romaji }} <span v-if="anime.title?.native">({{ anime.title?.native }})</span></div>

          <div class="banner-actions">
            <router-link :to="`/watch?id=${anime.id}&ep=1`" class="btn btn-primary play-btn" @click="$emit('close')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Mulai Nonton (Ep 1)</span>
            </router-link>
            <button class="btn btn-secondary fav-btn" @click="handleToggleWatchlist">
              <svg width="16" height="16" viewBox="0 0 24 24" :fill="isInWatchlist ? '#e50914' : 'none'" :stroke="isInWatchlist ? '#e50914' : 'currentColor'" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              <span>{{ isInWatchlist ? 'Hapus Koleksi' : '+ Simpan Koleksi' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Detail Body -->
      <div class="detail-body">
        <!-- Genres Tags -->
        <div class="genre-tags">
          <span class="genre-prefix">Genre:</span>
          <span v-for="g in anime.genres" :key="g" class="genre-tag">{{ g }}</span>
        </div>

        <!-- Airing Countdown Alert for Releasing Anime -->
        <div v-if="airingNotice" class="airing-alert-box">
          <span class="pulse-dot"></span>
          <span>{{ airingNotice }}</span>
        </div>

        <!-- ================= PILIH EPISODE SECTION ================= -->
        <div class="episodes-selector-section">
          <div class="episodes-section-header">
            <div>
              <h3 class="section-heading">Pilih Episode</h3>
              <p class="episodes-subtext">Pilih nomor episode untuk langsung ditonton di pemutar video theater:</p>
            </div>
            <div class="ep-header-controls">
              <span class="ep-count-tag">{{ totalEpisodes }} Episode Rilis</span>
              <input 
                type="text" 
                v-model="epSearchQuery" 
                placeholder="Cari ep (1, 2...)" 
                class="ep-search-input"
              />
            </div>
          </div>

          <!-- Grid of Episode Pills -->
          <div class="episodes-pills-grid">
            <router-link 
              v-for="ep in filteredEpisodes" 
              :key="ep.num" 
              :to="`/watch?id=${anime.id}&ep=${ep.num}`"
              class="modal-ep-pill"
              :class="{ 'ep-has-progress': ep.progress && ep.progress > 0 }"
              @click="$emit('close')"
            >
              <div class="pill-ep-num">Ep {{ ep.num }}</div>
              <div class="pill-ep-time" v-if="ep.progressText">{{ ep.progressText }}</div>
              <div class="pill-ep-progress-bar" v-if="ep.progress">
                <div class="progress-fill" :style="{ width: ep.progress + '%' }"></div>
              </div>
            </router-link>
          </div>
        </div>

        <!-- Cross-Database ARM Mapping -->
        <div class="arm-badges-wrap" v-if="armMapping">
          <span class="arm-badge" v-if="armMapping.anilist">AniList: {{ armMapping.anilist }}</span>
          <span class="arm-badge" v-if="armMapping.myanimelist">MAL: {{ armMapping.myanimelist }}</span>
          <span class="arm-badge" v-if="armMapping.themoviedb">TMDB: {{ armMapping.themoviedb }}</span>
          <span class="arm-badge" v-if="armMapping.imdb">IMDb: {{ armMapping.imdb }}</span>
          <span class="arm-badge" v-if="armMapping.anidb">AniDB: {{ armMapping.anidb }}</span>
          <span class="arm-badge" v-if="armMapping.kitsu">Kitsu: {{ armMapping.kitsu }}</span>
        </div>

        <!-- Synopsis Section with Shared Server Translation -->
        <div class="synopsis-box">
          <div class="synopsis-header">
            <h3 class="section-heading">Sinopsis Cerita</h3>
            
            <div class="translation-controls">
              <span v-if="isIndonesian && isServerCached" class="cached-pill" title="Terjemahan tersimpan di server lokal">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>
                <span>Tersimpan di Server</span>
              </span>

              <button 
                class="translate-btn" 
                :disabled="isTranslating" 
                @click="toggleTranslation"
              >
                <svg v-if="!isTranslating" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                <span v-else class="spinner-small"></span>
                <span>{{ isTranslating ? 'Menerjemahkan...' : (isIndonesian ? 'Lihat Bahasa Asli' : 'Terjemahkan ke Indonesia') }}</span>
              </button>
            </div>
          </div>

          <p class="synopsis-text">
            {{ currentSynopsis || 'Sinopsis belum tersedia untuk anime ini.' }}
          </p>
        </div>

        <!-- Anime Info Grid -->
        <div class="info-grid">
          <div class="info-card">
            <span class="info-k">Total Episode</span>
            <span class="info-v">{{ totalEpisodes }} Episode</span>
          </div>
          <div class="info-card">
            <span class="info-k">Durasi</span>
            <span class="info-v">{{ anime.duration ? `${anime.duration} Menit/Ep` : '24 Menit' }}</span>
          </div>
          <div class="info-card">
            <span class="info-k">Studio Produksi</span>
            <span class="info-v">{{ anime.studios?.nodes?.[0]?.name || 'N/A' }}</span>
          </div>
          <div class="info-card">
            <span class="info-k">Musim Rilis</span>
            <span class="info-v">{{ anime.season ? `${anime.season} ${anime.seasonYear || ''}` : 'N/A' }}</span>
          </div>
        </div>

        <!-- Kusonime Batch Downloads Section -->
        <div class="batch-downloads-card" v-if="kusonimeDownloads.length > 0">
          <h3 class="section-heading">📥 Download Batch Sub Indo (Kusonime)</h3>
          <div class="downloads-list">
            <div v-for="(dl, idx) in kusonimeDownloads" :key="idx" class="dl-row">
              <span class="dl-res-tag">{{ dl.quality }}</span>
              <div class="dl-host-links">
                <a 
                  v-for="(link, lIdx) in dl.links" 
                  :key="lIdx" 
                  :href="link.url" 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  class="dl-host-pill"
                >
                  {{ link.host }} ↗
                </a>
              </div>
            </div>
          </div>
        </div>

        <!-- Trailer Preview if available -->
        <div v-if="anime.trailer?.id && anime.trailer?.site === 'youtube'" class="trailer-box">
          <h3 class="section-heading">Cuplikan Trailer</h3>
          <div class="trailer-iframe-wrap">
            <iframe 
              :src="`https://www.youtube-nocookie.com/embed/${anime.trailer.id}`" 
              title="YouTube trailer" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen
            ></iframe>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue';
import { 
  getSafeImageUrl, 
  lookupTranslation, 
  translateSynopsis, 
  searchKusonime, 
  getKusonimeDownloads,
  apiUrl 
} from '../api.js';
import { 
  getWatchlistStatus, 
  addToWatchlist, 
  removeFromWatchlist, 
  getEpisodeProgress 
} from '../storage.js';

const props = defineProps({
  anime: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close']);

const originalSynopsis = ref('');
const indonesianSynopsis = ref('');
const isIndonesian = ref(false);
const isTranslating = ref(false);
const isServerCached = ref(false);
const isInWatchlist = ref(false);

const totalEpisodes = ref(1);
const episodesList = ref([]);
const epSearchQuery = ref('');
const airingNotice = ref('');
const armMapping = ref(null);
const kusonimeDownloads = ref([]);

const filteredEpisodes = computed(() => {
  const q = epSearchQuery.value.trim().toLowerCase();
  if (!q) return episodesList.value;
  return episodesList.value.filter(ep => String(ep.num).includes(q));
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
  episodesList.value = Array.from({ length: count }, (_, i) => {
    const epNum = i + 1;
    const progressData = getEpisodeProgress(details.id, epNum);
    return {
      num: epNum,
      progress: progressData?.progress || 0,
      progressText: progressData?.timeFormatted ? `${progressData.timeFormatted} (${progressData.progress}%)` : null
    };
  });
}

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

watch(() => props.anime, async (newAnime) => {
  if (!newAnime) return;
  originalSynopsis.value = stripHtml(newAnime.description || '');
  indonesianSynopsis.value = '';
  isIndonesian.value = false;
  isServerCached.value = false;
  isInWatchlist.value = !!getWatchlistStatus(newAnime.id);
  epSearchQuery.value = '';

  // 1. Accurate episode computation
  computeEpisodeCount(newAnime);

  // 2. Fetch ARM ID mapping
  fetchArmMapping(newAnime.id);

  // 3. Fetch Kusonime Batch downloads
  fetchKusonime(newAnime);

  // 4. Automatically check shared SQLite database for translation
  try {
    const res = await lookupTranslation(newAnime.id);
    if (res.found && res.translation) {
      indonesianSynopsis.value = res.translation;
      isIndonesian.value = true;
      isServerCached.value = true;
    }
  } catch (e) {
    console.warn('Translation auto lookup error:', e);
  }
}, { immediate: true });

async function toggleTranslation() {
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
    const res = await translateSynopsis(originalSynopsis.value, props.anime.id);
    if (res.success && res.translation) {
      indonesianSynopsis.value = res.translation;
      isIndonesian.value = true;
      isServerCached.value = true;
    }
  } catch (err) {
    console.error('Translation failed:', err);
  } finally {
    isTranslating.value = false;
  }
}

function handleToggleWatchlist() {
  if (!props.anime) return;
  if (isInWatchlist.value) {
    removeFromWatchlist(props.anime.id);
    isInWatchlist.value = false;
  } else {
    addToWatchlist(props.anime);
    isInWatchlist.value = true;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 250;
  padding: 1.5rem;
  overflow-y: auto;
  animation: fadeIn 0.2s ease;
}

.detail-card {
  position: relative;
  background: #12141c;
  border: 1px solid #2a3044;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9);
  border-radius: 20px;
  width: 100%;
  max-width: 840px;
  max-height: 90vh;
  overflow-y: auto;
  color: #fff;
  animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  background: rgba(0, 0, 0, 0.6);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #fff;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  z-index: 20;
  transition: all 0.2s;
}

.modal-close-btn:hover {
  background: rgba(229, 9, 20, 0.8);
  transform: rotate(90deg);
}

.detail-banner-wrap {
  position: relative;
  height: 290px;
  overflow: hidden;
  border-radius: 20px 20px 0 0;
}

.detail-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.detail-banner-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(18, 20, 28, 0.2) 0%, rgba(18, 20, 28, 0.8) 60%, #12141c 100%);
}

.detail-banner-content {
  position: absolute;
  bottom: 1.5rem;
  left: 2rem;
  right: 2rem;
  z-index: 10;
}

.badge-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}

.score-badge {
  background: #eab308;
  color: #000;
  font-weight: 800;
  font-size: 0.78rem;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.format-badge, .status-badge, .year-badge {
  background: rgba(255, 255, 255, 0.15);
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
}

.status-releasing {
  background: rgba(16, 185, 129, 0.25);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.4);
}

.detail-title {
  font-size: 1.65rem;
  font-weight: 800;
  line-height: 1.25;
  margin-bottom: 0.25rem;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

.detail-sub {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-bottom: 1rem;
}

.banner-actions {
  display: flex;
  gap: 0.75rem;
  align-items: center;
  flex-wrap: wrap;
}

.play-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.4rem;
  font-weight: 700;
  font-size: 0.92rem;
  background: #e50914;
  color: #fff;
  border-radius: 6px;
  transition: all 0.2s;
}

.play-btn:hover {
  background: #ff1f2d;
  transform: translateY(-2px);
}

.fav-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.65rem 1.1rem;
  font-size: 0.88rem;
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  transition: all 0.2s;
}

.fav-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}

.detail-body {
  padding: 1.5rem 2rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.genre-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  align-items: center;
}

.genre-prefix {
  font-size: 0.82rem;
  font-weight: 700;
  color: #94a3b8;
}

.genre-tag {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.25rem 0.65rem;
  border-radius: 9999px;
}

.airing-alert-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(229, 9, 20, 0.1);
  border: 1px solid rgba(229, 9, 20, 0.35);
  border-radius: 8px;
  padding: 0.75rem 1rem;
  font-size: 0.88rem;
  color: #fca5a5;
  font-weight: 600;
}

.pulse-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  box-shadow: 0 0 8px #ef4444;
  animation: pulse 1.5s infinite;
}

/* ================= Episodes Selector Section ================= */
.episodes-selector-section {
  background: #181b26;
  border: 1px solid #2a3044;
  border-radius: 12px;
  padding: 1.25rem;
}

.episodes-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.section-heading {
  font-size: 1.05rem;
  font-weight: 700;
  color: #fff;
}

.episodes-subtext {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 0.15rem;
}

.ep-header-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.ep-count-tag {
  background: rgba(229, 9, 20, 0.15);
  border: 1px solid rgba(229, 9, 20, 0.3);
  color: #ff6b72;
  font-size: 0.76rem;
  font-weight: 700;
  padding: 0.3rem 0.65rem;
  border-radius: 4px;
}

.ep-search-input {
  background: #12141c;
  border: 1px solid #2a3044;
  color: #fff;
  font-size: 0.82rem;
  padding: 0.35rem 0.65rem;
  border-radius: 6px;
  width: 125px;
  outline: none;
}

.ep-search-input:focus {
  border-color: #e50914;
}

.episodes-pills-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
  gap: 0.5rem;
  max-height: 280px;
  overflow-y: auto;
  padding-right: 0.3rem;
}

.modal-ep-pill {
  position: relative;
  background: #12141c;
  border: 1px solid #2a3044;
  color: #cbd5e1;
  padding: 0.55rem 0.4rem;
  border-radius: 6px;
  text-align: center;
  text-decoration: none;
  transition: all 0.15s ease;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.modal-ep-pill:hover {
  background: #e50914;
  color: #fff;
  border-color: #e50914;
  transform: translateY(-2px);
}

.pill-ep-num {
  font-size: 0.82rem;
  font-weight: 700;
}

.pill-ep-time {
  font-size: 0.65rem;
  color: #94a3b8;
  margin-top: 0.1rem;
}

.modal-ep-pill:hover .pill-ep-time {
  color: #ffe4e6;
}

.pill-ep-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 3px;
  background: rgba(255, 255, 255, 0.1);
}

.progress-fill {
  height: 100%;
  background: #e50914;
}

/* ================= ARM Badges ================= */
.arm-badges-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.arm-badge {
  background: #181b26;
  border: 1px solid #2a3044;
  color: #94a3b8;
  font-size: 0.72rem;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
}

/* ================= Synopsis ================= */
.synopsis-box {
  background: #181b26;
  border: 1px solid #2a3044;
  border-radius: 12px;
  padding: 1.25rem;
}

.synopsis-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.translation-controls {
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

.translate-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.78rem;
  font-weight: 600;
  color: #cbd5e1;
  background: #12141c;
  border: 1px solid #2a3044;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  transition: all 0.2s;
}

.translate-btn:hover:not(:disabled) {
  background: #242938;
  color: #fff;
  border-color: #e50914;
}

.synopsis-text {
  font-size: 0.88rem;
  color: #cbd5e1;
  line-height: 1.6;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

@media (max-width: 640px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

.info-card {
  background: #181b26;
  border: 1px solid #2a3044;
  border-radius: 8px;
  padding: 0.75rem 0.85rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-k {
  font-size: 0.72rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.info-v {
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
}

/* ================= Batch Downloads ================= */
.batch-downloads-card {
  background: #181b26;
  border: 1px solid #2a3044;
  border-radius: 12px;
  padding: 1.25rem;
}

.downloads-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.75rem;
}

.dl-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: #12141c;
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #2a3044;
  flex-wrap: wrap;
}

.dl-res-tag {
  font-size: 0.8rem;
  font-weight: 700;
  color: #e50914;
  min-width: 60px;
}

.dl-host-links {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.dl-host-pill {
  background: #1e2230;
  color: #cbd5e1;
  font-size: 0.75rem;
  padding: 0.25rem 0.6rem;
  border-radius: 4px;
  text-decoration: none;
  transition: all 0.15s;
}

.dl-host-pill:hover {
  background: #e50914;
  color: #fff;
}

/* ================= Trailer ================= */
.trailer-box {
  background: #181b26;
  border: 1px solid #2a3044;
  border-radius: 12px;
  padding: 1.25rem;
}

.trailer-iframe-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  margin-top: 0.75rem;
}

.trailer-iframe-wrap iframe {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.spinner-small {
  width: 12px;
  height: 12px;
  border: 2px solid rgba(255, 255, 255, 0.3);
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
  50% { opacity: 0.5; transform: scale(1.15); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
