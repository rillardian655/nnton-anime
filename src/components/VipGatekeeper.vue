<template>
  <div class="vip-gatekeeper-root">
    <!-- Ambient Background Glows -->
    <div class="ambient-glow glow-top"></div>
    <div class="ambient-glow glow-bottom"></div>

    <div class="gatekeeper-container">
      <!-- VIP Card -->
      <div class="gatekeeper-card">
        <!-- Brand Header -->
        <div class="gatekeeper-header">
          <div class="brand-badge-vip">
            <span class="pulsing-dot"></span>
            <span class="badge-text">VIP PRIVATE GATEWAY</span>
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
            <label for="gateUser">Nama Pengguna (Username / Email)</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                <circle cx="12" cy="7" r="4"></circle>
              </svg>
              <input 
                id="gateUser" 
                v-model="loginUsername" 
                type="text" 
                placeholder="misal: runa@gmail.com" 
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
            <span>{{ isLoading ? 'Memverifikasi Akses...' : 'Buka Akses & Masuk' }}</span>
          </button>

          <!-- Invite Ticket Prompt -->
          <div class="invite-ticket-callout">
            <div class="callout-left">
              <span class="callout-badge">TIKET VIP</span>
              <p class="callout-text">Punya Kode Undangan dari Admin atau teman?</p>
            </div>
            <button type="button" class="btn-callout-action" @click="switchTab('claim')">
              Klaim Tiket →
            </button>
          </div>
        </form>

        <!-- 2. CLAIM INVITE FORM -->
        <form v-else-if="activeTab === 'claim'" @submit.prevent="handleClaimInvite" class="gate-form">
          <div class="form-group">
            <label for="claimCode">Kode Tiket / Undangan VIP</label>
            <div class="input-wrap">
              <svg class="input-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2">
                <path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2z"></path>
                <line x1="12" y1="9" x2="12" y2="15"></line>
              </svg>
              <input 
                id="claimCode" 
                v-model="inviteCode" 
                type="text" 
                placeholder="Contoh: INV-146206CD" 
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
                placeholder="Nama yang muncul di profil..." 
              />
            </div>
          </div>

          <button type="submit" class="btn-gate-submit btn-gold-submit" :disabled="isLoading">
            <span v-if="isLoading" class="spinner-small"></span>
            <span>{{ isLoading ? 'Mengklaim Tiket...' : 'Klaim Tiket & Buka Aplikasi' }}</span>
          </button>

          <div class="invite-ticket-callout">
            <div class="callout-left">
              <span class="callout-badge" style="background: rgba(255,255,255,0.1); color: #fff;">INFO</span>
              <p class="callout-text">Sudah memiliki akun terdaftar?</p>
            </div>
            <button type="button" class="btn-callout-action" @click="switchTab('login')">
              Masuk di Sini →
            </button>
          </div>
        </form>

        <!-- Footer / Server Config Accordion -->
        <div class="gate-footer">
          <div class="server-status-pill" @click="showServerConfig = !showServerConfig">
            <span class="status-indicator" :class="serverStatusClass"></span>
            <span class="server-label">Server: <strong>{{ currentBackendHost }}</strong></span>
            <span class="server-config-toggle">{{ showServerConfig ? '▲ Tutup' : '⚙️ Atur' }}</span>
          </div>

          <!-- Collapsible Server IP Settings -->
          <transition name="fade">
            <div v-if="showServerConfig" class="server-config-drawer">
              <p class="config-desc">
                Sesuaikan alamat IP jika backend berjalan di jaringan Wi-Fi lain atau domain tunnel:
              </p>
              <div class="config-row">
                <input 
                  type="text" 
                  v-model="tempServerUrl" 
                  placeholder="http://192.168.1.11:8000"
                  class="config-input"
                />
                <button type="button" class="btn-config-save" @click="saveServerUrl">Simpan</button>
              </div>
              <div class="config-actions">
                <button type="button" class="btn-config-sub" @click="testServerConnection">
                  Tes Koneksi
                </button>
                <button type="button" class="btn-config-sub" @click="resetServerUrl">
                  Reset Default
                </button>
              </div>
              <p v-if="pingResult" class="ping-result" :class="{ 'ping-ok': pingOk, 'ping-fail': !pingOk }">
                {{ pingResult }}
              </p>
            </div>
          </transition>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { loginUser } from '../stores/auth.js';
import { getApiBaseUrl, setBackendUrl, claimInvite } from '../api.js';

const activeTab = ref('login');
const loginUsername = ref('runa@gmail.com');
const loginPassword = ref('');
const showPassword = ref(false);

const inviteCode = ref('');
const claimUsername = ref('');
const claimPassword = ref('');
const claimDisplayName = ref('');

const isLoading = ref(false);
const errorMessage = ref('');
const successMessage = ref('');

// Server Configuration Drawer
const showServerConfig = ref(false);
const currentBackendHost = ref(getApiBaseUrl() || 'http://192.168.1.11:8000');
const tempServerUrl = ref(currentBackendHost.value);
const serverStatusClass = ref('status-unknown');
const pingResult = ref('');
const pingOk = ref(false);

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
    errorMessage.value = err.message || 'Gagal masuk. Periksa kembali username dan kata sandi kamu.';
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

function saveServerUrl() {
  if (!tempServerUrl.value.trim()) {
    resetServerUrl();
    return;
  }
  let url = tempServerUrl.value.trim().replace(/\/+$/, '');
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    url = `http://${url}`;
  }
  setBackendUrl(url);
  currentBackendHost.value = url;
  testServerConnection();
}

function resetServerUrl() {
  setBackendUrl('');
  tempServerUrl.value = 'http://192.168.1.11:8000';
  currentBackendHost.value = 'http://192.168.1.11:8000';
  testServerConnection();
}

async function testServerConnection() {
  pingResult.value = 'Memeriksa koneksi server...';
  serverStatusClass.value = 'status-testing';
  try {
    const target = (currentBackendHost.value || 'http://192.168.1.11:8000').replace(/\/+$/, '');
    const startTime = performance.now();
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${target}/docs`, {
      method: 'GET',
      mode: 'no-cors',
      signal: controller.signal
    });
    clearTimeout(timeout);
    const latency = Math.round(performance.now() - startTime);

    pingOk.value = true;
    serverStatusClass.value = 'status-online';
    pingResult.value = `✓ Server terhubung (${latency}ms)`;
  } catch (err) {
    pingOk.value = false;
    serverStatusClass.value = 'status-offline';
    pingResult.value = `✕ Server tidak merespons. Pastikan laptop & HP di Wi-Fi yang sama.`;
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

  // Ping current server
  testServerConnection();
});
</script>

<style scoped>
.vip-gatekeeper-root {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: radial-gradient(circle at 50% 20%, #151821 0%, #090a0f 65%, #050608 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  overflow-y: auto;
  min-height: 100vh;
  box-sizing: border-box;
}

.ambient-glow {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  pointer-events: none;
  opacity: 0.15;
}

.glow-top {
  width: 320px;
  height: 320px;
  background: #ff2851;
  top: -100px;
  left: 50%;
  transform: translateX(-50%);
}

.glow-bottom {
  width: 280px;
  height: 280px;
  background: #eab308;
  bottom: -100px;
  right: 10%;
}

.gatekeeper-container {
  width: 100%;
  max-width: 440px;
  margin: auto;
  position: relative;
  z-index: 2;
}

.gatekeeper-card {
  background: rgba(18, 20, 29, 0.88);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 20px;
  padding: 2rem 1.75rem;
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7), 0 0 1px rgba(255, 255, 255, 0.1) inset;
}

.gatekeeper-header {
  text-align: center;
  margin-bottom: 1.5rem;
}

.brand-badge-vip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.35);
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 1.2px;
  color: #facc15;
  margin-bottom: 1rem;
  text-transform: uppercase;
}

.pulsing-dot {
  width: 6px;
  height: 6px;
  background-color: #facc15;
  border-radius: 50%;
  box-shadow: 0 0 8px #facc15;
  animation: pulse-dot 1.8s infinite;
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.8); }
}

.logo-box {
  width: 64px;
  height: 64px;
  margin: 0 auto 0.75rem auto;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.04);
  padding: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(255, 40, 81, 0.2);
}

.brand-logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.brand-title {
  font-size: 1.85rem;
  font-weight: 900;
  letter-spacing: -0.5px;
  margin: 0 0 0.35rem 0;
  line-height: 1.1;
}

.text-white { color: #ffffff; }
.text-red { color: #ff2851; }

.vip-subtag {
  display: inline-block;
  font-size: 0.75rem;
  font-weight: 800;
  color: #000;
  background: #facc15;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 6px;
  vertical-align: middle;
}

.brand-tagline {
  color: #94a3b8;
  font-size: 0.85rem;
  margin: 0;
  line-height: 1.4;
}

/* Alert Boxes */
.alert-box {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 0.75rem 1rem;
  border-radius: 10px;
  margin-bottom: 1.25rem;
  font-size: 0.82rem;
  line-height: 1.4;
}

.alert-error {
  background: rgba(239, 68, 68, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #fca5a5;
}

.alert-success {
  background: rgba(34, 197, 94, 0.12);
  border: 1px solid rgba(34, 197, 94, 0.3);
  color: #86efac;
}

/* Tabs */
.gate-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  background: rgba(0, 0, 0, 0.28);
  padding: 4px;
  border-radius: 12px;
  margin-bottom: 1.5rem;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 14px;
  border-radius: 8px;
  background: transparent;
  border: none;
  color: #94a3b8;
  font-size: 0.88rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.tab-btn.active {
  background: #ff2851;
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(255, 40, 81, 0.35);
}

/* Forms */
.gate-form {
  display: flex;
  flex-direction: column;
  gap: 1.1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  text-align: left;
}

.form-group label {
  font-size: 0.78rem;
  font-weight: 600;
  color: #cbd5e1;
  letter-spacing: 0.2px;
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
  padding: 11px 12px 11px 38px;
  background: rgba(10, 12, 18, 0.75);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  color: #ffffff;
  font-size: 0.9rem;
  transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}

.input-wrap input:focus {
  outline: none;
  border-color: #ff2851;
  box-shadow: 0 0 0 3px rgba(255, 40, 81, 0.2);
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
  padding: 13px;
  border-radius: 12px;
  background: linear-gradient(135deg, #ff2851 0%, #dc2626 100%);
  color: #ffffff;
  font-size: 0.95rem;
  font-weight: 700;
  border: none;
  cursor: pointer;
  box-shadow: 0 8px 24px rgba(255, 40, 81, 0.35);
  transition: transform 0.15s, box-shadow 0.15s, opacity 0.15s;
}

.btn-gate-submit:hover:not(:disabled) {
  transform: translateY(-1px);
  box-shadow: 0 10px 28px rgba(255, 40, 81, 0.5);
}

.btn-gate-submit:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.btn-gold-submit {
  background: linear-gradient(135deg, #eab308 0%, #ca8a04 100%);
  color: #000;
  box-shadow: 0 8px 24px rgba(234, 179, 8, 0.35);
}

.btn-gold-submit:hover:not(:disabled) {
  box-shadow: 0 10px 28px rgba(234, 179, 8, 0.5);
}

/* Callout Box */
.invite-ticket-callout {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: rgba(255, 255, 255, 0.03);
  border: 1px dashed rgba(255, 255, 255, 0.12);
  border-radius: 10px;
  margin-top: 0.25rem;
}

.callout-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: left;
}

.callout-badge {
  font-size: 0.62rem;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  background: rgba(234, 179, 8, 0.2);
  color: #facc15;
  display: inline-block;
  width: fit-content;
}

.callout-text {
  font-size: 0.78rem;
  color: #94a3b8;
  margin: 0;
}

.btn-callout-action {
  background: none;
  border: none;
  color: #facc15;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  white-space: nowrap;
  padding: 4px 6px;
}

.btn-callout-action:hover {
  text-decoration: underline;
}

/* Footer & Server Status */
.gate-footer {
  margin-top: 1.5rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.server-status-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 0.76rem;
  color: #94a3b8;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.status-indicator {
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.status-online { background-color: #22c55e; box-shadow: 0 0 6px #22c55e; }
.status-testing { background-color: #eab308; box-shadow: 0 0 6px #eab308; }
.status-offline { background-color: #ef4444; box-shadow: 0 0 6px #ef4444; }
.status-unknown { background-color: #64748b; }

.server-config-toggle {
  color: #60a5fa;
  font-weight: 600;
  margin-left: 6px;
}

.server-config-drawer {
  margin-top: 10px;
  padding: 12px;
  background: rgba(10, 12, 18, 0.9);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 10px;
  text-align: left;
}

.config-desc {
  font-size: 0.72rem;
  color: #94a3b8;
  margin: 0 0 8px 0;
  line-height: 1.4;
}

.config-row {
  display: flex;
  gap: 6px;
}

.config-input {
  flex: 1;
  padding: 7px 10px;
  background: rgba(0, 0, 0, 0.5);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 6px;
  color: #ffffff;
  font-size: 0.8rem;
  font-family: monospace;
}

.btn-config-save {
  padding: 7px 14px;
  background: #ff2851;
  border: none;
  border-radius: 6px;
  color: #fff;
  font-size: 0.8rem;
  font-weight: 600;
  cursor: pointer;
}

.config-actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}

.btn-config-sub {
  background: rgba(255, 255, 255, 0.08);
  border: none;
  border-radius: 6px;
  color: #cbd5e1;
  font-size: 0.72rem;
  padding: 5px 10px;
  cursor: pointer;
}

.btn-config-sub:hover {
  background: rgba(255, 255, 255, 0.14);
}

.ping-result {
  font-size: 0.72rem;
  margin: 6px 0 0 0;
}

.ping-ok { color: #4ade80; }
.ping-fail { color: #f87171; }

.spinner-small {
  width: 16px;
  height: 16px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #ffffff;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.fade-enter-active, .fade-leave-active {
  transition: opacity 0.2s ease;
}
.fade-enter-from, .fade-leave-to {
  opacity: 0;
}
</style>
