// assets/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    const { uid, sessionId } = window.TrackingState || { uid: 'unknown', sessionId: 'unknown' };

    // 1. Event Delegation for Affiliate Links & Download Buttons
    // This ensures clicks work even if the header is injected dynamically.
    document.addEventListener('click', async (e) => {
        const target = e.target;
        
        // Affiliate Links (Checks if clicked element or its parent is the link)
        const affLink = target.closest('a[href*="/api/go"]');
        if (affLink) {
            e.preventDefault();
            const url = new URL(affLink.href, window.location.origin);
            url.searchParams.set('uid', uid);
            url.searchParams.set('sid', sessionId);
            window.location.href = url.toString();
            return;
        }

        // Download Buttons
        const dlBtn = target.closest('.download-btn');
        if (dlBtn) {
            e.preventDefault();
            const fileKey = dlBtn.getAttribute('data-file');
            
            try {
                const res = await fetch(`/api/download?uid=${uid}&file=${fileKey}`);
                const data = await res.json();
                
                if (data.success && data.download_url) {
                    window.open(data.download_url, '_blank');
                } else {
                    alert('Error retrieving file.');
                }
            } catch (err) {
                console.error('Download error:', err);
                alert('Network error. Please try again.');
            }
            return;
        }
    });

    // 2. Lead Forms
    // Using delegation for forms as well, in case they are injected
    document.addEventListener('submit', async (e) => {
        const form = e.target;
        if (!form.matches('#smart-lead-form')) return; // Ignore other forms
        
        e.preventDefault();
        const formData = new FormData(form);
        const payload = {
            uid,
            identified_name: formData.get('name'),
            identified_email: formData.get('email'),
            phone_number: formData.get('phone'),
            biggest_challenge: formData.get('challenge')
        };

        try {
            const res = await fetch('/api/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            
            if (data.success && data.redirect) {
                window.location.href = data.redirect;
            } else {
                alert('Error submitting form. Please try again.');
            }
        } catch (err) {
            console.error('Form submission error:', err);
            alert('Network error. Please try again.');
        }
    });
});