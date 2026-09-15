// src/lib/qr/qrVersion3M.ts
// 2026-09-15 JST
//
// Minimal QR Code Model 2 encoder for PARARI participation-pass URLs.
// Fixed profile: Version 3, error correction M, byte mode, mask 0.
// This profile can encode up to 42 UTF-8 bytes. Keeping the profile fixed
// makes the implementation small and auditable while remaining standards-compliant.

const SIZE = 29;
const DATA_CODEWORDS = 44;
const ECC_CODEWORDS = 26;
const MAX_BYTES = 42;

type Module = boolean | null;

function gfMultiply(a: number, b: number): number {
  let x = a & 0xff;
  let y = b & 0xff;
  let result = 0;

  while (y !== 0) {
    if ((y & 1) !== 0) {
      result ^= x;
    }

    y >>>= 1;
    x <<= 1;

    if ((x & 0x100) !== 0) {
      x ^= 0x11d;
    }
  }

  return result & 0xff;
}

function gfPowerOfTwo(power: number): number {
  let value = 1;

  for (let i = 0; i < power; i += 1) {
    value = gfMultiply(value, 2);
  }

  return value;
}

function multiplyPolynomials(
  a: number[],
  b: number[],
): number[] {
  const result =
    new Array<number>(
      a.length + b.length - 1,
    ).fill(0);

  for (let i = 0; i < a.length; i += 1) {
    for (let j = 0; j < b.length; j += 1) {
      result[i + j] ^=
        gfMultiply(a[i], b[j]);
    }
  }

  return result;
}

function createErrorCorrection(
  data: number[],
): number[] {
  let generator = [1];

  for (
    let i = 0;
    i < ECC_CODEWORDS;
    i += 1
  ) {
    generator = multiplyPolynomials(
      generator,
      [1, gfPowerOfTwo(i)],
    );
  }

  let remainder =
    new Array<number>(ECC_CODEWORDS).fill(0);

  for (const byte of data) {
    const factor =
      byte ^ remainder[0];

    remainder = [
      ...remainder.slice(1),
      0,
    ];

    for (
      let i = 0;
      i < ECC_CODEWORDS;
      i += 1
    ) {
      remainder[i] ^=
        gfMultiply(
          generator[i + 1],
          factor,
        );
    }
  }

  return remainder;
}

function appendBits(
  target: number[],
  value: number,
  length: number,
) {
  for (
    let i = length - 1;
    i >= 0;
    i -= 1
  ) {
    target.push((value >>> i) & 1);
  }
}

function createDataCodewords(
  text: string,
): number[] {
  const bytes =
    Array.from(
      new TextEncoder().encode(text),
    );

  if (bytes.length > MAX_BYTES) {
    throw new Error(
      `QR payload is too long (${bytes.length}/${MAX_BYTES} bytes).`,
    );
  }

  const bits: number[] = [];

  // Byte mode.
  appendBits(bits, 0b0100, 4);
  appendBits(bits, bytes.length, 8);

  for (const byte of bytes) {
    appendBits(bits, byte, 8);
  }

  const capacityBits =
    DATA_CODEWORDS * 8;

  const terminatorLength =
    Math.min(
      4,
      capacityBits - bits.length,
    );

  for (
    let i = 0;
    i < terminatorLength;
    i += 1
  ) {
    bits.push(0);
  }

  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const result: number[] = [];

  for (
    let offset = 0;
    offset < bits.length;
    offset += 8
  ) {
    let value = 0;

    for (let i = 0; i < 8; i += 1) {
      value =
        (value << 1) |
        bits[offset + i];
    }

    result.push(value);
  }

  let padIndex = 0;
  const padBytes = [0xec, 0x11];

  while (
    result.length < DATA_CODEWORDS
  ) {
    result.push(
      padBytes[padIndex % 2],
    );
    padIndex += 1;
  }

  return result;
}

function bitLength(value: number): number {
  if (value === 0) {
    return 0;
  }

  return (
    Math.floor(Math.log2(value)) + 1
  );
}

function createFormatBits(): number {
  // EC level M has format value 00, mask pattern is fixed to 000.
  const formatData = 0;
  const generator = 0x537;
  let value = formatData << 10;

  while (
    bitLength(value) -
      bitLength(generator) >=
    0
  ) {
    value ^=
      generator <<
      (bitLength(value) -
        bitLength(generator));
  }

  return (
    ((formatData << 10) | value) ^
    0x5412
  );
}

function isMaskDark(
  row: number,
  column: number,
): boolean {
  // Mask pattern 0.
  return (row + column) % 2 === 0;
}

function placeFinder(
  modules: Module[][],
  row: number,
  column: number,
) {
  for (let r = -1; r <= 7; r += 1) {
    const targetRow = row + r;

    if (
      targetRow < 0 ||
      targetRow >= SIZE
    ) {
      continue;
    }

    for (
      let c = -1;
      c <= 7;
      c += 1
    ) {
      const targetColumn =
        column + c;

      if (
        targetColumn < 0 ||
        targetColumn >= SIZE
      ) {
        continue;
      }

      const dark =
        (r >= 0 &&
          r <= 6 &&
          (c === 0 || c === 6)) ||
        (c >= 0 &&
          c <= 6 &&
          (r === 0 || r === 6)) ||
        (r >= 2 &&
          r <= 4 &&
          c >= 2 &&
          c <= 4);

      modules[targetRow][targetColumn] =
        dark;
    }
  }
}

function placeAlignment(
  modules: Module[][],
  centerRow: number,
  centerColumn: number,
) {
  if (
    modules[centerRow][centerColumn] !==
    null
  ) {
    return;
  }

  for (let r = -2; r <= 2; r += 1) {
    for (
      let c = -2;
      c <= 2;
      c += 1
    ) {
      modules[centerRow + r][centerColumn + c] =
        Math.abs(r) === 2 ||
        Math.abs(c) === 2 ||
        (r === 0 && c === 0);
    }
  }
}

function placeFormatInformation(
  modules: Module[][],
) {
  const bits = createFormatBits();

  for (let i = 0; i < 15; i += 1) {
    const dark =
      ((bits >>> i) & 1) === 1;

    if (i < 6) {
      modules[i][8] = dark;
    } else if (i < 8) {
      modules[i + 1][8] = dark;
    } else {
      modules[SIZE - 15 + i][8] =
        dark;
    }
  }

  for (let i = 0; i < 15; i += 1) {
    const dark =
      ((bits >>> i) & 1) === 1;

    if (i < 8) {
      modules[8][SIZE - i - 1] =
        dark;
    } else if (i < 9) {
      modules[8][15 - i] = dark;
    } else {
      modules[8][15 - i - 1] =
        dark;
    }
  }

  // Fixed dark module.
  modules[SIZE - 8][8] = true;
}

export function createQrVersion3M(
  text: string,
): boolean[][] {
  const data = createDataCodewords(text);
  const codewords = [
    ...data,
    ...createErrorCorrection(data),
  ];

  const modules: Module[][] =
    Array.from(
      { length: SIZE },
      () =>
        new Array<Module>(SIZE).fill(null),
    );

  placeFinder(modules, 0, 0);
  placeFinder(modules, SIZE - 7, 0);
  placeFinder(modules, 0, SIZE - 7);

  // Version 3 alignment centers are 6 and 22.
  for (const row of [6, 22]) {
    for (const column of [6, 22]) {
      placeAlignment(
        modules,
        row,
        column,
      );
    }
  }

  for (
    let row = 8;
    row < SIZE - 8;
    row += 1
  ) {
    if (modules[row][6] === null) {
      modules[row][6] =
        row % 2 === 0;
    }
  }

  for (
    let column = 8;
    column < SIZE - 8;
    column += 1
  ) {
    if (modules[6][column] === null) {
      modules[6][column] =
        column % 2 === 0;
    }
  }

  placeFormatInformation(modules);

  let row = SIZE - 1;
  let direction = -1;
  let byteIndex = 0;
  let bitIndex = 7;

  for (
    let column = SIZE - 1;
    column > 0;
    column -= 2
  ) {
    let workingColumn = column;

    if (workingColumn <= 6) {
      workingColumn -= 1;
    }

    while (true) {
      for (
        const targetColumn of [
          workingColumn,
          workingColumn - 1,
        ]
      ) {
        if (
          modules[row][targetColumn] !==
          null
        ) {
          continue;
        }

        let dark = false;

        if (byteIndex < codewords.length) {
          dark =
            ((codewords[byteIndex] >>>
              bitIndex) &
              1) ===
            1;
        }

        if (
          isMaskDark(
            row,
            targetColumn,
          )
        ) {
          dark = !dark;
        }

        modules[row][targetColumn] = dark;
        bitIndex -= 1;

        if (bitIndex < 0) {
          byteIndex += 1;
          bitIndex = 7;
        }
      }

      row += direction;

      if (
        row < 0 ||
        row >= SIZE
      ) {
        row -= direction;
        direction = -direction;
        break;
      }
    }
  }

  return modules.map((moduleRow) =>
    moduleRow.map((value) => value === true),
  );
}

export const QR_VERSION_3_SIZE = SIZE;
