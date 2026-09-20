import roblox from "eslint-plugin-roblox-ts";

export default [
	{
		...roblox.configs.recommended,
		rules: {
			...roblox.configs.recommended.rules,
			"roblox-ts/lua-truthiness": "off",
		},
	},
];
