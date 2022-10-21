import { Application, TSConfigReader } from "typedoc"

async function main() {
	const docs = new Application()
	docs.options.addReader(new TSConfigReader())
	docs.bootstrap({
		entryPoints: [ "./src/index.ts", "./src/primitive_codec.ts", "./src/structure_codec.ts", "./src/utility.ts", "./src/compiler_options.mjs" ],
		readme: "./readme.md",
		out: "./docs/",
		skipErrorChecking: true,
		githubPages: true,
		includeVersion: true,
		titleLink: "/",
		sidebarLinks: {
			"readme": "/",
			"PCodec": "/modules/primitive_codec.html",
			"PSCodec": "/modules/structure_codec.html",
		},
		sort: [ "required-first", "kind", "source-order" ],
		plugin: ["typedoc-plugin-not-exported"]
	})

	const project = docs.convert()
	if (project) {
		// Project may not have converted correctly
		const outputDir = "./docs/"
		// Rendered docs
		await docs.generateDocs(project, outputDir)
	}
}

main().catch(console.error)
