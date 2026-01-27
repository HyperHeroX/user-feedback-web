/**
 * image-lightbox.js
 * 圖片 Lightbox 預覽元件
 * 支援多圖片瀏覽、鍵盤導航
 */

/**
 * ImageLightbox 單例物件
 */
export const ImageLightbox = {
  currentImages: [],
  currentIndex: 0,
  keyboardHandler: null,

  /**
   * 開啟 Lightbox
   * @param {Array} images - 圖片陣列 [{type, data}, ...]
   * @param {number} startIndex - 起始索引
   */
  open(images, startIndex = 0) {
    if (!images || images.length === 0) return;

    this.currentImages = images;
    this.currentIndex = startIndex;
    this.render();
    this.show();
    this.bindKeyboard();
  },

  /**
   * 關閉 Lightbox
   */
  close() {
    this.hide();
    this.unbindKeyboard();
  },

  /**
   * 下一張圖片
   */
  next() {
    if (this.currentIndex < this.currentImages.length - 1) {
      this.currentIndex++;
      this.updateImage();
    }
  },

  /**
   * 上一張圖片
   */
  prev() {
    if (this.currentIndex > 0) {
      this.currentIndex--;
      this.updateImage();
    }
  },

  /**
   * 渲染 Lightbox DOM
   */
  render() {
    let lightbox = document.getElementById('imageLightbox');
    if (!lightbox) {
      lightbox = document.createElement('div');
      lightbox.id = 'imageLightbox';
      lightbox.className = 'image-lightbox';
      lightbox.innerHTML = `
        <div class="lightbox-overlay" onclick="window.closeLightbox()"></div>
        <div class="lightbox-container">
          <img class="lightbox-image" id="lightboxImage" src="" alt="Preview">
          <button class="lightbox-close" onclick="window.closeLightbox()" title="關閉 (ESC)">✕</button>
          <button class="lightbox-nav prev" id="lightboxPrev" onclick="window.prevLightboxImage()" title="上一張 (←)">◀</button>
          <button class="lightbox-nav next" id="lightboxNext" onclick="window.nextLightboxImage()" title="下一張 (→)">▶</button>
          <div class="lightbox-counter" id="lightboxCounter">1 / 1</div>
        </div>
      `;
      document.body.appendChild(lightbox);
    }

    this.updateImage();
  },

  /**
   * 更新顯示的圖片
   */
  updateImage() {
    const img = this.currentImages[this.currentIndex];
    if (!img) return;

    const lightboxImage = document.getElementById('lightboxImage');
    const counter = document.getElementById('lightboxCounter');
    const prevBtn = document.getElementById('lightboxPrev');
    const nextBtn = document.getElementById('lightboxNext');

    if (lightboxImage) {
      lightboxImage.src = `data:${img.type};base64,${img.data}`;
    }

    if (counter) {
      if (this.currentImages.length > 1) {
        counter.textContent = `${this.currentIndex + 1} / ${this.currentImages.length}`;
        counter.style.display = 'block';
      } else {
        counter.style.display = 'none';
      }
    }

    if (prevBtn) {
      prevBtn.style.display = this.currentImages.length > 1 ? 'flex' : 'none';
      prevBtn.disabled = this.currentIndex === 0;
      prevBtn.style.opacity = this.currentIndex === 0 ? '0.3' : '1';
    }

    if (nextBtn) {
      nextBtn.style.display = this.currentImages.length > 1 ? 'flex' : 'none';
      nextBtn.disabled = this.currentIndex === this.currentImages.length - 1;
      nextBtn.style.opacity = this.currentIndex === this.currentImages.length - 1 ? '0.3' : '1';
    }
  },

  /**
   * 顯示 Lightbox
   */
  show() {
    const lightbox = document.getElementById('imageLightbox');
    if (lightbox) {
      lightbox.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * 隱藏 Lightbox
   */
  hide() {
    const lightbox = document.getElementById('imageLightbox');
    if (lightbox) {
      lightbox.classList.remove('active');
      document.body.style.overflow = '';
    }
  },

  /**
   * 綁定鍵盤事件
   */
  bindKeyboard() {
    this.keyboardHandler = (e) => {
      switch (e.key) {
        case 'Escape':
          this.close();
          break;
        case 'ArrowLeft':
          this.prev();
          break;
        case 'ArrowRight':
          this.next();
          break;
      }
    };
    document.addEventListener('keydown', this.keyboardHandler);
  },

  /**
   * 解除鍵盤事件綁定
   */
  unbindKeyboard() {
    if (this.keyboardHandler) {
      document.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
  }
};

/**
 * 開啟圖片 Lightbox（全域函數）
 * @param {number} index - 圖片索引
 * @param {HTMLElement} element - 觸發元素
 */
export function openImageLightbox(index, element) {
  const container = element.closest('.entry-images');
  if (!container) return;

  try {
    const images = JSON.parse(container.dataset.images || '[]');
    ImageLightbox.open(images, index);
  } catch (e) {
    console.error('無法解析圖片數據:', e);
  }
}

/**
 * 關閉 Lightbox（全域函數）
 */
export function closeLightbox() {
  ImageLightbox.close();
}

/**
 * 下一張圖片（全域函數）
 */
export function nextLightboxImage() {
  ImageLightbox.next();
}

/**
 * 上一張圖片（全域函數）
 */
export function prevLightboxImage() {
  ImageLightbox.prev();
}

export default ImageLightbox;
