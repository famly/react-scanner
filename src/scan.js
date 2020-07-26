const { parse } = require("@typescript-eslint/typescript-estree");
const astray = require("astray");
const getObjectPath = require("dlv");
const setObjectPath = require("dset");

const parseOptions = {
  loc: true,
  jsx: true,
};

function getComponentName(nameObj) {
  switch (nameObj.type) {
    case "JSXIdentifier": {
      return nameObj.name;
    }

    case "JSXMemberExpression": {
      return `${getComponentName(nameObj.object)}.${getComponentName(
        nameObj.property
      )}`;
    }

    /* c8 ignore next 3 */
    default: {
      throw new Error(`Unknown name type: ${nameObj.type}`);
    }
  }
}

function getPropValue(node) {
  if (node === null) {
    return null;
  }

  if (node.type === "Literal") {
    return node.value;
  }

  if (node.type === "JSXExpressionContainer") {
    if (node.expression.type === "Literal") {
      return node.expression.value;
    }

    return `(${node.expression.type})`;
    /* c8 ignore next 3 */
  }

  throw new Error(`Unknown node type: ${node.type}`);
}

function getInstanceInfo(node, filePath) {
  const { attributes } = node;
  const result = {
    props: {},
    propsSpread: false,
    location: {
      file: filePath,
      start: node.name.loc.start,
    },
  };

  for (let i = 0, len = attributes.length; i < len; i++) {
    const attribute = attributes[i];

    if (attribute.type === "JSXAttribute") {
      const { name, value } = attribute;
      const propName = name.name;
      const propValue = getPropValue(value);

      result.props[propName] = propValue;
    } else if (attribute.type === "JSXSpreadAttribute") {
      result.propsSpread = true;
    }
  }

  return result;
}

function scan({
  code,
  filePath,
  components,
  includeSubComponents = false,
  importedFrom,
  report,
}) {
  let ast;

  try {
    ast = parse(code, parseOptions);
  } catch (_e) {
    console.error(`Failed to parse: ${filePath}`);
    return;
  }

  const importsMap = {};

  astray.walk(ast, {
    ImportDeclaration(node) {
      const { source, specifiers } = node;
      const moduleName = source.value;
      const specifiersCount = specifiers.length;

      for (let i = 0; i < specifiersCount; i++) {
        switch (specifiers[i].type) {
          case "ImportDefaultSpecifier":
          case "ImportSpecifier":
          case "ImportNamespaceSpecifier": {
            const imported = specifiers[i].local.name;

            importsMap[imported] = moduleName;
            break;
          }

          /* c8 ignore next 5 */
          default: {
            throw new Error(
              `Unknown import specifier type: ${specifiers[i].type}`
            );
          }
        }
      }
    },
    JSXOpeningElement(node) {
      const name = getComponentName(node.name);
      const nameParts = name.split(".");
      const shouldReportComponent = () => {
        if (components) {
          if (
            components[name] === undefined &&
            components[nameParts[0]] === undefined
          ) {
            return false;
          }
        }

        if (includeSubComponents === false) {
          if (nameParts.length > 1) {
            return false;
          }
        }

        if (importedFrom) {
          const actualImportedFrom = importsMap[nameParts[0]];

          if (importedFrom instanceof RegExp) {
            if (importedFrom.test(actualImportedFrom) === false) {
              return false;
            }
          } else if (actualImportedFrom !== importedFrom) {
            return false;
          }
        }

        return true;
      };

      if (!shouldReportComponent()) {
        return astray.SKIP;
      }

      const componentPath = nameParts.join(".components.");
      let componentInfo = getObjectPath(report, componentPath);

      if (!componentInfo) {
        componentInfo = {};
        setObjectPath(report, componentPath, componentInfo);
      }

      if (!componentInfo.instances) {
        componentInfo.instances = [];
      }

      const info = getInstanceInfo(node, filePath);

      componentInfo.instances.push(info);
    },
  });
}

module.exports = scan;
