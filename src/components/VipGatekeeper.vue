<template>
  <div class="vip-gatekeeper-root">
    <div class="gatekeeper-container">
      <!-- VIP Security Card -->
      <div class="gatekeeper-card">
        <!-- Brand Header -->
        <div class="gatekeeper-header">
          <div class="brand-badge-vip">
            <span class="badge-text">VIP ACCESS PORTAL</span>
          </div>

          <div class="logo-box">
            <img src="/logo.png" alt="AniPulse Logo" class="brand-logo-img" />
          </div>

          <h1 class="brand-title">
            <span class="text-white">ANI</span><span class="text-red">PULSE</span>
            <span class="vip-subtag">VIP</span>
          </h1>
          <p class="brand-tagline">Akses Khusus Pengguna Terdaftar & Undangan Resmi</p>
        </div>

        <!-- Alert Banners -->
        <transition name="fade">
          <div v-if="errorMessage" class="alert-box alert-error">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <div class="alert-text">{{ errorMessage }}</div>
          </div>
        </transition>

        <transition name="fade">
          <div v-if="successMessage" class="alert-box alert-success">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <div class="alert-text">{{ successMessage }}</div>
          </div>
        </transition>

        <!-- Access Mode Tabs -->
        <!-- Access Mode Tabs -->
        <div class="gate-tabs">
          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'ticket' }"
            @click="switchTab('ticket')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
              <line x1="12" y1="9" x2="12" y2="15"></line>
            </svg>
            <span>Masuk Pakai Tiket</span>
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'login' }"
            @click="switchTab('login')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path>
              <polyline points="10 17 15 12 10 7"></polyline>
              <line x1="15" y1="12" x2="3" y2="12"></line>
            </svg>
            <span>Masuk Akun (Admin)</span>
          </button>
        </div>

        <!-- 1. TICKET LOGIN FORM (Default: login hanya butuh tiket) -->
        <form v-if="activeTab === 'ticket'" @submit.prevent="handleTicketLogin" class="gate-form">
          <div class="ticket-callout-hero">
            <div class="ticket-badge-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2.5">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
              </svg>
              <span>AKSES KHUSUS KAWAN VIP</span>
            </div>
            <p class="ticket-hero-text">
              Masukkan Kode Tiket yang kamu dapatkan. Langsung aktif untuk menonton sepuasnya tanpa perlu daftar email atau password!
            </p>
          </div>

          <div class="form-group">
            <label for="ticketCodeInput">Kode Tiket VIP</label>
            <div class="input-wrap ticket-input-wrap">
              <svg class="input-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
                <line x1="12" y1="9" x2="12" y2="15"></line>
              </svg>
              <input 
                id="ticketCodeInput" 
                v-model="ticketCode" 
                type="text" 
                placeholder="VIP-30D-XXXXXX" 
                required 
                style="text-transform: uppercase; font-family: monospace; font-size: 1.15rem; letter-spacing: 1.5px; font-weight: 700;"
                @input="ticketCode = ticketCode.toUpperCase()"
              />
            </div>
            <span class="input-helper">Format kode diawali dengan <code>VIP-</code> (contoh: <code>VIP-30D-8F92A1</code> atau <code>VIP-ANIPULSE</code>)</span>
          </div>

          <button type="submit" class="btn-gate-submit btn-ticket-submit" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-small"></span>
            <span>{{ isLoading ? 'Memverifikasi Tiket...' : '🚀 Klaim Tiket & Langsung Nonton' }}</span>
          </button>
        </form>

        <!-- 2. LOGIN FORM (Username / Password) -->
        <form v-else-if="activeTab === 'login'" @submit.prevent="handleLogin" class="gate-form">
          <div class="form-group">
            <label for="gateUser">Nama Pengguna atau Email</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <input 
                id="gateUser" 
                v-model="loginUsername" 
                type="text" 
                placeholder="Masukkan username atau email..." 
                required 
                autocomplete="username"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="gatePass">Kata Sandi</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input 
                id="gatePass" 
                v-model="loginPassword" 
                :type="showPassword ? 'text' : 'password'" 
                placeholder="Masukkan kata sandi..." 
                required 
                autocomplete="current-password"
              />
              <button type="button" class="btn-toggle-pw" @click="showPassword = !showPassword">
                {{ showPassword ? 'Sembunyi' : 'Lihat' }}
              </button>
            </div>
          </div>

          <button type="submit" class="btn-gate-submit" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-small"></span>
            <span>{{ isLoading ? 'Memverifikasi...' : 'Buka Akses & Masuk' }}</span>
          </button>

          <!-- Invite Ticket Prompt -->
          <div class="invite-ticket-callout">
            <div class="callout-left">
              <span class="callout-badge">TIKET</span>
              <p class="callout-text">Punya Kode Tiket dari Admin?</p>
            </div>
            <button type="button" class="btn-callout-action" @click="switchTab('ticket')">
              Masuk Pakai Tiket →
            </button>
          </div>
        </form>

        <!-- Optional Server IP changer on connection issue -->
        <div v-if="showServerConfig" class="gate-server-box">
          <span class="server-box-lbl">Pengaturan IP Server Backend:</span>
          <div class="server-box-row">
            <input v-model="customServerUrl" type="text" placeholder="http://192.168.1.51:8000" class="server-box-input" />
            <button type="button" class="btn btn-primary btn-sm" @click="saveServerAddress">Simpan</button>
          </div>
          <span class="server-box-hint">Pastikan HP dan laptop terhubung ke Wi-Fi yang sama.</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { loginUser, loginWithTicketOnly } from '../stores/auth.js';
import { getApiBaseUrl, setBackendUrl } from '../api.js';

const activeTab = ref('ticket');
const ticketCode = ref('');
const loginUsername = ref('');
const loginPassword = ref('');
const showPassword = ref(false);

const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const showServerConfig = ref(false);
const customServerUrl = ref(localStorage.getItem('anipulse_backend_url') || getApiBaseUrl() || 'http://192.168.1.51:8000');

function saveServerAddress() {
  const url = customServerUrl.value.trim().replace(/\/+$/, '');
  setBackendUrl(url);
  errorMessage.value = '';
  successMessage.value = '✓ Alamat IP server berhasil disimpan: ' + url;
  showServerConfig.value = false;
}

function switchTab(tab) {
  activeTab.value = tab;
  errorMessage.value = '';
  successMessage.value = '';
}

async function handleTicketLogin() {
  if (!ticketCode.value.trim()) {
    errorMessage.value = 'Silakan masukkan Kode Tiket VIP.';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const code = ticketCode.value.trim().toUpperCase();
    const res = await loginWithTicketOnly(code);
    successMessage.value = `✓ Tiket VIP Valid! Selamat menonton, ${res.user?.displayName || 'Kawan VIP'}. Memasuki aplikasi...`;
    setTimeout(() => {
      window.location.reload();
    }, 600);
  } catch (err) {
    errorMessage.value = err.message || 'Kode tiket tidak valid atau salah format. Pastikan kode diawali dengan VIP-';
  } finally {
    isLoading.value = false;
  }
}

async function handleLogin() {
  if (!loginUsername.value.trim() || !loginPassword.value) {
    errorMessage.value = 'Silakan isi nama pengguna dan kata sandi.';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const result = await loginUser(loginUsername.value.trim(), loginPassword.value);
    successMessage.value = `Akses berhasil dibuka! Selamat datang, ${result.user?.displayName || result.user?.username}.`;
  } catch (err) {
    const msg = err.message || '';
    if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || msg.includes('koneksi') || msg.includes('Server backend')) {
      errorMessage.value = `Tidak dapat menghubungi server (${getApiBaseUrl()}). Pastikan server.py aktif di laptop dan HP terhubung ke Wi-Fi yang sama.`;
      showServerConfig.value = true;
    } else {
      errorMessage.value = msg || 'Gagal masuk. Periksa kembali username dan kata sandi kamu.';
    }
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  // Check if URL has invite parameter
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('invite') || urlParams.get('code') || urlParams.get('ticket');
  if (code) {
    ticketCode.value = code.toUpperCase();
    activeTab.value = 'ticket';
  }
});
</script>

<style scoped>
.vip-gatekeeper-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background-color: #0b0c10;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.25rem;
  overflow-y: auto;
  min-height: 100vh;
  box-sizing: border-box;
}

.gatekeeper-container {
  width: 100%;
  max-width: 420px;
  margin: auto;
  position: relative;
  z-index: 2;
}

.gatekeeper-card {
  background: #12141c;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 16px;
  padding: 2rem 1.75rem;
  box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);
}

.gatekeeper-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.brand-badge-vip {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 1px;
  color: #cbd5e1;
  margin-bottom: 0.85rem;
  text-transform: uppercase;
}

.logo-box {
  width: 58px;
  height: 58px;
  margin: 0 auto 0.75rem auto;
  border-radius: 14px;
  background: #181b24;
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-title {
  font-size: 1.75rem;
  font-weight: 900;
  letter-spacing: -0.5px;
  margin: 0 0 0.3rem 0;
  line-height: 1.1;
}

.text-white { color: #f8fafc; }
.text-red { color: #e50914; }

.vip-subtag {
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 800;
  color: #ffffff;
  background: #b91c1c;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
  vertical-align: middle;
}

.brand-tagline {
  color: #94a3b8;
  font-size: 0.82rem;
  margin: 0;
  line-height: 1.4;
}

/* Alert Boxes */
.alert-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0.75rem 1rem;
  border-radius: 8px;
  margin-bottom: 1.25rem;
  font-size: 0.82rem;
  line-height: 1.4;
}

.alert-error {
  background: rgba(220, 38, 38, 0.1);
  border: 1px solid rgba(220, 38, 38, 0.25);
  color: #fca5a5;
}

.alert-success {
  background: rgba(22, 163, 74, 0.1);
  border: 1px solid rgba(22, 163, 74, 0.25);
  color: #86efac;
}

/* Tabs */
.gate-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  background: #090a0f;
  padding: 4px;
  border-radius: 10px;
  margin-bottom: 1.35rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  padding: 9px 12px;
  border-radius: 7px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.tab-btn.active {
  background: #e50914;
  color: #ffffff;
}

/* Forms */
.gate-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  text-align: left;
}

.form-group label {
  font-size: 0.76rem;
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
  left: 12px;
  color: #64748b;
  pointer-events: none;
}

.input-wrap input {
  width: 100%;
  padding: 10px 12px 10px 38px;
  background: #090a0f;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  color: #ffffff;
  font-size: 0.88rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.input-wrap input:focus {
  outline: none;
  border-color: #e50914;
}

.btn-toggle-pw {
  position: absolute;
  right: 10px;
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  padding: 4px 6px;
}

.btn-toggle-pw:hover {
  color: #ffffff;
}

/* Action Buttons */
.btn-gate-submit {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  width: 100%;
  padding: 12px;
  border-radius: 8px;
  background: #e50914;
  color: #ffffff;
  font-size: 0.92rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s;
}

.btn-gate-submit:hover:not(:disabled) {
  background: #b91c1c;
}

.btn-gate-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-gold-submit {
  background: #d97706;
  color: #ffffff;
}

.btn-gold-submit:hover:not(:disabled) {
  background: #b45309;
}

/* Callout Box */
.invite-ticket-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  margin-top: 0.2rem;
}

.callout-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.callout-badge {
  font-size: 0.6rem;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  background: rgba(217, 119, 6, 0.2);
  color: #fbbf24;
  display: inline-block;
  width: fit-content;
}

.callout-text {
  font-size: 0.76rem;
  color: #94a3b8;
  margin: 0;
}

.btn-callout-action {
  background: none;
  border: none;
  color: #fbbf24;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  padding: 4px 6px;
}

.btn-callout-action:hover {
  text-decoration: underline;
}

.spinner-small {
  width: 15px;
  height: 15px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.gate-server-box {
  margin-top: 1rem;
  padding: 0.75rem 0.9rem;
  background: rgba(15, 23, 42, 0.7);
  border: 1px dashed rgba(59, 130, 246, 0.4);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.server-box-lbl {
  font-size: 0.74rem;
  font-weight: 700;
  color: #93c5fd;
}

.server-box-row {
  display: flex;
  gap: 0.5rem;
}

.server-box-input {
  flex: 1;
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 0.4rem 0.6rem;
  font-size: 0.8rem;
  color: #f8fafc;
  font-family: monospace;
}

.server-box-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.server-box-hint {
  font-size: 0.68rem;
  color: #64748b;
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}

/* Ticket Entry Hero & Badge */
.ticket-callout-hero {
  background: linear-gradient(135deg, rgba(217, 119, 6, 0.12), rgba(15, 23, 42, 0.6));
  border: 1px solid rgba(217, 119, 6, 0.35);
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.25rem;
  text-align: center;
}

.ticket-badge-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: rgba(217, 119, 6, 0.2);
  border: 1px solid rgba(217, 119, 6, 0.4);
  padding: 3px 10px;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 800;
  color: #fbbf24;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.ticket-hero-text {
  font-size: 0.82rem;
  color: #e2e8f0;
  line-height: 1.45;
  margin: 0;
}

.ticket-input-wrap input {
  color: #fbbf24 !important;
}

.input-helper {
  display: block;
  font-size: 0.72rem;
  color: #94a3b8;
  margin-top: 0.35rem;
  line-height: 1.4;
}

.input-helper code {
  color: #fbbf24;
  background: rgba(217, 119, 6, 0.15);
  padding: 1px 4px;
  border-radius: 4px;
  font-size: 0.76rem;
}

.btn-ticket-submit {
  background: linear-gradient(135deg, #d97706, #b45309) !important;
  border: 1px solid rgba(251, 191, 36, 0.5) !important;
  color: #ffffff !important;
  font-weight: 800 !important;
  box-shadow: 0 4px 16px rgba(217, 119, 6, 0.35) !important;
}

.btn-ticket-submit:hover:not(:disabled) {
  background: linear-gradient(135deg, #f59e0b, #d97706) !important;
  box-shadow: 0 6px 20px rgba(217, 119, 6, 0.55) !important;
  transform: translateY(-1px);
}
</style>
