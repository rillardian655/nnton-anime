<template>
  <div class="anime-detail-page">
    <!-- Loading Skeleton State -->
    <div v-if="loading" class="detail-loading-skeleton">
      <div class="skeleton-banner"></div>
      <div class="skeleton-content-container">
        <div class="skeleton-poster"></div>
        <div class="skeleton-info-block">
          <div class="skeleton-line title"></div>
          <div class="skeleton-line sub"></div>
          <div class="skeleton-line text"></div>
          <div class="skeleton-line text"></div>
        </div>
      </div>
    </div>

    <!-- Error State -->
    <div v-else-if="error || !anime" class="detail-error-container">
      <div class="error-card">
        <div class="error-icon">⚠️</div>
        <h2>Anime Tidak Ditemukan</h2>
        <p>{{ error || 'Gagal memuat informasi anime. Silakan kembali ke beranda.' }}</p>
        <router-link to="/" class="btn btn-primary">← Kembali ke Beranda</router-link>
      </div>
    </div>

    <!-- Main Detail Content -->
    <div v-else class="detail-main-layout">
      <!-- Back Navigation Bar -->
      <div class="top-nav-bar">
        <div class="nav-container">
          <router-link to="/" class="back-link-btn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
            <span>Kembali ke Beranda</span>
          </router-link>
        </div>
      </div>

      <!-- Backdrop Banner Header -->
      <div class="detail-hero-banner">
        <img 
          :src="getSafeImageUrl(anime.bannerImage || anime.coverImage?.extraLarge || anime.coverImage?.large)" 
          :alt="displayTitle" 
          class="banner-backdrop-img" 
        />
        <div class="banner-overlay-gradient"></div>

        <div class="banner-hero-content">
          <div class="hero-container">
            <!-- Poster Column -->
            <div class="hero-poster-wrap">
              <img 
                :src="getSafeImageUrl(anime.coverImage?.extraLarge || anime.coverImage?.large)" 
                :alt="displayTitle" 
                class="hero-poster-img" 
              />
              <span class="poster-format-tag">{{ anime.format || 'TV' }}</span>
            </div>

            <!-- Title & Quick Meta Column -->
            <div class="hero-info-wrap">
              <div class="badge-row">
                <span class="score-badge" v-if="anime.averageScore">★ {{ (anime.averageScore / 10).toFixed(1) }}</span>
                <span class="status-badge" :class="{ 'status-releasing': anime.status === 'RELEASING' }">
                  <span class="status-dot"></span>
                  {{ anime.status === 'RELEASING' ? 'Sedang Rilis' : 'Tamat' }}
                </span>
                <span class="year-badge" v-if="anime.seasonYear">{{ anime.seasonYear }}</span>
                <span class="ep-count-badge">{{ totalEpisodes }} Episode</span>
              </div>

              <h1 class="anime-main-title">{{ displayTitle }}</h1>
              <div class="anime-sub-title" v-if="displaySubTitle">{{ displaySubTitle }}</div>

              <!-- Genre Badges -->
              <div class="genre-tags-row">
                <span class="genre-pill" v-for="g in anime.genres" :key="g">{{ g }}</span>
              </div>

              <!-- Primary CTAs -->
              <div class="action-buttons-row">
                <button type="button" class="btn btn-primary play-btn-lg" @click="handlePlayClick(1)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                  <span>Mulai Nonton (Episode 1)</span>
                </button>

                <button class="btn btn-secondary fav-btn" @click="handleToggleWatchlist">
                  <svg width="18" height="18" viewBox="0 0 24 24" :fill="isInWatchlist ? '#e50914' : 'none'" :stroke="isInWatchlist ? '#e50914' : 'currentColor'" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
                  <span>{{ isInWatchlist ? 'Tersimpan di Koleksi' : '+ Simpan Koleksi' }}</span>
                </button>

                <button class="btn btn-glass share-btn" @click="handleShareLink" :title="copiedShare ? 'Tersalin!' : 'Bagikan Link'">
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
                  <span>{{ copiedShare ? 'Link Tersalin!' : 'Bagikan' }}</span>
                </button>
              </div>

              <!-- Airing countdown alert for active release -->
              <div v-if="airingNotice" class="airing-alert-banner">
                <span class="pulse-ring"></span>
                <span>{{ airingNotice }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Main Body Container -->
      <div class="detail-body-container">
        <!-- Section 1: Episode Selector Grid -->
        <section class="detail-section episodes-section">
          <div class="section-header-row">
            <div>
              <h2 class="section-title">Pilih Episode</h2>
              <p class="section-desc">Pilih episode untuk langsung streaming pemutar video:</p>
            </div>

            <div class="ep-search-wrap" v-if="totalEpisodes > 12">
              <input 
                type="text" 
                v-model="epSearchQuery" 
                placeholder="Cari episode..." 
                class="ep-search-field"
              />
            </div>
          </div>

          <!-- Single Movie/OVA Card CTA -->
          <div v-if="totalEpisodes === 1" class="single-movie-cta-wrap">
            <button type="button" class="single-movie-banner" @click="handlePlayClick(1)">
              <div class="movie-play-circle">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
              <div class="movie-banner-info">
                <div class="movie-head">Tonton Film Lengkap (Episode 1)</div>
                <div class="movie-sub">{{ anime.duration ? `${anime.duration} Menit` : 'Durasi Penuh' }} • Kualitas HD Sub Indo</div>
              </div>
              <div class="movie-action-arrow">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
              </div>
            </button>
          </div>

          <!-- Grid of Episode Cards -->
          <div v-else class="episodes-grid">
            <button 
              type="button"
              v-for="ep in filteredEpisodes" 
              :key="ep.num" 
              class="episode-card"
              :class="{ 'has-progress': ep.progress && ep.progress > 0 }"
              @click="handlePlayClick(ep.num)"
            >
              <div class="ep-number-tag">Episode {{ ep.num }}</div>
              <div class="ep-progress-info" v-if="ep.progressText">{{ ep.progressText }}</div>
              <div class="ep-card-footer">
                <span class="ep-play-label">Putar Video</span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
              <div class="ep-progress-bar" v-if="ep.progress">
                <div class="progress-fill" :style="{ width: ep.progress + '%' }"></div>
              </div>
            </button>
          </div>
        </section>

        <!-- Section 2: Synopsis with Indonesia Auto-Translate -->
        <section class="detail-section synopsis-section">
          <div class="synopsis-card">
            <div class="synopsis-header-bar">
              <h2 class="section-title">Sinopsis Cerita</h2>

              <div class="translate-action-box">
                <span v-if="isIndonesian && isServerCached" class="cached-badge" title="Tersimpan di server lokal">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"></path></svg>
                  <span>Sub Indo</span>
                </span>

                <button class="translate-toggle-btn" :disabled="isTranslating" @click="toggleTranslation">
                  <svg v-if="!isTranslating" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
                  <span v-else class="spinner-small"></span>
                  <span>{{ isTranslating ? 'Menerjemahkan...' : (isIndonesian ? 'Lihat Bahasa Asli' : 'Terjemahkan ke Indonesia') }}</span>
                </button>
              </div>
            </div>

            <p class="synopsis-paragraph">
              {{ currentSynopsis || 'Sinopsis belum tersedia untuk anime ini.' }}
            </p>
          </div>
        </section>

        <!-- Section 3: Anime Metadata Stats Grid -->
        <section class="detail-section meta-stats-section">
          <div class="meta-stats-grid">
            <div class="meta-stat-card">
              <span class="meta-k">Total Episode</span>
              <span class="meta-v">{{ totalEpisodes }} Episode</span>
            </div>
            <div class="meta-stat-card">
              <span class="meta-k">Durasi</span>
              <span class="meta-v">{{ anime.duration ? `${anime.duration} Menit/Ep` : '24 Menit' }}</span>
            </div>
            <div class="meta-stat-card">
              <span class="meta-k">Studio Produksi</span>
              <span class="meta-v">{{ anime.studios?.nodes?.[0]?.name || 'N/A' }}</span>
            </div>
            <div class="meta-stat-card">
              <span class="meta-k">Musim Rilis</span>
              <span class="meta-v">{{ anime.season ? `${anime.season} ${anime.seasonYear || ''}` : 'N/A' }}</span>
            </div>
            <div class="meta-stat-card">
              <span class="meta-k">Sumber Cerita</span>
              <span class="meta-v">{{ anime.source ? anime.source.replace('_', ' ') : 'Manga' }}</span>
            </div>
            <div class="meta-stat-card">
              <span class="meta-k">Rating Usia</span>
              <span class="meta-v">PG-13 / Remaja</span>
            </div>
          </div>
        </section>

        <!-- Section 4: Characters List (if available) -->
        <section class="detail-section characters-section" v-if="anime.characters?.nodes?.length > 0">
          <h2 class="section-title">Karakter Utama</h2>
          <div class="characters-scroll-row">
            <div v-for="char in anime.characters.nodes" :key="char.id" class="character-card">
              <img :src="char.image?.medium" :alt="char.name?.full" class="char-avatar" />
              <div class="char-names">
                <div class="char-full-name">{{ char.name?.full }}</div>
                <div class="char-native-name" v-if="char.name?.native">{{ char.name?.native }}</div>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 5: Kusonime Batch Downloads (if found) -->
        <section class="detail-section downloads-section" v-if="kusonimeDownloads.length > 0">
          <div class="downloads-card">
            <h2 class="section-title">📥 Download Batch Subtitle Indonesia (Kusonime)</h2>
            <p class="downloads-note">Download seluruh episode dalam satu paket arsip ZIP/RAR:</p>
            <div class="downloads-table">
              <div v-for="(dl, idx) in kusonimeDownloads" :key="idx" class="dl-item-row">
                <span class="dl-badge-quality">{{ dl.quality }}</span>
                <div class="dl-hosts-wrap">
                  <a 
                    v-for="(link, lIdx) in dl.links" 
                    :key="lIdx" 
                    :href="link.url" 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    class="dl-host-button"
                  >
                    {{ link.host }} ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 6: Official Trailer (if available) -->
        <section class="detail-section trailer-section" v-if="anime.trailer?.id && anime.trailer?.site === 'youtube'">
          <h2 class="section-title">Cuplikan Trailer Resmi</h2>
          <div class="trailer-wrapper">
            <iframe 
              :src="`https://www.youtube-nocookie.com/embed/${anime.trailer.id}`" 
              title="Official Trailer" 
              frameborder="0" 
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
              allowfullscreen
            ></iframe>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { isAuthenticated, showLoginModal } from '../stores/auth.js';
import { 
  getAnimeDetails, 
  getSafeImageUrl, 
  lookupTranslation, 
  translateSynopsis, 
  searchKusonime, 
  getKusonimeDownloads,
  getEffectiveEpisodeCount,
  isAiringStatus,
  cleanRussianTitle,
  apiUrl 
} from '../api.js';
import { 
  getWatchlistStatus, 
  addToWatchlist, 
  removeFromWatchlist, 
  getEpisodeProgress 
} from '../storage.js';

const route = useRoute();
const router = useRouter();

function handlePlayClick(ep = 1) {
  if (!isAuthenticated.value) {
    showLoginModal.value = true;
    return;
  }
  const title = encodeURIComponent(cleanRussianTitle(anime.value?.title?.english || anime.value?.title?.romaji || ''));
  const slugQuery = anime.value?.slug ? `&slug=${encodeURIComponent(anime.value.slug)}` : '';
  router.push(`/watch?id=${anime.value?.id}&ep=${ep}&title=${title}${slugQuery}`);
}

const anime = ref(null);
const loading = ref(true);
const error = ref('');

const originalSynopsis = ref('');
const indonesianSynopsis = ref('');
const isIndonesian = ref(false);
const isTranslating = ref(false);
const isServerCached = ref(false);
const isInWatchlist = ref(false);
const copiedShare = ref(false);

const totalEpisodes = ref(1);
const episodesList = ref([]);
const epSearchQuery = ref('');
const airingNotice = ref('');
const kusonimeDownloads = ref([]);

const displayTitle = computed(() => {
  return cleanRussianTitle(anime.value?.title?.english || anime.value?.title?.romaji) || 'Anime';
});

const displaySubTitle = computed(() => {
  const eng = cleanRussianTitle(anime.value?.title?.english?.trim());
  const rom = cleanRussianTitle(anime.value?.title?.romaji?.trim());
  const nat = cleanRussianTitle(anime.value?.title?.native?.trim());

  if (eng && rom && eng.toLowerCase() !== rom.toLowerCase()) {
    return nat ? `${rom} • ${nat}` : rom;
  }
  return nat || '';
});

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
  airingNotice.value = '';
  const isAiring = isAiringStatus(details);
  const count = getEffectiveEpisodeCount(details);

  if (isAiring) {
    if (details.nextAiringEpisode && details.nextAiringEpisode.episode) {
      const hours = Math.floor(details.nextAiringEpisode.timeUntilAiring / 3600);
      const days = Math.floor(hours / 24);
      const remHours = hours % 24;
      const timeStr = days > 0 ? `${days} hari ${remHours} jam` : `${hours} jam`;
      airingNotice.value = `Episode ${details.nextAiringEpisode.episode} rilis dalam ${timeStr}`;
    } else {
      airingNotice.value = `Episode ${count + 1} tayang sesuai jadwal resmi`;
    }
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

async function loadAnimeData() {
  const animeId = route.query.id || route.params.id;
  if (!animeId) {
    error.value = 'ID anime tidak ditemukan di URL.';
    loading.value = false;
    return;
  }

  loading.value = true;
  error.value = '';

  try {
    const data = await getAnimeDetails(animeId);
    if (!data) throw new Error('Data anime tidak tersedia.');
    anime.value = data;

    // Set title tag
    const title = data.title?.english || data.title?.romaji || 'Anime';
    document.title = `${title} — Detail & Episode | AniPulse`;

    // Process synopsis
    originalSynopsis.value = stripHtml(data.description || '');
    indonesianSynopsis.value = '';
    isIndonesian.value = false;
    isServerCached.value = false;

    // Episodes
    computeEpisodeCount(data);

    // Watchlist
    isInWatchlist.value = getWatchlistStatus(data.id);

    // Automatic Indonesian translation (instant cache lookup, or auto-fetch in background)
    lookupTranslation(data.id)
      .then(async (res) => {
        if (res.found && res.translation) {
          indonesianSynopsis.value = res.translation;
          isIndonesian.value = true;
          isServerCached.value = true;
        } else if (originalSynopsis.value) {
          try {
            const trRes = await translateSynopsis(originalSynopsis.value, data.id);
            if (trRes.translation) {
              indonesianSynopsis.value = trRes.translation;
              isIndonesian.value = true;
              isServerCached.value = true;
            }
          } catch (_) {}
        }
      })
      .catch(() => {});

    // Kusonime downloads
    fetchKusonime(data);
  } catch (err) {
    error.value = err.message || 'Gagal memuat anime.';
  } finally {
    loading.value = false;
  }
}

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
    const res = await translateSynopsis(originalSynopsis.value, anime.value.id);
    if (res.translation) {
      indonesianSynopsis.value = res.translation;
      isIndonesian.value = true;
      isServerCached.value = res.source === 'server_db';
    }
  } catch (err) {
    console.warn('Translation failed:', err);
  } finally {
    isTranslating.value = false;
  }
}

function handleToggleWatchlist() {
  if (!anime.value) return;
  if (isInWatchlist.value) {
    removeFromWatchlist(anime.value.id);
    isInWatchlist.value = false;
  } else {
    addToWatchlist(anime.value);
    isInWatchlist.value = true;
  }
}

async function handleShareLink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    copiedShare.value = true;
    setTimeout(() => { copiedShare.value = false; }, 2500);
  } catch (_) {}
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

onMounted(() => {
  loadAnimeData();
});

watch(() => [route.query.id, route.params.id], () => {
  loadAnimeData();
});
</script>

<style scoped>
.anime-detail-page {
  min-height: 100vh;
  background-color: var(--bg-base, #0b0c10);
  color: var(--text-main, #f8fafc);
  padding-bottom: 6rem;
}

/* ================= Top Navigation Bar ================= */
.top-nav-bar {
  background: rgba(11, 12, 16, 0.85);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  position: sticky;
  top: 0;
  z-index: 40;
}

.nav-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0.85rem 1.5rem;
}

.back-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  text-decoration: none;
  transition: color 0.15s ease;
}

.back-link-btn:hover {
  color: #ffffff;
}

/* ================= Backdrop Banner Hero ================= */
.detail-hero-banner {
  position: relative;
  min-height: 480px;
  display: flex;
  align-items: flex-end;
  overflow: hidden;
  background: #0d0f17;
}

.banner-backdrop-img {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0.35;
  filter: blur(2px);
}

.banner-overlay-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, rgba(11, 12, 16, 0.4) 0%, rgba(11, 12, 16, 0.85) 65%, #0b0c10 100%),
              radial-gradient(circle at 20% 50%, rgba(229, 9, 20, 0.15) 0%, transparent 60%);
}

.banner-hero-content {
  position: relative;
  z-index: 10;
  width: 100%;
  padding: 3rem 0 2rem 0;
}

.hero-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 1.5rem;
  display: flex;
  gap: 2.5rem;
  align-items: flex-end;
}

/* Poster */
.hero-poster-wrap {
  width: 220px;
  flex-shrink: 0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 16px 40px rgba(0, 0, 0, 0.85), 0 0 0 1px rgba(255, 255, 255, 0.1);
  position: relative;
  aspect-ratio: 2/3;
  background: #151822;
}

.hero-poster-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.poster-format-tag {
  position: absolute;
  top: 10px;
  left: 10px;
  background: rgba(18, 20, 28, 0.85);
  backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 800;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
  letter-spacing: 0.05em;
}

/* Info */
.hero-info-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
}

.badge-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.score-badge {
  background: rgba(234, 179, 8, 0.15);
  border: 1px solid rgba(234, 179, 8, 0.4);
  color: #facc15;
  font-weight: 800;
  font-size: 0.8rem;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(148, 163, 184, 0.12);
  border: 1px solid rgba(148, 163, 184, 0.25);
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
}

.status-badge.status-releasing {
  background: rgba(34, 197, 94, 0.12);
  border-color: rgba(34, 197, 94, 0.35);
  color: #4ade80;
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
}

.year-badge, .ep-count-badge {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #94a3b8;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 6px;
}

.anime-main-title {
  font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif;
  font-size: clamp(1.8rem, 4vw, 2.8rem);
  font-weight: 800;
  line-height: 1.15;
  color: #ffffff;
}

.anime-sub-title {
  font-size: 1rem;
  color: #94a3b8;
  margin-top: -0.3rem;
}

.genre-tags-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.genre-pill {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.22rem 0.65rem;
  border-radius: 9999px;
}

/* Action Buttons */
.action-buttons-row {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 0.6rem;
  flex-wrap: wrap;
}

.play-btn-lg {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  background: #e50914;
  color: #ffffff;
  padding: 0.75rem 1.6rem;
  font-size: 0.95rem;
  font-weight: 700;
  border-radius: 10px;
  text-decoration: none;
  box-shadow: 0 4px 20px rgba(229, 9, 20, 0.45);
  transition: all 0.2s ease;
}

.play-btn-lg:hover {
  background: #f40612;
  transform: translateY(-2px);
  box-shadow: 0 6px 25px rgba(229, 9, 20, 0.6);
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #ffffff;
  padding: 0.75rem 1.3rem;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-secondary:hover {
  background: rgba(255, 255, 255, 0.18);
}

.btn-glass {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(18, 20, 28, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  padding: 0.75rem 1.1rem;
  font-size: 0.88rem;
  font-weight: 600;
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-glass:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}

.airing-alert-banner {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  background: rgba(59, 130, 246, 0.12);
  border: 1px solid rgba(59, 130, 246, 0.3);
  color: #60a5fa;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 0.45rem 0.9rem;
  border-radius: 8px;
  max-width: fit-content;
}

.pulse-ring {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3b82f6;
  box-shadow: 0 0 8px #3b82f6;
}

/* ================= Body Sections ================= */
.detail-body-container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 2.5rem;
}

.detail-section {
  width: 100%;
}

.section-header-row {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 1.25rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.section-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.35rem;
  font-weight: 800;
  color: #ffffff;
}

.section-desc {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

/* Episodes Grid */
.ep-search-field {
  background: #141722;
  border: 1px solid #232838;
  color: #fff;
  padding: 0.45rem 0.85rem;
  font-size: 0.82rem;
  border-radius: 8px;
  outline: none;
  width: 180px;
}

.ep-search-field:focus {
  border-color: #e50914;
}

.episodes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
  gap: 0.85rem;
}

.episode-card {
  background: #131620;
  border: 1px solid #202434;
  border-radius: 10px;
  padding: 0.85rem;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  font-family: inherit;
  width: 100%;
  text-align: left;
  transition: all 0.2s ease;
}

.episode-card:hover {
  background: #1a1e2b;
  border-color: #e50914;
  transform: translateY(-2px);
}

.ep-number-tag {
  font-size: 0.95rem;
  font-weight: 800;
  color: #ffffff;
}

.ep-progress-info {
  font-size: 0.72rem;
  color: #e50914;
  font-weight: 700;
}

.ep-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: auto;
}

.ep-progress-bar {
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

/* Single Movie Banner */
.single-movie-cta-wrap {
  margin-top: 0.5rem;
}

.single-movie-banner {
  display: flex;
  align-items: center;
  gap: 1.2rem;
  background: linear-gradient(135deg, #181c28 0%, #10121a 100%);
  border: 1px solid #2a3146;
  border-radius: 14px;
  padding: 1.25rem 1.6rem;
  text-decoration: none;
  transition: all 0.2s;
  cursor: pointer;
  font-family: inherit;
  width: 100%;
  text-align: left;
}

.single-movie-banner:hover {
  border-color: #e50914;
  transform: translateY(-2px);
}

.movie-play-circle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #e50914;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.movie-banner-info {
  flex: 1;
}

.movie-head {
  font-size: 1.05rem;
  font-weight: 800;
  color: #fff;
}

.movie-sub {
  font-size: 0.82rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.movie-action-arrow {
  color: #cbd5e1;
}

/* Synopsis Section */
.synopsis-card {
  background: #12141c;
  border: 1px solid #1f2330;
  border-radius: 14px;
  padding: 1.5rem;
}

.synopsis-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
  flex-wrap: wrap;
}

.translate-action-box {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.cached-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #4ade80;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 0.2rem 0.55rem;
  border-radius: 6px;
}

.translate-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #e2e8f0;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.35rem 0.75rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.translate-toggle-btn:hover {
  background: rgba(255, 255, 255, 0.14);
}

.synopsis-paragraph {
  font-size: 0.94rem;
  line-height: 1.7;
  color: #cbd5e1;
}

/* Meta Stats Grid */
.meta-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
}

.meta-stat-card {
  background: #12141c;
  border: 1px solid #1f2330;
  border-radius: 10px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.meta-k {
  font-size: 0.75rem;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.meta-v {
  font-size: 0.95rem;
  font-weight: 700;
  color: #ffffff;
}

/* Characters Row */
.characters-scroll-row {
  display: flex;
  gap: 1rem;
  overflow-x: auto;
  padding-bottom: 0.6rem;
}

.character-card {
  width: 110px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 0.5rem;
}

.char-avatar {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid rgba(255, 255, 255, 0.15);
  background: #181c28;
}

.char-names {
  width: 100%;
}

.char-full-name {
  font-size: 0.78rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.char-native-name {
  font-size: 0.68rem;
  color: #64748b;
}

/* Kusonime Batch Downloads */
.downloads-card {
  background: #12141c;
  border: 1px solid #1f2330;
  border-radius: 14px;
  padding: 1.5rem;
}

.downloads-note {
  font-size: 0.82rem;
  color: #94a3b8;
  margin-top: 0.2rem;
  margin-bottom: 1rem;
}

.downloads-table {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.dl-item-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #171a25;
  border: 1px solid #232738;
  border-radius: 8px;
  padding: 0.65rem 1rem;
  flex-wrap: wrap;
}

.dl-badge-quality {
  background: #e50914;
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 0.2rem 0.55rem;
  border-radius: 4px;
  min-width: 65px;
  text-align: center;
}

.dl-hosts-wrap {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.dl-host-button {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.12);
  color: #cbd5e1;
  font-size: 0.78rem;
  font-weight: 600;
  padding: 0.25rem 0.65rem;
  border-radius: 6px;
  text-decoration: none;
  transition: all 0.15s;
}

.dl-host-button:hover {
  background: rgba(255, 255, 255, 0.16);
  color: #fff;
}

/* Trailer */
.trailer-wrapper {
  position: relative;
  padding-bottom: 56.25%;
  height: 0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.8);
  background: #000;
}

.trailer-wrapper iframe {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

/* Skeletons */
.detail-loading-skeleton {
  max-width: 1400px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.skeleton-banner {
  height: 350px;
  background: #131620;
  border-radius: 16px;
  animation: skeletonPulse 1.5s infinite;
}

.skeleton-content-container {
  display: flex;
  gap: 2rem;
  margin-top: -60px;
  padding: 0 1.5rem;
}

.skeleton-poster {
  width: 180px;
  height: 260px;
  background: #191c28;
  border-radius: 12px;
  animation: skeletonPulse 1.5s infinite;
  flex-shrink: 0;
}

.skeleton-info-block {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.8rem;
  margin-top: 80px;
}

.skeleton-line {
  background: #191c28;
  border-radius: 6px;
  animation: skeletonPulse 1.5s infinite;
}

.skeleton-line.title { width: 50%; height: 28px; }
.skeleton-line.sub { width: 30%; height: 18px; }
.skeleton-line.text { width: 90%; height: 14px; }

@keyframes skeletonPulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 0.3; }
}

/* ================= Mobile Layout ================= */
@media (max-width: 768px) {
  .hero-container {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1.5rem;
  }

  .hero-poster-wrap {
    width: 160px;
  }

  .badge-row, .genre-tags-row, .action-buttons-row {
    justify-content: center;
  }

  .anime-main-title {
    font-size: 1.6rem;
  }

  .detail-hero-banner {
    min-height: auto;
  }

  .detail-body-container {
    padding: 1.5rem 1rem;
    gap: 2rem;
  }

  .episodes-grid {
    grid-template-columns: repeat(auto-fill, minmax(95px, 1fr));
    gap: 0.6rem;
  }

  .episode-card {
    padding: 0.65rem 0.5rem;
  }

  .ep-number-tag {
    font-size: 0.85rem;
  }
}
</style>
