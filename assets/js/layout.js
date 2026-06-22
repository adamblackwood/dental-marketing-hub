// assets/js/layout.js
// محرك القوالب المركزي: يحقن الـ Navbar والـ Footer تلقائياً، ويحدد الرابط النشط

export function initLayout() {
    const appContainer = document.getElementById('app');
    if (!appContainer) return;

    // 1. إدراج الـ Navbar في الأعلى
    const nav = document.createElement('nav');
    nav.className = 'main-nav';
    const currentPath = window.location.pathname;
    
    nav.innerHTML = `
        <div class="nav-container">
            <a href="/" class="nav-logo">DentalHub<span>Track</span></a>
            <ul class="nav-links">
                <li><a href="/" class="${currentPath === '/' ? 'active' : ''}">Home</a></li>
                <li><a href="/about.html" class="${currentPath === '/about.html' ? 'active' : ''}">About Us</a></li>
                <li><a href="/privacy.html" class="${currentPath === '/privacy.html' ? 'active' : ''}">Privacy Policy</a></li>
            </ul>
            <button class="nav-toggle" id="navToggle">☰</button>
        </div>
    `;
    document.body.prepend(nav);

    // 2. إدراج الـ Footer في الأسفل
    const footer = document.createElement('footer');
    footer.className = 'main-footer';
    footer.innerHTML = `
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} Dental Marketing Resource Hub. All rights reserved.</p>
            <div class="footer-links">
                <a href="/about.html">About</a> | <a href="/privacy.html">Privacy</a>
            </div>
        </div>
    `;
    document.body.appendChild(footer);

    // 3. قائمة الموبايل (Toggle)
    const toggleBtn = document.getElementById('navToggle');
    const navLinks = document.querySelector('.nav-links');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }
}