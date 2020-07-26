const { suite } = require("uvu");
const assert = require("uvu/assert");
const scan = require("./scan");

const Scan = suite("scan");

Scan.before((context) => {
  context.getReport = (
    filePath,
    code,
    { components, includeSubComponents, importedFrom } = {}
  ) => {
    const report = {};

    scan({
      code,
      filePath,
      components: {
        Box: true,
        Header: true,
        Text: true,
      },
      ...(components !== undefined && { components }),
      ...(includeSubComponents !== undefined && { includeSubComponents }),
      ...(importedFrom !== undefined && { importedFrom }),
      report,
    });

    return report;
  };
});

Scan.after((context) => {
  context.getReport = undefined;
});

Scan("invalid code", ({ getReport }) => {
  const originalConsoleError = global.console.error;
  let errors = [];

  global.console.error = (...args) => {
    errors = errors.concat(args);
  };

  const report = getReport("invalid-code.js", `<foo`);

  assert.equal(errors, ["Failed to parse: invalid-code.js"]);
  assert.equal(report, {});

  global.console.error = originalConsoleError;
});

Scan("unknown components", ({ getReport }) => {
  const report = getReport(
    "unknown-components.js",
    `
    <div>
      <Button>Submit</Button>
      <Footer />
    </div>
  `
  );

  assert.equal(report, {});
});

Scan("ignores comments", ({ getReport }) => {
  const report = getReport("ignores-comments.js", `{/* <Text>Hello</Text> */}`);

  assert.equal(report, {});
});

Scan("self closing", ({ getReport }) => {
  const report = getReport("self-closing.js", `<Header />`);

  assert.equal(report, {
    Header: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "self-closing.js",
            start: {
              line: 1,
              column: 1,
            },
          },
        },
      ],
    },
  });
});

Scan("no props", ({ getReport }) => {
  const report = getReport("no-props.js", `<Text>Hello</Text>`);

  assert.equal(report, {
    Text: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "no-props.js",
            start: {
              line: 1,
              column: 1,
            },
          },
        },
      ],
    },
  });
});

Scan("prop with no value", ({ getReport }) => {
  const report = getReport(
    "prop-with-no-value.js",
    `<Text foo bar={true}>Hello</Text>`
  );

  assert.equal(report, {
    Text: {
      instances: [
        {
          props: {
            foo: null,
            bar: true,
          },
          propsSpread: false,
          location: {
            file: "prop-with-no-value.js",
            start: {
              line: 1,
              column: 1,
            },
          },
        },
      ],
    },
  });
});

Scan("props with literal values", ({ getReport }) => {
  const report = getReport(
    "props-with-literal-values.js",
    `<Text textStyle="heading2" wrap={false} columns={3}>Hello</Text>`
  );

  assert.equal(report, {
    Text: {
      instances: [
        {
          props: {
            textStyle: "heading2",
            wrap: false,
            columns: 3,
          },
          propsSpread: false,
          location: {
            file: "props-with-literal-values.js",
            start: {
              line: 1,
              column: 1,
            },
          },
        },
      ],
    },
  });
});

Scan("props with other values", ({ getReport }) => {
  const report = getReport(
    "props-with-other-values.js",
    `<Text foo={bar} style={{object}}>Hello</Text>`
  );

  assert.equal(report, {
    Text: {
      instances: [
        {
          props: {
            foo: "(Identifier)",
            style: "(ObjectExpression)",
          },
          propsSpread: false,
          location: {
            file: "props-with-other-values.js",
            start: {
              line: 1,
              column: 1,
            },
          },
        },
      ],
    },
  });
});

Scan("with props spread", ({ getReport }) => {
  const report = getReport(
    "with-props-spread.js",
    `<Text {...someProps}>Hello</Text>`
  );

  assert.equal(report, {
    Text: {
      instances: [
        {
          props: {},
          propsSpread: true,
          location: {
            file: "with-props-spread.js",
            start: {
              line: 1,
              column: 1,
            },
          },
        },
      ],
    },
  });
});

Scan("no sub components by default", ({ getReport }) => {
  const report = getReport(
    "no-sub-components-by-default.js",
    `
    <Header>
      <Header.Logo />
    </Header>
  `
  );

  assert.equal(report, {
    Header: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "no-sub-components-by-default.js",
            start: {
              line: 2,
              column: 5,
            },
          },
        },
      ],
    },
  });
});

Scan("with sub components", ({ getReport }) => {
  const report = getReport(
    "with-sub-components.js",
    `
    <>
      <Header>
        <Header.Logo />
      </Header>
      <Footer.Legal />
    </>
  `,
    {
      components: {
        Header: true,
        "Footer.Legal": true,
      },
      includeSubComponents: true,
    }
  );

  assert.equal(report, {
    Header: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "with-sub-components.js",
            start: {
              line: 3,
              column: 7,
            },
          },
        },
      ],
      components: {
        Logo: {
          instances: [
            {
              props: {},
              propsSpread: false,
              location: {
                file: "with-sub-components.js",
                start: {
                  line: 4,
                  column: 9,
                },
              },
            },
          ],
        },
      },
    },
    Footer: {
      components: {
        Legal: {
          instances: [
            {
              props: {},
              propsSpread: false,
              location: {
                file: "with-sub-components.js",
                start: {
                  line: 6,
                  column: 7,
                },
              },
            },
          ],
        },
      },
    },
  });
});

Scan("deeply nested sub components", ({ getReport }) => {
  const report = getReport(
    "deeply-nested-sub-components.js",
    `
    <Header>
      <Header.Logo name="foo" />
      <Header.Content>
        <Header.Content.Column>
          Hello
          <Header.Content.Column.Title variant="important">
            Title
          </Header.Content.Column.Title>
        </Header.Content.Column>
      </Header.Content>
    </Header>
  `,
    {
      includeSubComponents: true,
    }
  );

  assert.equal(report, {
    Header: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "deeply-nested-sub-components.js",
            start: {
              line: 2,
              column: 5,
            },
          },
        },
      ],
      components: {
        Logo: {
          instances: [
            {
              props: {
                name: "foo",
              },
              propsSpread: false,
              location: {
                file: "deeply-nested-sub-components.js",
                start: {
                  line: 3,
                  column: 7,
                },
              },
            },
          ],
        },
        Content: {
          instances: [
            {
              props: {},
              propsSpread: false,
              location: {
                file: "deeply-nested-sub-components.js",
                start: {
                  line: 4,
                  column: 7,
                },
              },
            },
          ],
          components: {
            Column: {
              instances: [
                {
                  props: {},
                  propsSpread: false,
                  location: {
                    file: "deeply-nested-sub-components.js",
                    start: {
                      line: 5,
                      column: 9,
                    },
                  },
                },
              ],
              components: {
                Title: {
                  instances: [
                    {
                      props: {
                        variant: "important",
                      },
                      propsSpread: false,
                      location: {
                        file: "deeply-nested-sub-components.js",
                        start: {
                          line: 7,
                          column: 11,
                        },
                      },
                    },
                  ],
                },
              },
            },
          },
        },
      },
    },
  });
});

Scan("ignores non-JSX stuff", ({ getReport }) => {
  const report = getReport(
    "ignores-non-jsx-stuff.js",
    `
    import React from "react";

    function GoodbyeMessage({ languageStyle }) {
      return languageStyle === "formal" ? (
        <Text>Goodbye</Text>
      ) : (
        <Text>See ya</Text>
      );
    }

    function App() {
      return (
        <div css={{ padding: 20 }}>
          <Text color="blue">Hello</Text>
          <GoodbyeMessage languageStyle="formal" />
        </div>
      )
    }

    export default App;
  `
  );

  assert.equal(report, {
    Text: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "ignores-non-jsx-stuff.js",
            start: {
              line: 6,
              column: 9,
            },
          },
        },
        {
          props: {},
          propsSpread: false,
          location: {
            file: "ignores-non-jsx-stuff.js",
            start: {
              line: 8,
              column: 9,
            },
          },
        },
        {
          props: {
            color: "blue",
          },
          propsSpread: false,
          location: {
            file: "ignores-non-jsx-stuff.js",
            start: {
              line: 15,
              column: 11,
            },
          },
        },
      ],
    },
  });
});

Scan("typescript", ({ getReport }) => {
  const report = getReport(
    "typescript.ts",
    `
    /* @jsx jsx */
    import { jsx } from '@emotion/core'; // eslint-disable-line
    import React, { ReactNode, ElementType, useContext } from 'react'; // eslint-disable-line
    import { Box, BoxProps, useTheme } from '@chakra-ui/core';
    import capsize from 'capsize';
    import siteFontContext from './SiteProvider';
    import { FontMetrics } from 'capsize';
    import fontSizes from '../fontSizes';

    export interface HeadingProps {
      children: ReactNode;
      as?: ElementType;
      size?: '1' | '2' | '3';
      align?: BoxProps['textAlign'];
    }

    const element = {
      '1': 'h1',
      '2': 'h2',
      '3': 'h3',
    } as const;

    const color = {
      '1': 'blue.900',
      '2': 'blue.800',
      '3': 'gray.500',
    };
    const capsizeForSize = (size: number, font: FontMetrics) =>
      capsize({
        capHeight: size,
        leading: Math.floor(size * 1.9),
        fontMetrics: font,
      });

    const Heading = ({ children, as, size = '1', align }: HeadingProps) => {
      const activeFont = useContext(siteFontContext);
      const theme = useTheme();

      const mq = (theme.breakpoints as string[])
        .slice(0, 4)
        .map((bp) => \`@media (min-width: \${bp})\`);

      return (
        <Box
          as={as || element[size]}
          fontFamily={activeFont.familyName}
          color={color[size]}
          textAlign={align}
          css={{
            ...capsizeForSize(fontSizes[size][0], activeFont),
            [mq[0]]: capsizeForSize(fontSizes[size][1], activeFont),
            [mq[1]]: capsizeForSize(fontSizes[size][2], activeFont),
            [mq[2]]: capsizeForSize(fontSizes[size][3], activeFont),
          }}
        >
          {children}
        </Box>
      );
    };

    export default Heading;
  `
  );

  assert.equal(report, {
    Box: {
      instances: [
        {
          props: {
            as: "(LogicalExpression)",
            fontFamily: "(MemberExpression)",
            color: "(MemberExpression)",
            textAlign: "(Identifier)",
            css: "(ObjectExpression)",
          },
          propsSpread: false,
          location: {
            file: "typescript.ts",
            start: {
              line: 45,
              column: 9,
            },
          },
        },
      ],
    },
  });
});

Scan("not importedFrom", ({ getReport }) => {
  const report = getReport(
    "not-imported-from.js",
    `
    import Header from "other-design-system";
    
    <Header />
  `,
    { importedFrom: "my-design-system" }
  );

  assert.equal(report, {});
});

Scan("importedFrom default export", ({ getReport }) => {
  const report = getReport(
    "imported-from-default-export.js",
    `
    import Header from "my-design-system";
    import Box from "other-module";
    
    <Box>
      <Header />
    </Box>
  `,
    { importedFrom: /my-design-system/ }
  );

  assert.equal(report, {
    Header: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "imported-from-default-export.js",
            start: {
              line: 6,
              column: 7,
            },
          },
        },
      ],
    },
  });
});

Scan("importedFrom named export", ({ getReport }) => {
  const report = getReport(
    "imported-from-named-export.js",
    `
    import { Header } from "basis";
    
    <Header />
  `,
    { importedFrom: "basis" }
  );

  assert.equal(report, {
    Header: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "imported-from-named-export.js",
            start: {
              line: 4,
              column: 5,
            },
          },
        },
      ],
    },
  });
});

Scan("importedFrom named export with alias", ({ getReport }) => {
  const report = getReport(
    "imported-from-named-export-with-alias.js",
    `
    import { CoreHeader as Header } from "basis";
    
    <Header />
  `,
    { importedFrom: "basis" }
  );

  assert.equal(report, {
    Header: {
      instances: [
        {
          props: {},
          propsSpread: false,
          location: {
            file: "imported-from-named-export-with-alias.js",
            start: {
              line: 4,
              column: 5,
            },
          },
        },
      ],
    },
  });
});

Scan("importedFrom entire module", ({ getReport }) => {
  const report = getReport(
    "imported-from-entire-module.js",
    `
    import * as Basis from "basis";
    
    <Basis.Header />
  `,
    {
      components: {
        "Basis.Header": true,
      },
      includeSubComponents: true,
      importedFrom: "basis",
    }
  );

  assert.equal(report, {
    Basis: {
      components: {
        Header: {
          instances: [
            {
              props: {},
              propsSpread: false,
              location: {
                file: "imported-from-entire-module.js",
                start: {
                  line: 4,
                  column: 5,
                },
              },
            },
          ],
        },
      },
    },
  });
});

Scan.run();
