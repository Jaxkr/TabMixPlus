"use strict";

const path = require("path");
const fs = require("fs");

const mozilla = require.resolve("eslint-plugin-mozilla");
const mozillaPath = path.dirname(mozilla);
const helpers = require(path.join(mozillaPath, "helpers.js"));

const SYSMJS_FILE_NAME = "sysmjs.txt";
const CHROME_UTILS_PATH = "addon/modules/ChromeUtils.jsm";
const ROOTDIR = path.join(__dirname, "..", "..");

function getMsjFiles() {
  const filePath = path.join(__dirname, SYSMJS_FILE_NAME);
  if (!fs.existsSync(filePath)) {
    console.log("File not found", filePath);
    return null;
  }

  const content = fs.readFileSync(filePath, "utf8");
  const sysmsj = content
      .split(/\r?\n/)
      .filter(Boolean)
      .map(file => path.basename(file.trim().slice(0, -1)));

  const jsm = sysmsj.map(file => file.replace(".sys.mjs", ".jsm"));
  return [jsm, sysmsj];
}

function getModulesMap() {
  const filePath = path.join(ROOTDIR, CHROME_UTILS_PATH);
  const content = fs.readFileSync(filePath, "utf8");
  const {ast} = helpers.parseCode(content);
  for (const node of Object.values(ast.body)) {
    if (node.type === "VariableDeclaration") {
      for (const item of node.declarations) {
        // item.id?.name must match the variable in in ChromeUtils.jsm
        if (item.id?.type == "Identifier" && item.id?.name === "modulesMap") {
          return item.init.properties.map(i => i.key.value);
        }
      }
    }
  }
  return [];
}

const [jsmFiles] = getMsjFiles() || [];

const items = ["XPCOMUtils", "ChromeUtils", "TabmixChromeUtils"];

const callExpressionDefinitions = [
  /^XPCOMUtils\.defineLazyGetter\(lazy,\s*"(\w+)",\s*"(.+)"/,
  /^XPCOMUtils\.defineLazyGetter\(this,\s*"(\w+)",\s*"(.+)"/,
  /^XPCOMUtils\.defineLazyModuleGetter\(lazy,\s*"(\w+)",\s*"(.+)"/,
  /^XPCOMUtils\.defineLazyModuleGetter\(this,\s*"(\w+)",\s*"(.+)"/,
  /^ChromeUtils\.defineModuleGetter\(lazy,\s*"(\w+)",\s*"(.+)"/,
  /^ChromeUtils\.defineModuleGetter\(this,\s*"(\w+)",\s*"(.+)"/,
];

const callExpressionMultiDefinitions = [
  "ChromeUtils.defineESModuleGetters(",
  "XPCOMUtils.defineLazyModuleGetters(",
];

module.exports = {
  meta: {
    messages: {
      missingInChromeUtils: "The path to {{name}} is missing from ChromeUtils.jsm modulesMap object.",
      outDatedChromeUtilsImport: "Use TabmixChromeUtils.import for {{name}}, .sys.mjs file exist",
      outDatedDefineLazyModuleGetters:
        "Use TabmixChromeUtils.defineLazyModuleGetters for {{name}}, .sys.mjs file exist",
    },
    type: "problem",
  },

  create(context) {
    if (!jsmFiles || !jsmFiles.length) {
      return {};
    }

    const isChromeUtils = context.getFilename() === path.resolve(CHROME_UTILS_PATH);
    let modulesMap;
    if (!modulesMap || isChromeUtils) {
      modulesMap = getModulesMap();
    }

    function isIdentifier(node, id) {
      return node && node.type === "Identifier" && node.name === id;
    }

    function addReport(messageId, node, {value}, prop) {
      if (value && jsmFiles.includes(path.basename(value))) {
        const name = `"${value.split("/").pop()}"`;
        if (messageId !== "missingInChromeUtils") {
          context.report({
            node,
            loc: prop?.loc,
            messageId,
            data: {name},
          });
        }
        if (!modulesMap.includes(value)) {
          context.report({
            node,
            loc: prop?.loc,
            messageId: "missingInChromeUtils",
            data: {name},
          });
        }
      }
    }

    function addReportForExpression(messageId, node) {
      const arg = node.arguments[1];
      if (arg.type === "ObjectExpression") {
        for (const prop of arg.properties) {
          if (prop.key.type !== "Literal") {
            addReport(messageId, node, prop.value, prop);
          }
        }
      }
    }

    return {
      CallExpression(node) {
        const {callee} = node;
        if (
          callee.type != "MemberExpression" ||
          callee.object.type == "MemberExpression" &&
            !items.includes(callee.object.object.name) ||
          callee.object.type != "MemberExpression" && !items.includes(callee.object.name)
        ) {
          return;
        }

        if (isIdentifier(callee.object, "TabmixChromeUtils")) {
          if (isIdentifier(callee.property, "import")) {
            addReport("missingInChromeUtils", node, node.arguments[0]);
          } else if (isIdentifier(callee.property, "defineLazyModuleGetters")) {
            addReportForExpression("missingInChromeUtils", node);
          }
          return;
        }

        if (isIdentifier(callee.object, "ChromeUtils") && isIdentifier(callee.property, "import")) {
          addReport("outDatedChromeUtilsImport", node, node.arguments[0]);
          return;
        }

        let source;
        try {
          source = helpers.getASTSource(node);
        } catch (e) {
          return;
        }

        for (const reg of callExpressionDefinitions) {
          const match = source.match(reg);
          if (match) {
            addReport("outDatedDefineLazyModuleGetters", node, {value: match[2]});
          }
        }

        if (
          callExpressionMultiDefinitions.some(expr => source.startsWith(expr)) &&
          node.arguments[1]
        ) {
          addReportForExpression("outDatedDefineLazyModuleGetters", node);
        }
      },
    };
  },
};