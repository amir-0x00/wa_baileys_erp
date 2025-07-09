// Global variables
let socket;
let isConnected = false;
let recentMessages = [];
let isSubmitting = false; // Add submission guard

// DOM elements
const statusIndicator = document.getElementById('statusIndicator');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const qrContainer = document.getElementById('qrContainer');
const connectedState = document.getElementById('connectedState');
const messageSection = document.getElementById('messageSection');
const qrCode = document.getElementById('qrCode');
const messageForm = document.getElementById('messageForm');
const logoutBtn = document.getElementById('logoutBtn');
const clearBtn = document.getElementById('clearBtn');
const pendingCount = document.getElementById('pendingCount');
const processingCount = document.getElementById('processingCount');
const messagesList = document.getElementById('messagesList');
const toastContainer = document.getElementById('toastContainer');

// Initialize the application
document.addEventListener('DOMContentLoaded', function () {
  initializeSocket();
  setupEventListeners();
  updateStatus('جاري الاتصال...', false);
});

// Initialize WebSocket connection
function initializeSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Connected to server');
    updateStatus('متصل', true);
  });

  socket.on('disconnect', () => {
    console.log('Disconnected from server');
    updateStatus('غير متصل', false);
    showToast('انقطع الاتصال. جاري إعادة الاتصال...', 'warning');
  });

  socket.on('stateChange', (state) => {
    console.log('WhatsApp state changed:', state);
    handleStateChange(state);
  });

  socket.on('messageSent', (messageId, whatsappId) => {
    console.log('Message sent:', messageId, whatsappId);
    updateMessageStatus(messageId, 'success', `تم الإرسال (ID: ${whatsappId})`);
    showToast('تم إرسال الرسالة بنجاح!', 'success');
    updateQueueStatus();
  });

  socket.on('messageFailed', (messageId, error) => {
    console.log('Message failed:', messageId, error);
    updateMessageStatus(messageId, 'error', `فشل: ${error}`);
    showToast(`فشل في إرسال الرسالة: ${error}`, 'error');
    updateQueueStatus();
  });

  socket.on('messageSending', (message) => {
    console.log('Message sending:', message);
    addMessageToList(message, 'pending');
    updateQueueStatus();
  });

  socket.on('queueStatus', (status) => {
    updateQueueDisplay(status);
  });
}

// Setup event listeners
function setupEventListeners() {
  // Form submission
  messageForm.addEventListener('submit', handleFormSubmit);

  // Logout button
  logoutBtn.addEventListener('click', handleLogout);

  // Clear button
  clearBtn.addEventListener('click', clearForm);

  // File input change
  document.getElementById('mediaFile').addEventListener('change', handleFileChange);
}

// Handle form submission
async function handleFormSubmit(e) {
  e.preventDefault();

  // Prevent multiple submissions
  if (isSubmitting) {
    showToast('جاري إرسال الرسالة، يرجى الانتظار...', 'warning');
    return;
  }

  const formData = new FormData(messageForm);
  const phoneNumber = formData.get('phoneNumber');
  const message = formData.get('message');
  const mediaFile = formData.get('media');

  if (!phoneNumber || !message) {
    showToast('يرجى ملء جميع الحقول المطلوبة', 'error');
    return;
  }

  // Disable submit button and set submitting state
  isSubmitting = true;
  const sendBtn = document.getElementById('sendBtn');
  const originalText = sendBtn.innerHTML;
  sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> جاري الإرسال...';
  sendBtn.disabled = true;

  try {
    const response = await fetch('/api/send-message', {
      method: 'POST',
      body: formData,
    });

    const result = await response.json();

    if (result.success) {
      showToast(`تم إضافة الرسالة للطابور بنجاح! الموقع: ${result.queuePosition}`, 'success');
      clearForm();
    } else {
      // Translate error messages to Arabic
      let errorMessage = result.error;
      if (errorMessage.includes('Invalid Saudi or Egyptian phone number format')) {
        errorMessage = 'صيغة رقم الهاتف غير صحيحة. يرجى إدخال رقم سعودي أو مصري صحيح';
      } else if (errorMessage.includes('WhatsApp is not connected')) {
        errorMessage = 'واتساب غير متصل. يرجى مسح رمز QR أولاً';
      } else if (errorMessage.includes('Phone number and message are required')) {
        errorMessage = 'رقم الهاتف والرسالة مطلوبان';
      }
      showToast(`خطأ: ${errorMessage}`, 'error');
    }
  } catch (error) {
    console.error('Error sending message:', error);
    showToast('فشل في إرسال الرسالة. يرجى المحاولة مرة أخرى.', 'error');
  } finally {
    // Re-enable submit button and reset state
    isSubmitting = false;
    sendBtn.innerHTML = originalText;
    sendBtn.disabled = false;
  }
}

// Handle logout
async function handleLogout() {
  try {
    const response = await fetch('/api/logout', {
      method: 'POST',
    });

    const result = await response.json();

    if (result.success) {
      showToast('تم تسجيل الخروج بنجاح', 'success');
      // The state change will be handled by the WebSocket event
    } else {
      showToast(`فشل في تسجيل الخروج: ${result.error}`, 'error');
    }
  } catch (error) {
    console.error('Error during logout:', error);
    showToast('فشل في تسجيل الخروج. يرجى المحاولة مرة أخرى.', 'error');
  }
}

// Handle file change
function handleFileChange(e) {
  const file = e.target.files[0];
  if (file) {
    const maxSize = 16 * 1024 * 1024; // 16MB
    if (file.size > maxSize) {
      showToast('يجب أن يكون حجم الملف أقل من 16 ميجابايت', 'error');
      e.target.value = '';
      return;
    }
    showToast(`تم اختيار الملف: ${file.name}`, 'success');
  }
}

// Clear form
function clearForm() {
  messageForm.reset();
  showToast('تم مسح النموذج', 'success');
}

// Handle WhatsApp state changes
function handleStateChange(state) {
  if (state.isAuthenticated) {
    // Connected state
    qrContainer.style.display = 'none';
    connectedState.style.display = 'block';
    messageSection.style.display = 'block';
    updateStatus('واتساب متصل', true);
    showToast('تم الاتصال بواتساب بنجاح!', 'success');
  } else if (state.qrCode) {
    // QR code state
    qrContainer.style.display = 'block';
    connectedState.style.display = 'none';
    messageSection.style.display = 'none';
    updateStatus('امسح رمز QR', false);

    // Update QR code image
    qrCode.innerHTML = `<img src="${state.qrCode}" alt="QR Code">`;
  } else {
    // Disconnected state
    qrContainer.style.display = 'block';
    connectedState.style.display = 'none';
    messageSection.style.display = 'none';
    updateStatus('غير متصل', false);

    // Show loading state
    qrCode.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner fa-spin"></i>
                <p>جاري الاتصال...</p>
            </div>
        `;
  }
}

// Update connection status
function updateStatus(text, connected) {
  statusText.textContent = text;
  isConnected = connected;

  if (connected) {
    statusDot.classList.add('connected');
  } else {
    statusDot.classList.remove('connected');
  }
}

// Add message to the list
function addMessageToList(message, status) {
  const messageItem = document.createElement('div');
  messageItem.className = `message-item ${status}`;
  messageItem.id = `message-${message.id}`;

  const time = new Date(message.timestamp).toLocaleTimeString('ar-SA');
  const phoneDisplay = message.phoneNumber.replace('+966', '0');

  const statusText =
    status === 'pending'
      ? 'في الطابور'
      : status === 'sending'
      ? 'جاري الإرسال...'
      : status === 'success'
      ? 'تم الإرسال'
      : 'فشل';

  messageItem.innerHTML = `
        <div class="message-header">
            <span class="message-phone">${phoneDisplay}</span>
            <span class="message-time">${time}</span>
        </div>
        <div class="message-text">${message.message}</div>
        <div class="message-status ${status}">
            ${statusText}
        </div>
    `;

  messagesList.insertBefore(messageItem, messagesList.firstChild);

  // Keep only last 10 messages
  const messages = messagesList.querySelectorAll('.message-item');
  if (messages.length > 10) {
    messages[messages.length - 1].remove();
  }
}

// Update message status
function updateMessageStatus(messageId, status, statusText) {
  const messageItem = document.getElementById(`message-${messageId}`);
  if (messageItem) {
    messageItem.className = `message-item ${status}`;
    const statusElement = messageItem.querySelector('.message-status');
    if (statusElement) {
      statusElement.className = `message-status ${status}`;
      statusElement.textContent = statusText;
    }
  }
}

// Update queue status display
function updateQueueStatus() {
  fetch('/api/queue-status')
    .then((response) => response.json())
    .then((result) => {
      if (result.success) {
        updateQueueDisplay(result.status);
      }
    })
    .catch((error) => {
      console.error('Error fetching queue status:', error);
    });
}

// Update queue display
function updateQueueDisplay(status) {
  pendingCount.textContent = status.pending;
  processingCount.textContent = status.processing;
}

// Show toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;

  toastContainer.appendChild(toast);

  // Auto remove after 5 seconds
  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 5000);
}

// Handle page visibility change
document.addEventListener('visibilitychange', function () {
  if (document.hidden) {
    console.log('Page hidden - connection will be maintained');
  } else {
    console.log('Page visible - checking connection status');
    // Refresh status when page becomes visible
    updateQueueStatus();
  }
});

// Handle beforeunload
window.addEventListener('beforeunload', function () {
  console.log('Page unloading - cleaning up');
  if (socket) {
    socket.disconnect();
  }
});
