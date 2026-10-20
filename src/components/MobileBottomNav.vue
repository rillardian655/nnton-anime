<template>
  <div class="mobile-nav-container">
    <nav class="mobile-bottom-bar">
      <!-- 1. Beranda -->
      <button 
        class="nav-tab-btn" 
        :class="{ active: isHomeActive && currentTab === 'trending' }"
        @click="goToTab('trending')"
      >
        <div class="tab-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
        </div>
        <span class="tab-label">Beranda</span>
      </button>

      <!-- 2. Populer -->
      <button 
        class="nav-tab-btn" 
        :class="{ active: isHomeActive && currentTab === 'top-rated' }"
        @click="goToTab('top-rated')"
      >
        <div class="tab-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
          </svg>
        </div>
        <span class="tab-label">Top Rating</span>
      </button>

      <!-- 3. Jadwal Rilis -->
      <button 
        class="nav-tab-btn" 
        :class="{ active: isHomeActive && currentTab === 'airing' }"
        @click="goToTab('airing')"
      >
        <div class="tab-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="16" y1="2" x2="16" y2="6"></line>
            <line x1="8" y1="2" x2="8" y2="6"></line>
            <line x1="3" y1="10" x2="21" y2="10"></line>
          </svg>
        </div>
        <span class="tab-label">Jadwal</span>
      </button>

      <!-- 4. Koleksi & Riwayat -->
      <button 
        class="nav-tab-btn" 
        :class="{ active: isHomeActive && currentTab === 'watchlist' }"
        @click="goToTab('watchlist')"
      >
        <div class="tab-icon-wrap">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <span class="tab-label">Koleksi</span>
      </button>

      <!-- 5. Akun / VIP -->
      <button 
        class="nav-tab-btn" 
        :class="{ active: isAccountActive }"
        @click="handleAccountClick"
      >
        <div class="tab-icon-wrap">
          <div v-if="currentUser" class="mobile-avatar">
            {{ (currentUser.displayName || currentUser.username).charAt(0).toUpperCase() }}
          </div>
          <svg v-else width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
          <span v-if="currentUser" class="vip-dot"></span>
        </div>
        <span class="tab-label">{{ currentUser ? (currentUser.displayName || 'Akun') : 'Masuk' }}</span>
      </button>
    </nav>

    <!-- Mobile Account Bottom Sheet -->
    <transition name="sheet-slide">
      <div v-if="isSheetOpen" class="sheet-backdrop" @click="isSheetOpen = false">
        <div class="sheet-card" @click.stop>
          <div class="sheet-drag-handle"></div>
          
          <div class="sheet-user-header">
            <div class="sheet-avatar">
              {{ (currentUser?.displayName || currentUser?.username || 'U').charAt(0).toUpperCase() }}
            </div>
            <div class="sheet-user-meta">
              <h3 class="sheet-username">{{ currentUser?.displayName || currentUser?.username }}</h3>
              <div class="sheet-badge" :class="{ 'admin-badge': currentUser?.role === 'admin' }">
                {{ currentUser?.role === 'admin' ? 'Super Administrator' : 'VIP Member' }}
              </div>
              <p class="sheet-expiry" v-if="currentUser?.role !== 'admin'">
                Aktif sampai: {{ formatRemainingTime(currentUser?.remainingSeconds) }}
              </p>
            </div>
          </div>

          <div class="sheet-actions-list">
            <router-link 
              v-if="isAdmin" 
              to="/admin" 
              class="sheet-action-item"
              @click="isSheetOpen = false"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              <div class="action-text">
                <span class="action-title">Panel Admin</span>
                <span class="action-sub">Buat link invite & kelola user</span>
              </div>
              <span class="action-chevron">›</span>
            </router-link>

            <button class="sheet-action-item" @click="goToTab('watchlist'); isSheetOpen = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
              <div class="action-text">
                <span class="action-title">Koleksi Saya</span>
                <span class="action-sub">Anime yang disimpan & disukai</span>
              </div>
              <span class="action-chevron">›</span>
            </button>

            <button class="sheet-action-item" @click="goToTab('history'); isSheetOpen = false">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              <div class="action-text">
                <span class="action-title">Riwayat Nonton</span>
                <span class="action-sub">Lanjutkan anime yang sedang ditonton</span>
              </div>
              <span class="action-chevron">›</span>
            </button>

            <button class="sheet-action-item logout" @click="handleLogout">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
              <div class="action-text">
                <span class="action-title text-danger">Keluar (Logout)</span>
                <span class="action-sub">Hapus sesi dari perangkat ini</span>
              </div>
            </button>
          </div>

          <button class="sheet-close-btn" @click="isSheetOpen = false">Tutup</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { currentUser, isAdmin, showLoginModal, logoutUser, formatRemainingTime } from '../stores/auth.js';

const props = defineProps({
  currentTab: {
    type: String,
    default: 'trending'
  }
});

const emit = defineEmits(['selectTab']);
const router = useRouter();
const route = useRoute();

const isSheetOpen = ref(false);

const isHomeActive = computed(() => route.path === '/');
const isAccountActive = computed(() => route.path === '/admin' || isSheetOpen.value);

function goToTab(tab) {
  if (route.path !== '/') {
    router.push({ path: '/', query: { tab } });
  } else {
    emit('selectTab', tab);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function handleAccountClick() {
  if (!currentUser.value) {
    showLoginModal.value = true;
  } else {
    isSheetOpen.value = !isSheetOpen.value;
  }
}

function handleLogout() {
  isSheetOpen.value = false;
  logoutUser();
  if (route.path.startsWith('/admin')) {
    router.push('/');
  }
}
</script>

<style scoped>
.mobile-nav-container {
  display: none;
}

@media (max-width: 900px) {
  .mobile-nav-container {
    display: block;
  }

  .mobile-bottom-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    height: calc(60px + env(safe-area-inset-bottom, 0px));
    padding-bottom: env(safe-area-inset-bottom, 0px);
    background: rgba(10, 12, 18, 0.94);
    backdrop-filter: blur(20px);
    -webkit-backdrop-filter: blur(20px);
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    display: flex;
    align-items: center;
    justify-content: space-around;
    z-index: 1000;
    box-shadow: 0 -4px 20px rgba(0, 0, 0, 0.6);
  }

  .nav-tab-btn {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    background: transparent;
    border: none;
    color: #94a3b8;
    padding: 6px 0;
    cursor: pointer;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    -webkit-tap-highlight-color: transparent;
  }

  .tab-icon-wrap {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: transform 0.2s ease;
  }

  .tab-label {
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: color 0.2s ease;
  }

  .nav-tab-btn.active {
    color: #e50914;
  }

  .nav-tab-btn.active .tab-icon-wrap {
    transform: translateY(-2px);
    filter: drop-shadow(0 0 6px rgba(229, 9, 20, 0.6));
  }

  .nav-tab-btn.active .tab-label {
    color: #fff;
    font-weight: 700;
  }

  .mobile-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    background: linear-gradient(135deg, #e50914, #991b1b);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 800;
    font-size: 0.72rem;
    color: #fff;
    box-shadow: 0 0 6px rgba(229, 9, 20, 0.4);
  }

  .vip-dot {
    position: absolute;
    top: -1px;
    right: -2px;
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: #10b981;
    border: 1.5px solid #0a0c12;
    box-shadow: 0 0 5px #10b981;
  }

  /* Bottom Sheet */
  .sheet-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.75);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 1100;
    display: flex;
    align-items: flex-end;
    justify-content: center;
  }

  .sheet-card {
    width: 100%;
    max-width: 500px;
    background: #121520;
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    border-radius: 20px 20px 0 0;
    padding: 1rem 1.25rem calc(1.5rem + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -8px 32px rgba(0, 0, 0, 0.8);
  }

  .sheet-drag-handle {
    width: 40px;
    height: 4px;
    background: #334155;
    border-radius: 4px;
    margin: 0 auto 1.25rem;
  }

  .sheet-user-header {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid #1e2436;
  }

  .sheet-avatar {
    width: 46px;
    height: 46px;
    border-radius: 50%;
    background: linear-gradient(135deg, #e50914, #b91c1c);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.25rem;
    font-weight: 800;
    color: #fff;
    box-shadow: 0 0 12px rgba(229, 9, 20, 0.4);
  }

  .sheet-username {
    font-size: 1.1rem;
    font-weight: 800;
    color: #fff;
    margin: 0 0 3px 0;
  }

  .sheet-badge {
    display: inline-block;
    font-size: 0.72rem;
    font-weight: 700;
    color: #10b981;
    background: rgba(16, 185, 129, 0.12);
    padding: 2px 8px;
    border-radius: 9999px;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .sheet-badge.admin-badge {
    color: #ef4444;
    background: rgba(239, 68, 68, 0.12);
    border-color: rgba(239, 68, 68, 0.3);
  }

  .sheet-expiry {
    font-size: 0.75rem;
    color: #94a3b8;
    margin: 4px 0 0 0;
  }

  .sheet-actions-list {
    margin: 1rem 0;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .sheet-action-item {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    padding: 0.75rem 0.85rem;
    background: rgba(255, 255, 255, 0.03);
    border: 1px solid rgba(255, 255, 255, 0.06);
    border-radius: 12px;
    color: #f1f5f9;
    text-decoration: none;
    cursor: pointer;
    text-align: left;
    transition: background 0.15s ease, border-color 0.15s ease;
  }

  .sheet-action-item:hover, .sheet-action-item:active {
    background: rgba(255, 255, 255, 0.07);
    border-color: rgba(229, 9, 20, 0.4);
  }

  .action-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .action-title {
    font-size: 0.9rem;
    font-weight: 700;
  }

  .action-sub {
    font-size: 0.72rem;
    color: #94a3b8;
  }

  .text-danger {
    color: #ef4444;
  }

  .action-chevron {
    color: #64748b;
    font-size: 1.25rem;
  }

  .sheet-action-item.logout {
    border-color: rgba(239, 68, 68, 0.2);
  }

  .sheet-action-item.logout:hover, .sheet-action-item.logout:active {
    background: rgba(239, 68, 68, 0.1);
  }

  .sheet-close-btn {
    width: 100%;
    padding: 0.75rem;
    background: #1e2436;
    border: none;
    border-radius: 10px;
    color: #cbd5e1;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    margin-top: 0.5rem;
  }

  /* Sheet slide transition */
  .sheet-slide-enter-active,
  .sheet-slide-leave-active {
    transition: opacity 0.25s ease;
  }

  .sheet-slide-enter-active .sheet-card,
  .sheet-slide-leave-active .sheet-card {
    transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .sheet-slide-enter-from,
  .sheet-slide-leave-to {
    opacity: 0;
  }

  .sheet-slide-enter-from .sheet-card,
  .sheet-slide-leave-to .sheet-card {
    transform: translateY(100%);
  }
}
</style>
