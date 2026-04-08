// jsIndex.js - Other site functionality can go here
// The project slider functionality is now handled inline in index.html

// ── Hero slideshow ────────────────────────────────────────────────────
// Always initialises so slide-active is set regardless of viewport width.
// CSS controls whether the slideshow layout and dots are actually visible
// (only on ≤1000px). This avoids a race between window.innerWidth and the
// media query at script-execution time.
(function () {
    var SLIDE_INTERVAL = 4000;

    function initSlideshow() {
        var hero = document.getElementById('hero');
        if (!hero) return;

        var images = Array.from(hero.querySelectorAll('.hero-image img'));
        if (images.length === 0) return;

        // Build dots (CSS hides them above 1000px)
        var dotsContainer = document.createElement('div');
        dotsContainer.className = 'hero-slideshow-dots';

        var dots = images.map(function (_, i) {
            var dot = document.createElement('button');
            dot.className = 'hero-slideshow-dot' + (i === 0 ? ' active' : '');
            dot.setAttribute('aria-label', 'Go to slide ' + (i + 1));
            dot.addEventListener('click', function () { goTo(i); resetTimer(); });
            dotsContainer.appendChild(dot);
            return dot;
        });

        hero.appendChild(dotsContainer);

        var current = 0;
        images[0].classList.add('slide-active');

        function goTo(index) {
            images[current].classList.remove('slide-active');
            dots[current].classList.remove('active');
            current = ((index % images.length) + images.length) % images.length;
            images[current].classList.add('slide-active');
            dots[current].classList.add('active');
        }

        var timer = setInterval(function () { goTo(current + 1); }, SLIDE_INTERVAL);

        function resetTimer() {
            clearInterval(timer);
            timer = setInterval(function () { goTo(current + 1); }, SLIDE_INTERVAL);
        }

        // Pause while user is touching
        hero.addEventListener('touchstart', function () { clearInterval(timer); }, { passive: true });
        hero.addEventListener('touchend',   function () { resetTimer(); },          { passive: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initSlideshow);
    } else {
        initSlideshow();
    }
})();
