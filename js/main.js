document.addEventListener('DOMContentLoaded', () => {
  // Mobile menu toggle
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');

  if (menuToggle && navMenu) {
    menuToggle.addEventListener('click', () => {
      navMenu.classList.toggle('active');
      const isExpanded = navMenu.classList.contains('active');
      menuToggle.setAttribute('aria-expanded', isExpanded);
      menuToggle.innerHTML = isExpanded ? '✕' : '☰';
    });

    // Close menu when clicking outside
    document.addEventListener('click', (event) => {
      const isClickInside = navMenu.contains(event.target) || menuToggle.contains(event.target);
      if (!isClickInside && navMenu.classList.contains('active')) {
        navMenu.classList.remove('active');
        menuToggle.innerHTML = '☰';
      }
    });
  }

  // Set active link in navigation
  const currentPath = window.location.pathname;
  const pageName = currentPath.substring(currentPath.lastIndexOf('/') + 1);
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    const linkHref = link.getAttribute('href');
    if (pageName === linkHref || (pageName === '' && linkHref === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // Initialize notifications if logged in
  initNotifications();
});

// --- NOTIFICATIONS FRONTEND LOGIC ---
const _API_BASE = typeof API_BASE !== 'undefined' ? API_BASE : ((window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? (window.location.port === '8001' ? '' : 'http://localhost:8001') : 'http://localhost:8001');

function initNotifications() {
  const token = localStorage.getItem('admin_token');
  if (!token) return;

  const navMenu = document.getElementById('navMenu');
  if (!navMenu) return;

  // Clean up client links for admin
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload && payload.role === 'admin') {
      const pricingLink = navMenu.querySelector('a[href*="pricing.html"]');
      if (pricingLink) pricingLink.style.display = 'none';

      const policiesLink = navMenu.querySelector('a[href*="policies.html"]');
      if (policiesLink) policiesLink.style.display = 'none';
    }
  } catch (e) {
    console.error(e);
  }

  // Check if already injected
  if (document.getElementById('notifContainer')) return;

  // Create notifications container
  const container = document.createElement('div');
  container.className = 'notif-container';
  container.id = 'notifContainer';

  container.innerHTML = `
    <button class="notif-btn" id="notifBtn" aria-label="الإشعارات">
      🔔
      <span class="notif-badge" id="notifBadge" style="display: none;">0</span>
    </button>
    <div class="notif-dropdown" id="notifDropdown">
      <div class="notif-header">
        <span class="notif-header-title">🔔 التنبيهات والإشعارات</span>
        <span class="notif-mark-all" id="notifMarkAll">تحديد الكل كمقروء</span>
      </div>
      <div class="notif-list" id="notifList">
        <div class="notif-empty">لا توجد إشعارات حالياً.</div>
      </div>
    </div>
  `;

  // Insert before logout button if it exists, otherwise append
  const logoutBtn = document.getElementById('headerLogoutBtn');
  if (logoutBtn) {
    navMenu.insertBefore(container, logoutBtn);
  } else {
    navMenu.appendChild(container);
  }

  // Toggle dropdown
  const notifBtn = document.getElementById('notifBtn');
  const notifDropdown = document.getElementById('notifDropdown');
  
  if (notifBtn && notifDropdown) {
    notifBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      notifDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        notifDropdown.classList.remove('active');
      }
    });
  }

  // Mark all as read
  const markAllBtn = document.getElementById('notifMarkAll');
  if (markAllBtn) {
    markAllBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const res = await fetch(`${_API_BASE}/api/apps/notifications/read-all`, {
          method: 'PUT',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          fetchNotifications();
        }
      } catch (err) {
        console.error("Failed to mark all as read:", err);
      }
    });
  }

  // Fetch immediately and poll every 10 seconds
  fetchNotifications();
  setInterval(fetchNotifications, 10000);
}

async function fetchNotifications() {
  const token = localStorage.getItem('admin_token');
  if (!token) return;

  const badge = document.getElementById('notifBadge');
  const listEl = document.getElementById('notifList');
  if (!listEl) return;

  try {
    const res = await fetch(`${_API_BASE}/api/apps/notifications/list`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!res.ok) throw new Error();

    const notifications = await res.json();
    const unreadCount = notifications.filter(n => !n.read).length;

    // Update badge
    if (badge) {
      if (unreadCount > 0) {
        badge.textContent = unreadCount;
        badge.style.display = 'flex';
      } else {
        badge.style.display = 'none';
      }
    }

    // Update list
    if (notifications.length === 0) {
      listEl.innerHTML = '<div class="notif-empty">لا توجد إشعارات حالياً.</div>';
      return;
    }

    listEl.innerHTML = '';
    notifications.forEach(notif => {
      const item = document.createElement('a');
      item.href = '#'; // Handled via click event
      item.className = `notif-item ${notif.read ? 'read' : 'unread'}`;
      
      const date = new Date(notif.created_at);
      const timeStr = date.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) + ' - ' + date.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric' });

      item.innerHTML = `
        <div class="notif-item-title">${notif.title}</div>
        <div class="notif-item-content">${notif.content}</div>
        <div class="notif-item-time">${timeStr}</div>
      `;

      item.addEventListener('click', async (e) => {
        e.preventDefault();
        
        // Mark as read
        if (!notif.read) {
          try {
            await fetch(`${_API_BASE}/api/apps/notifications/${notif.id}/read`, {
              method: 'PUT',
              headers: { 'Authorization': `Bearer ${token}` }
            });
          } catch (err) {
            console.error("Failed to mark notification as read:", err);
          }
        }

        // Redirect
        window.location.href = notif.link;
      });

      listEl.appendChild(item);
    });
  } catch (err) {
    console.error("Failed to fetch notifications:", err);
  }
}
