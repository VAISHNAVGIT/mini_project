// theme.js

// Execute immediately to prevent FOUC (Flash of Unstyled Content)
(function() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    updateThemeIcon(savedTheme);
});

function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'light' ? 'dark' : 'light';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const themeIcon = document.getElementById('themeIcon');
    if (themeIcon) {
        if (theme === 'light') {
            // Sun icon (for switching to dark, wait, if theme is light, showing sun means "it's light mode" or "switch to dark"? 
            // Usually, if it is light mode, icon is sun, or icon represents what you switch to.
            // Let's show Moon in light mode to indicate "Click for Dark Mode" and Sun in dark mode to indicate "Click for Light Mode")
            themeIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>`;
        } else {
            // Dark mode is active, show Sun icon to switch to light mode
            themeIcon.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>`;
        }
    }
}

window.toggleTheme = toggleTheme;

// Global Notification System for Critical Events
window.showGlobalNotification = function(msg) {
    let globalNotif = document.getElementById('globalNotification');
    if (!globalNotif) {
        globalNotif = document.createElement('div');
        globalNotif.id = 'globalNotification';
        globalNotif.className = 'global-notification';
        document.body.appendChild(globalNotif);
    }
    globalNotif.innerHTML = `<span>⚠️ ${msg}</span>`;
    setTimeout(() => globalNotif.classList.add('show'), 50);
};

window.hideGlobalNotification = function() {
    let globalNotif = document.getElementById('globalNotification');
    if (globalNotif) {
        globalNotif.classList.remove('show');
    }
};
