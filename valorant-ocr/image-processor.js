'use strict';

const jimp = require('jimp');

class ImageProcessor {
  constructor(cropConfig, blotConfig, playersConfig) {
    this.cropConfig = cropConfig;
    this.blotConfig = blotConfig;
    this.playersConfig = playersConfig;
    this.strategy = (cropConfig && cropConfig.strategy) || 'blot';
    this.dynamicRegion = null;
    this.mappedColumns = null;
  }

  setDynamicRegion(region) {
    this.dynamicRegion = region;
  }

  setMappedColumns(mapped) {
    this.mappedColumns = mapped;
  }

  async process(imageBuffer, dynamicRegion) {
    const image = await jimp.read(imageBuffer);
    const actualW = image.bitmap.width;
    const actualH = image.bitmap.height;

    if (dynamicRegion && dynamicRegion.detected) {
      this.dynamicRegion = dynamicRegion;
    }

    if (this.strategy === 'row-wise') {
      return this._processRowWise(image, actualW, actualH);
    }
    if (this.strategy === 'full-column') {
      return this._processFullColumn(image, actualW, actualH);
    }
    if (this.strategy === 'per-player-crop') {
      return this._processPerPlayer(image, actualW, actualH);
    }
    if (this.strategy === 'column-crop') {
      return this._processColumnCrop(image, actualW, actualH);
    }
    return this._processBlot(image, actualW, actualH);
  }

  // 新增：行式裁剪 - 每行裁剪一整条（包含所有列）
  async _processRowWise(image, actualW, actualH) {
    if (!this.dynamicRegion || !this.mappedColumns) {
      throw new Error('row-wise strategy requires dynamicRegion and mappedColumns');
    }

    const rows = [];
    for (let ri = 0; ri < this.dynamicRegion.rowCount; ri++) {
      const y = this.dynamicRegion.dataStart + ri * this.dynamicRegion.rowHeight;
      // 从 dataLeft 到 dataRight 裁剪整行
      const cropX = this.dynamicRegion.dataLeft;
      const cropW = this.dynamicRegion.dataWidth;
      const cropH = this.dynamicRegion.rowHeight;

      const rowImg = image.clone().crop(cropX, y, cropW, cropH);
      const buf = await rowImg.getBufferAsync(jimp.MIME_PNG);

      rows.push({
        buffer: buf,
        rowIndex: ri,
        team: ri < 5 ? 0 : 1,
        playerIndex: ri % 5
      });
    }

    console.log('[processor] 行式裁剪: ' + rows.length + ' 行');
    return { rows, mappedColumns: this.mappedColumns };
  }

  async _processFullColumn(image, actualW, actualH) {
    const players = this.playersConfig;
    const { targetWidth, targetHeight } = this.cropConfig;
    const { columns } = players;

    const scaleX = actualW / targetWidth;
    const scaleY = actualH / targetHeight;
    const needsScale = (actualW !== targetWidth || actualH !== targetHeight);

    const result = {};
    const enabledColumns = Object.entries(columns).filter(([, col]) => col.enabled);

    for (const [colName, col] of enabledColumns) {
      let cx = col.x;
      let cw = col.width;
      let cy = col.fullY;
      let ch = col.fullHeight;

      if (needsScale) {
        cx = Math.round(cx * scaleX);
        cw = Math.round(cw * scaleX);
        cy = Math.round(cy * scaleY);
        ch = Math.round(ch * scaleY);
      }

      const crop = image.clone().crop(cx, cy, cw, ch);
      const scale = col.scale || 3;
      crop.scale(scale);

      const buf = await crop.getBufferAsync(jimp.MIME_PNG);
      result[colName] = [buf];

      if (process.env.DEBUG_SAVE) {
        await crop.writeAsync('debug-' + colName + '-full.png');
      }
    }

    return result;
  }

  async _processPerPlayer(image, actualW, actualH) {
    const players = this.playersConfig;
    const { targetWidth, targetHeight } = this.cropConfig;
    const { rowHeight, rowSpacing, columns, team1, team2 } = players;

    const scaleX = actualW / targetWidth;
    const scaleY = actualH / targetHeight;
    const needsScale = (actualW !== targetWidth || actualH !== targetHeight);

    const playerYs = [];
    if (this.dynamicRegion) {
      for (let pi = 0; pi < this.dynamicRegion.rowCount; pi++) {
        const y = this.dynamicRegion.dataStart + pi * this.dynamicRegion.rowHeight;
        const team = pi < 5 ? 0 : 1;
        const playerIdx = pi % 5;
        if (needsScale) {
          playerYs.push({ y: Math.round(y * scaleY), teamIndex: team, playerIndex: playerIdx, absoluteIndex: pi });
        } else {
          playerYs.push({ y, teamIndex: team, playerIndex: playerIdx, absoluteIndex: pi });
        }
      }
    } else {
      for (let t = 0; t < 2; t++) {
        const team = t === 0 ? team1 : team2;
        if (!team) continue;
        for (let pi = 0; pi < team.playerCount; pi++) {
          const y = team.startY + pi * (rowHeight + rowSpacing);
          if (needsScale) {
            playerYs.push({ y: Math.round(y * scaleY), teamIndex: t, playerIndex: pi });
          } else {
            playerYs.push({ y, teamIndex: t, playerIndex: pi });
          }
        }
      }
    }

    const result = {};
    const enabledColumns = Object.entries(columns).filter(([, col]) => col.enabled);

    for (const [colName, col] of enabledColumns) {
      result[colName] = [];
      for (const p of playerYs) {
        let cx;
        let cw;
        if (this.mappedColumns && this.mappedColumns[colName]) {
          cx = this.mappedColumns[colName].x;
          cw = this.mappedColumns[colName].width;
        } else {
          cx = col.x;
          cw = col.width;
          if (needsScale) {
            cx = Math.round(cx * scaleX);
            cw = Math.round(cw * scaleX);
          }
        }

        let cy;
        if (this.dynamicRegion && col.yOffsetFactor != null) {
          cy = p.y + Math.round(this.dynamicRegion.rowHeight * col.yOffsetFactor);
        } else {
          cy = p.y + col.yOffset;
        }

        let ch;
        if (this.dynamicRegion && col.heightFactor != null) {
          ch = Math.round(this.dynamicRegion.rowHeight * col.heightFactor);
        } else {
          ch = col.height;
        }

        if (needsScale && !this.mappedColumns) {
          if (!this.dynamicRegion) {
            cy = Math.round(cy * scaleY);
            ch = Math.round(ch * scaleY);
          }
        }

        const crop = image.clone().crop(cx, cy, cw, ch);
        const scale = col.scale || 3;
        crop.scale(scale);

        if (col.preprocess === 'threshold') {
          crop.greyscale();
          const hist = new Array(256).fill(0);
          let totalPixels = 0;
          crop.scan(0, 0, crop.bitmap.width, crop.bitmap.height, (x, y, idx) => {
            const v = crop.bitmap.data[idx];
            hist[v]++;
            totalPixels++;
          });
          let sum = 0;
          for (let i = 0; i < 256; i++) sum += i * hist[i];
          let sumB = 0, wB = 0, wF = 0;
          let maxVariance = 0, threshold = 128;
          for (let t = 0; t < 256; t++) {
            wB += hist[t];
            if (wB === 0) continue;
            wF = totalPixels - wB;
            if (wF === 0) break;
            sumB += t * hist[t];
            const meanB = sumB / wB;
            const meanF = (sum - sumB) / wF;
            const betweenVar = wB * wF * (meanB - meanF) * (meanB - meanF);
            if (betweenVar > maxVariance) {
              maxVariance = betweenVar;
              threshold = t;
            }
          }
          crop.scan(0, 0, crop.bitmap.width, crop.bitmap.height, (x, y, idx) => {
            const v = crop.bitmap.data[idx];
            crop.bitmap.data[idx] = crop.bitmap.data[idx + 1] = crop.bitmap.data[idx + 2] = (v > threshold) ? 255 : 0;
          });
        }

        const buf = await crop.getBufferAsync(jimp.MIME_PNG);
        result[colName].push(buf);
      }
    }

    return result;
  }

  async _processColumnCrop(image, actualW, actualH) {
    const { nameColumn, scoreColumn, targetWidth, targetHeight } = this.cropConfig;

    let nx = nameColumn.x, ny = nameColumn.y;
    let nw = nameColumn.width, nh = nameColumn.height;
    let sx = scoreColumn.x, sy = scoreColumn.y;
    let sw = scoreColumn.width, sh = scoreColumn.height;

    if (actualW !== targetWidth || actualH !== targetHeight) {
      const scaleX = actualW / targetWidth;
      const scaleY = actualH / targetHeight;
      nx = Math.round(nx * scaleX); ny = Math.round(ny * scaleY);
      nw = Math.round(nw * scaleX); nh = Math.round(nh * scaleY);
      sx = Math.round(sx * scaleX); sy = Math.round(sy * scaleY);
      sw = Math.round(sw * scaleX); sh = Math.round(sh * scaleY);
    }

    const namesImg = image.clone().crop(nx, ny, nw, nh);
    const scoresImg = image.clone().crop(sx, sy, sw, sh);

    if (process.env.DEBUG_SAVE) {
      await namesImg.writeAsync('debug-names.png');
      await scoresImg.writeAsync('debug-scores.png');
    }

    const namesBuffer = await namesImg.getBufferAsync(jimp.MIME_PNG);
    const scoresBuffer = await scoresImg.getBufferAsync(jimp.MIME_PNG);
    return { namesBuffer, scoresBuffer };
  }

  async _processBlot(image, actualW, actualH) {
    const { x, y, width, height, targetWidth, targetHeight } = this.cropConfig;
    const { blotFile, namesMask, scoresMask } = this.blotConfig;

    let cropX = x, cropY = y, cropW = width, cropH = height;
    if (actualW !== targetWidth || actualH !== targetHeight) {
      const scaleX = actualW / targetWidth;
      const scaleY = actualH / targetHeight;
      cropX = Math.round(x * scaleX);
      cropY = Math.round(y * scaleY);
      cropW = Math.round(width * scaleX);
      cropH = Math.round(height * scaleY);
    }

    const blot = await jimp.read(blotFile);
    const namesImg = image.clone().crop(cropX, cropY, cropW, cropH);
    for (const bx of namesMask) namesImg.composite(blot, bx, 0);
    const namesBuffer = await namesImg.getBufferAsync(jimp.MIME_PNG);

    const scoresImg = image.clone().crop(cropX, cropY, cropW, cropH);
    for (const bx of scoresMask) scoresImg.composite(blot, bx, 0);
    const scoresBuffer = await scoresImg.getBufferAsync(jimp.MIME_PNG);

    return { namesBuffer, scoresBuffer };
  }
}

module.exports = ImageProcessor;
