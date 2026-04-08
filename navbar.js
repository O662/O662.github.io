// navbar.js — all navbar initialization logic.
// Loaded via <script src="navbar.js" defer> in each page.
// Uses MutationObserver to self-initialize after navbar.html is injected via fetch/innerHTML.

(function () {
    var searchIndex = [
        { title: 'Home', url: '/index.html', description: "Malcolm Ferguson's personal website", keywords: ['home', 'malcolm', 'ferguson'] },
        { title: 'Projects', url: '/pProjects.html', description: 'Explore all projects', keywords: ['projects', 'work'] },
        { title: 'Architecture: House Design', url: '/pArchitecture.html', description: 'A modern, light-filled home focused on calm materials, passive ventilation, and flexible living spaces.', keywords: ['architecture', 'house', 'design', 'courtyard', 'concept', 'building'] },
        { title: 'Commodity Tracker', url: '/pCommodityTracker.html', description: 'Real-time commodity prices and trends', keywords: ['commodity', 'tracker', 'prices', 'trends', 'finance', 'markets'] },
        { title: '2026 Senate Races', url: '/pElectionTrackerSenate.html', description: 'Prediction market odds for 2026 Senate races', keywords: ['senate', 'election', 'tracker', 'prediction', 'market', 'politics', '2026'] },
        { title: '2026 House Races', url: '/pElectionTrackerHouse.html', description: 'Prediction market odds for 2026 House races', keywords: ['house', 'election', 'tracker', 'prediction', 'market', 'politics', '2026', 'representative'] },
        { title: 'Portfolio', url: '/pPortfolio.html', description: 'Website designs and creative projects', keywords: ['portfolio', 'design', 'website', 'creative', 'work'] },
        { title: 'Publications', url: '/pPublications.html', description: 'Journal articles and conference papers', keywords: ['publications', 'journal', 'articles', 'papers', 'research', 'academic'] },
        { title: 'Contact', url: '/pContact.html', description: 'Get in touch', keywords: ['contact', 'about', 'email', 'reach'] },
        { title: 'TURTLE', url: '/pTURTLE.html', description: 'TURTLE robotics project', keywords: ['turtle', 'robot', 'robotics'] },
        { title: 'Cover Letter', url: '/Professional-documents/pCoverLetter.html', description: 'Professional cover letter', keywords: ['cover letter', 'professional', 'documents', 'job'] },
        { title: 'Resume', url: '/Professional-documents/pResume.html', description: 'Professional resume', keywords: ['resume', 'professional', 'documents', 'cv', 'job'] },
        { title: 'CV', url: '/Professional-documents/pCV.html', description: 'Curriculum vitae', keywords: ['cv', 'curriculum vitae', 'professional', 'documents', 'academic'] },
        { title: 'Writings Viewer', url: '/writings-viewer.html', description: 'Customizable reader for writings with font and color controls', keywords: ['writings', 'viewer', 'reader', 'articles', 'text'] },
    ];

    function initNavbar() {
        var hamburger = document.getElementById('hamburger-menu');
        var menu = document.getElementById('nav-menu');

        if (hamburger && menu) {
            // Hamburger toggle
            hamburger.addEventListener('click', function () {
                hamburger.classList.toggle('open');
                menu.classList.toggle('open');
            });

            // Mobile: click-to-expand dropdowns
            menu.querySelectorAll('.dropdown').forEach(function (dropdown) {
                var btn = dropdown.querySelector('.dropbtn');
                if (btn) {
                    btn.addEventListener('click', function (e) {
                        if (window.innerWidth <= 768) {
                            e.preventDefault();
                            dropdown.classList.toggle('mobile-open');
                        }
                    });
                }
            });

            // Desktop: hover with delay so the gap between the pill and dropdown doesn't close it
            menu.querySelectorAll('.dropdown').forEach(function (dropdown) {
                var hideTimer;

                function showDropdown() {
                    clearTimeout(hideTimer);
                    dropdown.classList.add('active');
                }

                function scheduleHide() {
                    clearTimeout(hideTimer);
                    hideTimer = setTimeout(function () {
                        dropdown.classList.remove('active');
                    }, 400);
                }

                dropdown.addEventListener('mouseenter', function () {
                    if (window.innerWidth > 768) showDropdown();
                });
                dropdown.addEventListener('mouseleave', function () {
                    if (window.innerWidth > 768) scheduleHide();
                });

                var content = dropdown.querySelector('.dropdown-content');
                if (content) {
                    content.addEventListener('mouseenter', function () {
                        if (window.innerWidth > 768) showDropdown();
                    });
                    content.addEventListener('mouseleave', function () {
                        if (window.innerWidth > 768) scheduleHide();
                    });
                }
            });
        }

        // Search
        var searchInput = document.getElementById('navbar-search');
        var searchBtn = document.getElementById('navbar-search-btn');
        var searchResults = document.getElementById('search-results');

        if (!searchInput || !searchResults) return;

        function performSearch(query) {
            var q = query.toLowerCase().trim();
            if (!q) {
                searchResults.classList.remove('visible');
                searchResults.innerHTML = '';
                return;
            }

            var results = searchIndex.filter(function (item) {
                return item.title.toLowerCase().includes(q) ||
                    item.description.toLowerCase().includes(q) ||
                    item.keywords.some(function (k) { return k.includes(q); });
            });

            if (results.length === 0) {
                searchResults.innerHTML = '<div class="search-no-results">No results found</div>';
            } else {
                searchResults.innerHTML = results.map(function (item) {
                    return '<div class="search-result-item" onclick="window.location.href=\'' + item.url + '\'">' +
                        '<div class="search-result-title">' + item.title + '</div>' +
                        '<div class="search-result-desc">' + item.description + '</div>' +
                        '</div>';
                }).join('');
            }
            searchResults.classList.add('visible');
        }

        searchInput.addEventListener('input', function () {
            performSearch(this.value);
        });

        searchInput.addEventListener('keydown', function (e) {
            if (e.key === 'Enter') performSearch(this.value);
        });

        if (searchBtn) {
            searchBtn.addEventListener('click', function () {
                performSearch(searchInput.value);
            });
        }

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.search-container')) {
                searchResults.classList.remove('visible');
            }
        });
    }

    // Self-initialize: watch for navbar HTML to be injected via fetch/innerHTML
    var observer = new MutationObserver(function () {
        if (document.getElementById('hamburger-menu') || document.getElementById('navbar-search')) {
            observer.disconnect();
            initNavbar();
        }
    });

    if (document.body) {
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', function () {
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
})();
