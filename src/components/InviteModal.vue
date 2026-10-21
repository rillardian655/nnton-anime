<template>
  <div class="modal-overlay" v-if="showInviteModal" @click.self="handleDismiss">
    <div class="invite-card">
      <button class="modal-close-btn" @click="handleDismiss" aria-label="Tutup">✕</button>

      <!-- 1. Manual Code Entry Form (if opened without code and no error) -->
      <div v-if="!activeInviteCode && !inviteData && !inviteError" class="manual-entry-state">
        <div class="vip-header">
          <div class="vip-crown-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"></path></svg>
            <span>KLAIM AKSES VIP</span>
          </div>
          <h2 class="claim-title">Aktivasi Akun Undangan</h2>
          <p class="claim-subtitle">Masukkan kode undangan yang diberikan oleh Administrator</p>
        </div>

        <form @submit.prevent="handleManualCodeSubmit" class="claim-form">
          <div class="form-group">
            <label for="manualInviteCode">Kode Undangan (1x Pakai)</label>
            <input 
              id="manualInviteCode"
              v-model="manualCode" 
              type="text" 
              placeholder="Contoh: VIP-XXXXXX" 
              required
              style="text-transform: uppercase; font-weight: 800; letter-spacing: 2px; text-align: center; font-size: 1.1rem; padding: 0.9rem;"
              autofocus
            />
            <span class="field-hint">Paste atau ketik kode yang kamu terima via WhatsApp/Chat.</span>
          </div>

          <button type="submit" class="btn btn-primary btn-block" :disabled="isVerifying">
            <span v-if="isVerifying" class="spinner-small"></span>
            <span>{{ isVerifying ? 'Memeriksa Kode...' : 'Periksa & Aktivasi' }}</span>
          </button>
        </form>
      </div>

      <!-- 2. Loading State (when verifying code) -->
      <div v-else-if="activeInviteCode && !inviteData && !inviteError" class="loading-state">
        <span class="spinner-large"></span>
        <p class="loading-text">Memeriksa kode undangan VIP: {{ activeInviteCode }}...</p>
      </div>

      <!-- 2. Error / Already Used State -->
      <div v-else-if="inviteError" class="error-state">
        <div class="status-icon-wrap error-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        </div>
        <h3 class="state-title">Undangan Tidak Dapat Digunakan</h3>
        <p class="state-desc">{{ inviteError }}</p>
        <p class="state-sub">Link ini bersifat <strong>1x pakai</strong>. Jika kamu sudah pernah mendaftar dengan link ini, silakan langsung masuk menggunakan nama dan kata sandi kamu.</p>
        <div class="state-actions">
          <button class="btn btn-primary btn-block" @click="openLogin">
            Masuk dengan Akun yang Sudah Dibuat
          </button>
        </div>
      </div>

      <!-- 3. Valid Invite -> Claim Form -->
      <div v-else-if="inviteData" class="claim-state">
        <!-- VIP Badge & Greeting -->
        <div class="vip-header">
          <div class="vip-crown-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#eab308" stroke-width="2"><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"></path></svg>
            <span>VIP INVITATION</span>
          </div>
          <h2 class="claim-title">Selamat Datang di AniPulse!</h2>
          <p class="claim-subtitle">Aktivasi akun khusus penerima undangan admin</p>
        </div>

        <!-- Target Info Pill -->
        <div class="invite-info-pill">
          <div class="info-row">
            <span class="info-label">Penerima Undangan:</span>
            <span class="info-val highlight">{{ inviteData.targetName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Masa Aktif Akses:</span>
            <span class="info-val badge-duration">{{ inviteData.durationType }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Tipe Akses:</span>
            <span class="info-val">1x Pakai (Sekali Aktivasi)</span>
          </div>
        </div>

        <!-- Form Error -->
        <div v-if="claimError" class="form-error-alert">
          {{ claimError }}
        </div>

        <!-- Setup Form -->
        <form @submit.prevent="handleClaim" class="claim-form">
          <div class="form-group">
            <label for="claimUsername">Buat Nama Pengguna (Username)</label>
            <input 
              id="claimUsername" 
              v-model="formUsername" 
              type="text" 
              placeholder="Contoh: ceta atau cetaspeed" 
              required 
              minlength="3"
            />
            <span class="field-hint">Minimal 3 karakter huruf / angka (digunakan untuk login nanti).</span>
          </div>

          <div class="form-group">
            <label for="claimDisplayName">Nama Panggilan (Tampilan)</label>
            <input 
              id="claimDisplayName" 
              v-model="formDisplayName" 
              type="text" 
              placeholder="Nama kamu..." 
            />
          </div>

          <div class="form-row">
            <div class="form-group">
              <label for="claimPassword">Kata Sandi (Password)</label>
              <input 
                id="claimPassword" 
                v-model="formPassword" 
                type="password" 
                placeholder="Minimal 4 karakter" 
                required 
                minlength="4"
              />
            </div>
            <div class="form-group">
              <label for="claimPasswordConfirm">Ulangi Password</label>
              <input 
                id="claimPasswordConfirm" 
                v-model="formPasswordConfirm" 
                type="password" 
                placeholder="Konfirmasi password" 
                required 
              />
            </div>
          </div>

          <button type="submit" class="btn btn-primary claim-submit-btn" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="spinner-small"></span>
            <span>{{ isSubmitting ? 'Mengaktifkan Akun...' : 'Aktifkan Akun & Mulai Nonton' }}</span>
          </button>
        </form>

        <p class="claim-footer-note">
          Simpan baik-baik nama pengguna & kata sandi kamu. Jika keluar nanti, cukup gunakan nama dan sandi tersebut untuk masuk kembali.
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { 
  showInviteModal, 
  showLoginModal, 
  activeInviteCode,
  inviteData, 
  inviteError, 
  checkInviteUrl,
  submitClaimInvite 
} from '../stores/auth.js';

const router = useRouter();
const manualCode = ref('');
const isVerifying = ref(false);
const formUsername = ref('');
const formDisplayName = ref('');
const formPassword = ref('');
const formPasswordConfirm = ref('');
const isSubmitting = ref(false);
const claimError = ref('');

async function handleManualCodeSubmit() {
  if (!manualCode.value.trim()) return;
  isVerifying.value = true;
  claimError.value = '';
  try {
    await checkInviteUrl(manualCode.value.trim().toUpperCase());
  } finally {
    isVerifying.value = false;
  }
}

// Watch inviteData to auto-fill username based on targetName
watch(inviteData, (newVal) => {
  if (newVal?.targetName) {
    const sanitized = newVal.targetName.toLowerCase().replace(/[^a-z0-9_]/g, '');
    formUsername.value = sanitized || 'user_' + Math.floor(Math.random() * 1000);
    formDisplayName.value = newVal.targetName;
  }
}, { immediate: true });

function handleDismiss() {
  showInviteModal.value = false;
  // Clean url params
  const url = new URL(window.location);
  url.searchParams.delete('invite');
  window.history.replaceState({}, '', url.pathname + url.search);
}

function openLogin() {
  handleDismiss();
  showLoginModal.value = true;
}

async function handleClaim() {
  if (formPassword.value !== formPasswordConfirm.value) {
    claimError.value = 'Konfirmasi kata sandi tidak cocok.';
    return;
  }
  isSubmitting.value = true;
  claimError.value = '';
  try {
    await submitClaimInvite(
      formUsername.value.trim(), 
      formPassword.value, 
      formDisplayName.value.trim() || formUsername.value.trim()
    );
    // Remove invite query param from URL
    const url = new URL(window.location);
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.pathname + url.search);
    router.push('/');
  } catch (err) {
    claimError.value = err.message || 'Gagal mengaktifkan akun.';
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 210;
  padding: 1rem;
  animation: fadeIn 0.2s ease;
}

.invite-card {
  position: relative;
  background: #12141c;
  border: 1px solid rgba(229, 9, 20, 0.3);
  box-shadow: 0 25px 60px rgba(0, 0, 0, 0.9), 0 0 30px rgba(229, 9, 20, 0.15);
  border-radius: 20px;
  width: 100%;
  max-width: 480px;
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

.loading-state {
  text-align: center;
  padding: 2.5rem 1rem;
}

.spinner-large {
  display: inline-block;
  width: 40px;
  height: 40px;
  border: 3px solid rgba(255, 255, 255, 0.15);
  border-top-color: #e50914;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-bottom: 1rem;
}

.loading-text {
  color: #94a3b8;
  font-size: 0.95rem;
}

.error-state {
  text-align: center;
  padding: 1rem 0;
}

.status-icon-wrap {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  margin: 0 auto 1.2rem auto;
  display: flex;
  align-items: center;
  justify-content: center;
}

.status-icon-wrap.error-icon {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.state-title {
  font-size: 1.3rem;
  font-weight: 800;
  color: #fff;
}

.state-desc {
  font-size: 0.9rem;
  color: #fca5a5;
  margin-top: 0.4rem;
  line-height: 1.4;
}

.state-sub {
  font-size: 0.82rem;
  color: #94a3b8;
  margin: 1rem 0 1.5rem 0;
  line-height: 1.45;
}

.vip-header {
  text-align: center;
  margin-bottom: 1.4rem;
}

.vip-crown-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  background: rgba(234, 179, 8, 0.12);
  border: 1px solid rgba(234, 179, 8, 0.35);
  color: #eab308;
  padding: 0.3rem 0.8rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  margin-bottom: 0.75rem;
}

.claim-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.55rem;
  font-weight: 800;
  color: #fff;
  letter-spacing: -0.02em;
}

.claim-subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.invite-info-pill {
  background: rgba(8, 9, 12, 0.9);
  border: 1px solid #1e2230;
  border-radius: 12px;
  padding: 0.85rem 1rem;
  margin-bottom: 1.3rem;
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
}

.info-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.82rem;
}

.info-label {
  color: #94a3b8;
}

.info-val {
  color: #cbd5e1;
  font-weight: 600;
}

.info-val.highlight {
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  text-transform: capitalize;
}

.badge-duration {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.78rem;
  font-weight: 700;
}

.form-error-alert {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.35);
  color: #fca5a5;
  font-size: 0.82rem;
  padding: 0.65rem 0.85rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.claim-form {
  display: flex;
  flex-direction: column;
  gap: 0.9rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0.75rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.form-group label {
  font-size: 0.8rem;
  font-weight: 600;
  color: #cbd5e1;
}

.form-group input {
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 8px;
  padding: 0.65rem 0.8rem;
  color: #fff;
  font-size: 0.88rem;
  outline: none;
  font-family: inherit;
  transition: all 0.2s ease;
}

.form-group input:focus {
  border-color: #e50914;
  box-shadow: 0 0 0 3px rgba(229, 9, 20, 0.15);
}

.field-hint {
  font-size: 0.72rem;
  color: #64748b;
}

.claim-submit-btn {
  margin-top: 0.6rem;
  padding: 0.85rem;
  font-size: 0.95rem;
  font-weight: 700;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.claim-footer-note {
  font-size: 0.75rem;
  color: #64748b;
  text-align: center;
  margin-top: 1rem;
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

@media (max-width: 500px) {
  .form-row {
    grid-template-columns: 1fr;
  }
}
</style>
