// Emergency Mesh Network - Frontend Logic
// Minimal JavaScript for offline/online sync

const STORAGE_KEY = 'emergency_queue';
const HISTORY_KEY = 'emergency_history';

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    updateOnlineStatus();
    setupEventListeners();
    loadHistory();
    updateQueueCount();

    // Check for pending messages on startup (in case user comes back online)
    if (navigator.onLine) {
        setTimeout(syncQueue, 1000); // Delay to ensure stable connection
    }
}

function setupEventListeners() {
    // Form submission
    document.getElementById('emergency-form').addEventListener('submit', handleFormSubmit);

    // Network status changes
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Character counter
    document.getElementById('message').addEventListener('input', function() {
        document.getElementById('char-count').textContent = this.value.length;
    });

    // Close modal on outside click
    document.getElementById('queue-modal').addEventListener('click', (e) => {
        if (e.target.classList.contains('modal')) {
            closeQueue();
        }
    });
}

// Handle form submission
async function handleFormSubmit(e) {
    e.preventDefault();

    const messageText = document.getElementById('message').value.trim();
    const location = document.getElementById('location').value.trim();

    if (!messageText) {
        alert('Please enter an emergency message');
        return;
    }

    const message = {
        id: Date.now().toString(),
        text: messageText,
        location: location || 'Not specified',
        timestamp: new Date().toISOString(),
        synced: false,
        retryCount: 0
    };

    if (navigator.onLine) {
        // Try to send immediately
        const success = await sendToAWS(message);
        if (success) {
            message.synced = true;
            addToHistory(message);
            showNotification('Alert sent successfully!', 'success');
            e.target.reset();
            document.getElementById('char-count').textContent = '0';
        } else {
            // If send fails, save locally
            saveToLocalStorage(message);
            showNotification('Message saved locally. Will retry.', 'warning');
            e.target.reset();
            document.getElementById('char-count').textContent = '0';
        }
    } else {
        // Offline - save locally
        saveToLocalStorage(message);
        showNotification('You are offline. Message saved locally.', 'offline');
        e.target.reset();
        document.getElementById('char-count').textContent = '0';
    }

    updateQueueCount();
}

// Send message to AWS (API Gateway → Lambda)
async function sendToAWS(message) {
    // REPLACE WITH YOUR ACTUAL API GATEWAY URL
    const API_URL = 'YOUR_API_GATEWAY_URL_HERE/emergency';

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(message)
        });

        if (response.ok) {
            return true;
        } else {
            console.error('AWS send failed:', response.status);
            return false;
        }
    } catch (error) {
        console.error('Network error:', error);
        return false;
    }
}

// Save message to localStorage queue
function saveToLocalStorage(message) {
    let queue = getQueue();
    queue.push(message);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
    updateQueueCount();
}

// Get queue from localStorage
function getQueue() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
}

// Clear entire queue
function clearQueue() {
    if (confirm('Are you sure you want to clear all pending messages?')) {
        localStorage.removeItem(STORAGE_KEY);
        updateQueueCount();
        closeQueue();
        showNotification('Queue cleared', 'info');
    }
}

// View queue in modal
function viewQueue() {
    const queue = getQueue();
    const modal = document.getElementById('queue-modal');
    const queueList = document.getElementById('queue-list');

    if (queue.length === 0) {
        queueList.innerHTML = '<p style="text-align:center;color:#888;">No pending messages</p>';
    } else {
        queueList.innerHTML = queue.map(msg => `
            <div class="queue-item">
                <div class="queue-message">${msg.text}</div>
                <div class="queue-time">
                    ${new Date(msg.timestamp).toLocaleString()}
                    ${msg.location !== 'Not specified' ? ` • 📍 ${msg.location}` : ''}
                </div>
                ${msg.retryCount > 0 ? `<div style="color:#ff6e40;font-size:0.8rem;">Retry attempts: ${msg.retryCount}</div>` : ''}
            </div>
        `).join('');
    }

    modal.style.display = 'flex';
}

function closeQueue() {
    document.getElementById('queue-modal').style.display = 'none';
}

// Update queue count badge
function updateQueueCount() {
    const queue = getQueue();
    const queueInfo = document.getElementById('queue-info');
    const countSpan = document.getElementById('queue-count');

    if (queue.length > 0) {
        queueInfo.style.display = 'block';
        countSpan.textContent = queue.length;
    } else {
        queueInfo.style.display = 'none';
    }
}

// Update online/offline status UI
function updateOnlineStatus() {
    const statusBar = document.getElementById('status-bar');

    if (navigator.onLine) {
        statusBar.className = 'online';
        statusBar.textContent = '● You are ONLINE - Connected to mesh network';
    } else {
        statusBar.className = 'offline';
        statusBar.textContent = '● You are OFFLINE - Messages will save locally';
    }
}

// Handle coming online
async function handleOnline() {
    updateOnlineStatus();
    showNotification('Connection restored! Syncing messages...', 'success');

    // Wait a moment for stable connection
    setTimeout(async () => {
        await syncQueue();
        loadHistory(); // Refresh history
    }, 1000);
}

// Handle going offline
function handleOffline() {
    updateOnlineStatus();
    showNotification('You are offline. Messages will be saved.', 'offline');
}

// Sync all pending messages to AWS
async function syncQueue() {
    if (!navigator.onLine) return;

    let queue = getQueue();
    if (queue.length === 0) return;

    showNotification(`Syncing ${queue.length} message(s)...`, 'info');

    // Process queue sequentially
    const remaining = [];
    let syncedCount = 0;

    for (const message of queue) {
        // Skip already synced (shouldn't happen, but safe)
        if (message.synced) {
            syncedCount++;
            continue;
        }

        const success = await sendToAWS(message);

        if (success) {
            message.synced = true;
            addToHistory(message);
            syncedCount++;
        } else {
            message.retryCount = (message.retryCount || 0) + 1;

            // Give up after 3 failed attempts
            if (message.retryCount < 3) {
                remaining.push(message);
            } else {
                // Move to failed messages
                saveFailedMessage(message);
                showNotification(`Failed to send message after 3 attempts: ${message.text.substring(0, 30)}...`, 'error');
            }
        }
    }

    // Update localStorage with remaining messages
    localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
    updateQueueCount();

    if (syncedCount > 0) {
        showNotification(`Synced ${syncedCount} message(s) successfully!`, 'success');
    }
}

// Save failed message (optional - for debugging)
function saveFailedMessage(message) {
    let failed = JSON.parse(localStorage.getItem('failed_messages') || '[]');
    failed.push({ ...message, failedAt: new Date().toISOString() });
    localStorage.setItem('failed_messages', JSON.stringify(failed));
}

// Add message to history
function addToHistory(message) {
    let history = getHistory();
    history.unshift(message); // Add to beginning
    // Keep only last 50 messages
    if (history.length > 50) history = history.slice(0, 50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

// Get history from localStorage
function getHistory() {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
}

// Load and display history
function loadHistory() {
    const history = getHistory();
    const messageList = document.getElementById('message-list');

    if (history.length === 0) {
        messageList.innerHTML = '<p class="empty-state">No messages sent yet.</p>';
        return;
    }

    messageList.innerHTML = history.map(msg => `
        <div class="message-card ${msg.synced ? 'synced' : 'pending'}">
            <div class="message-header">
                <span>${new Date(msg.timestamp).toLocaleString()}</span>
                <span class="message-status ${msg.synced ? 'synced' : 'pending'}">
                    ${msg.synced ? '✓ Sent' : '⏳ Pending'}
                </span>
            </div>
            <div class="message-text">${escapeHtml(msg.text)}</div>
            ${msg.location && msg.location !== 'Not specified' ? `<div class="message-location">📍 ${escapeHtml(msg.location)}</div>` : ''}
        </div>
    `).join('');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Show notification toast
function showNotification(message, type) {
    // Remove existing notification
    const existing = document.querySelector('.notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Add styles dynamically
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '12px 20px',
        borderRadius: '4px',
        color: '#fff',
        fontWeight: '600',
        fontSize: '14px',
        zIndex: '9999',
        animation: 'slideIn 0.3s ease',
        maxWidth: '300px'
    });

    // Type-specific colors
    switch (type) {
        case 'success':
            notification.style.background = '#00c853';
            break;
        case 'error':
            notification.style.background = '#ff3d00';
            break;
        case 'warning':
            notification.style.background = '#ffc107';
            notification.style.color = '#000';
            break;
        case 'info':
            notification.style.background = '#2196f3';
            break;
        case 'offline':
            notification.style.background = '#666';
            break;
    }

    document.body.appendChild(notification);

    // Auto-remove after 4 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transition = 'opacity 0.3s';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Add CSS animation for notification
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
`;
document.head.appendChild(style);
