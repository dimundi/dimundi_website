const MENU_TYPE_SPEED_MS = 30;
const menuItems = Array.from(document.querySelectorAll('.menu-item'));
const descriptionItems = menuItems.filter((item) => item.dataset.descriptionTarget);
const descriptionPanels = descriptionItems
  .map((item) => document.getElementById(item.dataset.descriptionTarget))
  .filter(Boolean);

function typeText(targetEl, speed, onDone) {
  targetEl.classList.add('visible');
  typeWriter(targetEl, speed, onDone);
}

function typeItemsSequentially(items, speed, index, onAllDone) {
  if (index >= items.length) {
    onAllDone?.();
    return;
  }

  typeText(items[index], speed, () => typeItemsSequentially(items, speed, index + 1, onAllDone));
}

if (menuItems.length > 0) {
  let activeIndex = 0;
  let menuReady = false;

  // Keep expandable service items mutually exclusive, toggleable and accessible.
  const setDescriptionOpen = (item, shouldOpen) => {
    const targetId = item.dataset.descriptionTarget;
    if (!targetId) return;

    descriptionPanels.forEach((panel) => {
      const isOpen = shouldOpen && panel.id === targetId;
      panel.classList.toggle('is-open', isOpen);
      panel.setAttribute('aria-hidden', String(!isOpen));
    });

    descriptionItems.forEach((descriptionItem) => {
      descriptionItem.setAttribute('aria-expanded', String(shouldOpen && descriptionItem === item));
    });
  };

  const toggleDescription = (item) => {
    setDescriptionOpen(item, item.getAttribute('aria-expanded') !== 'true');
  };

  const setActive = (index) => {
    activeIndex = index;
    menuItems.forEach((item, i) => item.classList.toggle('is-active', i === activeIndex));
  };

  const focusItem = (index) => {
    setActive(index);
    menuItems[activeIndex].focus();
  };

  menuItems.forEach((item, i) => {
    item.addEventListener('focus', () => {
      if (menuReady) setActive(i);
    });

    item.addEventListener('click', (event) => {
      if (!item.dataset.descriptionTarget) return;

      event.preventDefault();
      setActive(i);
      toggleDescription(item);
    });
  });

  document.addEventListener('keydown', (event) => {
    if (event.target.closest('.home-link')) return;
    if (!menuReady) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusItem((activeIndex + 1) % menuItems.length);
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusItem((activeIndex - 1 + menuItems.length) % menuItems.length);
    }

    if (event.key === 'Enter' || event.key === ' ') {
      const activeItem = menuItems[activeIndex];
      if (!activeItem.dataset.descriptionTarget) return;

      event.preventDefault();
      toggleDescription(activeItem);
    }
  });

  document.addEventListener('dimundi:intro-typed', () => {
    typeItemsSequentially(menuItems, MENU_TYPE_SPEED_MS, 0, () => {
      menuReady = true;
      setActive(0);
    });
  });
}
