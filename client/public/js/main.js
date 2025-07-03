document.addEventListener('DOMContentLoaded', () => {
    // Mobile menu toggle
    const mobileMenuButton = document.getElementById('mobile-menu-button');
    const mobileMenu = document.getElementById('mobile-menu');

    if (mobileMenuButton && mobileMenu) {
        mobileMenuButton.addEventListener('click', () => {
            // Toggle the 'hidden' class
            mobileMenu.classList.toggle('hidden');
            
            // Toggle the menu icon (optional)
            const menuIcon = mobileMenuButton.querySelector('svg');
            if (menuIcon) {
                if (mobileMenu.classList.contains('hidden')) {
                    menuIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />';
                } else {
                    menuIcon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />';
                }
            }
        });

        // Close mobile menu when clicking outside
        document.addEventListener('click', (event) => {
            if (!mobileMenuButton.contains(event.target) && !mobileMenu.contains(event.target)) {
                mobileMenu.classList.add('hidden');
            }
        });
    }
});

// Typewriter effect
class TypeWriter {
    constructor(txtElement, words, wait = 3000) {
        this.txtElement = txtElement;
        this.words = words;
        this.txt = '';
        this.wordIndex = 0;
        this.wait = parseInt(wait, 10);
        this.type();
        this.isDeleting = false;
    }

    type() {
        const current = this.wordIndex % this.words.length;
        const fullTxt = this.words[current];

        if (this.isDeleting) {
            this.txt = fullTxt.substring(0, this.txt.length - 1);
        } else {
            this.txt = fullTxt.substring(0, this.txt.length + 1);
        }

        this.txtElement.querySelector('.wrap').textContent = this.txt;

        let typeSpeed = 100;
        if (this.isDeleting) {
            typeSpeed /= 2;
        }

        if (!this.isDeleting && this.txt === fullTxt) {
            typeSpeed = this.wait;
            this.isDeleting = true;
        } else if (this.isDeleting && this.txt === '') {
            this.isDeleting = false;
            this.wordIndex++;
            typeSpeed = 500;
        }

        setTimeout(() => this.type(), typeSpeed);
    }
}

// Counter animation
function animateCounters() {
    const counters = document.querySelectorAll('.count-up');
    const speed = 200;

    counters.forEach(counter => {
        const target = +counter.getAttribute('data-target');
        let count = 0;

        const updateCount = () => {
            const increment = target / speed;
            if (count < target) {
                count = Math.ceil(count + increment);
                counter.innerText = count;
                setTimeout(updateCount, 1);
            } else {
                counter.innerText = target;
            }
        };

        updateCount();
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Initialize typewriter
    const typewriteElement = document.querySelector('.typewrite');
    if (typewriteElement) {
        const words = JSON.parse(typewriteElement.getAttribute('data-type'));
        new TypeWriter(typewriteElement, words);
    }

    // Initialize counters with Intersection Observer
    const statsSection = document.querySelector('.count-up');
    if (statsSection) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounters();
                    observer.unobserve(entry.target);
                }
            });
        });

        observer.observe(statsSection);
    }

    // Handle investment form submission
    const investmentForm = document.getElementById('investmentForm');
    if (investmentForm) {
        investmentForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const amount = document.getElementById('amount').value;
            const projectId = window.location.pathname.split('/')[2];
            const messageDiv = document.getElementById('investmentMessage');
            
            try {
                const response = await fetch(`/projects/${projectId}/invest`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ amount: parseFloat(amount) })
                });

                const data = await response.json();
                
                if (response.ok) {
                    messageDiv.className = 'mt-3 p-3 bg-green-50 text-green-800 rounded-md';
                    messageDiv.textContent = 'Investment successful! The page will refresh shortly.';
                    messageDiv.classList.remove('hidden');
                    
                    // Refresh the page after 2 seconds to show updated funding progress
                    setTimeout(() => {
                        window.location.reload();
                    }, 2000);
                } else {
                    throw new Error(data.error || 'Failed to process investment');
                }
            } catch (error) {
                messageDiv.className = 'mt-3 p-3 bg-red-50 text-red-800 rounded-md';
                messageDiv.textContent = error.message;
                messageDiv.classList.remove('hidden');
            }
        });
    }
}); 