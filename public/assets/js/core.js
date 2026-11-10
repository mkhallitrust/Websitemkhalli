        document.addEventListener('DOMContentLoaded', () => {

            const navbar = document.getElementById('navbar');
            const utilityHeader = document.getElementById('utility-header');
            const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
            const mobileMenu = document.getElementById('mobile-menu');
            const mobileMenuIcon = mobileMenuToggle.querySelector('ion-icon');
            const pageSections = document.querySelectorAll('.page-section');
            const navLinks = document.querySelectorAll('.page-nav-link');
            const langSwitcher = document.getElementById('lang-switcher');
            const currentYear = document.getElementById('current-year');
            const htmlEl = document.documentElement;

            // --- Intersection Observer (Scroll Animations) ---
            const observerOptions = {
                root: null,
                rootMargin: '0px',
                threshold: 0.1
            };
            const observerCallback = (entries, observer) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                    } else {
                        entry.target.classList.remove('is-visible');
                    }
                });
            };
            const observer = new IntersectionObserver(observerCallback, observerOptions);
            function observeElements(elements) {
                elements.forEach(el => {
                    observer.observe(el);
                });
            }

            // Set current year in footer
            if (currentYear) {
                currentYear.textContent = new Date().getFullYear();
            }

            // --- Language Switching ---
            const savedLang = localStorage.getItem('lang') || 'en';
            htmlEl.lang = savedLang;
            updateLanguage(savedLang);

            langSwitcher.addEventListener('click', () => {
                const newLang = htmlEl.lang === 'en' ? 'kn' : 'en';
                updateLanguage(newLang);
            });
            
            function updateLanguage(lang) {
                htmlEl.lang = lang;
                localStorage.setItem('lang', lang);
                
                if (lang === 'kn') {
                    document.querySelectorAll('[data-lang-key="trust_activity_2_list"] li[data-lang="en"]').forEach(li => li.style.display = 'none');
                    document.querySelectorAll('[data-lang-key="trust_activity_2_list"] li[data-lang="kn"]').forEach(li => li.style.display = 'list-item');
                } else {
                    document.querySelectorAll('[data-lang-key="trust_activity_2_list"] li[data-lang="en"]').forEach(li => li.style.display = 'list-item');
                    document.querySelectorAll('[data-lang-key="trust_activity_2_list"] li[data-lang="kn"]').forEach(li => li.style.display = 'none');
                }
            }

            // --- Carousel Initialization with Swipe Support ---
            const carousels = {}; 
            function initCarousel(carouselId) {
                if (carousels[carouselId]) return; 
                const carousel = document.getElementById(carouselId);
                if (!carousel) return;

                const track = carousel.querySelector('.carousel-track');
                const slides = Array.from(track.children);
                const nextButton = carousel.querySelector('.carousel-button.next');
                const prevButton = carousel.querySelector('.carousel-button.prev');
                
                if (!slides.length) return;
                let currentIndex = 0;
                let autoSlideInterval;
                
                // Touch variables
                let touchStartX = 0;
                let touchEndX = 0;

                function updateCarouselDimensions() {
                    const slideWidth = carousel.clientWidth;
                    track.style.transform = 'translateX(-' + (slideWidth * currentIndex) + 'px)';
                }

                const goToSlide = (index) => {
                    const slideWidth = carousel.clientWidth;
                    if (index < 0) index = slides.length - 1;
                    if (index >= slides.length) index = 0;
                    
                    track.style.transform = 'translateX(-' + (slideWidth * index) + 'px)';
                    currentIndex = index;
                };
                
                const slideNext = () => goToSlide(currentIndex + 1);
                const slidePrev = () => goToSlide(currentIndex - 1);
                
                const startAutoSlide = () => {
                    stopAutoSlide(); 
                    autoSlideInterval = setInterval(slideNext, 5000); 
                };
                const stopAutoSlide = () => clearInterval(autoSlideInterval);

                // Button Listeners
                if (nextButton) {
                    nextButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        slideNext();
                        stopAutoSlide();
                        startAutoSlide(); 
                    });
                }
                if (prevButton) {
                    prevButton.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        slidePrev();
                        stopAutoSlide();
                        startAutoSlide();
                    });
                }
                
                // Touch / Swipe Listeners
                carousel.addEventListener('touchstart', (e) => {
                    stopAutoSlide();
                    touchStartX = e.changedTouches[0].screenX;
                }, { passive: true });

                carousel.addEventListener('touchend', (e) => {
                    touchEndX = e.changedTouches[0].screenX;
                    handleSwipe();
                    startAutoSlide();
                }, { passive: true });

                function handleSwipe() {
                    const threshold = 50; // Minimum distance to count as a swipe
                    if (touchEndX < touchStartX - threshold) {
                        slideNext(); // Swipe Left -> Next
                    }
                    if (touchEndX > touchStartX + threshold) {
                        slidePrev(); // Swipe Right -> Prev
                    }
                }
                
                carousel.addEventListener('mouseenter', stopAutoSlide);
                carousel.addEventListener('mouseleave', startAutoSlide);
                window.addEventListener('resize', updateCarouselDimensions);
                
                // Fix initial sizing issue by delaying slightly
                setTimeout(updateCarouselDimensions, 100);
                
                startAutoSlide();
                carousels[carouselId] = true;
            }

            // Initialize ALL carousels on page load
            setTimeout(() => {
                const allCarousels = document.querySelectorAll('.carousel-container');
                allCarousels.forEach(c => initCarousel(c.id));
            }, 500);
            
            // --- NEW: Header Height & Page Padding Fix ---
            let utilityHeaderHeight = 0;
            let navbarHeight = 0;

            function updateHeaderHeightsAndPadding() {
                // 1. Get current heights
                utilityHeaderHeight = utilityHeader ? utilityHeader.offsetHeight : 0;
                navbarHeight = navbar ? navbar.offsetHeight : 0;
                const totalHeaderHeight = utilityHeaderHeight + navbarHeight;

                // 2. Set the main navbar's 'top' position to be below the utility bar
                if (navbar) {
                    navbar.style.top = `${utilityHeaderHeight}px`;
                }

                // 3. Apply padding to all pages EXCEPT home
                pageSections.forEach(section => {
                    if (section.id !== 'page-home') {
                        // This fixes the overlap on all other pages
                        section.style.paddingTop = `${totalHeaderHeight}px`;
                    }
                });
            }
            // --- END: Header Height & Page Padding Fix ---
            

            // --- Navigation & Page Switching ---
            let activePage = 'page-home';
            let lastScrollTop = 0;

            // Run header calculation on load
            updateHeaderHeightsAndPadding();
            // Re-run on resize (e.g., mobile orientation change)
            window.addEventListener('resize', updateHeaderHeightsAndPadding);

            // Show initial page
            const PAGE_URL = {"page-home": "/", "page-about": "/about/", "page-vyasatirtha": "/vyasatirtha/", "page-gallery": "/gallery/", "page-events": "/events/", "page-trust": "/trust/", "page-sevas": "/seva-booking/", "page-donations": "/donate/"};
            const PAGE_TITLE = {"page-home": "Vyasaraja Pranadevaru (Hanuman) Temple, Mavinakayinahalli | Mukhyaprana Seva Trust", "page-about": "About the Temple and Sri Vyasarajaru | Mavinakayinahalli Pranadevaru", "page-vyasatirtha": "Life of Sri Vyasatirtha (Vyasaraja) from the Vyasayogicharita | Mavinakayinahalli", "page-gallery": "Photo Gallery | Mavinakayinahalli Pranadevaru Temple", "page-events": "Events and Utsavas | Mavinakayinahalli Pranadevaru Temple", "page-trust": "The Trust | Mavinakayinahalli Sri Mukhyaprana Seva Trust", "page-sevas": "Book a Seva Online | Mavinakayinahalli Pranadevaru Temple", "page-donations": "Donate | Mavinakayinahalli Sri Mukhyaprana Seva Trust"};
            const pageFromPath = (p) => {
                p = (p || '/').replace(/index\.html$/, '');
                if (!p.endsWith('/')) p += '/';
                return Object.keys(PAGE_URL).find((k) => PAGE_URL[k] === p) || null;
            };
            const initialHash = decodeURIComponent(window.location.hash.replace('#', ''));
            const hashTarget = initialHash ? document.getElementById(initialHash) : null;
            if (hashTarget && hashTarget.classList.contains('page-section')) {
                // an old link such as /#page-about: show the page and switch to its new address
                showPage(initialHash, true);
                try { history.replaceState({ page: initialHash }, '', PAGE_URL[initialHash] || '/'); } catch (err) {}
            } else if (hashTarget && hashTarget.closest('.page-section')) {
                // a spot inside a page (e.g. #contact or #fx-pmap): open that page, then scroll to it
                showPage(hashTarget.closest('.page-section').id, true);
                setTimeout(() => hashTarget.scrollIntoView({ behavior: 'auto', block: 'start' }), 400);
            } else {
                const first = pageFromPath(location.pathname) || (document.querySelector('.page-section') || {}).id || 'page-home';
                showPage(first, true);
                try { history.replaceState({ page: first }, '', location.href); } catch (err) {}
            }
            window.addEventListener('popstate', (e) => {
                const id = (e.state && e.state.page) || pageFromPath(location.pathname) || 'page-home';
                if (id !== activePage) showPage(id, false, true);
            });
            // used by links inside pages that are loaded later (the life story)
            window.__goPage = (pageId, scrollToId) => {
                if (pageId && !document.getElementById(pageId)) { location.href = (PAGE_URL[pageId] || '/') + (scrollToId ? '#' + scrollToId : ''); return; }
                if (pageId) showPage(pageId);
                if (scrollToId) setTimeout(() => document.getElementById(scrollToId)?.scrollIntoView({ behavior: 'smooth' }), 60);
            };

            // Handle nav link clicks
            navLinks.forEach(link => {
                link.addEventListener('click', (e) => {
                    if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button === 1) return; // let "open in new tab" work
                    // separate pages: a link to another page is an ordinary link
                    if (link.dataset.page && !document.getElementById(link.dataset.page)) return;
                    e.preventDefault();
                    const pageId = link.dataset.page;
                    const scrollToId = link.dataset.scroll;
                    
                    if (pageId) {
                        showPage(pageId);
                    }
                    
                    if (scrollToId) {
                        if (pageId && pageId !== activePage) {
                            setTimeout(() => {
                                document.getElementById(scrollToId)?.scrollIntoView({ behavior: 'smooth' });
                            }, 50);
                        } else {
                            document.getElementById(scrollToId)?.scrollIntoView({ behavior: 'smooth' });
                        }
                    }

                    if (mobileMenu.classList.contains('hidden') === false) {
                        mobileMenu.classList.add('hidden');
                        mobileMenuIcon.setAttribute('name', 'menu-outline');
                    }
                });
            });

            function showPage(pageId, isInitialLoad = false, fromHistory = false) {
                if (!pageId || !document.getElementById(pageId)) return;
                activePage = pageId;
                if (!isInitialLoad && !fromHistory && PAGE_URL[pageId] && location.pathname !== PAGE_URL[pageId]) {
                    try { history.pushState({ page: pageId }, '', PAGE_URL[pageId]); } catch (err) {}
                }
                if (PAGE_TITLE[pageId]) document.title = PAGE_TITLE[pageId];
                if (pageId === 'page-vyasatirtha' && window.vtEnsure) setTimeout(window.vtEnsure, 0);

                pageSections.forEach(section => {
                    section.classList.add('hidden');
                });

                const newPage = document.getElementById(pageId);
                if (newPage) {
                    newPage.classList.remove('hidden');
                    activePage = pageId; 
                }

                updateActiveNav(pageId);

                // --- SIMPLIFIED HEADER STYLE LOGIC ---
                // The scroll listener will handle styling.
                // We just need to trigger the scroll listener's logic manually for the new page.
                handleScroll(); 
                
                if (!isInitialLoad) {
                    window.scrollTo(0, 0);
                }
                
                observeElements(newPage.querySelectorAll('.reveal-on-scroll, .reveal-from-left, .reveal-from-right'));

                // Init carousels for specific pages
                if (pageId === 'page-trust') {
                    setTimeout(() => {
                        initCarousel('carousel-medical');
                        initCarousel('carousel-school');
                        initCarousel('carousel-civic');
                    }, 100);
                } else if (pageId === 'page-gallery') {
                    // This is ready for your next step, if you add carousels to the gallery
                    // initCarousel('carousel-gallery'); 
                } else if (pageId === 'page-sevas') {
                    // Initialize the Seva form dropdown when this page is shown
                    if (typeof populateSevaDropdown === 'function') {
                        populateSevaDropdown();
                    }
                }
            }

            function updateActiveNav(pageId) {
                navLinks.forEach(link => {
                    if (link.dataset.page === pageId) {
                        link.classList.add('active-nav');
                        if (link.classList.contains('desktop-nav-link')) {
                            link.classList.add('active-nav');
                        }
                    } else {
                        link.classList.remove('active-nav');
                    }
                });
            }

            // --- Scroll Effects (Header) ---
            function handleScroll() {
                const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
                
                // 1. Sticky Nav Background
                if (navbar) {
                    // Make sticky if scrolled OR if not on the home page
                    if (scrollTop > 50 || activePage !== 'page-home') {
                        navbar.classList.add('bg-white/95', 'shadow-lg', 'text-gray-800');
                        navbar.classList.remove('text-white');
                    } else {
                        // Only make transparent if at top AND on the home page
                        navbar.classList.remove('bg-white/95', 'shadow-lg', 'text-gray-800');
                        navbar.classList.add('text-white');
                    }
                }

                // 2. Utility Header Hide/Show
                if (utilityHeader) {
                    if (scrollTop > lastScrollTop && scrollTop > 50) { // Only hide after scrolling down a bit
                        // Scrolling Down
                        utilityHeader.style.transform = 'translateY(-100%)';
                        navbar.style.top = `0px`; // Move navbar to very top
                    } else {
                        // Scrolling Up
                        utilityHeader.style.transform = 'translateY(0)';
                        navbar.style.top = `${utilityHeaderHeight}px`; // Move navbar back down
                    }
                    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop; 
                }
            }

            window.addEventListener('scroll', handleScroll);

            // --- Mobile Menu Toggle ---
            mobileMenuToggle.addEventListener('click', () => {
                mobileMenu.classList.toggle('hidden');
                if (mobileMenu.classList.contains('hidden')) {
                    mobileMenuIcon.setAttribute('name', 'menu-outline');
                } else {
                    mobileMenuIcon.setAttribute('name', 'close-outline');
                }
            });

        });
    
