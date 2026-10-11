// Striver A2Z DSA Tracker • Multi-Platform Edition (LeetCode, GFG, Code360, TUF)
(function () {
  'use strict';

  const STORAGE_KEY = 'striver_a2z_tracker_all_v1';
  const THEME_KEY = 'striver_theme_pref';

  const defaultState = {
    completed: {},      // { [id]: boolean }
    starred: {},        // { [id]: boolean }
    notes: {},          // { [id]: string }
    collapsedSteps: {}, // { [stepId]: boolean }
    lastActive: null
  };

  let state = loadState();
  let currentFilters = {
    search: '',
    platform: 'all',    // 'all' | 'leetcode' | 'gfg' | 'code360' | 'youtube'
    difficulty: 'all',  // 'all' | 'Easy' | 'Medium' | 'Hard'
    status: 'all',      // 'all' | 'solved' | 'unsolved' | 'starred' | 'notes'
    stepId: 'all',      // 'all' | step number
    sortBy: 'default'   // 'default' | 'lcNumber' | 'title' | 'diffAsc' | 'diffDesc'
  };

  let activeNoteQuestionId = null;

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          completed: parsed.completed || {},
          starred: parsed.starred || {},
          notes: parsed.notes || {},
          collapsedSteps: parsed.collapsedSteps || {},
          lastActive: parsed.lastActive || null
        };
      }
    } catch (e) {
      console.error('Failed to load state from localStorage', e);
    }
    return JSON.parse(JSON.stringify(defaultState));
  }

  function saveState() {
    try {
      state.lastActive = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      triggerCloudSync();
    } catch (e) {
      console.error('Failed to save state to localStorage', e);
      showToast('Storage error or quota exceeded', 'error');
    }
  }

  // --- Password-Only Cloud Sync Module ---
  const SYNC_CONFIG_KEY = 'striver_cloud_sync_config_v2';
  const KV_REGISTRY_APP_KEY = 'ftoqt8yv';
  const CLOUD_OBJECTS_URL = 'https://api.restful-api.dev/objects';
  let syncDebounceTimer = null;

  async function hashPassword(password) {
    const raw = 'striver_a2z_salt_2025_' + password.trim();
    try {
      if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest) {
        const enc = new TextEncoder();
        const data = enc.encode(raw);
        const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 32);
      }
    } catch (e) {}
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = ((h1 ^ (h1 >>> 16)) >>> 0).toString(16).padStart(8, '0');
    h2 = ((h2 ^ (h2 >>> 16)) >>> 0).toString(16).padStart(8, '0');
    return (h1 + h2 + h1 + h2).substring(0, 32);
  }

  function getSyncConfig() {
    try {
      const saved = localStorage.getItem(SYNC_CONFIG_KEY);
      if (saved) return JSON.parse(saved);
    } catch(e) {}
    return { password: '', cloudId: '', autoSync: false, lastSynced: null };
  }

  function saveSyncConfig(cfg) {
    try {
      localStorage.setItem(SYNC_CONFIG_KEY, JSON.stringify(cfg));
    } catch(e) {}
    updateSyncUI();
  }

  function updateSyncUI(statusText, statusType) {
    const cfg = getSyncConfig();
    const syncDot = document.getElementById('sync-dot');
    const syncText = document.getElementById('sync-text');

    const connectedView = document.getElementById('sync-connected-view');
    const setupView = document.getElementById('sync-setup-view');
    const lastTimeDisplay = document.getElementById('sync-last-time');

    const isConnected = !!(cfg.cloudId && cfg.autoSync);

    if (isConnected) {
      if (connectedView) connectedView.classList.remove('hidden');
      if (setupView) setupView.classList.add('hidden');
      if (lastTimeDisplay) {
        const d = cfg.lastSynced ? new Date(cfg.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never';
        lastTimeDisplay.textContent = 'Last synced: ' + d;
      }

      if (syncDot) {
        if (statusType === 'syncing') {
          syncDot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-ping';
          if (syncText) syncText.textContent = statusText || 'Syncing...';
        } else if (statusType === 'error') {
          syncDot.className = 'w-2 h-2 rounded-full bg-rose-400';
          if (syncText) syncText.textContent = statusText || 'Sync Error';
        } else {
          syncDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
          if (syncText) syncText.textContent = 'Cloud Synced';
        }
      }
    } else {
      if (connectedView) connectedView.classList.add('hidden');
      if (setupView) setupView.classList.remove('hidden');
      if (syncDot) syncDot.className = 'w-2 h-2 rounded-full bg-slate-500';
      if (syncText) syncText.textContent = 'Cloud Sync';
    }
  }

  function triggerCloudSync() {
    const cfg = getSyncConfig();
    if (!cfg.cloudId || !cfg.autoSync) return;

    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    updateSyncUI('Syncing...', 'syncing');

    syncDebounceTimer = setTimeout(async () => {
      try {
        const payload = {
          name: 'striver_sync_v3',
          data: {
            version: '3.0',
            updatedAt: new Date().toISOString(),
            state: {
              completed: state.completed,
              starred: state.starred,
              notes: state.notes
            }
          }
        };

        const response = await fetch(`${CLOUD_OBJECTS_URL}/${cfg.cloudId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error('HTTP ' + response.status);
        cfg.lastSynced = new Date().toISOString();
        saveSyncConfig(cfg);
        updateSyncUI('Synced', 'success');
      } catch (err) {
        console.error('Cloud sync push failed', err);
        updateSyncUI('Sync Error', 'error');
      }
    }, 1500);
  }

  async function pullFromCloud(manual = false) {
    const cfg = getSyncConfig();
    if (!cfg.cloudId) return;

    updateSyncUI('Syncing...', 'syncing');

    try {
      const response = await fetch(`${CLOUD_OBJECTS_URL}/${cfg.cloudId}`);
      if (!response.ok) throw new Error('HTTP ' + response.status);
      const data = await response.json();
      const remoteState = (data.data && data.data.state) ? data.data.state : (data.data || {});

      let changed = false;
      Object.keys(remoteState.completed || {}).forEach(k => {
        if (remoteState.completed[k] && !state.completed[k]) {
          state.completed[k] = true;
          changed = true;
        }
      });
      Object.keys(remoteState.starred || {}).forEach(k => {
        if (remoteState.starred[k] && !state.starred[k]) {
          state.starred[k] = true;
          changed = true;
        }
      });
      Object.keys(remoteState.notes || {}).forEach(k => {
        if (!state.notes[k] || state.notes[k].trim() === '') {
          state.notes[k] = remoteState.notes[k];
          changed = true;
        }
      });

      cfg.lastSynced = new Date().toISOString();
      saveSyncConfig(cfg);

      if (changed || manual) {
        state.lastActive = new Date().toISOString();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
        if (manual) showToast('Progress synced across devices! ☁️', 'success');
      }
      updateSyncUI('Synced', 'success');
    } catch (err) {
      console.error('Failed to pull from Cloud', err);
      updateSyncUI('Sync Error', 'error');
      if (manual) showToast('Cloud Sync error: ' + err.message, 'error');
    }
  }

  async function connectWithPassword(password) {
    showToast('Connecting to Cloud Sync...', 'info');
    try {
      const hash = await hashPassword(password);
      
      // Step 1: Query pointer registry to check if this password already has a cloud record
      const ptrRes = await fetch(`https://keyvalue.immanuel.co/api/KeyVal/GetValue/${KV_REGISTRY_APP_KEY}/${hash}`);
      let pointer = (await ptrRes.text()).replace(/["\s]/g, '');

      let cloudId = pointer;
      let isExisting = false;

      if (pointer && pointer !== 'null' && pointer.length > 5) {
        // Existing backup found! Pull and merge
        cloudId = pointer;
        isExisting = true;
      } else {
        // New password: create initial cloud record
        const createRes = await fetch(CLOUD_OBJECTS_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'striver_sync_' + hash.slice(0, 8),
            data: {
              version: '3.0',
              updatedAt: new Date().toISOString(),
              state: {
                completed: state.completed,
                starred: state.starred,
                notes: state.notes
              }
            }
          })
        });

        if (!createRes.ok) throw new Error('Failed to create cloud record (HTTP ' + createRes.status + ')');
        const created = await createRes.json();
        cloudId = created.id;

        // Save pointer in registry
        await fetch(`https://keyvalue.immanuel.co/api/KeyVal/UpdateValue/${KV_REGISTRY_APP_KEY}/${hash}/${cloudId}`, {
          method: 'POST'
        });
      }

      const cfg = {
        password: password,
        cloudId: cloudId,
        autoSync: true,
        lastSynced: new Date().toISOString()
      };
      saveSyncConfig(cfg);

      if (isExisting) {
        await pullFromCloud(true);
        // Also push back merged state so cloud has union of both devices
        triggerCloudSync();
        showToast('Connected! Progress synced from your cloud backup 🚀', 'success');
      } else {
        showToast('Connected! Cloud backup created for this password 🚀', 'success');
      }

      return true;
    } catch (err) {
      showToast('Connection failed: ' + err.message, 'error');
      return false;
    }
  }

  function disconnectSync() {
    saveSyncConfig({ password: '', cloudId: '', autoSync: false, lastSynced: null });
    showToast('Cloud Sync disconnected', 'info');
  }


  // --- Theme Controller ---
  function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(savedTheme);

    const btnTheme = document.getElementById('btn-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        const isDark = document.documentElement.classList.contains('dark');
        const newTheme = isDark ? 'light' : 'dark';
        applyTheme(newTheme);
        localStorage.setItem(THEME_KEY, newTheme);
      });
    }
  }

  function applyTheme(theme) {
    const sunIcon = document.getElementById('theme-icon-sun');
    const moonIcon = document.getElementById('theme-icon-moon');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.documentElement.classList.remove('light');
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.classList.add('light');
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
    }
  }

  // --- UI Toast Notifications ---
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast px-4 py-3 rounded-xl shadow-xl border text-xs sm:text-sm font-medium flex items-center gap-2.5 ${
      type === 'success' 
        ? 'bg-slate-900 border-emerald-500/40 text-emerald-300' 
        : type === 'error'
        ? 'bg-slate-900 border-rose-500/40 text-rose-300'
        : 'bg-slate-900 border-indigo-500/40 text-indigo-200'
    }`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✓';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span class="font-bold">${icon}</span><span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 250);
    }, 2800);
  }

  // --- Data Accessors ---
  function getDataset() {
    return window.STRIVER_DATA || { metadata: {}, steps: [], questions: [] };
  }

  function getAllQuestions() {
    return getDataset().questions || [];
  }

  function getSteps() {
    return getDataset().steps || [];
  }

  // --- Progress & Analytics Calculation ---
  function updateAnalytics() {
    const allQ = getAllQuestions();

    // Determine base set of questions according to active platform filter
    let basePool = allQ;
    if (currentFilters.platform !== 'all') {
      basePool = allQ.filter(q => q.platforms && q.platforms.includes(currentFilters.platform));
    }

    const totalCount = basePool.length || 1;

    let solvedTotal = 0;
    let solvedEasy = 0;
    let solvedMedium = 0;
    let solvedHard = 0;
    let totalEasy = 0;
    let totalMedium = 0;
    let totalHard = 0;
    let starredCount = 0;
    let notesCount = 0;

    basePool.forEach(q => {
      const isSolved = !!state.completed[q.id];
      const isStarred = !!state.starred[q.id];
      const hasNote = !!(state.notes[q.id] && state.notes[q.id].trim());

      if (isStarred) starredCount++;
      if (hasNote) notesCount++;

      if (q.difficulty === 'Easy') {
        totalEasy++;
        if (isSolved) solvedEasy++;
      } else if (q.difficulty === 'Medium') {
        totalMedium++;
        if (isSolved) solvedMedium++;
      } else if (q.difficulty === 'Hard') {
        totalHard++;
        if (isSolved) solvedHard++;
      }

      if (isSolved) solvedTotal++;
    });

    const percentTotal = Math.round((solvedTotal / totalCount) * 100);
    const percentEasy = totalEasy > 0 ? Math.round((solvedEasy / totalEasy) * 100) : 0;
    const percentMedium = totalMedium > 0 ? Math.round((solvedMedium / totalMedium) * 100) : 0;
    const percentHard = totalHard > 0 ? Math.round((solvedHard / totalHard) * 100) : 0;

    // Update Overall KPI
    const elOverallCount = document.getElementById('overall-solved-count');
    const elOverallTotal = document.getElementById('overall-total-count');
    const elOverallPercent = document.getElementById('overall-percent');
    const elOverallCircle = document.getElementById('overall-circle-bar');
    if (elOverallCount) elOverallCount.textContent = solvedTotal;
    if (elOverallTotal) elOverallTotal.textContent = `/ ${totalCount} Problems`;
    if (elOverallPercent) elOverallPercent.textContent = `${percentTotal}%`;
    if (elOverallCircle) {
      const radius = 46;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (percentTotal / 100) * circumference;
      elOverallCircle.style.strokeDashoffset = offset;
    }

    // Update Starred & Notes stats
    const elStarredCount = document.getElementById('stat-starred-count');
    const elNotesCount = document.getElementById('stat-notes-count');
    if (elStarredCount) elStarredCount.textContent = starredCount;
    if (elNotesCount) elNotesCount.textContent = notesCount;

    // Update Difficulty Breakdown
    const elEasyCount = document.getElementById('easy-count');
    const elEasyTotal = document.getElementById('easy-total');
    const elEasyPercent = document.getElementById('easy-percent');
    const elEasyBar = document.getElementById('easy-bar');
    if (elEasyCount) elEasyCount.textContent = solvedEasy;
    if (elEasyTotal) elEasyTotal.textContent = `/ ${totalEasy}`;
    if (elEasyPercent) elEasyPercent.textContent = `${percentEasy}%`;
    if (elEasyBar) elEasyBar.style.width = `${percentEasy}%`;

    const elMedCount = document.getElementById('medium-count');
    const elMedTotal = document.getElementById('medium-total');
    const elMedPercent = document.getElementById('medium-percent');
    const elMedBar = document.getElementById('medium-bar');
    if (elMedCount) elMedCount.textContent = solvedMedium;
    if (elMedTotal) elMedTotal.textContent = `/ ${totalMedium}`;
    if (elMedPercent) elMedPercent.textContent = `${percentMedium}%`;
    if (elMedBar) elMedBar.style.width = `${percentMedium}%`;

    const elHardCount = document.getElementById('hard-count');
    const elHardTotal = document.getElementById('hard-total');
    const elHardPercent = document.getElementById('hard-percent');
    const elHardBar = document.getElementById('hard-bar');
    if (elHardCount) elHardCount.textContent = solvedHard;
    if (elHardTotal) elHardTotal.textContent = `/ ${totalHard}`;
    if (elHardPercent) elHardPercent.textContent = `${percentHard}%`;
    if (elHardBar) elHardBar.style.width = `${percentHard}%`;

    // Update Step Badges
    getSteps().forEach(step => {
      const badge = document.getElementById(`step-badge-${step.id}`);
      const bar = document.getElementById(`step-bar-${step.id}`);
      if (badge || bar) {
        let stepSolved = 0;
        let stepTotal = 0;
        step.subtopics.forEach(sub => {
          sub.questions.forEach(q => {
            if (currentFilters.platform === 'all' || (q.platforms && q.platforms.includes(currentFilters.platform))) {
              stepTotal++;
              if (state.completed[q.id]) stepSolved++;
            }
          });
        });
        const stepPct = stepTotal > 0 ? Math.round((stepSolved / stepTotal) * 100) : 0;
        if (badge) badge.textContent = `${stepSolved}/${stepTotal} (${stepPct}%)`;
        if (bar) bar.style.width = `${stepPct}%`;
      }
    });
  }

  // --- Filter Matching ---
  function questionMatchesFilters(q) {
    // 1. Platform Filter
    if (currentFilters.platform !== 'all') {
      if (!q.platforms || !q.platforms.includes(currentFilters.platform)) {
        return false;
      }
    }

    // 2. Difficulty Filter
    if (currentFilters.difficulty !== 'all' && q.difficulty !== currentFilters.difficulty) {
      return false;
    }

    // 3. Status Filter
    const isSolved = !!state.completed[q.id];
    const isStarred = !!state.starred[q.id];
    const hasNote = !!(state.notes[q.id] && state.notes[q.id].trim());

    if (currentFilters.status === 'solved' && !isSolved) return false;
    if (currentFilters.status === 'unsolved' && isSolved) return false;
    if (currentFilters.status === 'starred' && !isStarred) return false;
    if (currentFilters.status === 'notes' && !hasNote) return false;

    // 4. Step Filter
    if (currentFilters.stepId !== 'all' && String(q.stepId) !== String(currentFilters.stepId)) {
      return false;
    }

    // 5. Search Filter
    const qTerm = currentFilters.search.trim().toLowerCase();
    if (qTerm) {
      const matchNum = q.lcNumber && (String(q.lcNumber).toLowerCase() === qTerm || `#${q.lcNumber}` === qTerm);
      const matchTitle = q.title.toLowerCase().includes(qTerm);
      const matchStriver = q.striverName && q.striverName.toLowerCase().includes(qTerm);
      const matchTag = (q.tags || []).some(t => t.toLowerCase().includes(qTerm));
      const matchSub = q.subStepTitle && q.subStepTitle.toLowerCase().includes(qTerm);
      const matchPlatform = (q.platforms || []).some(p => p.toLowerCase().includes(qTerm));

      if (!matchNum && !matchTitle && !matchStriver && !matchTag && !matchSub && !matchPlatform) {
        return false;
      }
    }

    return true;
  }

  // --- Sort Helper ---
  function sortQuestions(questions) {
    if (currentFilters.sortBy === 'default') return questions;

    const copy = [...questions];
    if (currentFilters.sortBy === 'lcNumber') {
      return copy.sort((a, b) => {
        const numA = a.lcNumber || 99999;
        const numB = b.lcNumber || 99999;
        return numA - numB;
      });
    } else if (currentFilters.sortBy === 'title') {
      return copy.sort((a, b) => a.title.localeCompare(b.title));
    } else if (currentFilters.sortBy === 'diffAsc') {
      const order = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
      return copy.sort((a, b) => (order[a.difficulty] || 2) - (order[b.difficulty] || 2));
    } else if (currentFilters.sortBy === 'diffDesc') {
      const order = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
      return copy.sort((a, b) => (order[b.difficulty] || 2) - (order[a.difficulty] || 2));
    }
    return copy;
  }

  // --- Main Render Engine ---
  function renderAll() {
    const container = document.getElementById('steps-container');
    const noResults = document.getElementById('no-results');
    const filterBanner = document.getElementById('filter-banner');
    const filterMatchCount = document.getElementById('filter-match-count');
    const clearFiltersBtn = document.getElementById('btn-clear-filters');
    const lcOnlyToggle = document.getElementById('toggle-lc-only');

    if (!container) return;

    // Synchronize LeetCode Only Toggle switch state
    if (lcOnlyToggle) {
      lcOnlyToggle.checked = (currentFilters.platform === 'leetcode');
    }

    const steps = getSteps();
    let totalMatchingQuestions = 0;
    const isFiltered = currentFilters.search || currentFilters.platform !== 'all' || currentFilters.difficulty !== 'all' || currentFilters.status !== 'all' || currentFilters.stepId !== 'all';

    if (isFiltered) {
      if (filterBanner) filterBanner.classList.remove('hidden');
      if (clearFiltersBtn) clearFiltersBtn.classList.remove('hidden');
    } else {
      if (filterBanner) filterBanner.classList.add('hidden');
      if (clearFiltersBtn) clearFiltersBtn.classList.add('hidden');
    }

    let stepsHtml = '';

    steps.forEach(step => {
      const matchingSubtopics = [];
      let stepTotal = 0;
      let stepSolved = 0;

      step.subtopics.forEach(sub => {
        let matchingQuestions = [];
        sub.questions.forEach(q => {
          if (currentFilters.platform === 'all' || (q.platforms && q.platforms.includes(currentFilters.platform))) {
            stepTotal++;
            if (state.completed[q.id]) stepSolved++;
          }

          if (questionMatchesFilters(q)) {
            matchingQuestions.push(q);
            totalMatchingQuestions++;
          }
        });

        if (matchingQuestions.length > 0) {
          matchingQuestions = sortQuestions(matchingQuestions);
          matchingSubtopics.push({
            ...sub,
            questions: matchingQuestions
          });
        }
      });

      if (matchingSubtopics.length === 0) return;

      const isStepCollapsed = !isFiltered && !!state.collapsedSteps[step.id];
      const stepPct = stepTotal > 0 ? Math.round((stepSolved / stepTotal) * 100) : 0;

      stepsHtml += `
        <div class="glass-panel rounded-2xl overflow-hidden shadow-lg border border-slate-800/80 transition" id="step-card-${step.id}">
          
          <!-- Step Header -->
          <div class="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 hover:bg-slate-900/80 cursor-pointer select-none border-b border-slate-800/60" onclick="window.app.toggleStepCollapse(${step.id})">
            
            <div class="flex items-center gap-3">
              <button class="w-7 h-7 rounded-lg bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition">
                <svg class="w-4 h-4 transform transition-transform duration-200 ${isStepCollapsed ? '-rotate-90' : 'rotate-0'}" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              <div>
                <h3 class="text-base sm:text-lg font-bold text-white tracking-tight flex items-center gap-2">
                  <span>${escapeHtml(step.title)}</span>
                </h3>
                <p class="text-xs text-slate-400">${matchingSubtopics.length} Subtopics • ${matchingSubtopics.reduce((acc, s) => acc + s.questions.length, 0)} Questions Shown</p>
              </div>
            </div>

            <div class="flex items-center gap-3 self-end sm:self-center" onclick="event.stopPropagation()">
              
              <!-- Progress indicator -->
              <div class="text-right space-y-1 min-w-[110px]">
                <div class="flex items-center justify-end gap-1.5 text-xs font-semibold text-slate-300">
                  <span id="step-badge-${step.id}">${stepSolved}/${stepTotal} (${stepPct}%)</span>
                </div>
                <div class="w-28 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                  <div id="step-bar-${step.id}" class="bg-indigo-500 h-1.5 rounded-full transition-all duration-300" style="width: ${stepPct}%"></div>
                </div>
              </div>

              <!-- Quick Mark All Menu -->
              <button onclick="window.app.toggleMarkAllInStep(${step.id})" class="text-xs px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition" title="Toggle mark all in step as solved">
                ${stepSolved === stepTotal && stepTotal > 0 ? 'Reset' : 'Done All'}
              </button>

            </div>

          </div>

          <!-- Step Content (Subtopics & Questions) -->
          <div class="accordion-content ${isStepCollapsed ? 'hidden' : 'block'} p-4 sm:p-5 space-y-5" id="step-content-${step.id}">
            ${matchingSubtopics.map(sub => `
              <div class="space-y-2.5">
                <!-- Subtopic Heading -->
                <div class="flex items-center justify-between pb-1.5 border-b border-slate-800/80">
                  <h4 class="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                    <span class="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    ${escapeHtml(sub.id)}: ${escapeHtml(sub.title)}
                  </h4>
                  <span class="text-[11px] font-semibold text-slate-400">
                    ${sub.questions.filter(q => state.completed[q.id]).length}/${sub.questions.length} Solved
                  </span>
                </div>

                <!-- Questions List -->
                <div class="space-y-1.5">
                  ${sub.questions.map(q => renderQuestionRow(q)).join('')}
                </div>
              </div>
            `).join('')}
          </div>

        </div>
      `;
    });

    container.innerHTML = stepsHtml;

    if (filterMatchCount) filterMatchCount.textContent = totalMatchingQuestions;

    if (totalMatchingQuestions === 0) {
      if (noResults) noResults.classList.remove('hidden');
      container.classList.add('hidden');
    } else {
      if (noResults) noResults.classList.add('hidden');
      container.classList.remove('hidden');
    }

    updateAnalytics();
  }

  function renderQuestionRow(q) {
    const isSolved = !!state.completed[q.id];
    const isStarred = !!state.starred[q.id];
    const noteContent = state.notes[q.id] || '';
    const hasNote = noteContent.trim().length > 0;

    const diffClass = q.difficulty === 'Easy' ? 'badge-easy' 
                    : q.difficulty === 'Hard' ? 'badge-hard' 
                    : 'badge-medium';

    // Primary link priority: LeetCode -> GFG -> Code360 -> YouTube -> #
    const primaryLink = (q.links && q.links.leetcode) || (q.links && q.links.gfg) || (q.links && q.links.code360) || '#';

    return `
      <div 
        id="q-row-${q.id}"
        class="question-row flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 rounded-xl border transition ${
          isSolved 
            ? 'bg-slate-900/30 border-slate-800/60 completed-row' 
            : 'bg-slate-900/70 border-slate-800/90 hover:border-slate-700 hover:bg-slate-900'
        }"
      >
        <!-- Left Section: Checkbox + Star + Sheet Index / LC Badge + Title -->
        <div class="flex items-center gap-3 min-w-0 flex-grow">
          
          <!-- Solved Checkbox -->
          <button 
            type="button"
            onclick="window.app.toggleSolved('${q.id}')"
            class="checkbox-custom w-5 h-5 rounded-md flex items-center justify-center border transition flex-shrink-0 ${
              isSolved 
                ? 'bg-emerald-600 border-emerald-500 text-white' 
                : 'border-slate-600 hover:border-emerald-500 text-transparent'
            }"
            title="${isSolved ? 'Mark as Unsolved' : 'Mark as Solved'}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="3" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </button>

          <!-- Star / Bookmark Button -->
          <button 
            type="button"
            onclick="window.app.toggleStarred('${q.id}')"
            class="p-1 rounded text-slate-500 hover:text-amber-400 transition flex-shrink-0 ${isStarred ? 'text-amber-400 font-bold' : ''}"
            title="${isStarred ? 'Remove Bookmark' : 'Bookmark Question'}"
          >
            <svg class="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" />
            </svg>
          </button>

          <!-- Sheet Index or LeetCode Number Badge -->
          ${q.lcNumber ? `
            <span class="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30 flex-shrink-0" title="LeetCode #${q.lcNumber}">
              LC #${q.lcNumber}
            </span>
          ` : `
            <span class="font-mono text-xs font-medium px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700/80 flex-shrink-0" title="Sheet #${q.sheetIndex}">
              #${q.sheetIndex}
            </span>
          `}

          <!-- Title & Striver Alternate Name -->
          <div class="min-w-0 flex-grow">
            <a 
              href="${escapeHtml(primaryLink)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="text-xs sm:text-sm font-semibold hover:text-indigo-400 hover:underline transition truncate block ${
                isSolved ? 'line-through text-slate-400' : 'text-slate-100'
              }"
              title="Open problem: ${escapeHtml(q.title)}"
            >
              ${escapeHtml(q.title)}
            </a>
            ${q.striverName && q.striverName !== q.title ? `
              <span class="text-[10px] text-slate-400 truncate block">A2Z: ${escapeHtml(q.striverName)}</span>
            ` : ''}
          </div>

        </div>

        <!-- Right Section: Difficulty + Platform Links (LC, GFG, Code360, Video) + Notes -->
        <div class="flex items-center gap-1.5 flex-wrap self-end md:self-center flex-shrink-0 pl-8 md:pl-0">
          
          <!-- Difficulty Badge -->
          <span class="text-[11px] font-bold px-2 py-0.5 rounded-full ${diffClass} mr-1">
            ${q.difficulty}
          </span>

          <!-- Platform Action Buttons -->
          ${q.links && q.links.leetcode ? `
            <a 
              href="${escapeHtml(q.links.leetcode)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="p-1 px-2 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-amber-300 text-xs font-medium transition flex items-center gap-1"
              title="Solve on LeetCode"
            >
              <span class="font-bold">LC</span>
              <svg class="w-3 h-3 text-amber-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          ` : ''}

          ${q.links && q.links.gfg ? `
            <a 
              href="${escapeHtml(q.links.gfg)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="p-1 px-2 rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 border border-emerald-500/30 text-emerald-300 text-xs font-medium transition flex items-center gap-1"
              title="Solve on GeeksforGeeks"
            >
              <span class="font-bold">GFG</span>
              <svg class="w-3 h-3 text-emerald-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          ` : ''}

          ${q.links && q.links.code360 ? `
            <a 
              href="${escapeHtml(q.links.code360)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="p-1 px-2 rounded-lg bg-blue-600/15 hover:bg-blue-600/25 border border-blue-500/30 text-blue-300 text-xs font-medium transition flex items-center gap-1"
              title="Solve on Code360 / Coding Ninjas"
            >
              <span>Code360</span>
              <svg class="w-3 h-3 text-blue-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </a>
          ` : ''}

          ${q.links && q.links.youtube ? `
            <a 
              href="${escapeHtml(q.links.youtube)}" 
              target="_blank" 
              rel="noopener noreferrer"
              class="p-1 px-1.5 rounded-lg bg-rose-600/15 hover:bg-rose-600/25 border border-rose-500/30 text-rose-300 text-xs font-medium transition flex items-center gap-1"
              title="Watch YouTube Solution Video"
            >
              <svg class="w-3.5 h-3.5 text-rose-400 fill-current" viewBox="0 0 24 24"><path d="M10 15l5.19-3L10 9v6m11.56-7.83c.13.47.22 1.1.28 1.9.07.8.1 1.49.1 2.09L22 12c0 2.19-.16 3.8-.44 4.83-.25.9-.83 1.48-1.73 1.73-.47.13-1.33.22-2.65.28-1.3.07-2.49.1-3.59.1L12 22c-4.19 0-6.8-.16-7.83-.44-.9-.25-1.48-.83-1.73-1.73-.13-.47-.22-1.1-.28-1.9-.07-.8-.1-1.49-.1-2.09L2 12c0-2.19.16-3.8.44-4.83.25-.9.83-1.48 1.73-1.73.47-.13 1.33-.22 2.65-.28 1.3-.07 2.49-.1 3.59-.1L12 2c4.19 0 6.8.16 7.83.44.9.25 1.48.83 1.73 1.73z"/></svg>
          ` : ''}

          <!-- VS Code / Problem Details Tab Button -->
          <a 
            href="problem.html?id=${q.id}" 
            target="_blank" 
            rel="noopener noreferrer"
            class="p-1 px-2 rounded-lg ${
              q.isOfflineProblem 
                ? 'bg-indigo-600/25 hover:bg-indigo-600/35 border-indigo-500/40 text-indigo-300 font-semibold shadow-sm' 
                : 'bg-slate-800/80 hover:bg-slate-700 border-slate-700 text-slate-300 font-medium'
            } border text-xs transition flex items-center gap-1 hover:scale-105 active:scale-95"
            title="${q.isOfflineProblem ? 'Solve locally in VS Code (Full Statement, Examples & Constraints)' : 'View problem details & VS Code starter code'}"
          >
            <svg class="w-3 h-3 text-indigo-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"/></svg>
            <span>${q.isOfflineProblem ? 'VS Code 💻' : 'VS Code'}</span>
          </a>

          <!-- Notes Trigger -->
          <button 
            onclick="window.app.openNotesModal('${q.id}')"
            class="p-1.5 rounded-lg border text-xs transition flex items-center gap-1 ${
              hasNote 
                ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25' 
                : 'bg-slate-800/80 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
            }"
            title="${hasNote ? 'Edit your notes' : 'Add solution notes'}"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span class="hidden lg:inline text-[11px]">${hasNote ? 'Note' : '+'}</span>
          </button>

          <!-- Copy Link Button -->
          <button 
            onclick="window.app.copyLink('${escapeHtml(primaryLink)}')"
            class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 text-xs transition"
            title="Copy problem link"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>

        </div>
      </div>
    `;
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // --- Exposed Actions ---
  window.app = {
    setPlatformFilter(platform) {
      currentFilters.platform = platform;
      document.querySelectorAll('.filter-platform-btn').forEach(btn => {
        if (btn.getAttribute('data-filter-platform') === platform) {
          btn.classList.add('active', 'bg-indigo-600', 'text-white');
          btn.classList.remove('bg-slate-900', 'text-slate-300');
        } else {
          btn.classList.remove('active', 'bg-indigo-600', 'text-white');
          btn.classList.add('bg-slate-900', 'text-slate-300');
        }
      });
      renderAll();
      showToast(`Showing ${platform === 'all' ? 'All Platforms' : platform.toUpperCase()} questions`, 'info');
    },

    toggleLeetCodeOnly(checked) {
      window.app.setPlatformFilter(checked ? 'leetcode' : 'all');
    },

    setSortBy(sortBy) {
      currentFilters.sortBy = sortBy;
      renderAll();
    },

    toggleSolved(id) {
      state.completed[id] = !state.completed[id];
      saveState();
      renderAll();
      showToast(state.completed[id] ? 'Problem completed! 🚀' : 'Marked as uncompleted', 'success');
    },

    toggleStarred(id) {
      state.starred[id] = !state.starred[id];
      saveState();
      renderAll();
      showToast(state.starred[id] ? 'Bookmarked for revision ⭐' : 'Removed from bookmarks', 'info');
    },

    toggleStepCollapse(stepId) {
      state.collapsedSteps[stepId] = !state.collapsedSteps[stepId];
      saveState();
      const content = document.getElementById(`step-content-${stepId}`);
      if (content) {
        content.classList.toggle('hidden');
      }
      renderAll();
    },

    toggleMarkAllInStep(stepId) {
      const step = getSteps().find(s => s.id === stepId);
      if (!step) return;

      const qList = [];
      step.subtopics.forEach(sub => {
        sub.questions.forEach(q => {
          if (currentFilters.platform === 'all' || (q.platforms && q.platforms.includes(currentFilters.platform))) {
            qList.push(q);
          }
        });
      });
      
      const allDone = qList.every(q => !!state.completed[q.id]);
      const newState = !allDone;

      qList.forEach(q => {
        state.completed[q.id] = newState;
      });

      saveState();
      renderAll();
      showToast(newState ? `All ${qList.length} questions in Step ${stepId} marked solved!` : `Step ${stepId} progress cleared`, 'info');
    },

    copyLink(url) {
      if (!url || url === '#') {
        showToast('No external link available', 'error');
        return;
      }
      navigator.clipboard.writeText(url).then(() => {
        showToast('Link copied to clipboard!', 'success');
      }).catch(() => {
        showToast('Could not copy link', 'error');
      });
    },

    openNotesModal(questionId) {
      activeNoteQuestionId = questionId;
      const q = getAllQuestions().find(item => item.id === questionId);
      if (!q) return;

      const modal = document.getElementById('modal-notes');
      const elTitle = document.getElementById('modal-notes-title');
      const elLc = document.getElementById('modal-notes-lc');
      const elTextarea = document.getElementById('modal-notes-textarea');

      if (elTitle) elTitle.textContent = q.title;
      if (elLc) elLc.textContent = `${q.lcNumber ? `LC #${q.lcNumber} • ` : ''}${q.difficulty} • Step ${q.stepId}`;
      if (elTextarea) elTextarea.value = state.notes[questionId] || '';

      if (modal) modal.classList.remove('hidden');
    },

    closeNotesModal() {
      const modal = document.getElementById('modal-notes');
      if (modal) modal.classList.add('hidden');
      activeNoteQuestionId = null;
    },

    saveNote() {
      if (!activeNoteQuestionId) return;
      const elTextarea = document.getElementById('modal-notes-textarea');
      const text = elTextarea ? elTextarea.value.trim() : '';

      if (text) {
        state.notes[activeNoteQuestionId] = text;
      } else {
        delete state.notes[activeNoteQuestionId];
      }

      saveState();
      window.app.closeNotesModal();
      renderAll();
      showToast('Note saved 📝', 'success');
    },

    deleteNote() {
      if (!activeNoteQuestionId) return;
      delete state.notes[activeNoteQuestionId];
      saveState();
      window.app.closeNotesModal();
      renderAll();
      showToast('Note removed', 'info');
    },

    pickRandomQuestion() {
      const allQ = getAllQuestions();
      const filtered = allQ.filter(q => questionMatchesFilters(q));
      const pool = filtered.length > 0 ? filtered : allQ;

      // Prefer unsolved
      const unsolved = pool.filter(q => !state.completed[q.id]);
      const pickPool = unsolved.length > 0 ? unsolved : pool;
      const randomQ = pickPool[Math.floor(Math.random() * pickPool.length)];

      const modal = document.getElementById('modal-random');
      const elTitle = document.getElementById('random-problem-title');
      const elMeta = document.getElementById('random-problem-meta');
      const elLink = document.getElementById('random-problem-link');

      const primaryLink = (randomQ.links && randomQ.links.leetcode) || (randomQ.links && randomQ.links.gfg) || (randomQ.links && randomQ.links.code360) || '#';

      if (elTitle) elTitle.textContent = randomQ.title;
      if (elMeta) elMeta.textContent = `${randomQ.stepTitle} • ${randomQ.difficulty}${randomQ.lcNumber ? ` • LC #${randomQ.lcNumber}` : ''}`;
      if (elLink) elLink.href = primaryLink;

      if (modal) modal.classList.remove('hidden');
    },

    closeRandomModal() {
      const modal = document.getElementById('modal-random');
      if (modal) modal.classList.add('hidden');
    },

    exportData() {
      const exportObject = {
        app: 'Striver A2Z DSA Tracker',
        version: '3.0',
        exportedAt: new Date().toISOString(),
        state: state
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportObject, null, 2));
      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `striver_a2z_all_platforms_progress_${dateStr}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      showToast('Progress backup downloaded! 📥', 'success');
    },

    importData(file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const imported = JSON.parse(e.target.result);
          if (imported.state && (imported.state.completed || imported.state.notes)) {
            state = {
              completed: imported.state.completed || {},
              starred: imported.state.starred || {},
              notes: imported.state.notes || {},
              collapsedSteps: imported.state.collapsedSteps || {},
              lastActive: new Date().toISOString()
            };
            saveState();
            renderAll();
            showToast('Progress backup restored! 📤', 'success');
          } else {
            showToast('Invalid backup file', 'error');
          }
        } catch (err) {
          showToast('Failed to parse file', 'error');
        }
      };
      reader.readAsText(file);
    },

    resetAllProgress() {
      state = JSON.parse(JSON.stringify(defaultState));
      saveState();
      renderAll();
      const modal = document.getElementById('modal-reset');
      if (modal) modal.classList.add('hidden');
      showToast('All progress reset', 'info');
    }
  };

  // --- Initialize Event Handlers ---
  function initEvents() {
    // Search input
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('btn-clear-search');

    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        currentFilters.search = e.target.value;
        if (clearSearchBtn) {
          if (e.target.value.length > 0) clearSearchBtn.classList.remove('hidden');
          else clearSearchBtn.classList.add('hidden');
        }
        renderAll();
      });
    }

    if (clearSearchBtn && searchInput) {
      clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        currentFilters.search = '';
        clearSearchBtn.classList.add('hidden');
        renderAll();
      });
    }

    // LeetCode Only Quick Switch Toggle in header
    const toggleLcOnly = document.getElementById('toggle-lc-only');
    if (toggleLcOnly) {
      toggleLcOnly.addEventListener('change', (e) => {
        window.app.toggleLeetCodeOnly(e.target.checked);
      });
    }

    // Platform Filter Buttons
    document.querySelectorAll('.filter-platform-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const plat = btn.getAttribute('data-filter-platform');
        window.app.setPlatformFilter(plat);
      });
    });

    // Sort Dropdown
    const sortSelect = document.getElementById('sort-select');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        window.app.setSortBy(e.target.value);
      });
    }

    // Step Jump Select
    const stepSelect = document.getElementById('step-jump-select');
    if (stepSelect) {
      getSteps().forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = `${s.title}`;
        stepSelect.appendChild(opt);
      });

      stepSelect.addEventListener('change', (e) => {
        const val = e.target.value;
        currentFilters.stepId = val;
        renderAll();

        if (val !== 'all') {
          setTimeout(() => {
            const el = document.getElementById(`step-card-${val}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }, 50);
        }
      });
    }

    // Difficulty Filter Buttons
    document.querySelectorAll('.filter-diff-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-diff-btn').forEach(b => b.classList.remove('active', 'bg-indigo-600', 'text-white'));
        btn.classList.add('active', 'bg-indigo-600', 'text-white');
        currentFilters.difficulty = btn.getAttribute('data-filter-diff');
        renderAll();
      });
    });

    // Status Filter Buttons
    document.querySelectorAll('.filter-status-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-status-btn').forEach(b => b.classList.remove('active', 'bg-indigo-600', 'text-white'));
        btn.classList.add('active', 'bg-indigo-600', 'text-white');
        currentFilters.status = btn.getAttribute('data-filter-status');
        renderAll();
      });
    });

    // Clear All Filters
    const resetFilterAction = () => {
      currentFilters = { search: '', platform: 'all', difficulty: 'all', status: 'all', stepId: 'all', sortBy: 'default' };
      if (searchInput) searchInput.value = '';
      if (clearSearchBtn) clearSearchBtn.classList.add('hidden');
      if (stepSelect) stepSelect.value = 'all';
      if (sortSelect) sortSelect.value = 'default';
      if (toggleLcOnly) toggleLcOnly.checked = false;

      document.querySelectorAll('.filter-platform-btn').forEach(b => {
        if (b.getAttribute('data-filter-platform') === 'all') b.classList.add('active', 'bg-indigo-600', 'text-white');
        else b.classList.remove('active', 'bg-indigo-600', 'text-white');
      });

      document.querySelectorAll('.filter-diff-btn').forEach(b => {
        if (b.getAttribute('data-filter-diff') === 'all') b.classList.add('active', 'bg-indigo-600', 'text-white');
        else b.classList.remove('active', 'bg-indigo-600', 'text-white');
      });

      document.querySelectorAll('.filter-status-btn').forEach(b => {
        if (b.getAttribute('data-filter-status') === 'all') b.classList.add('active', 'bg-indigo-600', 'text-white');
        else b.classList.remove('active', 'bg-indigo-600', 'text-white');
      });

      renderAll();
    };

    ['btn-clear-filters', 'btn-banner-clear', 'btn-empty-reset'].forEach(id => {
      const btn = document.getElementById(id);
      if (btn) btn.addEventListener('click', resetFilterAction);
    });

    // Toggle All Steps Collapse
    const btnToggleAll = document.getElementById('btn-toggle-all-steps');
    let allCollapsed = false;
    if (btnToggleAll) {
      btnToggleAll.addEventListener('click', () => {
        allCollapsed = !allCollapsed;
        getSteps().forEach(step => {
          state.collapsedSteps[step.id] = allCollapsed;
        });
        saveState();
        renderAll();
        const textSpan = document.getElementById('text-toggle-all-steps');
        if (textSpan) textSpan.textContent = allCollapsed ? 'Expand All' : 'Collapse All';
      });
    }

    // Header Menu Dropdown
    const menuToggle = document.getElementById('btn-menu-toggle');
    const menuDropdown = document.getElementById('menu-dropdown');
    if (menuToggle && menuDropdown) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        menuDropdown.classList.toggle('hidden');
      });
      document.addEventListener('click', () => {
        menuDropdown.classList.add('hidden');
      });
    }

    // Export Trigger
    const btnExport = document.getElementById('btn-export');
    if (btnExport) {
      btnExport.addEventListener('click', () => {
        window.app.exportData();
        if (menuDropdown) menuDropdown.classList.add('hidden');
      });
    }

    // Import Trigger & File Input
    const fileInput = document.getElementById('import-file-input');
    const btnImportTrigger = document.getElementById('btn-import-trigger');
    if (btnImportTrigger && fileInput) {
      btnImportTrigger.addEventListener('click', () => {
        if (menuDropdown) menuDropdown.classList.add('hidden');
        fileInput.click();
      });
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          window.app.importData(e.target.files[0]);
          fileInput.value = '';
        }
      });
    }

    // Reset Progress Modal Triggers
    const btnResetTrigger = document.getElementById('btn-reset-trigger');
    const modalReset = document.getElementById('modal-reset');
    const btnCancelReset = document.getElementById('btn-cancel-reset');
    const btnConfirmReset = document.getElementById('btn-confirm-reset');

    if (btnResetTrigger && modalReset) {
      btnResetTrigger.addEventListener('click', () => {
        if (menuDropdown) menuDropdown.classList.add('hidden');
        modalReset.classList.remove('hidden');
      });
    }
    if (btnCancelReset && modalReset) {
      btnCancelReset.addEventListener('click', () => {
        modalReset.classList.add('hidden');
      });
    }
    if (btnConfirmReset) {
      btnConfirmReset.addEventListener('click', () => {
        window.app.resetAllProgress();
      });
    }

    // Random Problem Triggers
    const btnRandom = document.getElementById('btn-random');
    const btnCloseRandom = document.getElementById('btn-close-random');
    const btnPickAnother = document.getElementById('btn-random-pick-another');
    if (btnRandom) btnRandom.addEventListener('click', () => window.app.pickRandomQuestion());
    if (btnCloseRandom) btnCloseRandom.addEventListener('click', () => window.app.closeRandomModal());
    if (btnPickAnother) btnPickAnother.addEventListener('click', () => window.app.pickRandomQuestion());

    // Notes Modal Buttons
    const btnSaveNote = document.getElementById('btn-save-notes');
    const btnCloseNote = document.getElementById('btn-close-notes');
    const btnCloseNoteX = document.getElementById('btn-close-notes-x');
    const btnDeleteNote = document.getElementById('btn-delete-note');

    if (btnSaveNote) btnSaveNote.addEventListener('click', () => window.app.saveNote());
    if (btnCloseNote) btnCloseNote.addEventListener('click', () => window.app.closeNotesModal());
    if (btnCloseNoteX) btnCloseNoteX.addEventListener('click', () => window.app.closeNotesModal());
    if (btnDeleteNote) btnDeleteNote.addEventListener('click', () => window.app.deleteNote());

    // --- GitHub Sync Event Listeners ---
    const modalSync = document.getElementById('modal-github-sync');
    const openSyncModal = () => {
      updateSyncUI();
      if (modalSync) modalSync.classList.remove('hidden');
      if (menuDropdown) menuDropdown.classList.add('hidden');
    };
    const closeSyncModal = () => {
      if (modalSync) modalSync.classList.add('hidden');
    };

    const btnSyncStatus = document.getElementById('btn-sync-status');
    const btnOpenSyncModal = document.getElementById('btn-open-sync-modal');
    if (btnSyncStatus) btnSyncStatus.addEventListener('click', openSyncModal);
    if (btnOpenSyncModal) btnOpenSyncModal.addEventListener('click', openSyncModal);

    const btnCloseSyncX = document.getElementById('btn-close-sync-modal-x');
    const btnCloseSync = document.getElementById('btn-close-sync-modal');
    const btnCloseSyncCancel = document.getElementById('btn-close-sync-modal-cancel');
    if (btnCloseSyncX) btnCloseSyncX.addEventListener('click', closeSyncModal);
    if (btnCloseSync) btnCloseSync.addEventListener('click', closeSyncModal);
    if (btnCloseSyncCancel) btnCloseSyncCancel.addEventListener('click', closeSyncModal);

    // Show/hide password visibility toggle
    const btnTogglePwd = document.getElementById('btn-toggle-password-visibility');
    const pwdInput = document.getElementById('input-sync-password');
    if (btnTogglePwd && pwdInput) {
      btnTogglePwd.addEventListener('click', () => {
        const isPwd = pwdInput.type === 'password';
        pwdInput.type = isPwd ? 'text' : 'password';
      });
    }

    // Connect button
    const btnConnectSync = document.getElementById('btn-connect-sync');
    if (btnConnectSync) {
      btnConnectSync.addEventListener('click', async () => {
        const pwd = pwdInput ? pwdInput.value.trim() : '';

        if (!pwd) {
          showToast('Please enter a secret password', 'error');
          return;
        }
        if (pwd.length < 3) {
          showToast('Password should be at least 3 characters', 'error');
          return;
        }

        btnConnectSync.disabled = true;
        btnConnectSync.textContent = 'Connecting...';

        const success = await connectWithPassword(pwd);

        btnConnectSync.disabled = false;
        btnConnectSync.textContent = 'Connect & Sync';

        if (success) {
          if (pwdInput) pwdInput.value = '';
          updateSyncUI();
        }
      });
    }

    // Disconnect button
    const btnDisconnectSync = document.getElementById('btn-disconnect-sync');
    if (btnDisconnectSync) {
      btnDisconnectSync.addEventListener('click', () => {
        disconnectSync();
        updateSyncUI();
      });
    }

    // Manual Sync buttons
    const btnSyncNow = document.getElementById('btn-sync-now');
    const btnTriggerManualSync = document.getElementById('btn-trigger-manual-sync');
    if (btnSyncNow) {
      btnSyncNow.addEventListener('click', () => {
        if (menuDropdown) menuDropdown.classList.add('hidden');
        pullFromCloud(true);
      });
    }
    if (btnTriggerManualSync) {
      btnTriggerManualSync.addEventListener('click', () => {
        pullFromCloud(true);
      });
    }


    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        window.app.closeNotesModal();
        window.app.closeRandomModal();
        if (modalReset) modalReset.classList.add('hidden');
      }
    });
  }

  // --- Startup ---
  document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    initEvents();
    renderAll();
    updateSyncUI();
    pullFromCloud(false);
  });

})();
