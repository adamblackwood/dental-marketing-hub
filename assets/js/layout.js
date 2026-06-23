// assets/js/layout.js
function injectLayout() {
    const currentPath = window.location.pathname;

    // === Header HTML ===
    const headerHTML = `
    <nav>
        <a href="/" class="logo">DentalHub</a>
        <div class="nav-links">
            <a href="/" data-path="/">Home</a>
            <a href="/article.html" data-path="/article.html">Strategies</a>
            <a href="/about.html" data-path="/about.html">About</a>
            <a href="/privacy-policy.html" data-path="/privacy-policy.html">Privacy</a>
            <a href="/api/go" class="btn-outline" style="padding: 0.5rem 1rem; border-width: 1px; margin-left: 1rem;">Try GHL</a>
        </div>
    </nav>`;

    // === Footer HTML ===
    const footerHTML = `
    <footer>
        &copy; 2024 Dental Marketing Hub. All rights reserved.<br>
        <a href="/about.html" style="color: var(--text-muted); text-decoration: none;">About Us</a> | 
        <a href="/privacy-policy.html" style="color: var(--text-muted); text-decoration: none;">Privacy Policy</a><br>
        <span style="font-size: 0.8rem; color: #94a3b8;">Empowering Dental Clinics with Smart Automation.</span>
    </footer>`;

    // Inject HTML
    const headerPlaceholder = document.getElementById('header-placeholder');
    const footerPlaceholder = document.getElementById('footer-placeholder');
    
    if (headerPlaceholder) headerPlaceholder.innerHTML = headerHTML;
    if (footerPlaceholder) footerPlaceholder.innerHTML = footerHTML;

    // Highlight Active Link
    document.querySelectorAll('.nav-links a[data-path]').forEach(link => {
        if (link.getAttribute('data-path') === currentPath) {
            link.style.color = '#2563eb'; // Primary color
            link.style.fontWeight = 'bold';
        }
    });
}

// Run injection as early as possible
document.addEventListener('DOMContentLoaded', injectLayout);