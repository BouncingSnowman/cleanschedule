/**
 * CleanSchedule — Modal System
 */

const overlay = document.getElementById('modal-overlay');
const modal = document.getElementById('modal');
const titleEl = document.getElementById('modal-title');
const bodyEl = document.getElementById('modal-body');
const footerEl = document.getElementById('modal-footer');
const closeBtn = document.getElementById('modal-close');

let currentOnClose = null;

export function openModal({ title, body, footer, onClose }) {
    titleEl.textContent = title;
    bodyEl.innerHTML = body;
    footerEl.innerHTML = footer || '';
    currentOnClose = onClose || null;
    overlay.classList.remove('hidden');
    // Focus first input
    setTimeout(() => {
        const firstInput = bodyEl.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    }, 100);
}

export function closeModal() {
    overlay.classList.add('hidden');
    if (currentOnClose) currentOnClose();
    currentOnClose = null;
    bodyEl.innerHTML = '';
    footerEl.innerHTML = '';
}

// Close on overlay click (outside modal)
overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeModal();
});

// Close button
closeBtn.addEventListener('click', closeModal);

// Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
        closeModal();
    }
});
