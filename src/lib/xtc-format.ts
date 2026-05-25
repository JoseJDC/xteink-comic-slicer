const XTC_MAGIC = 0x00435458;
const XTCH_MAGIC = 0x48435458;

interface XtcPageEntry {
  data: ArrayBuffer;
  width: number;
  height: number;
}

function setUint64LE(dv: DataView, byteOffset: number, value: number): void {
  const lo = value >>> 0;
  const hi = (value - lo) / 4294967296;
  dv.setUint32(byteOffset, lo, true);
  dv.setUint32(byteOffset + 4, hi, true);
}

function createHeader(
  magic: number,
  pageCount: number,
  metadataOffset: number,
  indexOffset: number,
  dataOffset: number
): ArrayBuffer {
  const buf = new ArrayBuffer(56);
  const dv = new DataView(buf);
  dv.setUint32(0, magic, true);
  dv.setUint16(4, 0x0100, true);
  dv.setUint16(6, pageCount, true);
  dv.setUint8(8, 0);
  dv.setUint8(9, 0);
  dv.setUint8(10, 0);
  dv.setUint8(11, 0);
  dv.setUint32(12, 0, true);
  setUint64LE(dv, 16, metadataOffset);
  setUint64LE(dv, 24, indexOffset);
  setUint64LE(dv, 32, dataOffset);
  setUint64LE(dv, 40, 0);
  setUint64LE(dv, 48, 0);
  return buf;
}

function createPageEntry(pageDataOffset: number, data: ArrayBuffer, width: number, height: number): ArrayBuffer {
  const buf = new ArrayBuffer(16);
  const dv = new DataView(buf);
  setUint64LE(dv, 0, pageDataOffset);
  dv.setUint32(8, data.byteLength, true);
  dv.setUint16(12, width, true);
  dv.setUint16(14, height, true);
  return buf;
}

export function buildXtc(pages: XtcPageEntry[], is2bit: boolean): ArrayBuffer {
  const pageCount = pages.length;
  const indexSize = pageCount * 16;
  let dataSize = 0;
  for (const p of pages) dataSize += p.data.byteLength;

  const headerSize = 56;
  const indexOffset = headerSize;
  const dataOffset = headerSize + indexSize;

  const totalSize = headerSize + indexSize + dataSize;
  const buf = new ArrayBuffer(totalSize);
  const out = new Uint8Array(buf);
  let offset = 0;

  const magic = is2bit ? XTCH_MAGIC : XTC_MAGIC;
  const header = new Uint8Array(createHeader(magic, pageCount, 0, indexOffset, dataOffset));
  out.set(header, offset);
  offset += headerSize;

  let pageFileOffset = dataOffset;
  for (const page of pages) {
    const entry = new Uint8Array(createPageEntry(pageFileOffset, page.data, page.width, page.height));
    out.set(entry, offset);
    offset += 16;
    pageFileOffset += page.data.byteLength;
  }

  for (const page of pages) {
    const pageData = new Uint8Array(page.data);
    out.set(pageData, offset);
    offset += page.data.byteLength;
  }

  return buf;
}

export function generateXtcFilename(title: string, is2bit: boolean): string {
  const safe = title.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'comic';
  return `${safe}.${is2bit ? 'xtch' : 'xtc'}`;
}
