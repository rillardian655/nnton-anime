<template>
  <div class="modal-overlay" v-if="showLoginModal" @click.self="showLoginModal = false">
    <div class="login-card">
      <button class="modal-close-btn" @click="showLoginModal = false" aria-label="Tutup">✕</button>

      <!-- Logo & Header -->
      <div class="login-header">
        <img src="/logo.png" alt="AniPulse Logo" class="login-logo-img" />
        <h2 class="login-title">Masuk ke AniPulse</h2>
        <p class="login-subtitle">Platform Streaming Anime VIP Tanpa Iklan</p>
      </div>

      <!-- Error Alert -->
      <div v-if="errorMessage" class="error-alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Login Form -->
      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="loginUsername">Nama Pengguna (Username)</label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <input 
              id="loginUsername" 
              v-model="username" 
              type="text" 
              placeholder="Masukkan username kamu..." 
              required 
              autocomplete="username"
              autofocus
            />
          </div>
        </div>

        <div class="form-group">
          <label for="loginPassword">Kata Sandi (Password)</label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <input 
              id="loginPassword" 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              placeholder="Masukkan password..." 
              required 
              autocomplete="current-password"
            />
            <button type="button" class="toggle-pw-btn" @click="showPassword = !showPassword">
              {{ showPassword ? 'Sembunyi' : 'Lihat' }}
            </button>
          </div>
        </div>

        <button type="submit" class="btn btn-primary submit-btn" :disabled="isLoading">
          <span v-if="isLoading" class="spinner-small"></span>
          <span>{{ isLoading ? 'Memproses...' : 'Masuk Sekarang' }}</span>
        </button>
      </form>

      <!-- Explanatory Notice (No Register Allowed) -->
      <div class="invite-notice-box">
        <div class="invite-notice-title">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          <span>Akses Privat Via Undangan</span>
        </div>
        <p class="invite-notice-text">
          Aplikasi ini tidak memiliki pendaftaran terbuka. Akun baru hanya dapat diaktifkan melalui <strong>Link Undangan 1x Pakai</strong> yang dibuat khusus oleh Admin di WhatsApp.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { showLoginModal, loginUser } from '../stores/auth.js';

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');

async function handleLogin() {
  if (!username.value.trim() || !password.value.trim()) return;
  isLoading.value = true;
  errorMessage.value = '';
  try {
    await loginUser(username.value.trim(), password.value.trim());
    username.value = '';
    password.value = '';
  } catch (err) {
    errorMessage.value = err.message || 'Gagal masuk. Periksa kembali nama pengguna dan sandi.';
  } finally {
    isLoading.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.78);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.login-card {
  position: relative;
  background: #12141c;
  border: 1px solid #2a3044;
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.8), 0 0 0 1px rgba(229, 9, 20, 0.15);
  border-radius: 16px;
  width: 100%;
  max-width: 420px;
  padding: 2.2rem 2rem;
  color: #fff;
  animation: scaleUp 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}

.modal-close-btn {
  position: absolute;
  top: 1.2rem;
  right: 1.2rem;
  background: rgba(255, 255, 255, 0.08);
  border: none;
  color: #94a3b8;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s ease;
}

.modal-close-btn:hover {
  background: rgba(239, 68, 68, 0.2);
  color: #ef4444;
}

.login-header {
  text-align: center;
  margin-bottom: 1.8rem;
}

.login-logo-img {
  width: 58px;
  height: 58px;
  object-fit: contain;
  margin: 0 auto 0.75rem auto;
  border-radius: 12px;
  filter: drop-shadow(0 4px 16px rgba(229, 9, 20, 0.5));
}

.login-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.01em;
  color: #fff;
}

.login-subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 0.25rem;
}

.error-alert {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  font-size: 0.82rem;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.2rem;
  line-height: 1.4;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-group label {
  font-size: 0.82rem;
  font-weight: 600;
  color: #cbd5e1;
}

.input-wrap {
  position: relative;
  display: flex;
  align-items: center;
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 10px;
  padding: 0 0.85rem;
  transition: all 0.2s ease;
}

.input-wrap:focus-within {
  border-color: #e50914;
  box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.15);
}

.input-icon {
  color: #64748b;
  flex-shrink: 0;
  margin-right: 0.5rem;
}

.input-wrap input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: #fff;
  font-size: 0.9rem;
  padding: 0.7rem 0;
  font-family: inherit;
}

.input-wrap input::placeholder {
  color: #475569;
}

.toggle-pw-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.75rem;
  cursor: pointer;
  padding: 0.2rem 0.4rem;
}

.toggle-pw-btn:hover {
  color: #fff;
}

.submit-btn {
  margin-top: 0.5rem;
  padding: 0.75rem;
  font-size: 0.95rem;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 10px;
}

.invite-notice-box {
  margin-top: 1.5rem;
  padding: 0.85rem 1rem;
  background: rgba(234, 179, 8, 0.06);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: 10px;
}

.invite-notice-title {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.78rem;
  font-weight: 700;
  color: #eab308;
  margin-bottom: 0.25rem;
}

.invite-notice-text {
  font-size: 0.76rem;
  color: #94a3b8;
  line-height: 1.4;
}

.spinner-small {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
