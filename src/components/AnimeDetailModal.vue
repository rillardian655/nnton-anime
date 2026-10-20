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
            <span class="status-badge">{{ anime.status === 'RELEASING' ? 'Ongoing' : 'Finished' }}</span>
            <span class="year-badge" v-if="anime.seasonYear">{{ anime.seasonYear }}</span>
          </div>
          <h2 class="detail-title">{{ anime.title?.english || anime.title?.romaji }}</h2>
          <div class="detail-sub">{{ anime.title?.romaji }} <span v-if="anime.title?.native">({{ anime.title?.native }})</span></div>

          <div class="banner-actions">
            <router-link :to="`/watch?id=${anime.id}&ep=1`" class="btn btn-primary play-btn" @click="$emit('close')">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Nonton Episode 1</span>
            </router-link>
            <button class="btn btn-secondary fav-btn" @click="handleToggleWatchlist">
              <svg width="16" height="16" viewBox="0 0 24 24" :fill="isInWatchlist ? '#e50914' : 'none'" :stroke="isInWatchlist ? '#e50914' : 'currentColor'" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              <span>{{ isInWatchlist ? 'Hapus Koleksi' : '+ Tambah Koleksi' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Detail Body -->
      <div class="detail-body">
        <!-- Genres Tags -->
        <div class="genre-tags">
          <span v-for="g in anime.genres" :key="g" class="genre-tag">{{ g }}</span>
        </div>

        <!-- Synopsis Section with Shared Server Translation -->
        <div class="synopsis-box">
          <div class="synopsis-header">
            <h3 class="section-heading">Sinopsis Cerita</h3>
            
            <div class="translation-controls">
              <!-- Cached Indicator Badge -->
              <span v-if="isIndonesian && isServerCached" class="cached-pill" title="Terjemahan tersimpan di server lokal, tidak menguras kuota API">
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
            <span class="info-v">{{ anime.episodes ? `${anime.episodes} Episode` : 'Masih Berjalan' }}</span>
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
import { getSafeImageUrl, lookupTranslation, translateSynopsis } from '../api.js';
import { getWatchlistStatus, addToWatchlist, removeFromWatchlist } from '../storage.js';

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

watch(() => props.anime, async (newAnime) => {
  if (!newAnime) return;
  originalSynopsis.value = stripHtml(newAnime.description || '');
  indonesianSynopsis.value = '';
  isIndonesian.value = false;
  isServerCached.value = false;
  isInWatchlist.value = !!getWatchlistStatus(newAnime.id);

  // Automatically check shared SQLite database for already translated synopsis
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
    // Switch to original
    isIndonesian.value = false;
    return;
  }

  // If already have indonesian in memory
  if (indonesianSynopsis.value) {
    isIndonesian.value = true;
    return;
  }

  // Fetch translation from server (deduplicated & cached in SQLite)
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
  max-width: 780px;
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
  font-size: 1rem;
  z-index: 10;
  backdrop-filter: blur(4px);
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  background: #e50914;
  border-color: #e50914;
}

.detail-banner-wrap {
  position: relative;
  height: 320px;
  width: 100%;
  overflow: hidden;
  border-radius: 20px 20px 0 0;
}

.detail-banner-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  filter: brightness(0.75);
}

.detail-banner-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #12141c 0%, rgba(18, 20, 28, 0.7) 45%, transparent 100%);
}

.detail-banner-content {
  position: absolute;
  bottom: 1.5rem;
  left: 2rem;
  right: 2rem;
  z-index: 2;
}

.badge-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
}

.score-badge {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
  border: 1px solid rgba(234, 179, 8, 0.4);
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 800;
  font-size: 0.78rem;
}

.format-badge, .status-badge, .year-badge {
  background: rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-badge {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.detail-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.8rem;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: -0.02em;
  color: #fff;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

.detail-sub {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 0.25rem;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 1.2rem;
}

.play-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.4rem;
  font-weight: 700;
  border-radius: 10px;
  text-decoration: none;
}

.fav-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.65rem 1.2rem;
  font-weight: 600;
  border-radius: 10px;
}

.detail-body {
  padding: 1.5rem 2rem 2.5rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.6rem;
}

.genre-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.genre-tag {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #e2e8f0;
  padding: 0.3rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.78rem;
  font-weight: 600;
}

.synopsis-box {
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 14px;
  padding: 1.2rem 1.4rem;
}

.synopsis-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.section-heading {
  font-size: 1rem;
  font-weight: 700;
  color: #fff;
}

.translation-controls {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.cached-pill {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 700;
}

.translate-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.3);
  color: #ff4d58;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.translate-btn:hover:not(:disabled) {
  background: rgba(229, 9, 20, 0.25);
  color: #fff;
}

.synopsis-text {
  font-size: 0.9rem;
  color: #cbd5e1;
  line-height: 1.65;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.info-card {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid #1e2230;
  border-radius: 10px;
  padding: 0.85rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.info-k {
  font-size: 0.72rem;
  color: #64748b;
  text-transform: uppercase;
  font-weight: 700;
  letter-spacing: 0.05em;
}

.info-v {
  font-size: 0.88rem;
  font-weight: 700;
  color: #f1f5f9;
}

.trailer-box {
  margin-top: 0.5rem;
}

.trailer-iframe-wrap {
  position: relative;
  width: 100%;
  padding-bottom: 56.25%; /* 16:9 aspect ratio */
  height: 0;
  overflow: hidden;
  border-radius: 12px;
  border: 1px solid #1e2230;
  margin-top: 0.6rem;
}

.trailer-iframe-wrap iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
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

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.96); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 650px) {
  .info-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .detail-banner-wrap {
    height: 240px;
  }
  .detail-title {
    font-size: 1.4rem;
  }
}
</style>
