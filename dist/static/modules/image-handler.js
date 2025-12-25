/**
 * image-handler.js
 * 圖片處理模組
 * 包含圖片上傳、預覽、移除等功能
 */

import {
  getCurrentImages,
  addImage,
  removeImageAt,
  clearImages as clearImageState,
} from "./state-manager.js";

/**
 * 處理檔案選擇事件
 * @param {Event} e - 檔案選擇事件
 */
export function handleFileSelect(e) {
  handleFileDrop(e.target.files);
}

/**
 * 處理檔案拖放
 * @param {FileList} files - 檔案列表
 */
export function handleFileDrop(files) {
  Array.from(files).forEach((file) => {
    if (file.type.startsWith("image/")) {
      readImageFile(file);
    }
  });
}

/**
 * 處理貼上事件
 * @param {ClipboardEvent} e - 貼上事件
 */
export function handlePaste(e) {
  const items = e.clipboardData.items;

  for (let item of items) {
    if (item.type.startsWith("image/")) {
      const file = item.getAsFile();
      readImageFile(file);
    }
  }
}

/**
 * 讀取圖片檔案
 * @param {File} file - 圖片檔案
 */
export function readImageFile(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const imageData = {
      name: file.name,
      data: e.target.result.split(",")[1],
      size: file.size,
      type: file.type,
    };

    addImage(imageData);
    const currentImages = getCurrentImages();
    addImagePreview(e.target.result, currentImages.length - 1);
    updateImageCount();
  };

  reader.readAsDataURL(file);
}

/**
 * 新增圖片預覽
 * @param {string} dataUrl - 圖片 Data URL
 * @param {number} index - 圖片索引
 */
export function addImagePreview(dataUrl, index) {
  const container = document.getElementById("imagePreviewContainer");
  const dropZone = document.getElementById("imageDropZone");
  const currentImages = getCurrentImages();

  if (currentImages.length > 0) {
    dropZone.style.display = "none";
    container.style.display = "flex";
  }

  const preview = document.createElement("div");
  preview.className = "image-preview";
  preview.innerHTML = `
    <img src="${dataUrl}" alt="Preview">
    <button class="image-preview-remove" onclick="removeImage(${index})">✖</button>
  `;

  container.appendChild(preview);
}

/**
 * 移除圖片
 * @param {number} index - 圖片索引
 */
export function removeImage(index) {
  removeImageAt(index);

  const container = document.getElementById("imagePreviewContainer");
  container.innerHTML = "";

  const currentImages = getCurrentImages();
  currentImages.forEach((img, i) => {
    const dataUrl = `data:${img.type};base64,${img.data}`;
    addImagePreview(dataUrl, i);
  });

  updateImageCount();

  if (currentImages.length === 0) {
    document.getElementById("imageDropZone").style.display = "flex";
    container.style.display = "none";
  }
}

/**
 * 清除所有圖片
 */
export function clearImages() {
  clearImageState();
  document.getElementById("imagePreviewContainer").innerHTML = "";
  document.getElementById("imageDropZone").style.display = "flex";
  document.getElementById("imagePreviewContainer").style.display = "none";
  updateImageCount();
}

/**
 * 更新圖片數量顯示
 */
export function updateImageCount() {
  const countEl = document.getElementById("imageCount");
  if (countEl) {
    countEl.textContent = getCurrentImages().length;
  }
}

// 暴露到 window 供 HTML onclick 使用
window.removeImage = removeImage;

export default {
  handleFileSelect,
  handleFileDrop,
  handlePaste,
  readImageFile,
  addImagePreview,
  removeImage,
  clearImages,
  updateImageCount,
};
