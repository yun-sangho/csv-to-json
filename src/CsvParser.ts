import { Transform } from 'stream';

const [cr] = Buffer.from('\r');
const [nl] = Buffer.from('\n');
const DEFAULT_OPTIONS = {
  escape: '"',
  newline: '\n',
  quote: '"',
  delimiter: ',',
  encoding: 'utf-8',
};

const MAX_ROW_SIZE = Number.MAX_SAFE_INTEGER;
const WHITE_SPACE_CHARS = /[\r\b\n\t]/g;

export class CsvParser extends Transform {
  public _options: any = {};
  private _header: string[] | null;
  private _prev: Buffer | null = null;

  public _state = {
    empty: '',
    escaped: false,
    first: true,
    lineNumber: 0,
    previousEnd: 0,
    rowLength: 0,
    quoted: false,
  };

  constructor(_options: Partial<typeof DEFAULT_OPTIONS> = {}) {
    super({ objectMode: true, highWaterMark: 16 });

    const options = { ...DEFAULT_OPTIONS, ..._options };
    for (const key of ['newline', 'quote', 'delimiter']) {
      if (typeof options[key] !== 'undefined') {
        [options[key]] = Buffer.from(options[key]);
      }
    }

    this._prev = null;
    this._options = options;
    this._header = null;
  }
  parseCell(buffer, start, end) {
    const { escape, quote } = this._options;
    // remove quotes from quoted cells
    if (buffer[start] === quote && buffer[end - 1] === quote) {
      start++;
      end--;
    }

    let y = start;

    for (let i = start; i < end; i++) {
      // check for escape characters and skip them
      if (buffer[i] === escape && i + 1 < end && buffer[i + 1] === quote) {
        i++;
      }

      if (y !== i) {
        buffer[y] = buffer[i];
      }
      y++;
    }

    return this.parseValue(buffer, start, y);
  }

  parseValue(buffer: Buffer, start, end) {
    return buffer.toString(this._options.encoding, start, end);
  }

  parseLine(buffer, start, end) {
    const { customNewline, escape, quote, delimiter } = this._options;

    end--; // trim newline
    if (!customNewline && buffer.length && buffer[end - 1] === cr) {
      end--;
    }

    const comma = delimiter;
    const cells = [];
    let isQuoted = false;
    let offset = start;

    for (let i = start; i < end; i++) {
      const isStartingQuote = !isQuoted && buffer[i] === quote;
      const isEndingQuote =
        isQuoted &&
        buffer[i] === quote &&
        i + 1 <= end &&
        buffer[i + 1] === comma;
      const isEscape =
        isQuoted &&
        buffer[i] === escape &&
        i + 1 < end &&
        buffer[i + 1] === quote;

      if (isStartingQuote || isEndingQuote) {
        isQuoted = !isQuoted;
        continue;
      } else if (isEscape) {
        i++;
        continue;
      }

      if (buffer[i] === comma && !isQuoted) {
        const value = this.parseCell(buffer, offset, i);
        cells.push(value);
        offset = i + 1;
      }
    }

    if (offset < end) {
      const value = this.parseCell(buffer, offset, end);
      cells.push(value);
    }

    if (buffer[end - 1] === comma) {
      cells.push(this._state.empty);
    }

    this._state.lineNumber++;

    if (this._state.first) {
      this._state.first = false;
      this._header = cells.map((v) => this._removeWhiteSpaces(v));

      this.emit('header', this._header);
      return;
    }

    if (cells.length !== this._header.length) {
      const e = new RangeError('Row length does not match headers');
      this.emit('error', e);
    } else {
      this._writeRow(cells);
    }
  }

  private _writeRow(cells) {
    this.push(cells.map((v) => this._removeWhiteSpaces(v)));
  }

  private _removeWhiteSpaces(str: string) {
    return str.replace(WHITE_SPACE_CHARS, '');
  }

  _flush(cb) {
    if (this._state.escaped || !this._prev) return cb();
    this.parseLine(this._prev, this._state.previousEnd, this._prev.length + 1); // plus since online -1s
    cb();
  }

  _transform(data, enc, cb) {
    if (typeof data === 'string') {
      data = Buffer.from(data);
    }

    const { escape, quote } = this._options;
    let start = 0;
    let buffer = data;

    if (this._prev) {
      start = this._prev.length;
      buffer = Buffer.concat([this._prev, data]);
      this._prev = null;
    }

    const bufferLength = buffer.length;

    for (let i = start; i < bufferLength; i++) {
      const chr = buffer[i];
      const nextChr = i + 1 < bufferLength ? buffer[i + 1] : null;

      this._state.rowLength++;
      if (this._state.rowLength > MAX_ROW_SIZE) {
        return cb(new Error('Row exceeds the maximum size'));
      }

      if (
        !this._state.escaped &&
        chr === escape &&
        nextChr === quote &&
        i !== start
      ) {
        this._state.escaped = true;
        continue;
      } else if (chr === quote) {
        if (this._state.escaped) {
          this._state.escaped = false;
          // non-escaped quote (quoting the cell)
        } else {
          this._state.quoted = !this._state.quoted;
        }
        continue;
      }

      if (!this._state.quoted) {
        if (this._state.first && !this._options.customNewline) {
          if (chr === nl) {
            this._options.newline = nl;
          } else if (chr === cr) {
            if (nextChr !== nl) {
              this._options.newline = cr;
            }
          }
        }

        if (chr === this._options.newline) {
          this.parseLine(buffer, this._state.previousEnd, i + 1);
          this._state.previousEnd = i + 1;
          this._state.rowLength = 0;
        }
      }
    }

    if (this._state.previousEnd === bufferLength) {
      this._state.previousEnd = 0;
      return cb();
    }

    if (bufferLength - this._state.previousEnd < data.length) {
      this._prev = data;
      this._state.previousEnd -= bufferLength - data.length;
      return cb();
    }

    this._prev = buffer;
    cb();
  }
}
