#!/usr/bin/env node
/**
 * 英雄清单同步脚本
 *
 * 唯一数据源：shared/agents.json
 * 生成副本：
 *   - valorant-ocr/agents.js   （OCR 服务用，CommonJS）
 *   - frontend/lib/agents.ts   （前端用，ESM）
 *
 * 用法：
 *   node scripts/sync-agents.mjs          重新生成两个副本
 *   node scripts/sync-agents.mjs --check  只校验，不一致时退出码 1（可用于提交前检查/CI）
 *
 * 为什么不用"两边直接引用同一个文件"：
 *   docker-compose 里 frontend 与 ocr 的 build context 分别是 ./frontend 和 ./valorant-ocr，
 *   仓库根目录的文件两个镜像都拿不到。改构建上下文成本与风险都高于生成两份副本。
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(ROOT, 'shared', 'agents.json');
const OCR_TARGET = path.join(ROOT, 'valorant-ocr', 'agents.js');
const WEB_TARGET = path.join(ROOT, 'frontend', 'lib', 'agents.ts');

const BANNER_JS =
  '/**\n' +
  ' * 自动生成，请勿手改。\n' +
  ' * 源文件：shared/agents.json\n' +
  ' * 修改后运行：node scripts/sync-agents.mjs\n' +
  ' */\n';

const BANNER_TS =
  '// 自动生成，请勿手改。\n' +
  '// 源文件：shared/agents.json\n' +
  '// 修改后运行：node scripts/sync-agents.mjs\n';

function fail(message) {
  console.error('[sync-agents] 错误: ' + message);
  process.exit(1);
}

function loadAgents() {
  if (!fs.existsSync(SOURCE)) {
    fail('找不到源文件 ' + path.relative(ROOT, SOURCE));
  }

  let parsed;
  try {
    parsed = JSON.parse(fs.readFileSync(SOURCE, 'utf8'));
  } catch (err) {
    fail('shared/agents.json 不是合法 JSON: ' + err.message);
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    fail('shared/agents.json 必须是非空数组');
  }

  const seen = new Set();
  for (const item of parsed) {
    if (typeof item !== 'string' || !item.trim()) {
      fail('存在非字符串或空白条目: ' + JSON.stringify(item));
    }
    if (item !== item.trim()) {
      fail('条目首尾有空白字符: ' + JSON.stringify(item));
    }
    if (seen.has(item)) {
      fail('存在重复条目: ' + item);
    }
    seen.add(item);
  }

  return parsed;
}

function buildOcrFile(agents) {
  const body = agents.map((a) => '  ' + JSON.stringify(a)).join(',\n');
  return (
    BANNER_JS +
    "'use strict';\n\n" +
    'module.exports = [\n' +
    body + ',\n' +
    '];\n'
  );
}

function buildWebFile(agents) {
  const body = agents.map((a) => '  ' + JSON.stringify(a)).join(',\n');
  return (
    BANNER_TS +
    '\n' +
    '/**\n' +
    ' * 全部特工的中文名。OCR 识别、录入下拉框、详情页判断共用同一份。\n' +
    ' * 注意：这里是 string[] 而不是 as const —— 调用处需要 AGENTS.includes(任意字符串)，\n' +
    ' * 若用 as const 会产生字面量联合类型，导致 includes 参数类型不匹配。\n' +
    ' */\n' +
    'export const AGENTS: string[] = [\n' +
    body + ',\n' +
    '];\n'
  );
}

function writeIfChanged(file, content, checkOnly) {
  const exists = fs.existsSync(file);
  const current = exists ? fs.readFileSync(file, 'utf8') : '';
  const rel = path.relative(ROOT, file);

  if (current === content) {
    console.log('  = ' + rel + ' 已是最新');
    return true;
  }

  if (checkOnly) {
    console.error('  ✗ ' + rel + (exists ? ' 与源文件不一致' : ' 缺失'));
    return false;
  }

  fs.writeFileSync(file, content, 'utf8');
  console.log('  → ' + rel + ' 已更新');
  return true;
}

const checkOnly = process.argv.includes('--check');
const agents = loadAgents();

console.log('[sync-agents] 源: shared/agents.json（' + agents.length + ' 个特工）');

const okOcr = writeIfChanged(OCR_TARGET, buildOcrFile(agents), checkOnly);
const okWeb = writeIfChanged(WEB_TARGET, buildWebFile(agents), checkOnly);

if (!okOcr || !okWeb) {
  console.error('[sync-agents] 校验失败：运行 `node scripts/sync-agents.mjs` 重新生成');
  process.exit(1);
}

console.log(checkOnly ? '[sync-agents] 校验通过' : '[sync-agents] 同步完成');
