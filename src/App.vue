<template>
  <div class="app-root">
    <!-- Top Navigation Header -->
    <HeaderNav 
      :currentTab="activeTab" 
      @selectTab="onTabSelected" 
      @openAnimeModal="openAnimeModal" 
    />

    <!-- Main View Routing -->
    <main class="main-content-body">
      <router-view 
        :tab="activeTab" 
        @openAnimeModal="openAnimeModal" 
        @updateTab="onTabSelected" 
      />
    </main>

    <!-- Cinematic Door Opening Splash Screen -->
    <DoorSplashScreen />

    <!-- Global Modals -->
    <LoginModal />
    <InviteModal />
    <AnimeDetailModal 
      :anime="selectedAnimeModal" 
      @close="selectedAnimeModal = null" 
    />

    <!-- Mobile Bottom Navigation Bar (Hidden on Watch View for maximum video screen) -->
    <MobileBottomNav 
      v-if="$route.path !== '/watch'"
      :currentTab="activeTab" 
      @selectTab="onTabSelected" 
    />

    <!-- Footer (Hidden on Watch View) -->
    <footer v-if="$route.path !== '/watch'" class="site-footer">
      <div class="footer-container">
        <div class="footer-top">
          <div class="footer-brand">
            <div class="footer-logo">
              <img src="/logo.png" alt="AniPulse Logo" class="footer-logo-img" />
              <span class="footer-brand-text"><span class="text-white">ANI</span><span class="text-red">PULSE</span></span>
              <span class="footer-kanji">アニメ</span>
            </div>
            <p class="footer-desc">
              Platform Nonton Anime Streaming Subtitle Indonesia HD tanpa iklan, dilengkapi pemutar video anti-buffer (Kodik HLS), jadwal rilis, dan koleksi lengkap.
            </p>
          </div>

          <div class="footer-links-col">
            <h4>Navigasi</h4>
            <ul>
              <li><router-link to="/">Beranda</router-link></li>
              <li><router-link to="/?tab=trending">Populer</router-link></li>
              <li><router-link to="/?tab=season">Musim Ini</router-link></li>
              <li><router-link to="/?tab=top-rated">Top Rating</router-link></li>
              <li><router-link to="/?tab=airing">Jadwal Rilis</router-link></li>
            </ul>
          </div>

          <div class="footer-links-col">
            <h4>Akses VIP</h4>
            <ul>
              <li v-if="!isAuthenticated"><a href="#" @click.prevent="showLoginModal = true">Masuk Akun</a></li>
              <li v-if="isAdmin"><router-link to="/admin">Panel Administrator</router-link></li>
              <li><span class="text-dim">Invite Only (WhatsApp)</span></li>
              <li><span class="text-dim">Database Sub Indo Server</span></li>
            </ul>
          </div>
        </div>

        <div class="footer-bottom">
          <div class="footer-copy">
            © 2026 AniPulse Streaming. Hak cipta dilindungi undang-undang. Video di-stream melalui Kodik HLS CDN & YummyAnime core.
          </div>
          <div class="footer-status-pill">
            <span class="status-dot"></span>
            <span>Server Online • 127.0.0.1:8000</span>
          </div>
        </div>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import HeaderNav from './components/HeaderNav.vue';
import MobileBottomNav from './components/MobileBottomNav.vue';
import LoginModal from './components/LoginModal.vue';
import InviteModal from './components/InviteModal.vue';
import AnimeDetailModal from './components/AnimeDetailModal.vue';
import DoorSplashScreen from './components/DoorSplashScreen.vue';
import { checkAuth, checkInviteUrl, isAuthenticated, isAdmin, showLoginModal } from './stores/auth.js';

const route = useRoute();
const activeTab = ref('trending');
const selectedAnimeModal = ref(null);

function onTabSelected(tab) {
  activeTab.value = tab;
}

function openAnimeModal(anime) {
  selectedAnimeModal.value = anime;
}

onMounted(async () => {
  // Check user session
  await checkAuth();

  // Check if opened via invite link in URL: e.g. /?invite=INV-XXXX or /invite?code=INV-XXXX
  const urlParams = new URLSearchParams(window.location.search);
  const inviteCode = urlParams.get('invite') || urlParams.get('code');
  if (inviteCode) {
    checkInviteUrl(inviteCode);
  }
});
</script>

<style scoped>
.app-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: var(--bg-base);
  color: var(--text-main);
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
}

.main-content-body {
  flex: 1;
  width: 100%;
  max-width: 100vw;
  overflow-x: hidden;
}

.site-footer {
  background: #08090c;
  border-top: 1px solid #1e2230;
  padding: 3.5rem 0 2rem 0;
  margin-top: auto;
}

.footer-container {
  max-width: 1440px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.footer-top {
  display: grid;
  grid-template-columns: 2fr 1fr 1fr;
  gap: 2.5rem;
  margin-bottom: 2.5rem;
}

.footer-brand {
  max-width: 440px;
}

.footer-logo {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  margin-bottom: 0.9rem;
}

.footer-logo-img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: contain;
}

.footer-brand-text {
  font-family: 'Outfit', sans-serif;
  font-weight: 800;
  font-size: 1.25rem;
}

.text-white { color: #fff; }
.text-red { color: #e50914; }
.text-dim { color: #64748b; }

.footer-kanji {
  font-size: 0.7rem;
  color: #ef4444;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.25);
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 600;
}

.footer-desc {
  font-size: 0.85rem;
  color: #94a3b8;
  line-height: 1.6;
}

.footer-links-col h4 {
  font-size: 0.92rem;
  font-weight: 700;
  color: #fff;
  margin-bottom: 1rem;
}

.footer-links-col ul {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.footer-links-col a {
  color: #94a3b8;
  font-size: 0.82rem;
  text-decoration: none;
  transition: color 0.15s ease;
}

.footer-links-col a:hover {
  color: #fff;
}

.footer-bottom {
  border-top: 1px solid #1e2230;
  padding-top: 1.8rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.78rem;
  color: #64748b;
  flex-wrap: wrap;
  gap: 1rem;
}

.footer-status-pill {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.25);
  padding: 3px 9px;
  border-radius: 9999px;
  color: #10b981;
  font-weight: 600;
  font-size: 0.72rem;
}

.status-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 6px #10b981;
}

@media (max-width: 900px) {
  .app-root {
    padding-bottom: calc(65px + env(safe-area-inset-bottom, 0px));
  }
}

@media (max-width: 768px) {
  .footer-top {
    grid-template-columns: 1fr;
    gap: 2rem;
  }
}
</style>
