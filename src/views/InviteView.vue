<template>
  <div class="invite-page">
    <div class="invite-redirect-card">
      <span class="spinner-large"></span>
      <h2>Mempersiapkan Undangan VIP...</h2>
      <p>Mohon tunggu sebentar, kami sedang mengarahkan kamu ke aktivasi akun.</p>
    </div>
  </div>
</template>

<script setup>
import { onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { checkInviteUrl } from '../stores/auth.js';

const route = useRoute();
const router = useRouter();

onMounted(() => {
  const code = route.query.code || route.query.invite;
  if (code) {
    checkInviteUrl(code);
  }
  router.replace({ path: '/', query: code ? { invite: code } : {} });
});
</script>

<style scoped>
.invite-page {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 80vh;
  padding: 2rem;
}

.invite-redirect-card {
  text-align: center;
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 16px;
  padding: 3rem 2rem;
  max-width: 450px;
}

.invite-redirect-card h2 {
  font-size: 1.3rem;
  margin: 1rem 0 0.5rem 0;
  color: #fff;
}

.invite-redirect-card p {
  color: #94a3b8;
  font-size: 0.88rem;
}

.spinner-large {
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.2);
  border-top-color: #e50914;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
