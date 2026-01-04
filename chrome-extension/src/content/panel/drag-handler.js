/**
 * Panel drag handler
 */


class DragHandler {
  constructor(container) {
    this.container = container;
    this.isDragging = false;
    this.dragOffset = { x: 0, y: 0 };
    this.onDragEnd = null;

    this.init();
  }

  init() {
    const header = this.container.querySelector('.lq-panel-header');
    if (!header) return;

    header.style.cursor = 'move';
    header.addEventListener('mousedown', this.onMouseDown.bind(this));

    // Prevent text selection during drag
    header.addEventListener('selectstart', (e) => {
      if (this.isDragging) e.preventDefault();
    });
  }

  onMouseDown(e) {
    // Don't drag if clicking buttons
    if (e.target.closest('.lq-btn-icon, .lq-btn-action')) return;

    this.isDragging = true;
    const rect = this.container.getBoundingClientRect();
    this.dragOffset = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };

    // Prevent text selection while dragging
    e.preventDefault();

    // Add global listeners
    document.addEventListener('mousemove', this.onMouseMove.bind(this));
    document.addEventListener('mouseup', this.onMouseUp.bind(this));

    // Add dragging class for visual feedback
    this.container.classList.add('lq-dragging');
  }

  onMouseMove(e) {
    if (!this.isDragging) return;

    const newX = e.clientX - this.dragOffset.x;
    const newY = e.clientY - this.dragOffset.y;

    // Keep panel within viewport bounds
    const maxX = window.innerWidth - this.container.offsetWidth;
    const maxY = window.innerHeight - this.container.offsetHeight;

    const boundedX = Math.max(0, Math.min(newX, maxX));
    const boundedY = Math.max(0, Math.min(newY, maxY));

    this.container.style.left = `${boundedX}px`;
    this.container.style.top = `${boundedY}px`;
    this.container.style.right = 'auto';
  }

  onMouseUp() {
    if (this.isDragging) {
      this.isDragging = false;

      // Remove dragging class
      this.container.classList.remove('lq-dragging');

      // Call drag end callback
      const rect = this.container.getBoundingClientRect();
      if (this.onDragEnd) {
        this.onDragEnd(rect.left, rect.top);
      }

      // Remove global listeners
      document.removeEventListener('mousemove', this.onMouseMove.bind(this));
      document.removeEventListener('mouseup', this.onMouseUp.bind(this));
    }
  }

  destroy() {
    const header = this.container.querySelector('.lq-panel-header');
    if (header) {
      header.removeEventListener('mousedown', this.onMouseDown.bind(this));
    }
  }
}

export { DragHandler };
