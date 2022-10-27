import compiler_options from "../src/compiler_options.mjs"
import esbuild from "esbuild"
import fs from "fs"

const examples_dir = "./examples/"
fs.readdir(examples_dir, (err, files) => {
	if (err) return console.log("error while scanning directory: " + err)
	for (const filename of files) {
		console.log("building example: ", filename)
		esbuild.build({
			entryPoints: [ examples_dir + filename ],
			outdir: "./dist/examples/",
			bundle: compiler_options.BUNDLE,
			minify: compiler_options.MINIFY,
			//mangleProps: /_$/,
			platform: "neutral",
			format: "esm",
			target: "esnext",
			define: compiler_options,
		}).catch(() => process.exit(1))
	}
})