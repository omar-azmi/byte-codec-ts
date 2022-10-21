const fs = require("fs")
const delete_dir_list = [
	"./docs/",
	"./dist/",
	/*
	"./node_modules",
	"./backup",
	*/
]
const delete_file_list = [
	/*
	"./pnpm-lock.yaml",
	*/
]
for (const dir of delete_dir_list) {
	fs.rmdir(dir, { recursive: true }, (err) => {
		if (err) throw err
		console.log(`"${dir}" was deleted`)
	})
}
for (const file of delete_file_list) {
	fs.rm(file, undefined, (err) => {
		if (err) throw err
		console.log(`"${file}" was deleted`)
	})
}
