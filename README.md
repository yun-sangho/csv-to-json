# CSV to JSON transformer

This is a simple CSV to JSON transformer. It takes a CSV file and converts it to a JSON file.

```typescript
import "reflect-metadata";
import {CsvToJson, Schema, Column} from 'csv-to-json-transformer';

class Test extends Schema {
    @Column({name: "id"})
    public id: string;

    @Ccolumn({name: "user_name"})
    public name: string;

    @Column({
        index: 6,
        valueFormatter: (value) => {
            if (!isNaN(parseFloat(value))) {
                return parseFloat(value);
            }
            return null;
        },
    })
    public age: number | null;
}

const json = await new CsvToJSON()
    .delimiter(',')
    .encoding('utf-8')
    .schema(Test)
    .convert('path_to_csv');
```