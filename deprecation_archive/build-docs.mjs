import { Application, TSConfigReader } from "typedoc"

let [ argv, exec_path, host_root_path ] = process.argv
host_root_path = host_root_path || "/"

/** use:
 * - `"/"` for localhost (default if unspecified in argv)
 * - `"/byte-codec-ts/"` for github pages
*/
const site_root = host_root_path

async function main() {
	const docs = new Application()
	docs.options.addReader(new TSConfigReader())
	docs.bootstrap({
		entryPoints: [
			"./src/index.ts",
			"./src/schema_codec.ts",
			"./src/compiler_options.mjs"
		],
		readme: "./readme.md",
		out: "./docs/",
		skipErrorChecking: true,
		githubPages: true,
		includeVersion: true,
		titleLink: site_root,
		sidebarLinks: {
			"readme": site_root,
			"schema codec": site_root + "modules/schema_codec.html",
			"structure codec": site_root + "modules/structure_codec.html",
		},
		sort: [ "source-order", "required-first", "kind", ],
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
