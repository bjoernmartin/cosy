module.exports = {
	env: {
		browser: true,
		es6: true,
	},
	extends: "eslint:recommended",
	globals: {
		Atomics: "readonly",
		SharedArrayBuffer: "readonly",
	},
	parserOptions: {
		ecmaVersion: 2018,
		sourceType: "module",
	},
	rules: {},
	globals: {
		JitsiMeetExternalAPI: true,
	},
	overrides: [
		{
			files: ["src/server/**/*.js", "rollup.config.js", "postcss.config.js"],
			env: {
				node: true,
			},
		},
	],
};
