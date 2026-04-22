// Config
const API_URL = 'https://lqlqqhbfq6.execute-api.ap-south-1.amazonaws.com/prod/emergency';
const Q_KEY = 'emr_q', H_KEY = 'emr_h';

// Elements
const statusEl = document.getElementById('status');
const formEl = document.getElementById('form');
const msgEl = document.getElementById('msg');
const locEl = document.getElementById('loc');
const charsEl = document.getElementById('chars');
const queueBox = document.getElementById('queue-box');
const queueCount = document.getElementById('queue-count');
const historyList = document.getElementById('history-list');
const modal = document.getElementById('modal');
const queueList = document.getElementById('queue-list');

// NEW: Fetch recent messages
async function fetchMessages() {
  try {
    const response = await fetch(API_URL.replace('/emergency', '/messages'));
    if (response.ok) {
      const data = await response.json();
      if (data.messages && data.messages.length > 0) {
        historyList.innerHTML = data.messages.map(msg => `
          <div class="message-item">
            <small>${new Date(msg.timestamp).toLocaleString()}</small>
            <p>${msg.message}</p>
            ${msg.location ? `<small>📍 ${msg.location}</small>` : ''}
          </div>
        `).join('');
      } else {
        historyList.innerHTML = '<p>No messages sent yet</p>';
      }
    }
  } catch (err) {
    console.error('Fetch failed:', err);
  }
}

// Init
document.addEventListener('DOMContentLoaded', () => {
    updateStatus();
    loadHistory();
    fetchMessages();  // NEW
    updateQueueCount();
    if (navigator.onLine) setTimeout(syncQueue, 1500);
});

// Events
formEl.addEventListener('submit', handleSubmit);
window.addEventListener('online', () => { 
    updateStatus(); 
    showToast('Online! Syncing...', 'success'); 
    syncQueue(); 
    fetchMessages();  // NEW
    loadHistory(); 
});
window.addEventListener('offline', () => { updateStatus(); showToast('Offline mode', 'warning'); });
msgEl.addEventListener('input', () => charsEl.textContent = msgEl.value.length);
modal.addEventListener('click', (e) => { if (e.target === modal) hideQueue(); });

// Main Functions
async function handleSubmit(e) {
    e.preventDefault();
    const text = msgEl.value.trim();
    const loc = locEl.value.trim();
    if (!text) return showToast('Enter message', 'error');

    const msg = {
        id: Date.now().toString(),
        text,
        location: loc || 'Unknown',
        timestamp: new Date().toISOString(),
        synced: false
    };

    if (navigator.onLine) {
        const ok = await sendToAWS(msg);
        if (ok) { 
            msg.synced = true; 
            addToHistory(msg); 
            showToast('Alert sent!', 'success'); 
            fetchMessages();  // NEW
        }
        else { 
            saveToQueue(msg); 
            showToast('Save locally (retry)', 'warning'); 
        }
    } else {
        saveToQueue(msg);
        showToast('Offline: saved locally', 'warning');
    }

    formEl.reset();
    charsEl.textContent = '0';
    updateQueueCount();
    loadHistory();
}

async function sendToAWS(msg) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(msg)
        });
        return res.ok;
    } catch { return false; }
}

function saveToQueue(msg) {
    const q = getQueue();
    q.push(msg);
    localStorage.setItem(Q_KEY, JSON.stringify(q));
}

function getQueue() { return JSON.parse(localStorage.getItem(Q_KEY) || '[]'); }

async function syncQueue() {
    if (!navigator.onLine) return;
    let q = getQueue();
    if (!q.length) return;

    showToast(`Syncing ${q.length} message(s)...`, 'info');
    const remaining = [];

    for (const msg of q) {
        if (await sendToAWS(msg)) {
            msg.synced = true;
            addToHistory(msg);
        } else {
            msg.retry = (msg.retry || 0) + 1;
            if (msg.retry < 3) remaining.push(msg);
        }
    }

    localStorage.setItem(Q_KEY, JSON.stringify(remaining));
    updateQueueCount();
    loadHistory();
    showToast(remaining.length ? `${remaining.length} failed` : 'All synced!', remaining.length ? 'error' : 'success');
    fetchMessages();  // NEW
}

function addToHistory(msg) {
    const h = getHistory();
    h.unshift(msg);
    if (h.length > 50) h.pop();
    localStorage.setItem(H_KEY, JSON.stringify(h));
}

function getHistory() { return JSON.parse(localStorage.getItem(H_KEY) || '[]'); }

function loadHistory() {
    const h = getHistory();
    historyList.innerHTML = h.length ? h.map(m => `
        <div class="msg ${m.synced ? 'sent' : ''}">
            <div class="msg-time">${new Date(m.timestamp).toLocaleString()}</div>
            <div class="msg-text">${escapeHtml(m.text)}</div>
            ${m.location !== 'Unknown' ? `<div class="msg-loc">📍 ${escapeHtml(m.location)}</div>` : ''}
        </div>
    `).join('') : '<p class="empty">No messages sent yet</p>';
}

// UI Updates
function updateStatus() {
    if (navigator.onLine) {
        statusEl.className = 'status-badge online';
        statusEl.innerHTML = '<span class="indicator"></span><span class="text">● Online - Connected</span>';
    } else {
        statusEl.className = 'status-badge offline';
        statusEl.innerHTML = '<span class="indicator"></span><span class="text">● Offline - Messages queued</span>';
    }
}

function updateQueueCount() {
    const c = getQueue().length;
    queueBox.style.display = c ? 'block' : 'none';
    queueCount.textContent = c;
}

function showQueue() {
    const q = getQueue();
    queueList.innerHTML = q.map(m => `
        <div class="queue-item">
            <div class="queue-item-text">${m.text}</div>
            <div class="queue-item-time">${new Date(m.timestamp).toLocaleString()}</div>
        </div>
    `).join('') || '<p>No pending messages</p>';
    modal.style.display = 'flex';
}

function hideQueue() { modal.style.display = 'none'; }

function clearQueue() {
    if (confirm('Clear all pending?')) {
        localStorage.removeItem(Q_KEY);
        updateQueueCount();
        hideQueue();
        showToast('Queue cleared', 'info');
    }
}

function showToast(msg, type = 'info') {
    const toast = document.createElement('div');
    toast.textContent = msg;
    const colors = { success: '#00c853', error: '#ff3d00', warning: '#ffc107', info: '#2196f3' };
    toast.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 20px;border-radius:8px;color:#fff;background:${colors[type]};z-index:10000;font-weight:600;animation:slideIn .3s`;
    document.body.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 3000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}