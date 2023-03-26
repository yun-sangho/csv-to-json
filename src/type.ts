export interface CSV {
  header: string[];
  body: string[][];
}

export type ClassConstructor<T> = {
  new (...args: any[]): T;
};

export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONObject
  | JSONArray;
type JSONObject = {
  [x: string]: JSONValue;
};
type JSONArray = Array<JSONValue>;

type Formatter = (value: string) => JSONValue;

export type ColumnMetadata = {
  name?: string;
  index?: number;
  valueFormatter?: Formatter;
};
