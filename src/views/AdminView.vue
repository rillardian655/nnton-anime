<template>
  <div class="admin-page">
    <div class="admin-container">
      <!-- Admin Header -->
      <div class="admin-header">
        <div class="admin-title-wrap">
          <div class="admin-icon-badge">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#e50914" stroke-width="2.2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg>
          </div>
          <div>
            <h1 class="admin-title">Panel Kontrol Administrator</h1>
            <p class="admin-subtitle">Manajemen Link Undangan VIP (1x Pakai), Durasi Pengguna & Cache Terjemahan</p>
          </div>
        </div>

        <router-link to="/" class="btn btn-secondary btn-sm">
          ← Kembali ke Beranda
        </router-link>
      </div>

      <!-- Access Denied if not admin -->
      <div v-if="!isAdmin" class="access-denied-card">
        <div class="denied-icon">🔒</div>
        <h2>Akses Dibatasi</h2>
        <p>Hanya akun Administrator yang berhak mengakses halaman ini.</p>
        <button class="btn btn-primary" @click="showLoginModal = true">
          Masuk sebagai Admin
        </button>
      </div>

      <!-- Admin Content -->
      <div v-else class="admin-content">
        <!-- Stats Row -->
        <div class="stats-row">
          <div class="stat-card">
            <span class="stat-num">{{ stats.totalInvites || 0 }}</span>
            <span class="stat-lbl">Total Undangan Dibuat</span>
          </div>
          <div class="stat-card">
            <span class="stat-num text-success">{{ stats.unclaimedInvites || 0 }}</span>
            <span class="stat-lbl">Undangan Tersedia (Belum Dipakai)</span>
          </div>
          <div class="stat-card">
            <span class="stat-num text-muted">{{ stats.claimedInvites || 0 }}</span>
            <span class="stat-lbl">Undangan Sudah Digunakan</span>
          </div>
          <div class="stat-card">
            <span class="stat-num text-primary">{{ stats.activeUsers || 0 }}</span>
            <span class="stat-lbl">Pengguna VIP Aktif</span>
          </div>
          <div class="stat-card">
            <span class="stat-num text-danger">{{ stats.expiredUsers || 0 }}</span>
            <span class="stat-lbl">Pengguna Expired</span>
          </div>
          <div class="stat-card">
            <span class="stat-num text-gold">{{ stats.cachedTranslations || 0 }}</span>
            <span class="stat-lbl">Anime Diterjemahkan di DB</span>
          </div>
        </div>

        <!-- Section: Pengaturan IP Server Backend (Mobile Connection) -->
        <div class="admin-card server-config-card">
          <div class="card-header-bar">
            <div class="card-header-title">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5"><rect x="2" y="2" width="20" height="8" rx="2" ry="2"></rect><rect x="2" y="14" width="20" height="8" rx="2" ry="2"></rect><line x1="6" y1="6" x2="6.01" y2="6"></line><line x1="6" y1="18" x2="6.01" y2="18"></line></svg>
              <h3>Konfigurasi Alamat IP Server Backend (Aplikasi HP)</h3>
            </div>
            <span class="badge-hint">Atur IP laptop agar HP langsung terhubung</span>
          </div>

          <div class="server-config-body">
            <div class="server-field">
              <label for="serverUrlInput">Alamat URL Server Backend:</label>
              <div class="server-input-row">
                <input 
                  id="serverUrlInput" 
                  v-model="customBackendUrl" 
                  type="text" 
                  placeholder="http://192.168.1.51:8000" 
                  class="admin-input-text"
                />
                <button type="button" class="btn btn-primary btn-sm" @click="saveServerUrl">
                  Simpan IP Server
                </button>
                <button type="button" class="btn btn-secondary btn-sm" @click="testServerConnection" :disabled="isTestingServer">
                  {{ isTestingServer ? 'Menguji...' : 'Uji Koneksi' }}
                </button>
              </div>
              <p v-if="serverTestMessage" class="server-status-msg" :class="{ 'msg-success': serverTestOk, 'msg-error': !serverTestOk }">
                {{ serverTestMessage }}
              </p>
              <p class="server-note">
                IP Laptop saat ini: <code>http://192.168.1.51:8000</code>. Jika laptop berpindah Wi-Fi atau hotspot, cukup ubah IP di sini agar aplikasi HP dapat terus terhubung.
              </p>
            </div>
          </div>
        </div>

        <!-- Section: Buat Akun & Link Undangan -->
        <div class="admin-card create-invite-section">
          <!-- Creation Mode Switcher -->
          <div class="creation-mode-tabs">
            <button 
              type="button"
              class="mode-tab-btn" 
              :class="{ active: creationMode === 'invite' }"
              @click="creationMode = 'invite'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
              <span>Metode 1: Buat Link Undangan (Invite)</span>
            </button>
            <button 
              type="button"
              class="mode-tab-btn" 
              :class="{ active: creationMode === 'direct' }"
              @click="creationMode = 'direct'"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7.5" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
              <span>Metode 2: Buat Akun Langsung (Admin Direct)</span>
            </button>
          </div>

          <!-- MODE 1: FORM LINK UNDANGAN -->
          <div v-if="creationMode === 'invite'">
            <div class="card-header-bar">
              <div class="card-header-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#e50914" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line><line x1="8" y1="12" x2="16" y2="12"></line></svg>
                <h3>Buat Link Undangan Baru (1x Pakai)</h3>
              </div>
              <span class="badge-hint">Penerima klik link & buat username/password sendiri</span>
            </div>

            <form @submit.prevent="handleCreateInvite" class="create-invite-form">
              <div class="invite-form-grid">
                <!-- Nama Penerima -->
                <div class="form-field">
                  <label for="invTargetName">Nama Penerima / Pemesan:</label>
                  <input 
                    id="invTargetName" 
                    v-model="targetName" 
                    type="text" 
                    placeholder="Misal: ceta, budi, kawan_kantor..." 
                    required 
                  />
                  <span class="input-tip">Nama ini akan tercantum di pesan undangan dan mempermudah pelacakan data.</span>
                </div>

                <!-- Durasi Expired -->
                <div class="form-field">
                  <label for="invDuration">Batas Masa Aktif (Expired):</label>
                  <select id="invDuration" v-model="durationType" class="admin-select">
                    <option value="1d">1 Hari (24 Jam)</option>
                    <option value="3d">3 Hari (72 Jam)</option>
                    <option value="1w">1 Minggu (7 Hari)</option>
                    <option value="2w">2 Minggu (14 Hari)</option>
                    <option value="1m">1 Bulan (30 Hari) — Rekomendasi VIP</option>
                    <option value="custom">Kustom (Isi jumlah hari)</option>
                  </select>
                </div>

                <!-- Custom Days if selected -->
                <div class="form-field" v-if="durationType === 'custom'">
                  <label for="invCustomDays">Jumlah Hari Kustom:</label>
                  <input 
                    id="invCustomDays" 
                    v-model.number="customDays" 
                    type="number" 
                    min="1" 
                    max="3650" 
                    placeholder="Contoh: 60" 
                  />
                </div>
              </div>

              <div class="create-btn-wrap">
                <button type="submit" class="btn btn-primary btn-generate" :disabled="isCreating">
                  <span v-if="isCreating" class="spinner-small"></span>
                  <span>{{ isCreating ? 'Membuat Link...' : 'Generate Link Undangan VIP (1x Pakai)' }}</span>
                </button>
              </div>
            </form>
          </div>

          <!-- MODE 2: FORM BUAT AKUN LANGSUNG -->
          <div v-else>
            <div class="card-header-bar">
              <div class="card-header-title">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2.5"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="8.5" cy="7.5" r="4"></circle><line x1="20" y1="8" x2="20" y2="14"></line><line x1="23" y1="11" x2="17" y2="11"></line></svg>
                <h3>Buat Akun VIP Langsung (Admin Direct)</h3>
              </div>
              <span class="badge-hint badge-green">Akun langsung aktif di database tanpa perlu link undangan</span>
            </div>

            <form @submit.prevent="handleCreateDirectUser" class="create-invite-form">
              <div class="invite-form-grid">
                <!-- Username -->
                <div class="form-field">
                  <label for="dirUsername">Username Pengguna:</label>
                  <input 
                    id="dirUsername" 
                    v-model="directUsername" 
                    type="text" 
                    placeholder="Contoh: ceta_anime" 
                    minlength="3"
                    required 
                  />
                  <span class="input-tip">Huruf kecil, tanpa spasi (min. 3 karakter).</span>
                </div>

                <!-- Password -->
                <div class="form-field">
                  <label for="dirPassword">Password Pengguna:</label>
                  <input 
                    id="dirPassword" 
                    v-model="directPassword" 
                    type="text" 
                    placeholder="Contoh: vip12345" 
                    minlength="6"
                    required 
                  />
                  <span class="input-tip">Minimal 6 karakter.</span>
                </div>

                <!-- Display Name -->
                <div class="form-field">
                  <label for="dirDisplayName">Nama Panggilan / Display Name:</label>
                  <input 
                    id="dirDisplayName" 
                    v-model="directDisplayName" 
                    type="text" 
                    placeholder="Contoh: Ceta VIP" 
                  />
                </div>

                <!-- Durasi Hari -->
                <div class="form-field">
                  <label for="dirDuration">Masa Aktif VIP:</label>
                  <select id="dirDuration" v-model.number="directDurationDays" class="admin-select">
                    <option :value="1">1 Hari (Test Akses)</option>
                    <option :value="7">7 Hari (1 Minggu)</option>
                    <option :value="30">30 Hari (1 Bulan VIP)</option>
                    <option :value="90">90 Hari (3 Bulan VIP)</option>
                    <option :value="365">365 Hari (1 Tahun VIP)</option>
                    <option :value="3650">LIFETIME ACCESS (Selamanya)</option>
                  </select>
                </div>
              </div>

              <div class="create-btn-wrap">
                <button type="submit" class="btn btn-success btn-generate" :disabled="isCreatingDirect">
                  <span v-if="isCreatingDirect" class="spinner-small"></span>
                  <span>{{ isCreatingDirect ? 'Membuat Akun...' : '✓ Buat Akun VIP Langsung Sekarang' }}</span>
                </button>
              </div>
            </form>

            <!-- Result Direct User Box -->
            <div v-if="latestDirectUser" class="created-result-card direct-user-result">
              <div class="created-header">
                <div class="result-title">
                  <span class="success-icon">✓</span>
                  <h4>Akun VIP Berhasil Dibuat & Aktif!</h4>
                </div>
                <span class="result-expiry-badge badge-green">{{ latestDirectUser.duration_days >= 3650 ? 'LIFETIME' : `${latestDirectUser.duration_days} Hari` }}</span>
              </div>

              <div class="account-creds-preview">
                <div class="cred-item"><strong>Username:</strong> <code>{{ latestDirectUser.username }}</code></div>
                <div class="cred-item"><strong>Password:</strong> <code>{{ latestDirectUser.plainPassword }}</code></div>
                <div class="cred-item"><strong>Nama:</strong> <span>{{ latestDirectUser.display_name }}</span></div>
              </div>

              <div class="wa-message-preview">
                <div class="wa-header">
                  <span class="wa-badge">Format Pesan WhatsApp (Siap Kirim ke Teman):</span>
                  <button class="btn btn-primary btn-sm" @click="copyDirectWaMessage(latestDirectUser)">
                    {{ copiedDirectWa ? '✓ Pesan Tersalin!' : '📋 Salin Pesan WhatsApp' }}
                  </button>
                </div>
                <pre class="wa-text-box">{{ generateDirectWaText(latestDirectUser) }}</pre>
              </div>
            </div>
          </div>

          <!-- Result Generated Box -->
          <div v-if="latestCreatedInvite" class="created-result-card">
            <div class="created-header">
              <div class="result-title">
                <span class="success-icon">✓</span>
                <h4>Kode Tiket VIP Berhasil Dibuat!</h4>
              </div>
              <span class="result-expiry-badge">{{ latestCreatedInvite.durationLabel || latestCreatedInvite.durationType }}</span>
            </div>

            <!-- Direct Ticket Code Display Box -->
            <div class="result-ticket-code-card">
              <div class="ticket-val-row">
                <span class="ticket-code-tag">{{ latestCreatedInvite.code }}</span>
                <button class="btn btn-warning btn-sm" @click="copyTicketCode(latestCreatedInvite.code)">
                  {{ copiedCode ? '✓ Kode Tersalin!' : '📋 Salin Kode Tiket' }}
                </button>
              </div>
              <span class="ticket-instruction">Kawan tinggal masukkan kode di atas di aplikasi pada tab <strong>"Masuk Pakai Tiket"</strong>!</span>
            </div>

            <div class="result-url-box">
              <input type="text" :value="getInviteFullUrl(latestCreatedInvite.code)" readonly ref="urlInputRef" />
              <button class="btn btn-secondary btn-sm" @click="copyLink(latestCreatedInvite.code)">
                {{ copiedLink ? '✓ Tersalin' : 'Salin Link' }}
              </button>
            </div>

            <div class="wa-message-preview">
              <div class="wa-header">
                <span class="wa-badge">Format Pesan WhatsApp (Siap Kirim ke Kawan):</span>
                <button class="btn btn-primary btn-sm btn-copy-wa" @click="copyWaMessage(latestCreatedInvite)">
                  {{ copiedWa ? '✓ Pesan WA Tersalin!' : '📲 Salin Pesan WhatsApp Lengkap' }}
                </button>
              </div>
              <pre class="wa-text-box">{{ generateWaText(latestCreatedInvite) }}</pre>
            </div>
          </div>
        </div>

        <!-- Navigation Tabs for Tables -->
        <div class="admin-tabs">
          <button 
            class="admin-tab-btn" 
            :class="{ active: currentTab === 'invites' }" 
            @click="currentTab = 'invites'"
          >
            📋 Daftar Link Undangan ({{ invitesList.length }})
          </button>
          <button 
            class="admin-tab-btn" 
            :class="{ active: currentTab === 'users' }" 
            @click="currentTab = 'users'"
          >
            👥 Daftar Pengguna VIP ({{ usersList.length }})
          </button>
        </div>

        <!-- Tab 1: Invites Table -->
        <div v-if="currentTab === 'invites'" class="admin-card table-card">
          <div class="table-search-bar">
            <input 
              type="text" 
              v-model="inviteSearch" 
              placeholder="Cari penerima (ceta) atau kode undangan..." 
            />
            <button class="btn btn-secondary btn-sm" @click="fetchData">🔄 Refresh Data</button>
          </div>

          <div class="table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Kode Undangan</th>
                  <th>Nama Penerima</th>
                  <th>Durasi Akses</th>
                  <th>Status (1x Pakai)</th>
                  <th>Diklaim Oleh</th>
                  <th>Waktu Dibuat</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="inv in filteredInvites" :key="inv.id">
                  <td>
                    <code class="code-tag">{{ inv.code }}</code>
                  </td>
                  <td class="font-bold text-white">{{ inv.target_name }}</td>
                  <td>
                    <span class="badge-duration-pill">{{ inv.duration_type }}</span>
                  </td>
                  <td>
                    <span v-if="inv.is_used" class="status-claimed">✓ Sudah Digunakan</span>
                    <span v-else class="status-available">● Belum Digunakan (Tersedia)</span>
                  </td>
                  <td>
                    <span v-if="inv.claimed_by_user" class="claimed-user-tag">{{ inv.claimed_by_user }}</span>
                    <span v-else class="text-dim">-</span>
                  </td>
                  <td class="text-sm text-dim">{{ formatDate(inv.created_at) }}</td>
                  <td>
                    <div class="action-buttons-row">
                      <button 
                        class="btn-act btn-act-wa" 
                        title="Salin Pesan WA"
                        @click="copyWaMessage(inv)"
                      >
                        📲 WA
                      </button>
                      <button 
                        class="btn-act btn-act-copy" 
                        title="Salin Link"
                        @click="copyLink(inv.code)"
                      >
                        🔗 Link
                      </button>
                      <button 
                        v-if="!inv.is_used"
                        class="btn-act btn-act-del" 
                        title="Hapus Undangan"
                        @click="handleDeleteInvite(inv.code)"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredInvites.length === 0">
                  <td colspan="7" class="empty-cell">Tidak ada data link undangan yang cocok.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Tab 2: Users Table -->
        <div v-if="currentTab === 'users'" class="admin-card table-card">
          <div class="table-search-bar">
            <input 
              type="text" 
              v-model="userSearch" 
              placeholder="Cari username atau nama tampilan..." 
            />
            <button class="btn btn-secondary btn-sm" @click="fetchData">🔄 Refresh Data</button>
          </div>

          <div class="table-wrap">
            <table class="admin-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Nama Tampilan</th>
                  <th>Role</th>
                  <th>Kode Undangan</th>
                  <th>Masa Berlaku (Expired)</th>
                  <th>Sisa Waktu</th>
                  <th>Status</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="u in filteredUsers" :key="u.id">
                  <td>
                    <div class="user-cell">
                      <div class="avatar-small">{{ (u.display_name || u.username).charAt(0).toUpperCase() }}</div>
                      <span class="font-bold text-white">{{ u.username }}</span>
                    </div>
                  </td>
                  <td>{{ u.display_name }}</td>
                  <td>
                    <span class="role-badge" :class="{ 'role-admin': u.role === 'admin' }">
                      {{ u.role === 'admin' ? 'ADMIN' : 'VIP' }}
                    </span>
                  </td>
                  <td>
                    <code class="code-tag" v-if="u.invite_code">{{ u.invite_code }}</code>
                    <span v-else class="text-dim">-</span>
                  </td>
                  <td class="text-sm">
                    {{ u.role === 'admin' ? 'Permanen (Lifetime)' : formatDate(u.expires_at) }}
                  </td>
                  <td>
                    <span 
                      v-if="u.role !== 'admin'" 
                      class="remaining-tag"
                      :class="{ 'tag-expired': u.isExpired }"
                    >
                      {{ u.isExpired ? 'EXPIRED' : formatRemaining(u.remainingSeconds) }}
                    </span>
                    <span v-else class="text-dim">Selamanya</span>
                  </td>
                  <td>
                    <button 
                      v-if="u.role !== 'admin'"
                      class="status-toggle-btn" 
                      :class="{ 'active': u.is_active }"
                      @click="handleToggleUser(u.username)"
                    >
                      {{ u.is_active ? 'Aktif' : 'Nonaktif' }}
                    </button>
                    <span v-else class="text-dim">Aktif</span>
                  </td>
                  <td>
                    <div class="action-buttons-row" v-if="u.role !== 'admin'">
                      <button 
                        class="btn-act btn-act-extend" 
                        title="Perpanjang 30 Hari"
                        @click="handleExtendUser(u.username, 30)"
                      >
                        +30 Hari
                      </button>
                      <button 
                        class="btn-act btn-act-extend" 
                        title="Perpanjang 7 Hari"
                        @click="handleExtendUser(u.username, 7)"
                      >
                        +7 Hari
                      </button>
                      <button 
                        class="btn-act btn-act-del" 
                        title="Hapus Akun Pengguna"
                        @click="handleDeleteUser(u.username)"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
                <tr v-if="filteredUsers.length === 0">
                  <td colspan="8" class="empty-cell">Tidak ada data pengguna.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { isAdmin, showLoginModal } from '../stores/auth.js';
import { 
  adminCreateInvite, 
  adminCreateUser,
  adminGetInvites, 
  adminGetUsers, 
  adminExtendUser, 
  adminToggleUser, 
  adminDeleteUser, 
  adminDeleteInvite, 
  adminGetStats,
  setBackendUrl,
  getApiBaseUrl 
} from '../api.js';

// Server Backend Configuration State
const customBackendUrl = ref(localStorage.getItem('anipulse_backend_url') || getApiBaseUrl() || 'http://192.168.1.51:8000');
const isTestingServer = ref(false);
const serverTestMessage = ref('');
const serverTestOk = ref(false);

function saveServerUrl() {
  const url = customBackendUrl.value.trim().replace(/\/+$/, '');
  setBackendUrl(url);
  serverTestMessage.value = '✓ Alamat IP server backend berhasil disimpan: ' + url;
  serverTestOk.value = true;
}

async function testServerConnection() {
  isTestingServer.value = true;
  serverTestMessage.value = '';
  try {
    const url = customBackendUrl.value.trim().replace(/\/+$/, '');
    const res = await fetch(`${url}/api/health`, { method: 'GET' });
    if (res.ok) {
      serverTestOk.value = true;
      serverTestMessage.value = '✓ Koneksi berhasil! Server backend merespons 200 OK.';
    } else {
      serverTestOk.value = false;
      serverTestMessage.value = `Server merespons status HTTP ${res.status}.`;
    }
  } catch (err) {
    serverTestOk.value = false;
    serverTestMessage.value = `Gagal terhubung ke server: ${err.message}. Pastikan server.py berjalan dan HP berada di Wi-Fi yang sama.`;
  } finally {
    isTestingServer.value = false;
  }
}

const creationMode = ref('invite'); // 'invite' | 'direct'

// Invite Mode State
const targetName = ref('');
const durationType = ref('1m');
const customDays = ref(30);
const isCreating = ref(false);
const latestCreatedInvite = ref(null);
const copiedLink = ref(false);
const copiedWa = ref(false);
const copiedCode = ref(false);

// Direct User Mode State
const directUsername = ref('');
const directPassword = ref('');
const directDisplayName = ref('');
const directDurationDays = ref(30);
const isCreatingDirect = ref(false);
const latestDirectUser = ref(null);
const copiedDirectWa = ref(false);

const currentTab = ref('invites');
const inviteSearch = ref('');
const userSearch = ref('');

const invitesList = ref([]);
const usersList = ref([]);
const stats = ref({});

const filteredInvites = computed(() => {
  const q = inviteSearch.value.trim().toLowerCase();
  if (!q) return invitesList.value;
  return invitesList.value.filter(i => 
    i.target_name?.toLowerCase().includes(q) || 
    i.targetName?.toLowerCase().includes(q) || 
    i.code?.toLowerCase().includes(q) ||
    i.claimed_by_user?.toLowerCase().includes(q) ||
    i.claimedBy?.toLowerCase().includes(q)
  );
});

const filteredUsers = computed(() => {
  const q = userSearch.value.trim().toLowerCase();
  if (!q) return usersList.value;
  return usersList.value.filter(u => 
    u.username?.toLowerCase().includes(q) || 
    u.display_name?.toLowerCase().includes(q)
  );
});

function getInviteFullUrl(code) {
  const origin = window.location.origin;
  return `${origin}/?invite=${code}`;
}

function generateWaText(invite) {
  const target = invite.target_name || invite.targetName || 'Kawan';
  const code = invite.code || '';
  const dur = invite.durationLabel || invite.duration_type || invite.durationType || '30 Hari';

  return `Halo ${target}! 🎬✨

Ini Kode Tiket VIP AniPulse kamu:
🎫 KODE TIKET: ${code}
⏳ Masa Aktif: ${dur}

Cara Pakai Sangat Mudah:
1. Buka aplikasi AniPulse di HP kamu
2. Pilih tab "Masuk Pakai Tiket"
3. Masukkan kode: ${code}
Langsung aktif nonton anime sepuasnya tanpa ribet buat email atau password! 🍿✨`;
}

async function copyTicketCode(code) {
  try {
    await navigator.clipboard.writeText(code);
    copiedCode.value = true;
    setTimeout(() => copiedCode.value = false, 2500);
  } catch (_) {
    prompt('Salin Kode Tiket:', code);
  }
}

async function handleCreateInvite() {
  if (!targetName.value.trim()) return;
  isCreating.value = true;
  copiedLink.value = false;
  copiedWa.value = false;
  copiedCode.value = false;
  try {
    const res = await adminCreateInvite(targetName.value.trim(), durationType.value, customDays.value);
    if (res.success && res.invite) {
      latestCreatedInvite.value = res.invite;
      targetName.value = '';
      await fetchData();
    }
  } catch (err) {
    alert('Gagal membuat tiket: ' + err.message);
  } finally {
    isCreating.value = false;
  }
}

async function copyLink(code) {
  const url = getInviteFullUrl(code);
  await navigator.clipboard.writeText(url);
  copiedLink.value = true;
  setTimeout(() => copiedLink.value = false, 2500);
}

async function copyWaMessage(invite) {
  const text = generateWaText(invite);
  await navigator.clipboard.writeText(text);
  copiedWa.value = true;
  setTimeout(() => copiedWa.value = false, 2500);
}

async function handleCreateDirectUser() {
  if (!directUsername.value.trim() || !directPassword.value.trim()) return;
  isCreatingDirect.value = true;
  copiedDirectWa.value = false;
  try {
    const res = await adminCreateUser(
      directUsername.value.trim(),
      directPassword.value.trim(),
      directDisplayName.value.trim(),
      directDurationDays.value
    );
    if (res.success && res.user) {
      latestDirectUser.value = {
        ...res.user,
        plainPassword: directPassword.value.trim()
      };
      directUsername.value = '';
      directPassword.value = '';
      directDisplayName.value = '';
      await fetchData();
    }
  } catch (err) {
    alert('Gagal membuat akun: ' + err.message);
  } finally {
    isCreatingDirect.value = false;
  }
}

function generateDirectWaText(user) {
  const origin = window.location.origin;
  const name = user.display_name || user.username;
  const days = user.duration_days >= 3650 ? 'LIFETIME ACCESS (Selamanya)' : `${user.duration_days} Hari`;

  return `Halo ${name}! 🎉

Akun VIP AniPulse kamu sudah berhasil dibuat dan langsung AKTIF:
🌐 Akses Aplikasi: ${origin}
👤 Username: ${user.username}
🔑 Password: ${user.plainPassword}
⏳ Masa Aktif: ${days}

Cara masuk:
1. Buka aplikasi AniPulse di link di atas
2. Klik tombol "Masuk Akun" di menu atau footer
3. Masukkan Username & Password di atas

Selamat menonton anime favorit subtitle Indonesia tanpa iklan! 🍿✨`;
}

async function copyDirectWaMessage(user) {
  const text = generateDirectWaText(user);
  await navigator.clipboard.writeText(text);
  copiedDirectWa.value = true;
  setTimeout(() => copiedDirectWa.value = false, 2500);
}

async function handleExtendUser(username, days) {
  if (!confirm(`Perpanjang masa aktif ${username} selama +${days} hari?`)) return;
  try {
    await adminExtendUser(username, days);
    await fetchData();
  } catch (err) {
    alert('Gagal perpanjang: ' + err.message);
  }
}

async function handleToggleUser(username) {
  try {
    await adminToggleUser(username);
    await fetchData();
  } catch (err) {
    alert('Gagal ubah status: ' + err.message);
  }
}

async function handleDeleteUser(username) {
  if (!confirm(`Hapus akun ${username}? Tindakan ini tidak dapat dibatalkan.`)) return;
  try {
    await adminDeleteUser(username);
    await fetchData();
  } catch (err) {
    alert('Gagal hapus: ' + err.message);
  }
}

async function handleDeleteInvite(code) {
  if (!confirm(`Hapus kode undangan ${code}?`)) return;
  try {
    await adminDeleteInvite(code);
    await fetchData();
  } catch (err) {
    alert('Gagal hapus: ' + err.message);
  }
}

function formatRemaining(seconds) {
  if (!seconds || seconds <= 0) return 'Expired';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days} Hari ${hours} Jam`;
  return `${hours} Jam`;
}

function formatDate(isoStr) {
  if (!isoStr) return '-';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return isoStr;
  }
}

async function fetchData() {
  try {
    const [invites, users, st] = await Promise.all([
      adminGetInvites(),
      adminGetUsers(),
      adminGetStats()
    ]);
    invitesList.value = invites;
    usersList.value = users;
    stats.value = st;
  } catch (err) {
    console.error('Fetch admin data error:', err);
  }
}

onMounted(() => {
  if (isAdmin.value) {
    fetchData();
  }
});
</script>

<style scoped>
.admin-page {
  padding: 2rem 0 5rem 0;
  min-height: 90vh;
}

.admin-container {
  max-width: 1300px;
  margin: 0 auto;
  padding: 0 1.5rem;
}

.admin-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 2rem;
  flex-wrap: wrap;
  gap: 1rem;
}

.admin-title-wrap {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.admin-icon-badge {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: rgba(229, 9, 20, 0.15);
  border: 1px solid rgba(229, 9, 20, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}

.admin-title {
  font-family: 'Outfit', sans-serif;
  font-size: 1.6rem;
  font-weight: 800;
  color: #fff;
}

.admin-subtitle {
  font-size: 0.85rem;
  color: #94a3b8;
  margin-top: 0.2rem;
}

.access-denied-card {
  background: #12141c;
  border: 1px solid #2a3044;
  border-radius: 16px;
  padding: 3rem 2rem;
  text-align: center;
  max-width: 450px;
  margin: 3rem auto;
}

.denied-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1rem;
  margin-bottom: 1.8rem;
}

.stat-card {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 12px;
  padding: 1.1rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.stat-num {
  font-family: 'Outfit', sans-serif;
  font-size: 1.8rem;
  font-weight: 800;
  color: #fff;
  line-height: 1;
}

.stat-lbl {
  font-size: 0.75rem;
  color: #94a3b8;
  font-weight: 600;
}

.text-success { color: #10b981; }
.text-primary { color: #3b82f6; }
.text-danger { color: #ef4444; }
.text-gold { color: #eab308; }
.text-muted { color: #cbd5e1; }
.text-dim { color: #64748b; }

.admin-card {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 16px;
  padding: 1.6rem 1.8rem;
  margin-bottom: 1.8rem;
}

/* Server Config Card */
.server-config-card {
  border-color: rgba(59, 130, 246, 0.25);
  background: linear-gradient(180deg, rgba(59, 130, 246, 0.04) 0%, rgba(18, 20, 28, 0.95) 100%);
}

.server-config-body {
  margin-top: 1.2rem;
}

.server-field label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: #cbd5e1;
  margin-bottom: 0.5rem;
}

.server-input-row {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  flex-wrap: wrap;
}

.server-input-row .admin-input-text {
  flex: 1;
  min-width: 200px;
}

.server-status-msg {
  margin-top: 0.6rem;
  font-size: 0.82rem;
  font-weight: 600;
  border-radius: 8px;
  padding: 0.5rem 0.8rem;
}

.server-status-msg.msg-success {
  background: rgba(16, 185, 129, 0.12);
  color: #34d399;
  border: 1px solid rgba(16, 185, 129, 0.25);
}

.server-status-msg.msg-error {
  background: rgba(239, 68, 68, 0.12);
  color: #f87171;
  border: 1px solid rgba(239, 68, 68, 0.25);
}

.server-note {
  margin-top: 0.5rem;
  font-size: 0.78rem;
  color: #94a3b8;
  line-height: 1.4;
}

.server-note code {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 6px;
  border-radius: 4px;
  color: #38bdf8;
  font-family: monospace;
}

/* Creation Mode Switcher Tabs */
.creation-mode-tabs {
  display: flex;
  gap: 0.6rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid #1e2230;
  padding-bottom: 1rem;
  flex-wrap: wrap;
}

.mode-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  background: #0d0f17;
  border: 1px solid #232838;
  color: #94a3b8;
  padding: 0.6rem 1.1rem;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.mode-tab-btn:hover {
  background: #161a26;
  color: #fff;
  border-color: #3b435c;
}

.mode-tab-btn.active {
  background: rgba(229, 9, 20, 0.15);
  border-color: #e50914;
  color: #ffffff;
}

.mode-tab-btn.active:last-child {
  background: rgba(34, 197, 94, 0.15);
  border-color: #22c55e;
  color: #4ade80;
}

.btn-success {
  background: #16a34a;
  color: #fff;
  border: none;
  cursor: pointer;
}

.btn-success:hover {
  background: #15803d;
}

.badge-green {
  background: rgba(34, 197, 94, 0.15) !important;
  color: #4ade80 !important;
  border-color: rgba(34, 197, 94, 0.35) !important;
}

/* Account Creds Box */
.account-creds-preview {
  display: flex;
  gap: 1.5rem;
  background: #090a0f;
  border: 1px solid #1e2332;
  border-radius: 10px;
  padding: 0.85rem 1.2rem;
  margin-top: 1rem;
  flex-wrap: wrap;
}

.cred-item {
  font-size: 0.88rem;
  color: #cbd5e1;
}

.cred-item strong {
  color: #94a3b8;
  margin-right: 0.35rem;
}

.cred-item code {
  background: rgba(255, 255, 255, 0.1);
  padding: 2px 7px;
  border-radius: 4px;
  color: #4ade80;
  font-weight: 700;
}

.card-header-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.2rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.card-header-title {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  font-size: 1.1rem;
  font-weight: 800;
  color: #fff;
}

.badge-hint {
  background: rgba(229, 9, 20, 0.12);
  color: #ef4444;
  border: 1px solid rgba(229, 9, 20, 0.3);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.72rem;
  font-weight: 700;
}

.invite-form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
  align-items: flex-start;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.form-field label {
  font-size: 0.82rem;
  font-weight: 700;
  color: #cbd5e1;
}

.form-field input, .admin-select {
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 8px;
  padding: 0.65rem 0.85rem;
  color: #fff;
  font-size: 0.88rem;
  outline: none;
  font-family: inherit;
}

.form-field input:focus, .admin-select:focus {
  border-color: #e50914;
}

.input-tip {
  font-size: 0.72rem;
  color: #64748b;
}

.create-btn-wrap {
  margin-top: 1.2rem;
}

.btn-generate {
  padding: 0.75rem 1.6rem;
  font-size: 0.95rem;
  font-weight: 800;
  border-radius: 10px;
}

/* Created Result Card */
.created-result-card {
  margin-top: 1.6rem;
  background: rgba(8, 9, 12, 0.95);
  border: 1px solid rgba(16, 185, 129, 0.35);
  border-radius: 12px;
  padding: 1.4rem;
  animation: fadeIn 0.25s ease;
}

.created-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.success-icon {
  width: 22px;
  height: 22px;
  background: #10b981;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
}

.result-title h4 {
  font-size: 1.05rem;
  color: #fff;
}

.result-expiry-badge {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 700;
}

.result-ticket-code-card {
  background: rgba(217, 119, 6, 0.1);
  border: 1.5px dashed rgba(245, 158, 11, 0.45);
  border-radius: 10px;
  padding: 0.85rem 1.1rem;
  margin-bottom: 1rem;
}

.ticket-val-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 0.4rem;
}

.ticket-code-tag {
  font-family: monospace;
  font-size: 1.25rem;
  font-weight: 800;
  color: #fbbf24;
  letter-spacing: 1.5px;
  background: rgba(0, 0, 0, 0.4);
  padding: 4px 10px;
  border-radius: 6px;
}

.ticket-instruction {
  font-size: 0.78rem;
  color: #cbd5e1;
  line-height: 1.4;
}

.ticket-instruction strong {
  color: #fbbf24;
}

.result-url-box {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.2rem;
}

.result-url-box input {
  flex: 1;
  background: #12141c;
  border: 1px solid #2a3044;
  border-radius: 8px;
  padding: 0.6rem 0.85rem;
  color: #60a5fa;
  font-family: monospace;
  font-size: 0.9rem;
}

.wa-message-preview {
  background: #12141c;
  border: 1px solid #1e2230;
  border-radius: 8px;
  padding: 1rem;
}

.wa-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.6rem;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.wa-badge {
  font-size: 0.78rem;
  font-weight: 700;
  color: #10b981;
}

.btn-copy-wa {
  background: #25d366;
  border-color: #25d366;
  color: #fff;
  font-weight: 700;
}

.btn-copy-wa:hover {
  background: #20ba5a;
}

.wa-text-box {
  white-space: pre-wrap;
  font-family: inherit;
  font-size: 0.82rem;
  color: #cbd5e1;
  line-height: 1.5;
  background: #08090c;
  padding: 0.8rem 1rem;
  border-radius: 6px;
}

/* Tabs */
.admin-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.admin-tab-btn {
  background: #12141c;
  border: 1px solid #1e2230;
  color: #94a3b8;
  padding: 0.65rem 1.2rem;
  border-radius: 10px;
  font-size: 0.88rem;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.2s ease;
}

.admin-tab-btn:hover {
  color: #fff;
  border-color: #2a3044;
}

.admin-tab-btn.active {
  background: #e50914;
  border-color: #e50914;
  color: #fff;
}

/* Tables */
.table-search-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.2rem;
}

.table-search-bar input {
  max-width: 380px;
  width: 100%;
  background: #08090c;
  border: 1px solid #1e2230;
  border-radius: 8px;
  padding: 0.55rem 0.85rem;
  color: #fff;
  font-size: 0.82rem;
  outline: none;
}

.table-search-bar input:focus {
  border-color: #e50914;
}

.table-wrap {
  overflow-x: auto;
}

.admin-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.admin-table th {
  padding: 0.75rem 0.85rem;
  font-size: 0.75rem;
  text-transform: uppercase;
  color: #64748b;
  font-weight: 700;
  letter-spacing: 0.05em;
  border-bottom: 1px solid #1e2230;
}

.admin-table td {
  padding: 0.85rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.04);
  font-size: 0.84rem;
  color: #cbd5e1;
}

.admin-table tr:hover td {
  background: rgba(255, 255, 255, 0.02);
}

.code-tag {
  background: #08090c;
  border: 1px solid #2a3044;
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
  color: #f87171;
  font-size: 0.8rem;
}

.badge-duration-pill {
  background: rgba(255, 255, 255, 0.08);
  padding: 2px 7px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
}

.status-available {
  color: #10b981;
  font-weight: 700;
}

.status-claimed {
  color: #64748b;
  text-decoration: line-through;
}

.claimed-user-tag {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border: 1px solid rgba(59, 130, 246, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.78rem;
  font-weight: 600;
}

.user-cell {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.avatar-small {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  background: #e50914;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 800;
}

.role-badge {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 800;
}

.role-badge.role-admin {
  background: rgba(229, 9, 20, 0.2);
  color: #e50914;
}

.remaining-tag {
  background: rgba(16, 185, 129, 0.12);
  color: #10b981;
  border: 1px solid rgba(16, 185, 129, 0.3);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 700;
}

.remaining-tag.tag-expired {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
  border-color: rgba(239, 68, 68, 0.3);
}

.status-toggle-btn {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid #1e2230;
  color: #94a3b8;
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.status-toggle-btn.active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
  border-color: rgba(16, 185, 129, 0.3);
}

.action-buttons-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.btn-act {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.1);
  color: #cbd5e1;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 0.72rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-act:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #fff;
}

.btn-act-wa {
  background: rgba(37, 211, 102, 0.15);
  color: #25d366;
  border-color: rgba(37, 211, 102, 0.3);
}

.btn-act-extend {
  background: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.3);
}

.btn-act-del:hover {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
}

.empty-cell {
  text-align: center;
  color: #64748b;
  padding: 2rem 0;
}

.spinner-small {
  display: inline-block;
  width: 14px;
  height: 14px;
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1024px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr);
  }
  .invite-form-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 600px) {
  .stats-row {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
