<template>
  <div 
    v-if="isVisible" 
    class="door-splash-container"
    :class="{ 'is-dismissing': isDismissing }"
    @click="dismissSplash"
    title="Klik untuk lewati intro"
  >
    <!-- Background Cinema Void with Soft Clean Ambient Tone (No heavy AI red flare) -->
    <div class="splash-background">
      <div class="ambient-glow"></div>
      <div class="cinema-light-beam"></div>
    </div>

    <!-- Center Content: Logo and Brand (Clean & Elegant Reveal) -->
    <div class="splash-center-content">
      <div class="logo-wrapper">
        <div class="logo-soft-glow"></div>
        <div class="logo-circle-badge">
          <img src="/logo.png" alt="AniPulse Logo" class="splash-logo-img" />
        </div>
      </div>

      <div class="brand-text-wrapper">
        <h1 class="brand-title">
          <span class="text-white">ANI</span><span class="text-red">PULSE</span>
        </h1>
        <div class="brand-badge-row">
          <span class="brand-kanji">アニメ</span>
          <span class="brand-tagline">CINEMA STREAMING VIP</span>
        </div>
      </div>

      <!-- Minimalist Cinema Progress Bar -->
      <div class="splash-loader-bar">
        <div class="loader-track"></div>
      </div>
      <span class="splash-status-text">MEMASUKI THEATER...</span>
    </div>

    <!-- The Left Door Panel (Sleek Matte Cinema Door) -->
    <div class="door-panel door-left">
      <div class="door-inner-texture">
        <div class="door-panel-recess">
          <span class="door-sign">STUDIO 1</span>
        </div>
        <!-- Realistic Brushed Metal Vertical Handle -->
        <div class="door-handle handle-left">
          <div class="handle-core"></div>
        </div>
      </div>
      <div class="door-edge-trim"></div>
    </div>

    <!-- The Right Door Panel (Sleek Matte Cinema Door) -->
    <div class="door-panel door-right">
      <div class="door-inner-texture">
        <div class="door-panel-recess">
          <span class="door-sign">VIP THEATER</span>
        </div>
        <!-- Realistic Brushed Metal Vertical Handle -->
        <div class="door-handle handle-right">
          <div class="handle-core"></div>
        </div>
      </div>
      <div class="door-edge-trim"></div>
    </div>

    <!-- Realistic Center Door Seam (Soft light seep, NO burning red laser) -->
    <div class="center-seam-light"></div>

    <!-- Sleek Minimalist Glassmorphic Lock (Strictly No Emojis, Clean Silver & Charcoal) -->
    <div class="central-lock-container">
      <div class="central-lock-core">
        <div class="lock-core-ring">
          <svg class="lock-icon-svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <!-- Lock Shackle that animates upward when unlocked -->
            <path class="lock-shackle" d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
        </div>
      </div>
      <div class="lock-label">
        <span class="lock-status-dot"></span>
        <span class="lock-text">PINTU THEATER</span>
      </div>
    </div>

    <!-- Quick Skip Button removed per user request: plays full intro on app launch -->
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';

// Always show on app launch / full page reload
const isVisible = ref(true);
const isDismissing = ref(false);

function dismissSplash() {
  if (isDismissing.value) return;
  isDismissing.value = true;
  setTimeout(() => {
    isVisible.value = false;
  }, 250);
}

onMounted(() => {
  // Clear any legacy sessionStorage flags
  try {
    sessionStorage.removeItem('anipulse_splash_played');
  } catch (e) {
    // Ignore storage errors in restricted contexts
  }

  // Timeline:
  // 0.0s - 1.7s: Realistic matte double cinema doors closed with brushed handles
  // 1.7s - 2.0s: Padlock shackle clicks open
  // 2.0s - 3.1s: Double doors slide apart cleanly
  // 2.5s - 3.8s: Clean AniPulse logo appears in center
  // 3.8s - 4.4s: Smooth cinema fadeout to home screen
  const timer = setTimeout(() => {
    isVisible.value = false;
  }, 4400);

  return () => clearTimeout(timer);
});
</script>

<style scoped>
/* ================= Base Container ================= */
.door-splash-container {
  position: fixed;
  inset: 0;
  z-index: 99999;
  overflow: hidden;
  background: #08090d;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  cursor: pointer;
  animation: splashFadeout 4.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.door-splash-container.is-dismissing {
  opacity: 0 !important;
  pointer-events: none !important;
  transition: opacity 0.25s ease-out !important;
}

/* ================= Background: Subtle Cinema Dark (No AI red wash) ================= */
.splash-background {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: radial-gradient(circle at center, #11141d 0%, #08090d 65%, #040507 100%);
}

.ambient-glow {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 500px;
  height: 500px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 255, 255, 0.06) 0%, rgba(229, 9, 20, 0.08) 35%, transparent 70%);
  filter: blur(50px);
  pointer-events: none;
}

.cinema-light-beam {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 700px;
  height: 700px;
  transform: translate(-50%, -50%);
  background: radial-gradient(circle, rgba(255, 255, 255, 0.12) 0%, rgba(255, 255, 255, 0.03) 40%, transparent 65%);
  filter: blur(40px);
  animation: beamSequence 4.4s ease-out forwards;
}

/* ================= Center Content: Clean Logo & Brand ================= */
.splash-center-content {
  position: relative;
  z-index: 5;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 0 1.5rem;
  animation: logoRevealAnim 4.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.logo-wrapper {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-soft-glow {
  position: absolute;
  inset: -14px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(229, 9, 20, 0.3) 0%, transparent 70%);
  animation: softPulse 2.5s infinite ease-in-out;
}

.logo-circle-badge {
  width: 86px;
  height: 86px;
  border-radius: 50%;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #ffffff;
  box-shadow: 0 10px 35px rgba(0, 0, 0, 0.8), 0 0 15px rgba(255, 255, 255, 0.15);
  position: relative;
  z-index: 2;
  border: 2px solid rgba(255, 255, 255, 0.2);
}

.splash-logo-img {
  width: 145%;
  height: 145%;
  object-fit: cover;
}

.brand-text-wrapper {
  margin-top: 1.2rem;
}

.brand-title {
  font-family: 'Outfit', 'Plus Jakarta Sans', sans-serif;
  font-size: clamp(2.2rem, 6.5vw, 2.85rem);
  font-weight: 800;
  letter-spacing: 0.15em;
  line-height: 1.1;
  text-shadow: 0 4px 20px rgba(0, 0, 0, 0.9);
}

.text-white {
  color: #ffffff;
}

.text-red {
  color: #e50914;
}

.brand-badge-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.6rem;
  margin-top: 0.45rem;
}

.brand-kanji {
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.15);
  color: #f1f5f9;
  font-size: 0.74rem;
  font-weight: 700;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  letter-spacing: 0.08em;
}

.brand-tagline {
  font-size: 0.72rem;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.2em;
}

.splash-loader-bar {
  width: 130px;
  height: 2.5px;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 9999px;
  margin-top: 1.5rem;
  overflow: hidden;
  position: relative;
}

.loader-track {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 100%;
  background: linear-gradient(90deg, transparent, #ffffff, #e50914, transparent);
  animation: sweepLoader 1.4s infinite ease-in-out;
}

.splash-status-text {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: #64748b;
  margin-top: 0.75rem;
}

/* ================= The Sleek Matte Cinema Doors ================= */
.door-panel {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 50.15vw;
  z-index: 10;
  background: linear-gradient(135deg, #13161f 0%, #0b0c10 50%, #101219 100%);
  will-change: transform;
  overflow: hidden;
  box-shadow: inset 0 0 50px rgba(0, 0, 0, 0.95);
}

.door-left {
  left: 0;
  border-right: 1px solid rgba(255, 255, 255, 0.12);
  animation: doorSlideLeft 4.4s cubic-bezier(0.77, 0, 0.175, 1) forwards;
}

.door-right {
  right: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.12);
  animation: doorSlideRight 4.4s cubic-bezier(0.77, 0, 0.175, 1) forwards;
}

.door-inner-texture {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
}

.door-panel-recess {
  position: absolute;
  top: 10%;
  bottom: 10%;
  left: 12%;
  right: 12%;
  border: 1px solid rgba(255, 255, 255, 0.04);
  background: rgba(0, 0, 0, 0.18);
  border-radius: 6px;
  box-shadow: inset 0 0 25px rgba(0, 0, 0, 0.7);
  display: flex;
  justify-content: center;
}

.door-sign {
  font-family: 'Outfit', sans-serif;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.26em;
  color: rgba(255, 255, 255, 0.2);
  margin-top: 2.2rem;
  display: inline-block;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.8);
}

/* Realistic Brushed Titanium Door Handles */
.door-handle {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 12;
}

.handle-left {
  right: 22px;
}

.handle-right {
  left: 22px;
}

.handle-core {
  width: 6px;
  height: 120px;
  border-radius: 9999px;
  background: linear-gradient(180deg, #475569 0%, #94a3b8 50%, #334155 100%);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.8), inset 0 1px 1px rgba(255, 255, 255, 0.4);
  border: 1px solid rgba(255, 255, 255, 0.15);
}

/* ================= Realistic Subtle Door Seam Light ================= */
.center-seam-light {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 50%;
  width: 2px;
  transform: translateX(-50%);
  background: linear-gradient(180deg, transparent, rgba(255, 255, 255, 0.6) 40%, rgba(255, 255, 255, 0.6) 60%, transparent);
  box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
  z-index: 18;
  animation: seamLightAnim 4.4s cubic-bezier(0.77, 0, 0.175, 1) forwards;
}

/* ================= Minimalist Glassmorphic Lock ================= */
.central-lock-container {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 25;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  pointer-events: none;
  animation: lockContainerAnim 4.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}

.central-lock-core {
  position: relative;
  width: 68px;
  height: 68px;
  border-radius: 50%;
  background: rgba(18, 21, 29, 0.88);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border: 1.5px solid rgba(255, 255, 255, 0.18);
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.75), inset 0 1px 2px rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #e2e8f0;
  animation: lockCoreFeedback 4.4s ease forwards;
}

.lock-shackle {
  transform-origin: 7px 11px;
  animation: unlockShackle 4.4s ease forwards;
}

.lock-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(18, 21, 29, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 9999px;
  padding: 0.35rem 0.85rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.18em;
  color: #cbd5e1;
  box-shadow: 0 4px 18px rgba(0, 0, 0, 0.7);
  animation: lockLabelFade 4.4s ease forwards;
}

.lock-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #94a3b8;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.5);
  animation: dotGlow 1.5s infinite ease-in-out;
}

/* ================= Skip Button ================= */
.splash-skip-btn {
  position: absolute;
  top: 1.5rem;
  right: 1.5rem;
  z-index: 30;
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(18, 21, 29, 0.75);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.14);
  color: #94a3b8;
  font-size: 0.76rem;
  font-weight: 600;
  padding: 0.4rem 0.85rem;
  border-radius: 9999px;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.6);
}

.splash-skip-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  border-color: rgba(255, 255, 255, 0.3);
  color: #ffffff;
  transform: translateY(-1px);
}

/* ================= CLEAN ANIMATION TIMELINE ================= */
/* 
   Timeline: 4.4s total
   0%  to 38%  (0.0s - 1.67s): Sleek matte doors CLOSED, subtle lock active
   38% to 65%  (1.67s - 2.86s): Shackle clicks open, doors slide smoothly left & right
   52% to 86%  (2.28s - 3.78s): Logo revealed cleanly without AI oversaturation
   86% to 100% (3.78s - 4.40s): Clean fade out into app
*/

@keyframes doorSlideLeft {
  0% { transform: translateX(0); }
  38% { transform: translateX(0); }
  65% { transform: translateX(-102%); }
  100% { transform: translateX(-102%); }
}

@keyframes doorSlideRight {
  0% { transform: translateX(0); }
  38% { transform: translateX(0); }
  65% { transform: translateX(102%); }
  100% { transform: translateX(102%); }
}

@keyframes seamLightAnim {
  0% { opacity: 0.7; transform: translateX(-50%) scaleX(1); }
  36% { opacity: 0.7; transform: translateX(-50%) scaleX(1); }
  42% { opacity: 1; transform: translateX(-50%) scaleX(6); }
  50% { opacity: 0; transform: translateX(-50%) scaleX(12); }
  100% { opacity: 0; }
}

@keyframes lockCoreFeedback {
  0% {
    color: #e2e8f0;
    border-color: rgba(255, 255, 255, 0.18);
  }
  36% {
    color: #e2e8f0;
    border-color: rgba(255, 255, 255, 0.18);
  }
  40% {
    color: #4ade80;
    border-color: rgba(74, 222, 128, 0.5);
    box-shadow: 0 8px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(74, 222, 128, 0.3);
  }
  50% {
    opacity: 1;
    transform: scale(1.08);
  }
  58% {
    opacity: 0;
    transform: scale(1.35);
  }
  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

@keyframes unlockShackle {
  0%, 36% { transform: translateY(0); }
  40% { transform: translateY(-5px) rotate(-18deg); }
  100% { transform: translateY(-5px) rotate(-18deg); }
}

@keyframes lockLabelFade {
  0%, 38% { opacity: 1; }
  48% { opacity: 0; transform: translateY(6px); }
  100% { opacity: 0; }
}

@keyframes lockContainerAnim {
  0%, 38% { opacity: 1; }
  58% { opacity: 0; pointer-events: none; }
  100% { opacity: 0; pointer-events: none; }
}

@keyframes logoRevealAnim {
  0%, 36% {
    opacity: 0;
    transform: scale(0.75);
    pointer-events: none;
  }
  44% {
    opacity: 0.5;
    transform: scale(0.9);
  }
  62% {
    opacity: 1;
    transform: scale(1.03);
  }
  72% {
    opacity: 1;
    transform: scale(1);
  }
  86% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes beamSequence {
  0%, 36% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
  50% { opacity: 0.8; transform: translate(-50%, -50%) scale(0.85); }
  72% { opacity: 0.4; transform: translate(-50%, -50%) scale(1.05); }
  100% { opacity: 0; transform: translate(-50%, -50%) scale(1.2); }
}

@keyframes splashFadeout {
  0%, 86% {
    opacity: 1;
    pointer-events: all;
  }
  99% {
    opacity: 0;
    pointer-events: none;
  }
  100% {
    opacity: 0;
    pointer-events: none;
    visibility: hidden;
  }
}

@keyframes softPulse {
  0%, 100% { opacity: 0.4; transform: scale(0.96); }
  50% { opacity: 0.7; transform: scale(1.05); }
}

@keyframes sweepLoader {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@keyframes dotGlow {
  0%, 100% { opacity: 0.5; transform: scale(0.9); }
  50% { opacity: 1; transform: scale(1.15); }
}

/* ================= Mobile Adjustments ================= */
@media (max-width: 640px) {
  .logo-circle-badge {
    width: 78px;
    height: 78px;
  }
  .brand-title {
    font-size: 2.1rem;
  }
  .central-lock-core {
    width: 62px;
    height: 62px;
  }
  .door-panel-recess {
    left: 8%;
    right: 8%;
  }
  .handle-left {
    right: 14px;
  }
  .handle-right {
    left: 14px;
  }
  .splash-skip-btn {
    top: 1rem;
    right: 1rem;
    padding: 0.35rem 0.75rem;
    font-size: 0.72rem;
  }
}
</style>
