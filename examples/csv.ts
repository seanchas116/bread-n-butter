import * as util from "util";
import * as bnb from "../src/bread-n-butter";

const csvEnd = bnb.text("\r\n").or(bnb.text("\n"));
const csvFieldSimple = bnb.match(/[^\r\n,"]*/);
const csvFieldQuoted = bnb.text('"').chain(() => {
  return bnb
    .match(/[^"]+/)
    .or(bnb.text('""').map(() => '"'))
    .many0()
    .map((chunks) => chunks.join(""))
    .chain((text) => {
      return bnb.text('"').map(() => text);
    });
});
const csvField = csvFieldQuoted.or(csvFieldSimple);
const csvRow = csvField.sepBy1(bnb.text(","));
const csvFile = csvRow.sepBy1(csvEnd).chain((rows) => {
  return csvEnd.or(bnb.ok("")).map(() => {
    return rows.filter((row, index) => {
      // Given that CSV files don't require line endings strictly, and empty
      // string is a valid CSV row, we need to make sure and trim off the final
      // row if all it has is a single empty string, since this parser will
      // mistakenly parse that into `[""]` even though you can't end a CSV file
      // with a single empty field (I think).
      return !(index === rows.length - 1 && row.length === 1 && row[0] === "");
    });
  });
});

const text = `\
a,,c,"a ""complex"" field, i think"\r\n\
d,eeeeee,FFFF,cool\r\n\
nice,nice,nice3,nice4\
`;

function prettyPrint(x: any): void {
  console.log(util.inspect(x, { depth: null, colors: true }));
}

const ast = csvFile.tryParse(text);
prettyPrint(ast);