import 'reflect-metadata';
import { createReadStream } from 'fs';

import { Column, getCSVColumnMetadataInSchema } from './decorators';
import { createPropertyHeaderMap, Schema, validateHeader } from './Schema';
import { CsvParser } from './CsvParser';
import { ClassConstructor, CSV } from './type';

const DEFAULT_COLUMN_DELIMITER = ',';

class CsvToJSON {
  private _delimiter = DEFAULT_COLUMN_DELIMITER;
  private _encoding: BufferEncoding = 'utf-8';
  private _schema: ClassConstructor<Schema> | null;

  public delimiter(delimiter: string) {
    this._delimiter = delimiter;
    return this;
  }

  public encoding(encoding: BufferEncoding) {
    this._encoding = encoding;
    return this;
  }

  public schema(schema: ClassConstructor<Schema>) {
    this._schema = schema;
    return this;
  }

  public async convert(filePath: string) {
    const csv = await this._readCSVFile(filePath);

    if (this.schema) return this._convertBodyWithSchema(csv);

    return this._convertBody(csv);
  }

  private _readCSVFile(filePath: string): Promise<CSV> {
    let header: string[];
    const body: string[][] = [];

    return new Promise((resolve, reject) => {
      createReadStream(filePath, { encoding: this._encoding })
        .pipe(
          new CsvParser({
            delimiter: this._delimiter,
            encoding: this._encoding,
          }),
        )
        .on('header', (_header: string[]) => {
          header = _header;
        })
        .on('data', (data: string[]) => {
          body.push(data);
        })
        .on('end', () => resolve({ header, body }))
        .on('error', (err) => reject(err));
    });
  }

  private _convertBodyWithSchema({ header, body }: CSV) {
    const schema = new this._schema();
    const columnMetadata = getCSVColumnMetadataInSchema(schema);

    validateHeader(header, Object.values(columnMetadata));

    const jsonPropCsvHeaderMap = createPropertyHeaderMap(
      header,
      columnMetadata,
    );

    const jsonProps = [...jsonPropCsvHeaderMap.keys()];

    return body.map((row) => {
      return jsonProps.reduce((json, key) => {
        const { colIndex, valueFormatter } = jsonPropCsvHeaderMap.get(key);

        const value = row[colIndex];
        json[key] = valueFormatter ? valueFormatter(value) : value;

        return json;
      }, {});
    });
  }

  private _convertBody({ header, body }: CSV) {
    return body.map((line) => {
      return line.reduce((json, col, i) => {
        json[header[i]] = col;
        return json;
      }, {});
    });
  }
}

export { CsvToJSON, Schema, Column };
