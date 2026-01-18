/**
 * Shared utility for calculating full-viewport canvas sizes
 * Used by Canvas, Pattern Builder, and Etch-a-Sketch
 */

/**
 * Calculate the optimal canvas size to fill the available viewport
 * @param {Object} options Configuration options
 * @param {number} options.headerHeight Height reserved for header/topbar (default: 80)
 * @param {number} options.footerHeight Height reserved for footer/controls (default: 200)
 * @param {number} options.padding Extra padding (default: 40)
 * @param {number} options.maxSize Maximum canvas size (default: 1200)
 * @returns {{width: number, height: number}} The calculated display size
 */
export function calculateCanvasSize(options = {}) {
    const {
        headerHeight = 80,
        footerHeight = 200,
        padding = 40,
        maxSize = 1200
    } = options;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Calculate available space
    const availableHeight = viewportHeight - headerHeight - footerHeight - padding;
    const availableWidth = viewportWidth - 40; // 20px padding each side

    // Use the maximum square that fits
    const size = Math.max(300, Math.min(availableWidth, availableHeight, maxSize));

    return { width: size, height: size };
}

/**
 * Calculate canvas size accounting for different layouts
 * For pages with sidebars like Pattern Builder
 */
export function calculateCanvasSizeWithSidebar(options = {}) {
    const {
        headerHeight = 80,
        footerHeight = 150,
        padding = 40,
        sidebarWidth = 300, // Approximate sidebar width
        maxSize = 800
    } = options;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // On mobile/tablet, no sidebar so use full width
    const isMobile = viewportWidth < 992; // lg breakpoint

    const availableHeight = viewportHeight - headerHeight - footerHeight - padding;
    const availableWidth = isMobile
        ? viewportWidth - 40
        : viewportWidth - sidebarWidth * 2 - 60; // Two sidebars

    const size = Math.max(300, Math.min(availableWidth, availableHeight, maxSize));

    return { width: size, height: size };
}

/**
 * Common canvas styles for consistency
 */
export const canvasContainerStyle = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
    minHeight: '300px'
};

export const canvasStyle = (size) => ({
    border: '3px solid #20c997',
    borderRadius: '12px',
    boxShadow: '0 0 30px rgba(32, 201, 151, 0.2), 0 8px 32px rgba(0, 0, 0, 0.4)',
    backgroundColor: '#1a1a1a',
    touchAction: 'none',
    width: size,
    height: size,
    maxWidth: '100%'
});
