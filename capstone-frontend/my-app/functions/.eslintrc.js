module.exports = {
  env: {
    browser: true,
    es6: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
  ],
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
  },
  rules: {
    // 기본 규칙만 사용하고 엄격한 규칙 비활성화
    "no-unused-vars": "warn",
    "no-console": "off",
    "quotes": "off",
    "semi": "off",
    "comma-dangle": "off",
    "linebreak-style": "off",
    "no-trailing-spaces": "off",
    "max-len": "off",
    "require-jsdoc": "off",
    "arrow-parens": "off",
    "object-curly-spacing": "off",
    "padded-blocks": "off",
  },
};