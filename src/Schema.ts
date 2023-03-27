import { ColumnMetadata } from './type.js';

export class Schema {}

export function validateHeader(
  header: string[],
  colMetaData: ColumnMetadata[],
) {
  const unValidCols = colMetaData.filter((m) => {
    if (m.index) {
      return m.index < 0 || m.index >= header.length;
    }
    if (m.name) {
      if (!header.includes(m.name)) return true;
    }
    return false;
  });

  if (unValidCols.length) {
    throw new Error('Invalid CSV Header');
  }
}

type PropertyHeaderMap = Map<string, { colIndex: number; valueFormatter: any }>;
export function createPropertyHeaderMap(
  header: string[],
  colMetaData: Record<string, ColumnMetadata>,
): PropertyHeaderMap {
  return Object.keys(colMetaData).reduce((map, prop) => {
    const m = colMetaData[prop];

    if (m.index !== undefined) {
      map.set(prop, {
        colIndex: m.index,
        valueFormatter: m.valueFormatter,
      });
    } else if (m.name && header.includes(m.name)) {
      const colIndex = header.indexOf(m.name);
      map.set(prop, {
        colIndex,
        valueFormatter: m.valueFormatter,
      });
    } else {
      throw new Error('Invalid Column Metadata');
    }

    return map;
  }, new Map() as PropertyHeaderMap);
}
