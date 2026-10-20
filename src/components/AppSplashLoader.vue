<template>
  <transition name="splash-fade">
    <div v-if="isVisible" class="splash-screen-root" id="appSplashLoader">
      <!-- Ambient Studio Lighting -->
      <div class="ambient-glow"></div>
      <div class="radial-vignette"></div>

      <!-- Main Animated Brand Container -->
      <div class="splash-card">
        <!-- Logo Badge with Shimmer & Pulse Aura -->
        <div class="logo-aura-wrapper">
          <div class="pulse-ring pulse-ring-1"></div>
          <div class="pulse-ring pulse-ring-2"></div>
          
          <div class="logo-badge">
            <img src="/logo.png" alt="AniPulse Logo" class="splash-logo-img" />
            <!-- Specular Shimmer Sweep -->
            <div class="logo-shimmer-sweep"></div>
          </div>
        </div>

        <!-- Typography Branding -->
        <div class="brand-heading">
          <div class="brand-title">
            <span class="text-white">ANI</span><span class="text-red">PULSE</span>
          </div>
          <div class="brand-tagline">
            <span class="sub-kanji">アニメストリーミング</span>
            <span class="sub-dot">•</span>
            <span class="sub-text">VIP CINEMA EXPERIENCE</span>
          </div>
        </div>

        <!-- High-Precision Animated Progress Bar -->
        <div class="progress-box">
          <div class="progress-track">
            <div class="progress-fill" :style="{ width: `${progress}%` }">
              <div class="progress-glow-head"></div>
            </div>
          </div>

          <div class="progress-meta">
            <span class="status-indicator">
              <span class="live-dot"></span>
              {{ currentStatusText }}
            </span>
            <span class="percent-counter">{{ Math.round(progress) }}%</span>
          </div>
        </div>

        <!-- Curated Professional Anime Trivia / Tip Carousel (No Emojis) -->
        <div class="trivia-box">
          <transition name="trivia-fade" mode="out-in">
            <div :key="currentTipIndex" class="trivia-content">
              <span class="trivia-label">{{ triviaList[currentTipIndex].category }}</span>
              <p class="trivia-text">{{ triviaList[currentTipIndex].text }}</p>
            </div>
          </transition>
          <div class="trivia-indicators">
            <span 
              v-for="(_, idx) in triviaList" 
              :key="idx" 
              class="dot-indicator" 
              :class="{ active: idx === currentTipIndex }"
            ></span>
          </div>
        </div>
      </div>
    </div>
  </transition>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({
  minDuration: {
    type: Number,
    default: 2000 // 2.0s optimal splash intro
  }
});

const emit = defineEmits(['loaded']);

const isVisible = ref(true);
const progress = ref(8);
const currentStatusText = ref('Menyiapkan koneksi streaming...');
const currentTipIndex = ref(0);

const triviaList = [
  {
    category: 'INFO STREAMING',
    text: 'AniPulse menggunakan arsitektur direct HLS CDN berkecepatan tinggi untuk pemutaran video tanpa jeda buffering.'
  },
  {
    category: 'FITUR VIP',
    text: 'Riwayat tontonan dan bookmark kamu tersimpan otomatis secara real-time di perangkat ini.'
  },
  {
    category: 'TRIVIA ANIME',
    text: 'Anime pertama yang ditayangkan di televisi dalam format serial mingguan adalah Astro Boy (Tetsuwan Atom) pada tahun 1963.'
  },
  {
    category: 'TIPS PENGGUNA',
    text: 'Kamu dapat memilih kualitas video 1080p, 720p, atau 480p di pemutar film sesuai kecepatan koneksi internet.'
  }
];

let progressTimer = null;
let triviaTimer = null;

function startSplashSequence(duration = 2400) {
  isVisible.value = true;
  progress.value = 5;
  currentStatusText.value = 'Menyiapkan koneksi streaming...';
  
  if (progressTimer) clearInterval(progressTimer);
  if (triviaTimer) clearInterval(triviaTimer);

  triviaTimer = setInterval(() => {
    currentTipIndex.value = (currentTipIndex.value + 1) % triviaList.length;
  }, 1600);

  const startTime = Date.now();
  progressTimer = setInterval(() => {
    const elapsed = Date.now() - startTime;
    const ratio = Math.min(1, elapsed / duration);
    
    // Ease-out progress curve
    progress.value = Math.min(100, Math.floor(8 + 92 * (1 - Math.pow(1 - ratio, 2))));

    if (progress.value > 25 && progress.value <= 60) {
      currentStatusText.value = 'Memuat katalog anime VIP Sub Indo...';
    } else if (progress.value > 60 && progress.value < 95) {
      currentStatusText.value = 'Mengoptimalkan pemutar video & HLS player...';
    } else if (progress.value >= 95) {
      currentStatusText.value = 'Selamat datang di AniPulse VIP';
    }

    if (ratio >= 1 && progress.value >= 100) {
      clearInterval(progressTimer);
      clearInterval(triviaTimer);
      setTimeout(() => {
        isVisible.value = false;
        emit('loaded');
      }, 350);
    }
  }, 35);
}

onMounted(() => {
  startSplashSequence(props.minDuration);
  if (typeof window !== 'undefined') {
    window.__showSplash = (d) => startSplashSequence(d || 3000);
  }
});

onUnmounted(() => {
  if (progressTimer) clearInterval(progressTimer);
  if (triviaTimer) clearInterval(triviaTimer);
});
</script>

<style scoped>
.splash-screen-root {
  position: fixed;
  inset: 0;
  background-color: #07090e;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  user-select: none;
}

/* Ambient Studio Glows */
.ambient-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 520px;
  height: 520px;
  background: radial-gradient(circle, rgba(229, 9, 20, 0.22) 0%, rgba(185, 28, 28, 0.08) 40%, transparent 70%);
  filter: blur(60px);
  pointer-events: none;
  animation: breathe 3.5s ease-in-out infinite alternate;
}

.radial-vignette {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, transparent 40%, rgba(0, 0, 0, 0.8) 100%);
  pointer-events: none;
}

@keyframes breathe {
  0% { transform: translate(-50%, -50%) scale(0.9); opacity: 0.7; }
  100% { transform: translate(-50%, -50%) scale(1.15); opacity: 1; }
}

/* Main Card */
.splash-card {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 440px;
  width: 90%;
  text-align: center;
  z-index: 2;
  padding: 2rem 1.5rem;
}

/* Logo Badge & Aura */
.logo-aura-wrapper {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.75rem;
}

.pulse-ring {
  position: absolute;
  inset: -12px;
  border-radius: 50%;
  border: 1px solid rgba(229, 9, 20, 0.4);
  pointer-events: none;
  animation: pulseOut 2.2s cubic-bezier(0.2, 0.8, 0.2, 1) infinite;
}

.pulse-ring-2 {
  inset: -24px;
  animation-delay: 0.7s;
  border-color: rgba(229, 9, 20, 0.25);
}

@keyframes pulseOut {
  0% { transform: scale(0.7); opacity: 0.8; }
  100% { transform: scale(1.35); opacity: 0; }
}

.logo-badge {
  position: relative;
  width: 84px;
  height: 84px;
  border-radius: 20px;
  background: linear-gradient(145deg, #161922, #0d0f17);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 
    0 12px 32px rgba(0, 0, 0, 0.8),
    0 0 24px rgba(229, 9, 20, 0.35),
    inset 0 1px 0 rgba(255, 255, 255, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.splash-logo-img {
  width: 58px;
  height: 58px;
  object-fit: contain;
  filter: drop-shadow(0 4px 12px rgba(229, 9, 20, 0.5));
  position: relative;
  z-index: 1;
}

/* Logo Shimmer Beam Effect */
.logo-shimmer-sweep {
  position: absolute;
  top: -50%;
  left: -100%;
  width: 200%;
  height: 200%;
  background: linear-gradient(
    115deg,
    transparent 20%,
    rgba(255, 255, 255, 0.05) 40%,
    rgba(255, 255, 255, 0.45) 50%,
    rgba(255, 255, 255, 0.05) 60%,
    transparent 80%
  );
  transform: rotate(25deg);
  animation: logoShimmer 2.4s ease-in-out infinite;
  pointer-events: none;
  z-index: 2;
}

@keyframes logoShimmer {
  0% { transform: translateX(-100%) rotate(25deg); }
  60%, 100% { transform: translateX(100%) rotate(25deg); }
}

/* Brand Heading */
.brand-heading {
  margin-bottom: 2rem;
}

.brand-title {
  font-family: 'Outfit', sans-serif;
  font-size: 2.1rem;
  font-weight: 900;
  letter-spacing: 0.12em;
  line-height: 1;
  margin-bottom: 0.5rem;
  text-shadow: 0 0 20px rgba(229, 9, 20, 0.5);
}

.text-white { color: #ffffff; }
.text-red { color: #e50914; }

.brand-tagline {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: #94a3b8;
  letter-spacing: 0.14em;
  font-weight: 600;
}

.sub-kanji {
  color: #ef4444;
  background: rgba(229, 9, 20, 0.12);
  border: 1px solid rgba(229, 9, 20, 0.25);
  padding: 1px 5px;
  border-radius: 4px;
}

.sub-dot {
  color: #475569;
}

/* Progress Section */
.progress-box {
  width: 100%;
  max-width: 320px;
  margin-bottom: 1.75rem;
}

.progress-track {
  width: 100%;
  height: 4px;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 9999px;
  overflow: hidden;
  position: relative;
  box-shadow: inset 0 1px 2px rgba(0, 0, 0, 0.5);
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #991b1b 0%, #e50914 65%, #ff4d58 100%);
  border-radius: 9999px;
  position: relative;
  transition: width 0.12s ease-out;
  box-shadow: 0 0 10px rgba(229, 9, 20, 0.8);
}

.progress-glow-head {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 8px;
  height: 8px;
  background: #ffffff;
  border-radius: 50%;
  box-shadow: 0 0 10px #ffffff, 0 0 16px #e50914;
}

.progress-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.75rem;
  font-size: 0.75rem;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #94a3b8;
  font-weight: 500;
}

.live-dot {
  width: 6px;
  height: 6px;
  background: #10b981;
  border-radius: 50%;
  box-shadow: 0 0 6px #10b981;
  animation: blink 1.2s ease-in-out infinite;
}

@keyframes blink {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.85); }
}

.percent-counter {
  font-family: 'Space Grotesk', monospace;
  color: #cbd5e1;
  font-weight: 700;
  letter-spacing: 0.04em;
}

/* Trivia Section */
.trivia-box {
  min-height: 68px;
  max-width: 380px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  padding-top: 1.1rem;
}

.trivia-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.3rem;
}

.trivia-label {
  font-size: 0.65rem;
  font-weight: 800;
  color: #e50914;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.trivia-text {
  font-size: 0.76rem;
  color: #94a3b8;
  line-height: 1.45;
  margin: 0;
  max-width: 360px;
}

.trivia-indicators {
  display: flex;
  gap: 5px;
  margin-top: 0.75rem;
}

.dot-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  transition: all 0.3s ease;
}

.dot-indicator.active {
  width: 14px;
  border-radius: 4px;
  background: #e50914;
}

/* Trivia Transitions */
.trivia-fade-enter-active,
.trivia-fade-leave-active {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.trivia-fade-enter-from {
  opacity: 0;
  transform: translateY(6px);
}

.trivia-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

/* Splash Exit Transition */
.splash-fade-leave-active {
  transition: opacity 0.45s ease, transform 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}

.splash-fade-leave-to {
  opacity: 0;
  transform: scale(1.03);
}
</style>
