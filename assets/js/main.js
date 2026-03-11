import { showSuccessAlert, showWarningAlert } from './utils/alerts.js';

// Wait for DOM to be ready before checking for elements
function initMainJS() {
    // Only run if we're on a page that needs main.js functionality
    const hasMainPageElements = document.querySelector('.menu-toggle') ||
        document.querySelector('.nav-links') ||
        document.getElementById('contactForm');

    if (!hasMainPageElements) {
        // Not a page that needs main.js, skip initialization
        return;
    }

    // Mobile Menu Toggle
    const menuToggle = document.querySelector('.menu-toggle');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            // Change icon if needed
            const icon = menuToggle.querySelector('i');
            if (icon) {
                if (navLinks.classList.contains('active')) {
                    icon.classList.remove('fa-bars');
                    icon.classList.add('fa-times');
                } else {
                    icon.classList.remove('fa-times');
                    icon.classList.add('fa-bars');
                }
            }
        });
    }

    // Smooth Scrolling for Anchor Links
    try {
        const anchors = document.querySelectorAll('a[href^="#"]');
        if (anchors && anchors.length > 0) {
            anchors.forEach(anchor => {
                anchor.addEventListener('click', function (e) {
                    const href = this.getAttribute('href');
                    if (href === '#' || href === '#!') return; // Ignore empty anchors

                    try {
                        const target = document.querySelector(href);
                        if (target) {
                            e.preventDefault();
                            target.scrollIntoView({
                                behavior: 'smooth'
                            });
                            // Close mobile menu if open
                            if (navLinks && navLinks.classList.contains('active')) {
                                navLinks.classList.remove('active');
                            }
                        }
                    } catch (err) {
                        // Invalid selector, ignore
                    }
                });
            });
        }
    } catch (err) {
        // Smooth scroll not available on this page
    }

    // Contact Form Validation
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();

            // Basic validation
            const name = document.getElementById('name').value;
            const email = document.getElementById('email').value;
            const message = document.getElementById('message').value;

            if (name && email && message) {
                // Simulate submission
                showSuccessAlert('تم الإرسال', 'شكراً لتواصلك معنا! هنرد عليك في أقرب وقت.');
                contactForm.reset();
            } else {
                showWarningAlert('تنبيه', 'املى كل الحقول المطلوبه');
            }
        });
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMainJS);
} else {
    // DOM already loaded
    initMainJS();
}

// PWA Installation Logic
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    showInstallBanner();
});

function showInstallBanner() {
    // Check if we're already in standalone mode
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true) {
        return;
    }

    // Only show on dashboard or index pages to avoid being annoying
    const isHome = window.location.pathname === '/' || window.location.pathname.includes('index.html');
    const isDashboard = window.location.pathname.includes('dashboard.html');
    if (!isHome && !isDashboard) return;

    // Check if user dismissed it this session
    if (sessionStorage.getItem('pwa_banner_dismissed')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.className = 'pwa-banner';
    banner.innerHTML = `
        <div class="pwa-banner-content">
            <div class="pwa-banner-icon">
                <img src="assets/images/logo-icon.webp" alt="App Icon">
            </div>
            <div class="pwa-banner-text">
                <h3>نزل تطبيق ثانوية.كوم 📱</h3>
            </div>
            <div class="pwa-banner-actions">
                <button id="pwa-install-btn" class="btn btn-primary btn-sm">ثبت دلوقتي</button>
                <button id="pwa-dismiss-btn" class="btn-close-banner"><i class="fas fa-times"></i></button>
            </div>
        </div>
    `;

    document.body.appendChild(banner);

    // Install logic
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
        if (!deferredPrompt) return;

        // Show the install prompt
        deferredPrompt.prompt();

        // Wait for the user to respond to the prompt
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);

        // We've used the prompt, and can't use it again
        deferredPrompt = null;

        // Hide the banner
        banner.remove();
    });

    // Dismiss logic
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
        banner.remove();
        sessionStorage.setItem('pwa_banner_dismissed', 'true');
    });
}

window.addEventListener('appinstalled', (event) => {
    console.log('👍', 'appinstalled', event);
    // Clear the deferredPrompt so it can be garbage collected
    deferredPrompt = null;
    const banner = document.getElementById('pwa-install-banner');
    if (banner) banner.remove();
});

// PWA Service Worker Registration with Update Notification
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                // console.log('Service Worker Registered');

                // 1. Check if there is already a waiting worker on load
                if (reg.waiting) {
                    processUpdate(reg);
                }

                // 2. Listen for future updates
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            processUpdate(reg);
                        }
                    });
                });
            })
            .catch(err => console.log('SW Registration Failed:', err));
    });

    // Handle controller change (reload the page once the new SW takes over)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
    });
}

/**
 * Automatically process the service worker update
 */
function processUpdate(reg) {
    if (reg.waiting) {
        console.log('[SW] New version detected. Updating automatically...');
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    }
}

/**
 * Show a persistent custom toast for updates
 */
function showUpdateToast(reg) {
    // 1. Get or Create Container
    let container = document.querySelector(".toast-container");
    if (!container) {
        container = document.createElement("div");
        container.className = "toast-container";
        document.body.appendChild(container);
    }

    // 2. Prevent duplicate update toasts
    if (document.getElementById('update-toast')) return;

    // 3. Create Toast Element
    const toast = document.createElement("div");
    toast.id = "update-toast";
    toast.className = `toast success`;
    toast.style.cssText = `
        display: flex;
        justify-content: space-between;
        align-items: center;
        min-width: 300px;
        max-width: 400px;
        padding: 0.8rem 1.2rem;
        cursor: default;
    `;

    toast.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <i class="fas fa-magic" style="color: var(--primary-color);"></i>
            <span class="toast-message" style="font-size: 0.9rem;">في تحديث جديد</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <button id="apply-update-btn" style="
                background: var(--primary-color);
                color: white;
                border: none;
                padding: 5px 12px;
                border-radius: 8px;
                font-size: 0.8rem;
                font-weight: 700;
                cursor: pointer;
            ">تحديث</button>
            <button id="close-update-toast" style="
                background: none;
                border: none;
                color: #94a3b8;
                cursor: pointer;
                padding: 4px;
                font-size: 0.9rem;
            "><i class="fas fa-times"></i></button>
        </div>
    `;

    container.appendChild(toast);

    // 4. Handle Update Button
    document.getElementById('apply-update-btn').addEventListener('click', () => {
        if (reg.waiting) {
            reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
    });

    // 5. Handle Close Button (Dismiss visually)
    document.getElementById('close-update-toast').addEventListener('click', () => {
        toast.style.animation = "fadeOut 0.4s ease forwards";
        setTimeout(() => toast.remove(), 400);
    });
}
