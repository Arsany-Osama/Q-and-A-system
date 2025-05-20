/**
 * Animation helper for the reports page
 * This enhances the reporting page with smooth animations 
 */

document.addEventListener('DOMContentLoaded', function() {
    // Add animation to report cards after they're added to the DOM
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                // Check if any added nodes are report cards
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList.contains('report-card')) {
                        animateReportCard(node);
                    }
                });
            }
        });
    });
    
    // Start observing the reports list for changes
    const reportsList = document.getElementById('reportsList');
    if (reportsList) {
        observer.observe(reportsList, { childList: true });
    }
    
    // Apply staggered animation to existing report cards
    function animateExistingCards() {
        const cards = document.querySelectorAll('.report-card');
        cards.forEach((card, index) => {
            // Set initial invisible state
            card.style.opacity = '0';
            card.style.transform = 'translateY(20px)';
            
            // Animate in with a staggered delay
            setTimeout(() => {
                card.style.transition = 'all 0.5s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 50 * index);
        });
    }
    
    // Animate a single report card
    function animateReportCard(card) {
        card.style.opacity = '0';
        card.style.transform = 'translateY(20px)';
        
        setTimeout(() => {
            card.style.transition = 'all 0.5s ease';
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 10);
    }
    
    // Run the animation on page load
    setTimeout(animateExistingCards, 500);
    
    // Add animation to stats cards
    function animateStatsCards() {
        const cards = document.querySelectorAll('.stats-card');
        cards.forEach((card, index) => {
            card.style.opacity = '0';
            card.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                card.style.transition = 'all 0.4s ease';
                card.style.opacity = '1';
                card.style.transform = 'translateY(0)';
            }, 150 * index);
        });
    }
    
    // Run stats animation on page load
    setTimeout(animateStatsCards, 300);
    
    // Add animation to filter controls
    const filterControls = document.getElementById('filterReports');
    if (filterControls) {
        filterControls.addEventListener('change', function() {
            // Animate cards after filter is applied
            setTimeout(animateExistingCards, 10);
        });
    }
    
    // Add animation to empty state
    const emptyState = document.getElementById('noReports');
    if (emptyState) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && 
                    mutation.attributeName === 'class' && 
                    !emptyState.classList.contains('hidden')) {
                    
                    // Empty state is now visible, animate it
                    const icon = emptyState.querySelector('.empty-state-icon');
                    const heading = emptyState.querySelector('h3');
                    const paragraph = emptyState.querySelector('p');
                    const button = emptyState.querySelector('button');
                    
                    if (icon) {
                        icon.style.opacity = '0';
                        icon.style.transform = 'translateY(20px) scale(0.8)';
                    }
                    
                    if (heading) {
                        heading.style.opacity = '0';
                        heading.style.transform = 'translateY(15px)';
                    }
                    
                    if (paragraph) {
                        paragraph.style.opacity = '0';
                        paragraph.style.transform = 'translateY(10px)';
                    }
                    
                    if (button) {
                        button.style.opacity = '0';
                        button.style.transform = 'translateY(5px)';
                    }
                    
                    // Animate each element with a delay
                    setTimeout(() => {
                        if (icon) {
                            icon.style.transition = 'all 0.5s ease';
                            icon.style.opacity = '1';
                            icon.style.transform = 'translateY(0) scale(1)';
                        }
                    }, 100);
                    
                    setTimeout(() => {
                        if (heading) {
                            heading.style.transition = 'all 0.5s ease';
                            heading.style.opacity = '1';
                            heading.style.transform = 'translateY(0)';
                        }
                    }, 200);
                    
                    setTimeout(() => {
                        if (paragraph) {
                            paragraph.style.transition = 'all 0.5s ease';
                            paragraph.style.opacity = '1';
                            paragraph.style.transform = 'translateY(0)';
                        }
                    }, 300);
                    
                    setTimeout(() => {
                        if (button) {
                            button.style.transition = 'all 0.5s ease';
                            button.style.opacity = '1';
                            button.style.transform = 'translateY(0)';
                        }
                    }, 400);
                }
            });
        });
        
        // Start observing the empty state for class changes
        observer.observe(emptyState, { attributes: true });
    }
});
