import { emptyDirSync } from "https://deno.land/std/fs/mod.ts"
import { basename } from "https://deno.land/std/path/mod.ts"
import { build } from "https://deno.land/x/dnt/mod.ts"
import { PackageJsonObject } from "https://deno.land/x/dnt@0.31.0/lib/types.ts"

const npm_dir = "./npm/"
const main_entrypoint = "./src/mod.ts"
const sub_entrypoints: string[] = []
const tsconfig = {
	"$schema": "https://json.schemastore.org/tsconfig",
	compilerOptions: {
		lib: ["ESNext", "DOM"],
		target: "ESNext",
		strict: true,
		allowJs: true,
		forceConsistentCasingInFileNames: true,
		skipLibCheck: true,
		moduleResolution: "node",
	},
}
const typedoc = {
	$schema: "https://typedoc.org/schema.json",
	entryPoints: [main_entrypoint, ...sub_entrypoints],
	out: "./docs/",
	skipErrorChecking: true,
}

const deno_package = JSON.parse(Deno.readTextFileSync("./deno.json"))
const npm_package_partial: PackageJsonObject = { name: "", version: "0.0.0" }
{
	const { name, version, description, author, license, repository, bugs, devDependencies, keywords } = deno_package
	Object.assign(npm_package_partial, { name, version, description, author, license, repository, bugs, devDependencies, keywords })
	npm_package_partial.scripts = {
		"build-docs": `npx typedoc`,
		"build-dist": `npm run build-esm && npm run build-esm-minify && npm run build-iife && npm run build-iife-minify`,
		"build-esm": `npx esbuild "${main_entrypoint}" --bundle --format=esm --outfile="./dist/${name}.esm.js"`,
		"build-esm-minify": `npx esbuild "${main_entrypoint}" --bundle --minify --format=esm --outfile="./dist/${name}.esm.min.js"`,
		"build-iife": `npx esbuild "${main_entrypoint}" --bundle --format=iife --outfile="./dist/${name}.iife.js"`,
		"build-iife-minify": `npx esbuild "${main_entrypoint}" --bundle --minify --format=iife --outfile="./dist/${name}.iife.min.js"`,
	}
}
emptyDirSync(npm_dir)
await build({
	entryPoints: [
		main_entrypoint,
		...sub_entrypoints.map(path => ({ name: "./" + basename(path, ".ts"), path: path })),
	],
	outDir: npm_dir,
	shims: { deno: true },
	packageManager: deno_package.node_packageManager,
	package: {
		...npm_package_partial
	},
	compilerOptions: deno_package.compilerOptions,
	typeCheck: false,
	declaration: true,
	esModule: true,
	scriptModule: false,
	test: false,
})

// copy other files
Deno.writeTextFileSync(npm_dir + ".gitignore", "/node_modules/\n")
Deno.copyFileSync("./readme.md", npm_dir + "readme.md")
Deno.writeTextFileSync(npm_dir + "tsconfig.json", JSON.stringify(tsconfig))
Deno.writeTextFileSync(npm_dir + "typedoc.json", JSON.stringify(typedoc))
