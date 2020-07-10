import * as util from "util";
import * as bnb from "../src/bread-n-butter";

///////////////////////////////////////////////////////////////////////

type PyBlock = { type: "Block"; statements: readonly PyStatement[] };
type PyIdent = { type: "Ident"; value: string };
type PyStatement = PyBlock | PyIdent;
type PyLanguage = {
  block: PyBlock;
  statement: PyStatement;
  restStatement: PyStatement;
  ident: PyIdent;
  countSpaces: number;
  indentSame: number;
  indentMore: number;
  nl: "\r\n" | "\n";
  end: "\r\n" | "\n" | "<EOF>";
};

// Because parsing indentation-sensitive languages such as Python requires
// tracking state, all of our parsers are created inside a function that takes
// the current parsing state. In this case it's just the current indentation
// level, but a real Python parser would also *at least* need to keep track of
// whether the current parsing is inside of () or [] or {} so that you can know
// to ignore all whitespace, instead of further tracking indentation.
//
// Implementing all of Python's various whitespace requirements, including
// comments and line continuations (backslash at the end of the line) is left as
// an exercise for the reader. I've tried and frankly it's pretty tricky.
function py(indent: number): bnb.Language<PyLanguage> {
  return bnb.language<PyLanguage>({
    // This is where the magic happens. Basically we need to parse a deeper
    // indentation level on the first statement of the block and keep track of
    // new indentation level. Then we make a whole new set of parsers that use
    // that new indentation level for all their parsing. Each line past the
    // first is required to be indented to the same level as that new deeper
    // indentation level.
    block(lang) {
      return bnb
        .str("block:")
        .and(lang.nl)
        .chain(() => {
          return lang.indentMore.chain((n) => {
            return lang.statement.chain((first) => {
              return py(n)
                .restStatement.many0()
                .map((rest) => {
                  return {
                    type: "Block",
                    statements: [first, ...rest],
                  } as const;
                });
            });
          });
        });
    },

    // This is just a statement in our language. To simplify, this is either a
    // block of code or just an identifier
    statement(lang) {
      return lang.block.or(lang.ident);
    },

    // This is a statement which is indented to the level of the current parse
    // state. It's called RestStatement because the first statement in a block
    // is indented more than the previous state, but the *rest* of the
    // statements match up with the new state.
    restStatement(lang) {
      return lang.indentSame.and(lang.statement).map((pair) => pair[1]);
    },

    // Just a variable and then the end of the line.
    ident(lang) {
      return bnb
        .match(/[a-z]+/i)
        .and(lang.end)
        .map((pair) => {
          return {
            type: "Ident",
            value: pair[0],
          } as const;
        });
    },

    // Consume zero or more spaces and then return the number consumed. For a
    // more Python-like language, this parser would also accept tabs and then
    // expand them to the correct number of spaces
    //
    // https://docs.python.org/3/reference/lexical_analysis.html#indentation
    countSpaces() {
      return bnb.match(/[ ]*/).map((s) => s.length);
    },

    // Count the current indentation level and assert it's more than the current
    // parse state's desired indentation
    indentSame(lang) {
      return lang.countSpaces.chain((n) => {
        if (n === indent) {
          return bnb.of(n);
        }
        return bnb.fail([`${n} spaces`]);
      });
    },

    // Count the current indentation level and assert it's equal to the current
    // parse state's desired indentation
    indentMore(lang) {
      return lang.countSpaces.chain((n) => {
        if (n > indent) {
          return bnb.of(n);
        }
        return bnb.fail([`more than ${n} spaces`]);
      });
    },

    // Support UNIX and Windows line endings
    nl() {
      return bnb.str("\r\n").or(bnb.str("\n"));
    },

    // Lines should always end in a newline sequence, but many files are missing
    // the final newline
    end(lang) {
      return lang.nl.or(bnb.eof);
    },
  });
}

// Start parsing at zero indentation
const pythonish = py(0);

///////////////////////////////////////////////////////////////////////

const text = `\
block:
  alpha
  bravo
  block:\r
         charlie
         delta\r
         echo
         block:
          foxtrot
  golf\
`;

function prettyPrint(x: any): void {
  console.log(util.inspect(x, { depth: null, colors: true }));
}

const ast = pythonish.statement.parse(text);
prettyPrint(ast);
