<template>
  <div class="modal-overlay" v-if="showLoginModal" @click.self="showLoginModal = false">
    <div class="login-card">
      <button class="modal-close-btn" @click="showLoginModal = false" aria-label="Tutup">✕</button>

      <!-- Logo & Header -->
      <div class="login-header">
        <img src="/logo.png" alt="AniPulse Logo" class="login-logo-img" />
        <h2 class="login-title">{{ authMode === 'admin' ? 'Masuk Administrator' : 'Masuk Akun VIP' }}</h2>
        <p class="login-subtitle">Akses Khusus Pengguna Terdaftar & Undangan Resmi</p>
      </div>

      <!-- Error Alert -->
      <div v-if="errorMessage" class="error-alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Success Alert -->
      <div v-if="successMessage" class="success-alert">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>
        <span>{{ successMessage }}</span>
      </div>

      <!-- 1. VIP Member Login Form -->
      <form v-if="authMode === 'login'" @submit.prevent="handleUserLogin" class="login-form">
        <!-- Username Field -->
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

        <!-- Password Field -->
        <div class="form-group">
          <label for="loginPassword">Kata Sandi</label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <input 
              id="loginPassword" 
              v-model="password" 
              :type="showPassword ? 'text' : 'password'" 
              placeholder="Masukkan kata sandi..." 
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
          <span>{{ isLoading ? 'Memverifikasi...' : 'Masuk ke Aplikasi' }}</span>
        </button>

        <!-- VIP Invite Access Box (Replaces Public Register & Google Sign-In) -->
        <div class="invite-banner-card">
          <div class="invite-banner-top">
            <svg class="invite-ticket-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
              <line x1="12" y1="9" x2="12" y2="15"></line>
            </svg>
            <div class="invite-banner-text">
              <h4>Akses Khusus Undangan (Invite Only)</h4>
              <p>Belum punya akun? Akun hanya dibuatkan langsung oleh Admin atau melalui Kode Undangan resmi.</p>
            </div>
          </div>
          <button 
            type="button" 
            class="btn-claim-invite"
            @click="handleOpenInviteModal"
          >
            Punya Kode Undangan? Klaim di Sini →
          </button>
        </div>
      </form>

      <!-- 2. Admin Login Form -->
      <form v-else-if="authMode === 'admin'" @submit.prevent="handleAdminLogin" class="login-form">
        <div class="form-group">
          <label for="adminUsername">Nama Pengguna Admin</label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
            <input 
              id="adminUsername" 
              v-model="adminUsername" 
              type="text" 
              placeholder="Masukkan username admin..." 
              required 
              autocomplete="username"
              autofocus
            />
          </div>
        </div>

        <div class="form-group">
          <label for="adminPassword">Kata Sandi Admin</label>
          <div class="input-wrap">
            <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>
            <input 
              id="adminPassword" 
              v-model="adminPassword" 
              :type="showPassword ? 'text' : 'password'" 
              placeholder="Masukkan kata sandi..." 
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
          <span>{{ isLoading ? 'Memverifikasi...' : 'Masuk Panel Administrator' }}</span>
        </button>
      </form>

      <!-- Bottom Switcher Links -->
      <div class="bottom-mode-switch">
        <button 
          v-if="authMode !== 'admin'" 
          type="button" 
          class="switch-link-btn" 
          @click="authMode = 'admin'; errorMessage = '';"
        >
          🔐 Masuk sebagai Administrator
        </button>
        <button 
          v-else 
          type="button" 
          class="switch-link-btn" 
          @click="authMode = 'login'; errorMessage = '';"
        >
          ← Kembali ke Login Pengguna
        </button>

        <!-- Optional Server URL Config (Useful for mobile LAN / custom backend) -->
        <div class="server-config-section">
          <button type="button" class="server-config-toggle" @click="showServerConfig = !showServerConfig">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>
            <span>Server: {{ currentServerUrl || 'Otomatis' }}</span>
          </button>
          <div v-if="showServerConfig" class="server-config-box">
            <input v-model="inputServerUrl" type="text" placeholder="http://192.168.1.11:8000" class="server-input" />
            <div class="server-btn-row">
              <button type="button" class="btn-save-server" @click="saveServerUrl">Simpan IP</button>
              <button type="button" class="btn-reset-server" @click="resetServerUrl">Reset Otomatis</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { 
  showLoginModal, 
  showInviteModal,
  activeInviteCode,
  inviteData,
  inviteError,
  loginUser 
} from '../stores/auth.js';
import { getApiBaseUrl, setBackendUrl } from '../api.js';

const router = useRouter();
const route = useRoute();

const authMode = ref('login'); // 'login' | 'admin'
const username = ref('');
const password = ref('');
const adminUsername = ref('');
const adminPassword = ref('');
const showPassword = ref(false);
const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

// Server backend settings
const showServerConfig = ref(false);
const currentServerUrl = ref(getApiBaseUrl());
const inputServerUrl = ref(currentServerUrl.value || 'http://192.168.1.11:8000');

function saveServerUrl() {
  if (inputServerUrl.value && inputServerUrl.value.trim()) {
    setBackendUrl(inputServerUrl.value.trim());
  } else {
    setBackendUrl('');
  }
  currentServerUrl.value = getApiBaseUrl();
  showServerConfig.value = false;
}

function resetServerUrl() {
  setBackendUrl('');
  currentServerUrl.value = getApiBaseUrl();
  inputServerUrl.value = currentServerUrl.value;
  showServerConfig.value = false;
}

// User Login (Direct / Invite Created / Admin)
async function handleUserLogin() {
  if (!username.value.trim() || !password.value.trim()) return;
  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const res = await loginUser(username.value.trim(), password.value.trim());
    if (res?.user) {
      username.value = '';
      password.value = '';
      if (res.user.role === 'admin' && route.path !== '/watch' && !route.path.startsWith('/anime')) {
        router.push('/admin');
      }
    }
  } catch (err) {
    errorMessage.value = err.message || 'Nama pengguna atau kata sandi tidak cocok.';
  } finally {
    isLoading.value = false;
  }
}

// Admin Login
async function handleAdminLogin() {
  if (!adminUsername.value.trim() || !adminPassword.value.trim()) return;
  isLoading.value = true;
  errorMessage.value = '';

  try {
    const res = await loginUser(adminUsername.value.trim(), adminPassword.value.trim());
    if (res?.user?.role === 'admin') {
      adminUsername.value = '';
      adminPassword.value = '';
      if (route.path !== '/watch') {
        router.push('/admin');
      }
    }
  } catch (err) {
    errorMessage.value = err.message || 'Gagal masuk. Periksa kembali username dan kata sandi admin.';
  } finally {
    isLoading.value = false;
  }
}

function handleOpenInviteModal() {
  showLoginModal.value = false;
  activeInviteCode.value = '';
  inviteData.value = null;
  inviteError.value = '';
  showInviteModal.value = true;
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1300;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.login-card {
  position: relative;
  background: #11141e;
  border: 1px solid #23293d;
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.9), 0 0 0 1px rgba(229, 9, 20, 0.15);
  border-radius: 20px;
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
  margin-bottom: 1.5rem;
}

.login-logo-img {
  width: 48px;
  height: 48px;
  margin-bottom: 0.75rem;
  border-radius: 10px;
  box-shadow: 0 4px 14px rgba(229, 9, 20, 0.25);
}

.login-title {
  font-size: 1.35rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.3px;
  margin-bottom: 0.3rem;
}

.login-subtitle {
  font-size: 0.8rem;
  color: #94a3b8;
}

.error-alert {
  display: flex;
  align-items: flex-start;
  gap: 0.65rem;
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.82rem;
  line-height: 1.45;
  margin-bottom: 1.25rem;
}

.success-alert {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  background: rgba(16, 185, 129, 0.12);
  border: 1px solid rgba(16, 185, 129, 0.3);
  color: #6ee7b7;
  padding: 0.75rem 1rem;
  border-radius: 12px;
  font-size: 0.82rem;
  margin-bottom: 1.25rem;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
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
}

.input-icon {
  position: absolute;
  left: 1rem;
  color: #64748b;
  pointer-events: none;
}

.input-wrap input {
  width: 100%;
  background: #0a0c13;
  border: 1px solid #1e2538;
  border-radius: 12px;
  padding: 0.75rem 1rem 0.75rem 2.6rem;
  color: #fff;
  font-size: 0.88rem;
  transition: all 0.2s ease;
}

.input-wrap input:focus {
  outline: none;
  border-color: #e50914;
  box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.15);
}

.toggle-pw-btn {
  position: absolute;
  right: 0.8rem;
  background: transparent;
  border: none;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
}

.toggle-pw-btn:hover {
  color: #cbd5e1;
}

.submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 100%;
  padding: 0.85rem;
  font-size: 0.92rem;
  font-weight: 700;
  border-radius: 12px;
  background: #e50914;
  color: #fff;
  border: none;
  cursor: pointer;
  box-shadow: 0 4px 14px rgba(229, 9, 20, 0.4);
  transition: all 0.2s ease;
  margin-top: 0.25rem;
}

.submit-btn:hover:not(:disabled) {
  background: #ff1f2d;
  transform: translateY(-1px);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* VIP Invite Banner (Private App Security Notice) */
.invite-banner-card {
  background: rgba(234, 179, 8, 0.05);
  border: 1px solid rgba(234, 179, 8, 0.2);
  border-radius: 14px;
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-top: 0.5rem;
}

.invite-banner-top {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.invite-ticket-icon {
  flex-shrink: 0;
  margin-top: 2px;
}

.invite-banner-text h4 {
  font-size: 0.84rem;
  font-weight: 700;
  color: #fbbf24;
  margin-bottom: 0.2rem;
}

.invite-banner-text p {
  font-size: 0.76rem;
  color: #94a3b8;
  line-height: 1.45;
}

.btn-claim-invite {
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.3);
  color: #fde047;
  font-size: 0.8rem;
  font-weight: 700;
  padding: 0.55rem 0.9rem;
  border-radius: 10px;
  cursor: pointer;
  text-align: center;
  transition: all 0.15s ease;
}

.btn-claim-invite:hover {
  background: #eab308;
  color: #000;
  border-color: #eab308;
}

.bottom-mode-switch {
  text-align: center;
  margin-top: 1.4rem;
  padding-top: 1.1rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.switch-link-btn {
  background: transparent;
  border: none;
  color: #828ba0;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
  transition: color 0.2s ease;
}

.switch-link-btn:hover {
  color: #fff;
}

.server-config-section {
  margin-top: 0.9rem;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.server-config-toggle {
  background: transparent;
  border: none;
  color: #555e73;
  font-size: 0.72rem;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
  padding: 0.2rem 0.5rem;
  border-radius: 4px;
  transition: all 0.2s ease;
}

.server-config-toggle:hover {
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.04);
}

.server-config-box {
  margin-top: 0.5rem;
  width: 100%;
  padding: 0.75rem;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  animation: fadeIn 0.2s ease;
}

.server-input {
  width: 100%;
  background: #11141c;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  color: #e2e8f0;
  font-size: 0.78rem;
  font-family: monospace;
}

.server-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.server-btn-row {
  display: flex;
  gap: 0.4rem;
}

.btn-save-server {
  flex: 1;
  background: #2563eb;
  color: #fff;
  border: none;
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-reset-server {
  background: transparent;
  color: #94a3b8;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 0.3rem 0.5rem;
  font-size: 0.75rem;
  cursor: pointer;
}

.spinner-small {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes scaleUp {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
</style>
