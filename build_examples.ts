import { build as esbuild, stop as esstop } from "https://deno.land/x/esbuild/mod.js"
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader/mod.ts"

const
	examples_dir = "./examples/",
	outdir = "./dist/examples/"
let t0 = performance.now(), t1: number
for (const file of Deno.readDirSync(examples_dir)) {
	if (!file.isFile) continue
	console.log("building example: ", file.name)
	esbuild({
		entryPoints: [examples_dir + file.name],
		outdir: outdir,
		bundle: true,
		minify: true,
		platform: "neutral",
		format: "esm",
		target: "esnext",
		plugins: [denoPlugin()],
		define: {},
	})
	esstop()
	console.log(file.name, "binary size:", Deno.statSync(outdir + file.name.slice(0, -3) + ".js").size / 1024, "kb")
}
t1 = performance.now()
console.log("execution time:", t1 - t0, "ms")
