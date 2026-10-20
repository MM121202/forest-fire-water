// 零依赖打包脚本：用 Node 内置 zlib 手写 ZIP（CRC32 + deflateRaw），
// 不依赖外部 zip/7z/tar，跨平台可用；文件名带 UTF-8 标志位，中文名不解压乱码。
// 用法：node scripts/package.mjs   （或 npm run package）
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8"));
const OUT_NAME = `forest-fire-water-v${pkg.version}.zip`;
const OUT = path.join(ROOT, OUT_NAME);
const PREFIX = "forest-fire-water"; // 解压后的顶层目录名

// 排除项（目录名或文件名，按路径段匹配）
const EXCLUDE_DIRS = new Set([".workbuddy", "node_modules", ".git"]);
const EXCLUDE_FILES = new Set([OUT_NAME, path.basename(OUT)]);

// ---------- CRC32 ----------
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function dosDateTime(d) {
  const time =
    ((d.getHours() & 0x1f) << 11) |
    ((d.getMinutes() & 0x3f) << 5) |
    ((Math.floor(d.getSeconds() / 2)) & 0x1f);
  const date =
    (((d.getFullYear() - 1980) & 0x7f) << 9) |
    (((d.getMonth() + 1) & 0x0f) << 5) |
    (d.getDate() & 0x1f);
  return { time, date };
}

// ---------- 收集文件 ----------
function walk(dir, base, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (EXCLUDE_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name), base, out);
    } else if (entry.isFile()) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(base, abs).split(path.sep).join("/"); // 统一用 /
      if (EXCLUDE_FILES.has(entry.name)) continue;
      out.push({ abs, name: `${PREFIX}/${rel}` });
    }
  }
}

function buildZip(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const push = (buf) => {
    chunks.push(buf);
    offset += buf.length;
  };

  for (const f of files) {
    const data = fs.readFileSync(f.abs);
    const compressed = zlib.deflateRawSync(data, { level: 9 });
    const crc = crc32(data);
    const { time, date } = dosDateTime(fs.statSync(f.abs).mtime);
    const nameBuf = Buffer.from(f.name, "utf8");
    const useStore = compressed.length >= data.length;
    const method = useStore ? 0 : 8;
    const payload = useStore ? data : compressed;
    const crcVal = crc; // CRC 始终取未压缩数据的校验值（store/deflate 皆然）
    const flags = 0x0800; // UTF-8 文件名

    // Local file header (30) + name + data
    const lfh = Buffer.alloc(30);
    lfh.writeUInt32LE(0x04034b50, 0);
    lfh.writeUInt16LE(20, 4); // version needed
    lfh.writeUInt16LE(flags, 6);
    lfh.writeUInt16LE(method, 8);
    lfh.writeUInt16LE(time, 10);
    lfh.writeUInt16LE(date, 12);
    lfh.writeUInt32LE(crcVal, 14);
    lfh.writeUInt32LE(payload.length, 18);
    lfh.writeUInt32LE(data.length, 22);
    lfh.writeUInt16LE(nameBuf.length, 26);
    lfh.writeUInt16LE(0, 28); // extra len
    push(lfh);
    push(nameBuf);
    push(payload);

    const localOffset = offset - (30 + nameBuf.length + payload.length);

    // Central directory header (46) + name
    const cdh = Buffer.alloc(46);
    cdh.writeUInt32LE(0x02014b50, 0);
    cdh.writeUInt16LE(20, 4); // version made by
    cdh.writeUInt16LE(20, 6); // version needed
    cdh.writeUInt16LE(flags, 8);
    cdh.writeUInt16LE(method, 10);
    cdh.writeUInt16LE(time, 12);
    cdh.writeUInt16LE(date, 14);
    cdh.writeUInt32LE(crcVal, 16);
    cdh.writeUInt32LE(payload.length, 20);
    cdh.writeUInt32LE(data.length, 24);
    cdh.writeUInt16LE(nameBuf.length, 28);
    cdh.writeUInt16LE(0, 30); // extra
    cdh.writeUInt16LE(0, 32); // comment
    cdh.writeUInt16LE(0, 34); // disk start
    cdh.writeUInt16LE(0, 36); // internal attr
    cdh.writeUInt32LE((0o100644 << 16) >>> 0, 38); // external attr (unix -rw-r--r--)
    cdh.writeUInt32LE(localOffset, 42);
    central.push(Buffer.concat([cdh, nameBuf]));
  }

  const cdBuf = Buffer.concat(central);
  const cdOffset = offset;
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(cdBuf.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20); // comment len

  return Buffer.concat([...chunks, cdBuf, eocd]);
}

const files = [];
walk(ROOT, ROOT, files);
files.sort((a, b) => (a.name < b.name ? -1 : 1));
const zip = buildZip(files);
fs.writeFileSync(OUT, zip);
console.log(
  `打包完成：${OUT_NAME}  (${files.length} 个文件, ${(zip.length / 1024).toFixed(1)} KB)`
);
