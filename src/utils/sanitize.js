// src/utils/sanitize.js
export function sanitizeInput(text, maxLength = 200) {
  if (!text) return ''
  return text
    .replace(/[<>]/g, '')            // 移除 < >
    .replace(/[\u0000-\u001F]/g, '') // 移除控制字符
    .slice(0, maxLength)
    .trim()
}
