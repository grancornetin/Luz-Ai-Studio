'use strict';

const ID_PATTERN = /^[a-zA-Z0-9_-]{1,160}$/;

function safeId(value) {
  const id = String(value || '').trim();
  if (!ID_PATTERN.test(id)) return null;
  return id;
}

function generateId(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

module.exports = { safeId, generateId };
