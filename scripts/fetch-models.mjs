#!/usr/bin/env node
// 下载 Live2D 模型到 assets/models/<name>/，供离线/CDN 不可达时兜底使用。
// 用法：
//   node scripts/fetch-models.mjs                        # 下载默认模型 cat-white
//   node scripts/fetch-models.mjs cat-white https://model.hacxy.cn/cat-white/model.json
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MODELS_DIR = path.join(ROOT, 'assets', 'models');

const DEFAULT_NAME = 'cat-white';
const DEFAULT_URL = 'https://model.hacxy.cn/cat-white/model.json';

const name = process.argv[2] || DEFAULT_NAME;
const modelUrl = process.argv[3] || DEFAULT_URL;
const outDir = path.join(MODELS_DIR, name);

// 模型文件后缀，命中即视为需要下载的资源
const RESOURCE_EXT = /\.(json|moc3?|png|webp|mtn|physics|pose)(\/|$)/i;

// Node 的 fetch 失败时真实原因藏在 e.cause 里（TLS/网络），逐层展开便于排查
function describeError(e) {
  const chain = [];
  for (let c = e; c; c = c.cause) chain.push(c.code || c.message);
  return chain.filter(Boolean).join(' <- ');
}

async function get(url, tries = 3) {
  let last;
  for (let i = 1; i <= tries; i++) {
    try {
      const res = await fetch(url, { redirect: 'follow' });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      return await res.arrayBuffer();
    } catch (e) {
      last = e;
      if (i < tries) await new Promise((r) => setTimeout(r, 800 * i));
    }
  }
  throw new Error(`${describeError(last)} (${url})`);
}

// 收集 model.json 中所有被引用的相对路径
function collectRefs(json) {
  const refs = new Set();
  const walk = (node) => {
    if (typeof node === 'string') {
      if (!/^https?:\/\//i.test(node) && RESOURCE_EXT.test(node)) refs.add(node);
      return;
    }
    if (Array.isArray(node)) return node.forEach(walk);
    if (node && typeof node === 'object') return Object.values(node).forEach(walk);
  };
  walk(json);
  // display 等字段可能带 ./ 前缀，统一规整
  return Array.from(refs).map((r) => r.replace(/^\.\//, ''));
}

function joinUrl(baseUrl, rel) {
  const base = baseUrl.slice(0, baseUrl.lastIndexOf('/') + 1);
  return new URL(rel, base).href;
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`模型: ${name}\n来源: ${modelUrl}\n目标: ${outDir}\n`);

  const raw = await get(modelUrl);
  const modelJson = Buffer.from(raw);
  fs.writeFileSync(path.join(outDir, 'model.json'), modelJson);
  console.log(`  ✓ model.json (${modelJson.byteLength} B)`);

  let parsed;
  try {
    parsed = JSON.parse(modelJson.toString('utf-8'));
  } catch (e) {
    throw new Error(`model.json 解析失败：${e.message}`);
  }

  const refs = collectRefs(parsed);
  let ok = 0;
  const failed = [];
  for (const rel of refs) {
    const url = joinUrl(modelUrl, rel);
    const target = path.join(outDir, ...rel.split('/'));
    try {
      const buf = Buffer.from(await get(url));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.writeFileSync(target, buf);
      console.log(`  ✓ ${rel} (${buf.byteLength} B)`);
      ok++;
    } catch (e) {
      console.warn(`  ✗ ${rel} -> ${e.message}`);
      failed.push(rel);
    }
  }

  if (failed.length) {
    console.error(`\n下载不完整：成功 ${ok}/${refs.length}，缺失 ${failed.join(', ')}`);
    console.error('请重新运行本脚本；缺失文件会导致模型渲染异常。');
    process.exit(1);
  }

  console.log(`\n完成：${ok + 1} 个文件已就绪，可离线使用。`);
}

main().catch((e) => {
  console.error('下载失败:', e.message);
  process.exit(1);
});
