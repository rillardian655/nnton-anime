<template>
  <div class="app-root">
    <!-- Cinematic Door Opening Splash Screen -->
    <DoorSplashScreen />

    <!-- 1. VIP Gatekeeper: Displayed when not authenticated (cannot bypass to Beranda) -->
    <VipGatekeeper v-if="!isAuthenticated && !authLoading" />

    <!-- 2. Authenticated App Experience: Only unlocked after successful login or claiming invite -->
    <template v-else-if="isAuthenticated">
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
    </template>

    <!-- Initial auth loading indicator -->
    <div v-else class="gate-loading-placeholder">
      <div class="spinner-auth"></div>
      <p>Memverifikasi akses VIP...</p>
    </div>
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
import VipGatekeeper from './components/VipGatekeeper.vue';
import { checkAuth, checkInviteUrl, isAuthenticated, isAdmin, authLoading, showLoginModal } from './stores/auth.js';

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

.gate-loading-placeholder {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background: #08090d;
  color: #94a3b8;
  font-size: 0.9rem;
  z-index: 1000;
}

.spinner-auth {
  width: 36px;
  height: 36px;
  border: 3px solid rgba(255, 40, 81, 0.2);
  border-top-color: #ff2851;
  border-radius: 50%;
  animation: spin-auth 0.8s linear infinite;
}

@keyframes spin-auth {
  to { transform: rotate(360deg); }
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
