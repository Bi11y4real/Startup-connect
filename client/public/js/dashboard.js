document.addEventListener('DOMContentLoaded', () => {
    const investorTabs = document.getElementById('investor-tabs');
    if (investorTabs) {
        const tabItems = investorTabs.querySelectorAll('.tab-item');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabItems.forEach(tab => {
            tab.addEventListener('click', (e) => {
                e.preventDefault();

                // Deactivate all tabs
                tabItems.forEach(item => {
                    item.classList.remove('border-primary', 'text-primary', 'font-semibold');
                    item.classList.add('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'font-medium');
                });

                // Activate the clicked tab
                tab.classList.add('border-primary', 'text-primary', 'font-semibold');
                tab.classList.remove('border-transparent', 'text-gray-500', 'hover:text-gray-700', 'hover:border-gray-300', 'font-medium');

                // Hide all panels
                tabPanels.forEach(panel => {
                    panel.classList.add('hidden');
                });

                // Show the target panel
                const targetPanelId = tab.dataset.tab + '-content';
                const targetPanel = document.getElementById(targetPanelId);
                if (targetPanel) {
                    targetPanel.classList.remove('hidden');
                }
            });
        });
    }
});
