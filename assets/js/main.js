document.addEventListener('DOMContentLoaded', () => {
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
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const href = this.getAttribute('href');
            if (href === '#') return; // Ignore empty anchors
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth'
                });
                // Close mobile menu if open
                if (navLinks.classList.contains('active')) {
                    navLinks.classList.remove('active');
                }
            }
        });
    });

    // Central Logo Management
    const initBranding = () => {
        const logos = document.querySelectorAll('.logo');
        const logoHTML = `
            <img src="assets/images/logo-icon.png" alt="Logo" class="brand-icon">
            <span class="logo-text">ثانوية<span class="logo-accent">.كوم</span></span>
        `;

        logos.forEach(logo => {
            logo.innerHTML = logoHTML;
        });

        // Also update Admin Sidebar Logo if exists
        const adminLogo = document.querySelector('.sidebar-header h2');
        if (adminLogo) {
            adminLogo.innerHTML = `
                <img src="assets/images/logo-icon.png" alt="Logo" class="brand-icon" style="height:35px">
                <span class="logo-text" style="font-size:1.5rem">ثانوية<span class="logo-accent">.كوم</span></span>
            `;
            adminLogo.style.display = "flex";
            adminLogo.style.alignItems = "center";
            adminLogo.style.gap = "8px";
        }

        // Also update Exam Logo if exists
        const examLogo = document.querySelector('.logo-box');
        const examTitle = document.getElementById('examTitleMobile');
        if (examLogo && examTitle) {
            examLogo.innerHTML = `
                <img src="assets/images/app_icon.png" alt="Logo" class="brand-icon" style="height:30px">
                <span id="examTitleMobile">${examTitle.textContent}</span>
            `;
        }
    };

    initBranding();

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
                Swal.fire({
                    icon: 'success',
                    title: 'تم الإرسال',
                    text: 'شكراً لتواصلك معنا! سنقوم بالرد عليك في أقرب وقت.',
                    confirmButtonText: 'حسناً'
                });
                contactForm.reset();
            } else {
                Swal.fire({
                    icon: 'warning',
                    title: 'تنبيه',
                    text: 'يرجى ملء جميع الحقول المطلوبة.',
                    confirmButtonText: 'حسناً'
                });
            }
        });
    }
});




// PWA Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(registration => {
                console.log('ServiceWorker registration successful with scope: ', registration.scope);
            })
            .catch(err => {
                console.log('ServiceWorker registration failed: ', err);
            });
    });
}
