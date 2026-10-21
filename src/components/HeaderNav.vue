<template>
  <header class="site-header" :class="{ 'scrolled': isScrolled }">
    <div class="header-container">
      <!-- Brand Logo -->
      <router-link to="/" class="brand-logo" id="brandHomeBtn">
        <img src="/logo.png" alt="AniPulse Logo" class="brand-icon-img" />
        <span class="brand-text-wrap">
          <span class="brand-mark">ANI</span>
          <span class="brand-text">PULSE</span>
        </span>
        <span class="brand-kanji">アニメ</span>
      </router-link>

      <!-- Desktop Nav -->
      <nav class="desktop-nav">
        <ul class="nav-links">
          <li>
            <button 
              class="nav-item-btn" 
              :class="{ active: currentTab === 'trending' && $route.path === '/' }"
              @click="selectTab('trending')"
            >
              Populer
            </button>
          </li>
          <li>
            <button 
              class="nav-item-btn" 
              :class="{ active: currentTab === 'season' && $route.path === '/' }"
              @click="selectTab('season')"
            >
              Musim Ini
            </button>
          </li>
          <li>
            <button 
              class="nav-item-btn" 
              :class="{ active: currentTab === 'top-rated' && $route.path === '/' }"
              @click="selectTab('top-rated')"
            >
              Top Rating
            </button>
          </li>
          <li>
            <button 
              class="nav-item-btn" 
              :class="{ active: currentTab === 'airing' && $route.path === '/' }"
              @click="selectTab('airing')"
            >
              Jadwal
            </button>
          </li>
          <li>
            <button 
              class="nav-item-btn" 
              :class="{ active: currentTab === 'watchlist' && $route.path === '/' }"
              @click="selectTab('watchlist')"
            >
              Koleksi
            </button>
          </li>
          <li>
            <button 
              class="nav-item-btn" 
              :class="{ active: currentTab === 'history' && $route.path === '/' }"
              @click="selectTab('history')"
            >
              Riwayat
            </button>
          </li>
        </ul>
      </nav>

      <!-- Header Search Input -->
      <div class="header-search-wrapper" ref="searchWrapperRef">
        <div class="search-input-box" :class="{ 'focused': isSearchOpen }">
          <span class="search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </span>
          <input 
            type="text" 
            ref="searchInputRef"
            v-model="searchQuery" 
            @input="onSearchInput"
            @focus="isSearchOpen = true"
            placeholder="Cari judul, misal frieren" 
            autocomplete="off" 
          />
          <span class="search-shortcut" v-if="!searchQuery">/</span>
          <button v-else class="search-clear-btn" @click="searchQuery = ''; searchResults = []">✕</button>
        </div>

        <!-- Search Autocomplete Dropdown -->
        <div class="search-results-dropdown" v-if="isSearchOpen && (searchResults.length > 0 || isSearching)">
          <div v-if="isSearching" class="search-loading">
            <span class="spinner-small"></span> Mencari anime...
          </div>
          <div v-else>
            <div 
              v-for="item in searchResults" 
              :key="item.id" 
              class="search-result-item"
              @click="openAnime(item)"
            >
              <img :src="getSafeImageUrl(item.coverImage?.large)" :alt="item.title?.romaji" class="search-thumb" />
              <div class="search-info">
                <div class="search-title">{{ item.title?.english || item.title?.romaji }}</div>
                <div class="search-meta">
                  <span class="search-score">★ {{ (item.averageScore / 10).toFixed(1) || 'N/A' }}</span>
                  <span>•</span>
                  <span>{{ item.format || 'TV' }}</span>
                  <span>•</span>
                  <span>{{ item.episodes ? `${item.episodes} Ep` : 'Ongoing' }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Actions & Profile -->
      <div class="header-actions">
        <!-- Admin Dashboard Shortcut -->
        <router-link 
          v-if="isAdmin" 
          to="/admin" 
          class="admin-badge-btn"
          title="Buka Panel Admin"
        >
          <span class="pulse-dot"></span>
          <span>Panel Admin</span>
        </router-link>

        <!-- Authenticated User Profile -->
        <div v-if="currentUser" class="user-profile-menu" ref="profileMenuRef">
          <button class="profile-trigger-btn" @click="isProfileOpen = !isProfileOpen">
            <div class="user-avatar">{{ (currentUser.displayName || currentUser.username).charAt(0).toUpperCase() }}</div>
            <div class="user-details-pill">
              <span class="user-name-text">{{ currentUser.displayName || currentUser.username }}</span>
              <span class="user-badge-vip" :class="{ 'admin-badge': currentUser.role === 'admin' }">
                {{ currentUser.role === 'admin' ? 'ADMIN' : formatRemainingTime(currentUser.remainingSeconds) }}
              </span>
            </div>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
          </button>

          <!-- Dropdown -->
          <div class="profile-dropdown" v-if="isProfileOpen">
            <div class="dropdown-header">
              <div class="dropdown-username">{{ currentUser.displayName || currentUser.username }}</div>
              <div class="dropdown-role">
                Status: <strong :style="{ color: currentUser.role === 'admin' ? '#ef4444' : '#10b981' }">
                  {{ currentUser.role === 'admin' ? 'Super Administrator' : 'VIP Member' }}
                </strong>
              </div>
              <div class="dropdown-expiry" v-if="currentUser.role !== 'admin'">
                Masa Aktif: {{ formatRemainingTime(currentUser.remainingSeconds) }}
              </div>
            </div>
            <div class="dropdown-divider"></div>
            <router-link v-if="isAdmin" to="/admin" class="dropdown-item" @click="isProfileOpen = false">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              <span>Panel Admin & Buat Invite</span>
            </router-link>
            <button class="dropdown-item logout" @click="handleLogout">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <span>Keluar (Logout)</span>
            </button>
          </div>
        </div>

        <!-- Unauthenticated Guest -->
        <div v-else class="auth-buttons">
          <button class="btn btn-primary btn-sm login-btn" @click="showLoginModal = true">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg>
            <span>Masuk</span>
          </button>
        </div>
      </div>
    </div>
  </header>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { currentUser, isAdmin, showLoginModal, logoutUser, formatRemainingTime } from '../stores/auth.js';
import { searchAnime, getSafeImageUrl } from '../api.js';

const props = defineProps({
  currentTab: {
    type: String,
    default: 'trending'
  }
});

const emit = defineEmits(['selectTab', 'openAnimeModal']);

const router = useRouter();
const isScrolled = ref(false);
const searchQuery = ref('');
const searchResults = ref([]);
const isSearching = ref(false);
const isSearchOpen = ref(false);
const isProfileOpen = ref(false);
const searchInputRef = ref(null);
const searchWrapperRef = ref(null);
const profileMenuRef = ref(null);

let searchDebounce = null;

function selectTab(tab) {
  if (router.currentRoute.value.path !== '/') {
    router.push({ path: '/', query: { tab } });
  } else {
    emit('selectTab', tab);
  }
}

function onSearchInput() {
  clearTimeout(searchDebounce);
  if (!searchQuery.value.trim()) {
    searchResults.value = [];
    isSearching.value = false;
    return;
  }
  isSearching.value = true;
  searchDebounce = setTimeout(async () => {
    try {
      const res = await searchAnime(searchQuery.value.trim(), {}, 1, 6);
      searchResults.value = Array.isArray(res) ? res : (res?.media || []);
    } catch (e) {
      console.warn('Search error:', e);
      searchResults.value = [];
    } finally {
      isSearching.value = false;
    }
  }, 300);
}

function openAnime(anime) {
  isSearchOpen.value = false;
  searchQuery.value = '';
  searchResults.value = [];
  router.push(`/anime?id=${anime.id}`);
}

function handleLogout() {
  isProfileOpen.value = false;
  logoutUser();
}

function handleScroll() {
  isScrolled.value = window.scrollY > 20;
}

function handleClickOutside(e) {
  if (searchWrapperRef.value && !searchWrapperRef.value.contains(e.target)) {
    isSearchOpen.value = false;
  }
  if (profileMenuRef.value && !profileMenuRef.value.contains(e.target)) {
    isProfileOpen.value = false;
  }
}

function handleKeydown(e) {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    searchInputRef.value?.focus();
    isSearchOpen.value = true;
  } else if (e.key === 'Escape') {
    isSearchOpen.value = false;
    isProfileOpen.value = false;
  }
}

onMounted(() => {
  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('click', handleClickOutside);
  document.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
  document.removeEventListener('click', handleClickOutside);
  document.removeEventListener('keydown', handleKeydown);
});
</script>

<style scoped>
.site-header {
  position: sticky;
  top: 0;
  left: 0;
  width: 100%;
  height: 68px;
  background-color: rgba(8, 9, 12, 0.85);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
  z-index: 100;
  transition: all 0.25s ease;
}

.site-header.scrolled {
  background-color: rgba(6, 7, 10, 0.96);
  border-bottom-color: rgba(229, 9, 20, 0.15);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
}

.header-container {
  max-width: 1440px;
  margin: 0 auto;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 1.5rem;
  gap: 1.5rem;
}

.brand-logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  flex-shrink: 0;
}

.brand-icon-img {
  width: 38px;
  height: 38px;
  object-fit: contain;
  border-radius: 8px;
  filter: drop-shadow(0 2px 10px rgba(229, 9, 20, 0.4));
  transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.brand-logo:hover .brand-icon-img {
  transform: scale(1.08) rotate(3deg);
}

.brand-text-wrap {
  display: flex;
  align-items: center;
  font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif;
  font-weight: 800;
  font-size: 1.35rem;
  letter-spacing: -0.02em;
}

.brand-mark {
  color: #fff;
}

.brand-text {
  color: #e50914;
  margin-left: 2px;
}

.brand-kanji {
  font-size: 0.72rem;
  color: #ef4444;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.25);
  padding: 1px 5px;
  border-radius: 4px;
  font-weight: 600;
  margin-left: 4px;
}

.desktop-nav {
  display: flex;
  align-items: center;
}

.nav-links {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  list-style: none;
}

.nav-item-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  padding: 0.5rem 0.85rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  position: relative;
}

.nav-item-btn:hover {
  color: #fff;
  background: rgba(255, 255, 255, 0.05);
}

.nav-item-btn.active {
  color: #fff;
  background: rgba(229, 9, 20, 0.12);
}

.nav-item-btn.active::after {
  content: '';
  position: absolute;
  bottom: 0px;
  left: 25%;
  width: 50%;
  height: 2px;
  background: #e50914;
  border-radius: 2px;
  box-shadow: 0 0 8px rgba(229, 9, 20, 0.8);
}

.header-search-wrapper {
  position: relative;
  flex: 1;
  max-width: 360px;
}

.search-input-box {
  display: flex;
  align-items: center;
  background: rgba(18, 20, 28, 0.85);
  border: 1px solid #1e2230;
  border-radius: 9999px;
  padding: 0.45rem 0.9rem;
  gap: 0.5rem;
  transition: all 0.2s ease;
}

.search-input-box.focused,
.search-input-box:focus-within {
  border-color: #e50914;
  background: rgba(24, 27, 38, 0.95);
  box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.15);
}

.search-icon {
  color: #64748b;
  display: flex;
  align-items: center;
}

.search-input-box input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #f8fafc;
  font-size: 0.85rem;
  font-family: inherit;
}

.search-input-box input::placeholder {
  color: #64748b;
}

.search-shortcut {
  font-size: 0.75rem;
  color: #64748b;
  background: rgba(255, 255, 255, 0.06);
  padding: 1px 6px;
  border-radius: 4px;
}

.search-clear-btn {
  background: none;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  font-size: 0.8rem;
  padding: 0 4px;
}

.search-results-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  width: 100%;
  background: #12141c;
  border: 1px solid #2a3044;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7);
  overflow: hidden;
  z-index: 110;
  max-height: 400px;
  overflow-y: auto;
}

.search-loading {
  padding: 1rem;
  text-align: center;
  color: #94a3b8;
  font-size: 0.85rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.search-result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.85rem;
  cursor: pointer;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  transition: background 0.15s ease;
}

.search-result-item:hover {
  background: rgba(229, 9, 20, 0.1);
}

.search-thumb {
  width: 36px;
  height: 50px;
  object-fit: cover;
  border-radius: 4px;
  flex-shrink: 0;
}

.search-info {
  flex: 1;
  overflow: hidden;
}

.search-title {
  color: #fff;
  font-size: 0.85rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-meta {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #94a3b8;
  font-size: 0.75rem;
  margin-top: 2px;
}

.search-score {
  color: #eab308;
  font-weight: 700;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.admin-badge-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: linear-gradient(135deg, rgba(229, 9, 20, 0.2), rgba(234, 179, 8, 0.2));
  border: 1px solid rgba(229, 9, 20, 0.4);
  color: #fff;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.4rem 0.75rem;
  border-radius: 9999px;
  text-decoration: none;
  transition: all 0.2s ease;
}

.admin-badge-btn:hover {
  background: linear-gradient(135deg, rgba(229, 9, 20, 0.35), rgba(234, 179, 8, 0.35));
  border-color: #e50914;
  transform: translateY(-1px);
}

.pulse-dot {
  width: 7px;
  height: 7px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 8px #10b981;
}

.user-profile-menu {
  position: relative;
}

.profile-trigger-btn {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  background: rgba(18, 20, 28, 0.8);
  border: 1px solid #1e2230;
  padding: 0.35rem 0.65rem 0.35rem 0.4rem;
  border-radius: 9999px;
  cursor: pointer;
  color: #fff;
  transition: all 0.2s ease;
}

.profile-trigger-btn:hover {
  border-color: rgba(229, 9, 20, 0.5);
  background: #181b26;
}

.user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e50914, #991b1b);
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 0.85rem;
  color: #fff;
}

.user-details-pill {
  display: flex;
  flex-direction: column;
  text-align: left;
  line-height: 1.1;
}

.user-name-text {
  font-size: 0.8rem;
  font-weight: 700;
  color: #fff;
  max-width: 90px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-badge-vip {
  font-size: 0.68rem;
  color: #10b981;
  font-weight: 600;
}

.user-badge-vip.admin-badge {
  color: #e50914;
}

.profile-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 220px;
  background: #12141c;
  border: 1px solid #2a3044;
  border-radius: 12px;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.7);
  padding: 0.5rem;
  z-index: 120;
}

.dropdown-header {
  padding: 0.5rem 0.65rem;
}

.dropdown-username {
  font-size: 0.9rem;
  font-weight: 700;
  color: #fff;
}

.dropdown-role {
  font-size: 0.75rem;
  color: #94a3b8;
  margin-top: 2px;
}

.dropdown-expiry {
  font-size: 0.72rem;
  color: #10b981;
  margin-top: 3px;
  background: rgba(16, 185, 129, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  display: inline-block;
}

.dropdown-divider {
  height: 1px;
  background: #1e2230;
  margin: 0.4rem 0;
}

.dropdown-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.55rem 0.65rem;
  background: none;
  border: none;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 0.82rem;
  font-weight: 500;
  cursor: pointer;
  text-decoration: none;
  transition: background 0.15s ease, color 0.15s ease;
}

.dropdown-item:hover {
  background: rgba(255, 255, 255, 0.05);
  color: #fff;
}

.dropdown-item.logout:hover {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.login-btn {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
  padding: 0.45rem 1rem;
}

.spinner-small {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: #e50914;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 900px) {
  .desktop-nav {
    display: none;
  }
  .header-search-wrapper {
    max-width: 260px;
  }
}

@media (max-width: 640px) {
  .site-header {
    height: 56px;
  }

  .header-container {
    padding: 0 0.75rem;
    gap: 0.6rem;
  }

  .brand-logo {
    gap: 0.35rem;
  }

  .brand-icon-img {
    width: 26px;
    height: 26px;
  }

  .brand-text-wrap {
    font-size: 1.15rem;
  }

  .brand-kanji {
    display: none;
  }

  .header-search-wrapper {
    flex: 1;
    max-width: none;
    min-width: 0;
  }

  .search-input-box {
    padding: 0.38rem 0.65rem;
    gap: 0.4rem;
    background: #18181c;
    border-color: #2a2e3d;
  }

  .search-input-box input {
    font-size: 0.8rem;
  }

  .search-shortcut {
    display: none;
  }

  .admin-badge-btn {
    display: none;
  }

  .profile-trigger-btn {
    padding: 0;
    background: transparent;
    border: none;
    gap: 0;
  }

  .profile-trigger-btn svg {
    display: none;
  }

  .user-details-pill {
    display: none;
  }

  .user-avatar {
    width: 32px;
    height: 32px;
    font-size: 0.88rem;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);
  }

  .login-btn {
    padding: 0.35rem 0.65rem;
    font-size: 0.78rem;
    border-radius: 9999px;
  }

  .login-btn span {
    display: inline;
  }
}
</style>
