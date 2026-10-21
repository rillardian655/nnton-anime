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
