// assets/js/main.js
document.addEventListener('DOMContentLoaded', () => {
    const { uid, sessionId } = window.TrackingState || { uid: 'unknown', sessionId: 'unknown' };

    // 1. Affiliate Links
    document.querySelectorAll('a[href*="/api/go"]').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const url = new URL(link.href, window.location.origin);
            url.searchParams.set('uid', uid);
            url.searchParams.set('sid', sessionId);
            window.location.href = url.toString();
        });
    });

    // 2. Lead Forms
    const leadForm = document.getElementById('smart-lead-form');
    if (leadForm) {
        leadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(leadForm);
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
    }

    // 3. Download Buttons
    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const fileKey = btn.getAttribute('data-file');
            
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
        });
    });
});