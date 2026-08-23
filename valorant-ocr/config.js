'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG_PATH = path.join(__dirname, 'default-config.json');

/**
 * 加载配置，支持用户自定义配置覆盖默认值
 * @param {string} [userConfigPath] - 可选的自定义配置文件路径
 * @returns {object} 合并后的配置对象
 */
function loadConfig(userConfigPath) {
  const defaults = JSON.parse(fs.readFileSync(DEFAULT_CONFIG_PATH, 'utf8'));

  if (!userConfigPath) {
    return defaults;
  }

  const resolvedPath = path.resolve(userConfigPath);
  if (!fs.existsSync(resolvedPath)) {
    console.warn(`[config] 用户配置文件不存在: ${resolvedPath}，使用默认配置`);
    return defaults;
  }

  const userConfig = JSON.parse(fs.readFileSync(resolvedPath, 'utf8'));
  return deepMerge(defaults, userConfig);
}

/**
 * 简单深合并（只合并普通对象，数组直接替换）
 */
function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

module.exports = { loadConfig };
