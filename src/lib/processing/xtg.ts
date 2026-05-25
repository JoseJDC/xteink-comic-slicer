const XTG_MAGIC = 0x00475458;
const XTH_MAGIC = 0x00485458;

function packHeader(magic: number, width: number, height: number, dataSize: number): ArrayBuffer {
  const buf = new ArrayBuffer(22);
  const dv = new DataView(buf);
  dv.setUint32(0, magic, true);
  dv.setUint16(4, width, true);
  dv.setUint16(6, height, true);
  dv.setUint8(8, 0); // colorMode
  dv.setUint8(9, 0); // compression
  dv.setUint32(10, dataSize, true);
  dv.setUint32(14, 0, true); // md5 low
  dv.setUint32(18, 0, true); // md5 high
  return buf;
}

export function imageDataToXtg(imageData: ImageData): ArrayBuffer {
  const { width, height, data } = imageData;
  const rowBytes = (width + 7) >> 3;
  const pixelDataSize = rowBytes * height;
  const totalSize = 22 + pixelDataSize;
  const buf = new ArrayBuffer(totalSize);
  const out = new Uint8Array(buf);

  const header = new Uint8Array(packHeader(XTG_MAGIC, width, height, pixelDataSize));
  out.set(header, 0);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const pixel = data[srcIdx];
      const bit = pixel < 128 ? 0 : 1;
      const byteIdx = 22 + y * rowBytes + (x >> 3);
      out[byteIdx] |= bit << (7 - (x & 7));
    }
  }

  return buf;
}

export function imageDataToXth(imageData: ImageData): ArrayBuffer {
  const { width, height, data } = imageData;
  const colBytes = (height + 7) >> 3;
  const planeSize = colBytes * width;
  const pixelDataSize = planeSize * 2;
  const totalSize = 22 + pixelDataSize;
  const buf = new ArrayBuffer(totalSize);
  const out = new Uint8Array(buf);

  const header = new Uint8Array(packHeader(XTH_MAGIC, width, height, pixelDataSize));
  out.set(header, 0);

  for (let x = width - 1; x >= 0; x--) {
    for (let y = 0; y < height; y++) {
      const srcIdx = (y * width + x) * 4;
      const gray = data[srcIdx];
      let q: number;
      if (gray >= 212) q = 0;
      else if (gray >= 127) q = 1;
      else if (gray >= 42) q = 2;
      else q = 3;

      const colIndex = width - 1 - x;
      const byteInCol = y >> 3;
      const bitInByte = 7 - (y & 7);

      const plane1 = colIndex * colBytes + byteInCol;
      const plane2 = planeSize + plane1;

      if (q & 2) out[22 + plane1] |= 1 << bitInByte;
      if (q & 1) out[22 + plane2] |= 1 << bitInByte;
    }
  }

  return buf;
}
