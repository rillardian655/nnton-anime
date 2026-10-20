<template>
  <div class="skeleton-grid-root">
    <!-- Optional Hero Skeleton if requested -->
    <div v-if="showHero" class="skeleton-hero">
      <div class="skeleton-shimmer"></div>
      <div class="skeleton-hero-content">
        <div class="skeleton-pill w-32"></div>
        <div class="skeleton-line-title"></div>
        <div class="skeleton-line-desc"></div>
        <div class="skeleton-line-desc w-60"></div>
        <div class="skeleton-btn-row">
          <div class="skeleton-btn"></div>
          <div class="skeleton-btn w-28"></div>
        </div>
      </div>
    </div>

    <!-- Cards Grid -->
    <div class="skeleton-cards-grid">
      <div 
        v-for="n in count" 
        :key="n" 
        class="skeleton-card"
      >
        <div class="skeleton-poster-wrap">
          <div class="skeleton-shimmer"></div>
          
          <!-- Mock Badges -->
          <div class="skeleton-badge-top-left"></div>
          <div class="skeleton-badge-top-right"></div>
        </div>

        <div class="skeleton-meta">
          <div class="skeleton-text-line w-85">
            <div class="skeleton-shimmer"></div>
          </div>
          <div class="skeleton-text-line w-45">
            <div class="skeleton-shimmer"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  count: {
    type: Number,
    default: 12
  },
  showHero: {
    type: Boolean,
    default: false
  }
});
</script>

<style scoped>
.skeleton-grid-root {
  width: 100%;
}

/* Hero Skeleton */
.skeleton-hero {
  position: relative;
  width: 100%;
  height: 420px;
  background: #11141e;
  border-radius: 16px;
  overflow: hidden;
  margin-bottom: 2.5rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
  display: flex;
  align-items: flex-end;
  padding: 3rem;
}

.skeleton-hero-content {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
  width: 100%;
  max-width: 500px;
  z-index: 2;
}

.skeleton-pill {
  height: 24px;
  border-radius: 9999px;
  background: #1e2436;
}

.skeleton-line-title {
  height: 38px;
  width: 75%;
  border-radius: 8px;
  background: #1e2436;
}

.skeleton-line-desc {
  height: 14px;
  width: 90%;
  border-radius: 6px;
  background: #1e2436;
}

.skeleton-btn-row {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.skeleton-btn {
  height: 42px;
  width: 130px;
  border-radius: 8px;
  background: #1e2436;
}

/* Cards Grid */
.skeleton-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1.5rem;
  width: 100%;
}

.skeleton-card {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.skeleton-poster-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 2 / 3;
  background: #121520;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.04);
}

.skeleton-badge-top-left {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 44px;
  height: 20px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}

.skeleton-badge-top-right {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 20px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}

.skeleton-meta {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.skeleton-text-line {
  position: relative;
  height: 14px;
  border-radius: 4px;
  background: #151926;
  overflow: hidden;
}

.w-85 { width: 85%; }
.w-60 { width: 60%; }
.w-45 { width: 45%; }
.w-32 { width: 120px; }
.w-28 { width: 110px; }

/* Silky Continuous Shimmer Wave Animation */
.skeleton-shimmer {
  position: absolute;
  inset: 0;
  transform: translateX(-100%);
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.03) 25%,
    rgba(255, 255, 255, 0.08) 50%,
    rgba(255, 255, 255, 0.03) 75%,
    rgba(255, 255, 255, 0) 100%
  );
  animation: shimmerWave 1.6s cubic-bezier(0.4, 0, 0.2, 1) infinite;
  pointer-events: none;
}

@keyframes shimmerWave {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

@media (max-width: 768px) {
  .skeleton-cards-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.9rem;
  }

  .skeleton-hero {
    height: 300px;
    padding: 1.5rem;
  }
}
</style>
