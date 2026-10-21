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
        <div class="gate-tabs">
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
            <span>Masuk Akun</span>
          </button>

          <button 
            type="button" 
            class="tab-btn" 
            :class="{ active: activeTab === 'claim' }"
            @click="switchTab('claim')"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
              <line x1="12" y1="9" x2="12" y2="15"></line>
            </svg>
            <span>Klaim Tiket</span>
          </button>
        </div>

        <!-- 1. LOGIN FORM -->
        <form v-if="activeTab === 'login'" @submit.prevent="handleLogin" class="gate-form">
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
              <span class="callout-badge">UNDANGAN</span>
              <p class="callout-text">Punya Kode Undangan resmi?</p>
            </div>
            <button type="button" class="btn-callout-action" @click="switchTab('claim')">
              Klaim Tiket →
            </button>
          </div>
        </form>

        <!-- 2. CLAIM INVITE FORM -->
        <form v-else-if="activeTab === 'claim'" @submit.prevent="handleClaimInvite" class="gate-form">
          <div class="form-group">
            <label for="claimCode">Kode Tiket Undangan</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d97706" stroke-width="2">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
                <line x1="12" y1="9" x2="12" y2="15"></line>
              </svg>
              <input 
                id="claimCode" 
                v-model="inviteCode" 
                type="text" 
                placeholder="INV-XXXXXX" 
                required 
                style="text-transform: uppercase; font-family: monospace; letter-spacing: 1px;"
                @input="inviteCode = inviteCode.toUpperCase()"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="claimUser">Buat Nama Pengguna (Username)</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <input 
                id="claimUser" 
                v-model="claimUsername" 
                type="text" 
                placeholder="Username akun kamu..." 
                required 
                autocomplete="username"
              />
            </div>
          </div>

          <div class="form-group">
            <label for="claimPass">Buat Kata Sandi</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
              </svg>
              <input 
                id="claimPass" 
                v-model="claimPassword" 
                :type="showPassword ? 'text' : 'password'" 
                placeholder="Minimal 4 karakter..." 
                required 
                autocomplete="new-password"
              />
              <button type="button" class="btn-toggle-pw" @click="showPassword = !showPassword">
                {{ showPassword ? 'Sembunyi' : 'Lihat' }}
              </button>
            </div>
          </div>

          <div class="form-group">
            <label for="claimDisplay">Nama Lengkap / Panggilan (Opsional)</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
                <circle cx="9" cy="7" r="4"></circle>
              </svg>
              <input 
                id="claimDisplay" 
                v-model="claimDisplayName" 
                type="text" 
                placeholder="Nama panggilan kamu..." 
              />
            </div>
          </div>

          <button type="submit" class="btn-gate-submit btn-gold-submit" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-small"></span>
            <span>{{ isLoading ? 'Mengklaim Tiket...' : 'Klaim Tiket & Buka Aplikasi' }}</span>
          </button>

          <div class="invite-ticket-callout">
            <div class="callout-left">
              <span class="callout-badge" style="background: rgba(255,255,255,0.08); color: #cbd5e1;">LOGIN</span>
              <p class="callout-text">Sudah memiliki akun terdaftar?</p>
            </div>
            <button type="button" class="btn-callout-action" @click="switchTab('login')">
              Masuk di Sini →
            </button>
          </div>

          <!-- Optional Server IP changer on connection issue -->
          <div v-if="showServerConfig" class="gate-server-box">
            <span class="server-box-lbl">Pengaturan IP Server Backend:</span>
            <div class="server-box-row">
              <input v-model="customServerUrl" type="text" placeholder="http://192.168.1.11:8000" class="server-box-input" />
              <button type="button" class="btn btn-primary btn-sm" @click="saveServerAddress">Simpan</button>
            </div>
            <span class="server-box-hint">Pastikan HP dan laptop terhubung ke Wi-Fi yang sama.</span>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { loginUser } from '../stores/auth.js';
import { claimInvite, getApiBaseUrl, setBackendUrl } from '../api.js';

const activeTab = ref('login');
const loginUsername = ref('');
const loginPassword = ref('');
const showPassword = ref(false);

const inviteCode = ref('');
const claimUsername = ref('');
const claimPassword = ref('');
const claimDisplayName = ref('');

const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');
const showServerConfig = ref(false);
const customServerUrl = ref(localStorage.getItem('anipulse_backend_url') || getApiBaseUrl() || 'http://192.168.1.11:8000');

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

async function handleClaimInvite() {
  if (!inviteCode.value.trim()) {
    errorMessage.value = 'Kode undangan wajib diisi.';
    return;
  }
  if (!claimUsername.value.trim() || !claimPassword.value) {
    errorMessage.value = 'Username dan kata sandi baru wajib diisi.';
    return;
  }

  isLoading.value = true;
  errorMessage.value = '';
  successMessage.value = '';

  try {
    const code = inviteCode.value.trim().toUpperCase();
    const res = await claimInvite(
      code,
      claimUsername.value.trim().toLowerCase(),
      claimPassword.value,
      claimDisplayName.value.trim() || claimUsername.value.trim()
    );
    successMessage.value = `Tiket berhasil diklaim! Akun ${res.user?.username} aktif. Memasuki aplikasi...`;
    setTimeout(() => {
      window.location.reload();
    }, 800);
  } catch (err) {
    errorMessage.value = err.message || 'Gagal mengklaim tiket. Pastikan kode valid dan belum pernah digunakan.';
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  // Check if URL has invite parameter
  const urlParams = new URLSearchParams(window.location.search);
  const code = urlParams.get('invite') || urlParams.get('code');
  if (code) {
    inviteCode.value = code.toUpperCase();
    activeTab.value = 'claim';
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
</style>
