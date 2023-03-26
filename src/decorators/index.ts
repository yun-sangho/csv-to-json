import { ColumnMetadata } from '../type.js';
import { Schema } from '../Schema.js';

const CSVColumnSymbol = Symbol('CSVColumn');

export function Column({ name, index, valueFormatter }: ColumnMetadata) {
  const colMetaData: ColumnMetadata = { name, index, valueFormatter };

  return (target, propertyKey): void => {
    Reflect.defineMetadata(CSVColumnSymbol, colMetaData, target, propertyKey);
  };
}

function getCSVColumnMetadata(
  target: any,
  propertyKey: string,
): ColumnMetadata {
  return Reflect.getMetadata(CSVColumnSymbol, target, propertyKey);
}

export function getCSVColumnMetadataInSchema(
  target: Schema,
): Record<string, ColumnMetadata> {
  return Object.getOwnPropertyNames(target)
    .filter((p) => getCSVColumnMetadata(target, p))
    .reduce((record, p) => {
      record[p] = getCSVColumnMetadata(target, p);
      return record;
    }, {});
}
