// Decode a CS2 crosshair share code (CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx) into console commands.
// Layout taken from client.dll (2026-09-23): apply_crosshair_code -> share code decode -> field parse.
//
// Loaded by the page as a plain script (exposes window.CrosshairCode); also
// require()-able from bun/node for testing:
//   bun -e 'const c = require("./decode.js"); console.log(c.toCommands(c.decodeCrosshairCode("CSGO-...")))'
(function (root) {
  'use strict';

  const ALPHABET = 'ABCDEFGHJKLMNOPQRSTUVWXYZabcdefhijkmnopqrstuvwxyz23456789';

  // Finds a share code anywhere in pasted text, e.g. "apply_crosshair_code CSGO-...".
  const CODE_RE = /CSGO(?:-[A-Za-z0-9]{5}){5}/;

  function extractCode(text) {
    const m = CODE_RE.exec(String(text));
    return m ? m[0] : null;
  }

  // 25 base-57 digits, least significant first, into an 18 byte big-endian buffer.
  function shareCodeBytes(code) {
    const digits = code.trim().replace(/^CSGO-/, '').replace(/-/g, '');

    if (digits.length !== 25) {
      throw new Error('expected CSGO-xxxxx-xxxxx-xxxxx-xxxxx-xxxxx');
    }

    let value = 0n;

    for (const char of [...digits].reverse()) {
      const digit = ALPHABET.indexOf(char);

      if (digit < 0) {
        throw new Error(`invalid character '${char}'`);
      }

      value = value * 57n + BigInt(digit);
    }

    const bytes = new Uint8Array(18);

    for (let i = 17; i >= 0; i--) {
      bytes[i] = Number(value & 0xffn);
      value >>= 8n;
    }

    return bytes;
  }

  function decodeCrosshairCode(code) {
    const b = shareCodeBytes(code);

    // byte 0 is a checksum over bytes 1..15, byte 1 is the format version (the game wants >= 3)
    const checksum = b.slice(1, 16).reduce((sum, byte) => (sum + byte) & 0xff, 0);

    if (b[0] !== checksum) {
      throw new Error('checksum mismatch');
    }

    if (b[1] < 3) {
      throw new Error(`version ${b[1]} is older than the game accepts`);
    }

    // bytes 10..13 as a little-endian dword hold the packed split / thickness fields
    const packed = (b[10] | (b[11] << 8) | (b[12] << 16) | (b[13] << 24)) >>> 0;

    const round2 = (x) => Math.round(x * 100) / 100;

    return {
      cl_crosshairstyle: b[2] & 0x0f,
      cl_crosshair_recoil: (b[2] >> 4) & 1,
      cl_crosshair_drawoutline: (b[2] >> 5) & 1,
      cl_crosshairdot: (b[2] >> 6) & 1,
      cl_crosshair_t: b[2] >> 7,
      cl_crosshair_gap: b[7],
      cl_crosshair_thickness: (packed >>> 23) & 0x1f,
      cl_crosshair_length: b[8],
      cl_crosshair_dynamic_spread_limit: b[9],
      cl_crosshaircolor_r: b[3],
      cl_crosshaircolor_g: b[4],
      cl_crosshaircolor_b: b[5],
      cl_crosshaircolor_a: b[6],
      cl_crosshair_dynamic_splitdist: packed & 0x7f,
      cl_crosshair_dynamic_splitalpha_innermod: round2(((packed >>> 7) & 0x1f) * 0.05),
      cl_crosshair_dynamic_splitalpha_outermod: round2(0.3 + ((packed >>> 12) & 0x0f) * 0.05),
      cl_crosshair_dynamic_maxdist_splitratio: round2(((packed >>> 16) & 0x7f) / 100),
    };
  }

  function toCommands(settings, separator = '; ') {
    return Object.entries(settings)
      .map(([name, value]) => `${name} ${value}`)
      .join(separator);
  }

  const api = { extractCode, decodeCrosshairCode, toCommands };

  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.CrosshairCode = api;
  }
})(this);
