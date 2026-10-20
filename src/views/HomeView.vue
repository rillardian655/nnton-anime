<template>
  <div class="home-page">
    <!-- ================= Cinematic Hero Billboard ================= -->
    <section class="hero-billboard" v-if="heroAnimeList.length > 0">
      <div 
        class="hero-slide"
        v-for="(anime, idx) in heroAnimeList" 
        :key="anime.id"
        :class="{ 'active': idx === heroIndex }"
      >
        <img 
          :src="getSafeImageUrl(anime.bannerImage || anime.coverImage?.extraLarge)" 
          :alt="anime.title?.romaji" 
          class="hero-bg-img" 
        />
        <div class="hero-gradient-overlay"></div>

        <div class="hero-content-wrap">
          <div class="hero-badges">
            <span class="hero-rank-badge">🔥 TOP TRENDING #{{ idx + 1 }}</span>
            <span class="hero-score-badge" v-if="anime.averageScore">★ {{ (anime.averageScore / 10).toFixed(1) }}</span>
            <span class="hero-meta-badge">{{ anime.format || 'TV' }}</span>
            <span class="hero-meta-badge">{{ anime.seasonYear || '2026' }}</span>
          </div>

          <h1 class="hero-title">{{ anime.title?.english || anime.title?.romaji }}</h1>
          <p class="hero-japanese-title">{{ anime.title?.native || anime.title?.romaji }}</p>

          <p class="hero-synopsis">
            {{ getTruncated(stripHtml(anime.description), 200) }}
          </p>

          <div class="hero-buttons">
            <router-link :to="`/watch?id=${anime.id}&ep=1`" class="btn btn-primary hero-btn-play">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              <span>Tonton Sekarang</span>
            </router-link>
            <button class="btn btn-secondary hero-btn-info" @click="openAnimeModal(anime)">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
              <span>Detail Anime</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Hero Thumbnails Slider Nav -->
      <div class="hero-nav-pills">
        <button 
          v-for="(anime, idx) in heroAnimeList.slice(0, 6)" 
          :key="anime.id" 
          class="hero-pill-btn"
          :class="{ 'active': idx === heroIndex }"
          @click="heroIndex = idx"
        >
          <img :src="getSafeImageUrl(anime.coverImage?.large)" :alt="anime.title?.romaji" />
          <span class="pill-number">{{ idx + 1 }}</span>
        </button>
      </div>
    </section>

    <!-- ================= Continue Watching Bar ================= -->
    <section class="continue-watching-section" v-if="historyList.length > 0 && currentTab !== 'history'">
      <div class="content-container">
        <div class="section-title-wrap">
          <div class="title-left">
            <div class="section-indicator"></div>
            <div>
              <h2 class="section-title">Lanjutkan Menonton</h2>
              <p class="section-subtitle">Lanjutkan dari menit terakhir kamu:</p>
            </div>
          </div>
          <button class="view-all-link" @click="selectTab('history')">Lihat Semua Riwayat →</button>
        </div>

        <div class="continue-grid">
          <div 
            v-for="item in historyList.slice(0, 4)" 
            :key="item.id" 
            class="continue-card"
            @click="navigateToWatch(item.id, item.episode || item.lastEpisode || 1)"
          >
            <div class="continue-thumb-wrap">
              <img :src="getSafeImageUrl(item.coverImage)" :alt="item.title" class="continue-thumb" />
              <div class="play-overlay-icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </div>
              <div class="continue-progress-bar">
                <div class="progress-fill" :style="{ width: `${item.progress || 20}%` }"></div>
              </div>
            </div>
            <div class="continue-info">
              <h4 class="continue-title">{{ item.title }}</h4>
              <div class="continue-ep-meta">
                <span>Episode {{ item.episode || item.lastEpisode || 1 }}</span>
                <span v-if="item.timeFormatted || item.formattedTime">• {{ item.timeFormatted || item.formattedTime }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ================= Main Grid Container ================= -->
    <div class="content-container main-content-wrap">
      <!-- Filter Chips & Selects -->
      <div class="filter-bar" v-if="!['watchlist', 'history'].includes(currentTab)">
        <div class="genre-scroll-wrapper">
          <button 
            class="chip-btn" 
            :class="{ active: selectedGenre === 'ALL' }"
            @click="setGenre('ALL')"
          >
            Semua Genre
          </button>
          <button 
            v-for="genre in availableGenres" 
            :key="genre" 
            class="chip-btn"
            :class="{ active: selectedGenre === genre }"
            @click="setGenre(genre)"
          >
            {{ genre }}
          </button>
        </div>

        <div class="filter-selects">
          <select v-model="selectedFormat" @change="fetchCurrentList" class="custom-select">
            <option value="ALL">Semua Format</option>
            <option value="TV">Serial TV</option>
            <option value="MOVIE">Movie Layar Lebar</option>
            <option value="OVA">OVA</option>
            <option value="SPECIAL">Special</option>
          </select>

          <select v-model="selectedSort" @change="fetchCurrentList" class="custom-select">
            <option value="TRENDING_DESC">Paling Populer</option>
            <option value="POPULARITY_DESC">Banyak Ditonton</option>
            <option value="SCORE_DESC">Rating Tertinggi</option>
            <option value="START_DATE_DESC">Rilis Terbaru</option>
          </select>
        </div>
      </div>

      <!-- Section Title Header -->
      <div class="section-header-bar">
        <div class="title-left">
          <div class="section-indicator"></div>
          <h2 class="section-title">{{ getTabTitle() }}</h2>
          <span class="count-badge" v-if="animeList.length > 0">{{ animeList.length }} Anime</span>
        </div>

        <!-- History Clear Button -->
        <button 
          v-if="currentTab === 'history' && historyList.length > 0" 
          class="btn-clear-history"
          @click="handleClearHistory"
        >
          Bersihkan Riwayat
        </button>
      </div>

      <!-- Modern Skeleton Shimmer Loading State -->
      <AnimeSkeletonGrid v-if="isLoading" :count="12" />

      <!-- Empty State -->
      <div v-else-if="animeList.length === 0" class="empty-state">
        <div class="empty-icon-wrap">
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <rect x="2" y="7" width="20" height="15" rx="2" ry="2"></rect>
            <polyline points="17 2 12 7 7 2"></polyline>
          </svg>
        </div>
        <h3>Belum Ada Anime di Daftar Ini</h3>
        <p>{{ getEmptyMessage() }}</p>
      </div>

      <!-- Anime Cards Grid -->
      <div v-else class="anime-cards-grid">
        <div 
          v-for="anime in animeList" 
          :key="anime.id" 
          class="anime-card"
          @click="openAnimeModal(anime)"
        >
          <div class="poster-wrap">
            <img 
              :src="getSafeImageUrl(anime.coverImage?.large || anime.coverImage)" 
              :alt="anime.title?.romaji || anime.title" 
              class="card-poster" 
              loading="lazy"
            />
            <div class="poster-badge-score" v-if="anime.averageScore && currentTab !== 'history'">
              ★ {{ (anime.averageScore / 10).toFixed(1) }}
            </div>
            <div class="poster-badge-score" v-else-if="currentTab === 'history' && anime.timeFormatted">
              ⏱ {{ anime.timeFormatted }}
            </div>
            <div class="poster-badge-ep">
              {{ currentTab === 'history' ? `Ep ${anime.episode || 1}` : (anime.episodes ? `${anime.episodes} Ep` : (anime.status === 'RELEASING' ? 'Ongoing' : 'HD')) }}
            </div>

            <!-- Card Progress Bar on History -->
            <div class="card-poster-progress" v-if="currentTab === 'history' && anime.progress">
              <div class="progress-fill" :style="{ width: `${anime.progress}%` }"></div>
            </div>

            <!-- Hover Play Action -->
            <div class="card-hover-overlay">
              <button 
                class="hover-play-btn" 
                @click.stop="navigateToWatch(anime.id, currentTab === 'history' ? (anime.episode || 1) : 1)"
                title="Tonton Sekarang"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
              </button>
            </div>
          </div>

          <div class="card-info">
            <h4 class="card-title">{{ anime.title?.english || anime.title?.romaji || anime.title }}</h4>
            <div class="card-meta">
              <span>{{ anime.format || 'TV' }}</span>
              <span>•</span>
              <span>{{ anime.seasonYear || anime.genres?.[0] || 'Anime' }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import AnimeSkeletonGrid from '../components/AnimeSkeletonGrid.vue';
import { 
  getTrendingAnime, 
  getPopularThisSeason, 
  getTopRated, 
  getAiringSchedule, 
  searchAnime, 
  getSafeImageUrl 
} from '../api.js';
import { 
  getWatchlist, 
  getHistory, 
  clearHistory, 
  formatTime 
} from '../storage.js';

const props = defineProps({
  tab: {
    type: String,
    default: 'trending'
  }
});

const emit = defineEmits(['openAnimeModal', 'updateTab']);

const route = useRoute();
const router = useRouter();

const currentTab = ref(route.query.tab || 'trending');
const heroAnimeList = ref([]);
const heroIndex = ref(0);
let heroTimer = null;

const animeList = ref([]);
const historyList = ref([]);
const isLoading = ref(true);

const selectedGenre = ref('ALL');
const selectedFormat = ref('ALL');
const selectedSort = ref('TRENDING_DESC');

const availableGenres = [
  'Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 
  'Romance', 'Sci-Fi', 'Supernatural', 'Mystery', 'Slice of Life', 'Horror', 'Sports'
];

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '').replace(/&quot;/g, '"').replace(/&#039;/g, "'").replace(/&amp;/g, '&');
}

function getTruncated(str, max = 180) {
  if (!str) return '';
  return str.length > max ? str.slice(0, max) + '...' : str;
}

function selectTab(tab) {
  currentTab.value = tab;
  emit('updateTab', tab);
  fetchCurrentList();
}

function setGenre(genre) {
  selectedGenre.value = genre;
  fetchCurrentList();
}

function getTabTitle() {
  switch (currentTab.value) {
    case 'season': return 'Anime Musim Ini (Airing)';
    case 'top-rated': return 'Top Rating Sepanjang Masa';
    case 'airing': return 'Jadwal Rilis Anime';
    case 'watchlist': return 'Koleksi Saya (Watchlist)';
    case 'history': return 'Riwayat Tontonan Kamu';
    default: return selectedGenre.value !== 'ALL' ? `Anime Genre ${selectedGenre.value}` : 'Anime Sedang Populer';
  }
}

function getEmptyMessage() {
  if (currentTab.value === 'watchlist') return 'Kamu belum menambahkan anime ke koleksi. Klik tombol + Koleksi di halaman detail anime.';
  if (currentTab.value === 'history') return 'Kamu belum memiliki riwayat menonton. Mulai tonton anime favoritmu sekarang!';
  return 'Tidak ada anime yang cocok dengan filter yang dipilih.';
}

function openAnimeModal(anime) {
  emit('openAnimeModal', anime);
}

function navigateToWatch(animeId, ep = 1) {
  router.push(`/watch?id=${animeId}&ep=${ep}`);
}

function handleClearHistory() {
  clearHistory();
  historyList.value = [];
  if (currentTab.value === 'history') {
    animeList.value = [];
  }
}

async function fetchCurrentList() {
  isLoading.value = true;
  try {
    if (currentTab.value === 'watchlist') {
      animeList.value = getWatchlist();
    } else if (currentTab.value === 'history') {
      historyList.value = getHistory();
      animeList.value = historyList.value;
    } else if (currentTab.value === 'season') {
      const res = await getPopularThisSeason(1, 24);
      animeList.value = Array.isArray(res) ? res : (res?.media || []);
    } else if (currentTab.value === 'top-rated') {
      const res = await getTopRated(1, 24);
      animeList.value = Array.isArray(res) ? res : (res?.media || []);
    } else if (currentTab.value === 'airing') {
      const res = await getAiringSchedule(1, 24);
      const rawList = Array.isArray(res) ? res : (res?.airingSchedules || []);
      animeList.value = rawList.map(s => s.media || s).filter(Boolean);
    } else {
      // Default trending / genre search
      if (selectedGenre.value !== 'ALL' || selectedFormat.value !== 'ALL' || selectedSort.value !== 'TRENDING_DESC') {
        const filters = {
          genre: selectedGenre.value,
          format: selectedFormat.value,
          sort: selectedSort.value
        };
        const res = await searchAnime('', filters, 1, 24);
        animeList.value = Array.isArray(res) ? res : (res?.media || []);
      } else {
        const res = await getTrendingAnime(1, 24);
        animeList.value = Array.isArray(res) ? res : (res?.media || []);
        if (heroAnimeList.value.length === 0 && animeList.value.length > 0) {
          heroAnimeList.value = animeList.value.slice(0, 6);
        }
      }
    }
  } catch (err) {
    console.error('Fetch anime error:', err);
    animeList.value = [];
  } finally {
    isLoading.value = false;
  }
}

function startHeroCarousel() {
  clearInterval(heroTimer);
  heroTimer = setInterval(() => {
    if (heroAnimeList.value.length > 0) {
      heroIndex.value = (heroIndex.value + 1) % Math.min(6, heroAnimeList.value.length);
    }
  }, 6000);
}

// Watch tab from props and route query
watch(() => props.tab, (newTab) => {
  if (newTab && newTab !== currentTab.value) {
    currentTab.value = newTab;
    fetchCurrentList();
  }
});

watch(() => route.query.tab, (newTab) => {
  if (newTab && newTab !== currentTab.value) {
    currentTab.value = newTab;
    fetchCurrentList();
  }
});

onMounted(() => {
  historyList.value = getHistory();
  fetchCurrentList();
  startHeroCarousel();
});

onUnmounted(() => {
  clearInterval(heroTimer);
});
</script>

<style scoped>
.home-page {
  padding-bottom: 5rem;
  width: 100%;
  max-width: 100%;
  overflow-x: hidden;
}

/* ================= Hero Billboard ================= */
.hero-billboard {
  position: relative;
  width: 100%;
  height: 65vh;
  min-height: 480px;
  max-height: 640px;
  overflow: hidden;
  background: #08090c;
}

.hero-slide {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.8s ease;
  pointer-events: none;
}

.hero-slide.active {
  opacity: 1;
  pointer-events: auto;
}

.hero-bg-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center 25%;
  filter: brightness(0.7);
}

.hero-gradient-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, #08090c 5%, rgba(8, 9, 12, 0.7) 45%, rgba(8, 9, 12, 0.25) 100%),
              linear-gradient(to right, rgba(8, 9, 12, 0.95) 0%, rgba(8, 9, 12, 0.5) 45%, transparent 100%);
}

.hero-content-wrap {
  position: absolute;
  bottom: 3.5rem;
  left: 5%;
  max-width: 650px;
  z-index: 2;
}

.hero-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.8rem;
  flex-wrap: wrap;
}

.hero-rank-badge {
  background: rgba(229, 9, 20, 0.9);
  color: #fff;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 3px 8px;
  border-radius: 4px;
  box-shadow: 0 0 12px rgba(229, 9, 20, 0.5);
}

.hero-score-badge {
  background: rgba(234, 179, 8, 0.2);
  color: #eab308;
  border: 1px solid rgba(234, 179, 8, 0.4);
  font-size: 0.75rem;
  font-weight: 800;
  padding: 2px 7px;
  border-radius: 4px;
}

.hero-meta-badge {
  background: rgba(255, 255, 255, 0.12);
  color: #f1f5f9;
  font-size: 0.72rem;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 4px;
}

.hero-title {
  font-family: 'Outfit', sans-serif;
  font-size: 2.8rem;
  font-weight: 800;
  line-height: 1.12;
  letter-spacing: -0.02em;
  color: #fff;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.9);
}

.hero-japanese-title {
  font-size: 0.95rem;
  color: #94a3b8;
  margin-top: 0.3rem;
  font-weight: 500;
}

.hero-synopsis {
  font-size: 0.92rem;
  color: #cbd5e1;
  margin-top: 1rem;
  line-height: 1.55;
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.8);
}

.hero-buttons {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  margin-top: 1.5rem;
}

.hero-btn-play {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.6rem;
  font-size: 1rem;
  font-weight: 800;
  border-radius: 10px;
  text-decoration: none;
  box-shadow: 0 6px 20px rgba(229, 9, 20, 0.5);
}

.hero-btn-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.4rem;
  font-size: 0.95rem;
  font-weight: 700;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(8px);
  color: #fff;
}

.hero-btn-info:hover {
  background: rgba(255, 255, 255, 0.25);
}

.hero-nav-pills {
  position: absolute;
  bottom: 2rem;
  right: 5%;
  display: flex;
  gap: 0.6rem;
  z-index: 10;
}

.hero-pill-btn {
  position: relative;
  width: 48px;
  height: 68px;
  border-radius: 6px;
  overflow: hidden;
  border: 2px solid transparent;
  background: #12141c;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
  opacity: 0.65;
}

.hero-pill-btn:hover {
  opacity: 0.9;
  transform: translateY(-2px);
}

.hero-pill-btn.active {
  opacity: 1;
  border-color: #e50914;
  box-shadow: 0 0 12px rgba(229, 9, 20, 0.6);
  transform: scale(1.06);
}

.hero-pill-btn img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.pill-number {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 0.65rem;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.9);
}

/* ================= Content Layout ================= */
.content-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 1.5rem;
  width: 100%;
  box-sizing: border-box;
}

.continue-watching-section {
  padding: 2rem 0 1rem 0;
}

.section-title-wrap {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.title-left {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.section-indicator {
  width: 4px;
  height: 24px;
  background: #e50914;
  border-radius: 2px;
  box-shadow: 0 0 10px rgba(229, 9, 20, 0.8);
}

.section-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
}

.section-subtitle {
  font-size: 0.8rem;
  color: #94a3b8;
  margin-top: 1px;
}

.view-all-link {
  background: none;
  border: none;
  color: #e50914;
  font-size: 0.82rem;
  font-weight: 700;
  cursor: pointer;
}

.view-all-link:hover {
  text-decoration: underline;
}

.continue-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
}

.continue-card {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: transform 0.2s ease, border-color 0.2s ease;
}

.continue-card:hover {
  transform: translateY(-3px);
  border-color: rgba(229, 9, 20, 0.4);
}

.continue-thumb-wrap {
  position: relative;
  width: 100%;
  height: 120px;
}

.continue-thumb {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.play-overlay-icon {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.continue-card:hover .play-overlay-icon {
  opacity: 1;
}

.continue-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.2);
}

.progress-fill {
  height: 100%;
  background: #e50914;
  border-radius: 0 2px 2px 0;
  box-shadow: 0 0 6px #e50914;
}

.continue-info {
  padding: 0.65rem 0.8rem;
}

.continue-title {
  font-size: 0.85rem;
  font-weight: 700;
  color: #fff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.continue-ep-meta {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 2px;
}

/* Filter Bar */
.filter-bar {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 1.25rem 0 1rem 0;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

@media (min-width: 900px) {
  .filter-bar {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
  }
}

.genre-scroll-wrapper {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  padding-bottom: 6px;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  flex: 1;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.genre-scroll-wrapper::-webkit-scrollbar {
  display: none;
}

.chip-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.08);
  color: #94a3b8;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  font-size: 0.8rem;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}

.chip-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.chip-btn.active {
  background: #e50914;
  border-color: #e50914;
  color: #fff;
  box-shadow: 0 0 12px rgba(229, 9, 20, 0.4);
}

.filter-selects {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

@media (min-width: 900px) {
  .filter-selects {
    width: auto;
  }
}

.custom-select {
  background: #12141c;
  border: 1px solid #1e2230;
  color: #cbd5e1;
  padding: 0.45rem 0.85rem;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 600;
  outline: none;
  cursor: pointer;
  flex: 1;
  min-width: 0;
}

.custom-select:focus {
  border-color: #e50914;
}

.section-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 1.2rem 0 1rem 0;
}

.count-badge {
  font-size: 0.75rem;
  color: #64748b;
  background: rgba(255, 255, 255, 0.06);
  padding: 2px 7px;
  border-radius: 4px;
  font-weight: 600;
}

.btn-clear-history {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
  font-size: 0.78rem;
  font-weight: 700;
  padding: 0.35rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
}

/* Cards Grid */
.anime-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.3rem;
  margin-top: 0.5rem;
}

.anime-card {
  cursor: pointer;
  display: flex;
  flex-direction: column;
  transition: transform 0.25s ease;
}

.anime-card:hover {
  transform: translateY(-5px);
}

.poster-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: #12141c;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.4);
}

.card-poster {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform 0.3s ease;
}

.anime-card:hover .card-poster {
  transform: scale(1.05);
}

.poster-badge-score {
  position: absolute;
  top: 8px;
  left: 8px;
  background: rgba(8, 9, 12, 0.85);
  backdrop-filter: blur(4px);
  color: #eab308;
  font-size: 0.75rem;
  font-weight: 800;
  padding: 2px 6px;
  border-radius: 6px;
  border: 1px solid rgba(234, 179, 8, 0.3);
}

.poster-badge-ep {
  position: absolute;
  bottom: 8px;
  right: 8px;
  background: rgba(8, 9, 12, 0.85);
  backdrop-filter: blur(4px);
  color: #fff;
  font-size: 0.72rem;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 6px;
}

.card-hover-overlay {
  position: absolute;
  inset: 0;
  background: rgba(8, 9, 12, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.anime-card:hover .card-hover-overlay {
  opacity: 1;
}

.hover-play-btn {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #e50914;
  border: none;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  box-shadow: 0 4px 18px rgba(229, 9, 20, 0.6);
  transform: scale(0.9);
  transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.anime-card:hover .hover-play-btn {
  transform: scale(1);
}

.card-info {
  margin-top: 0.65rem;
}

.card-title {
  font-size: 0.88rem;
  font-weight: 700;
  color: #f1f5f9;
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.card-meta {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 3px;
}

.grid-loader {
  text-align: center;
  padding: 5rem 1rem;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.empty-state {
  text-align: center;
  padding: 5rem 1rem;
  color: #94a3b8;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.empty-icon-wrap {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #64748b;
  margin-bottom: 1.25rem;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
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

@media (max-width: 768px) {
  .content-container {
    padding: 0 0.85rem;
  }
  .hero-billboard {
    height: 50vh;
    min-height: 380px;
  }
  .hero-content-wrap {
    left: 1rem;
    right: 1rem;
    max-width: calc(100% - 2rem);
    bottom: 2rem;
  }
  .hero-title {
    font-size: 1.65rem;
  }
  .hero-synopsis {
    display: none;
  }
  .hero-nav-pills {
    display: none;
  }
  .continue-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.65rem;
  }
  .continue-card {
    min-width: 0;
  }
  .anime-cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.75rem;
  }
  .anime-card {
    min-width: 0;
  }
  .filter-selects {
    display: flex;
    gap: 0.5rem;
  }
  .custom-select {
    flex: 1;
    min-width: 0;
    font-size: 0.78rem;
    padding: 0.45rem 0.65rem;
  }
}
</style>
