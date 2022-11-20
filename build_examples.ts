import { build as esbuild, BuildResult, stop as esstop } from "https://deno.land/x/esbuild/mod.js"
import { denoPlugin } from "https://deno.land/x/esbuild_deno_loader/mod.ts"

const
	examples_dir = "./examples/",
	outdir = "./dist/examples/"
let t0 = performance.now(), t1: number
{
	const build_promises: Promise<BuildResult>[] = []
	for await (const file of Deno.readDir(examples_dir)) {
		if (!file.isFile) continue
		console.log("building example: ", file.name)
		build_promises.push(
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
		)
	}
	await Promise.all(build_promises)
	esstop()
}
t1 = performance.now()
for (const file of Deno.readDirSync(outdir)) if (file.isFile) console.log(file.name, "binary size:", Deno.statSync(outdir + file.name).size / 1024, "kb")
console.log("execution time:", t1 - t0, "ms")
