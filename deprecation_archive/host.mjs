/** copied and modified from "https://stackoverflow.com/a/29046869" by "Hasan A Yousef" */
import http from "http"
import url from "url"
import fs from "fs"
import path from "path"

let [ argv, exec_path, web_root, port ] = process.argv
web_root = web_root || "./"
port = port || 8000
console.log(`hosting root directory "${web_root}/" at port ${port}`)

http.createServer(function (req, res) {
	console.log(`${req.method} ${req.url}`)
	// parse URL
	const parsedUrl = url.parse(req.url)
	// extract URL path
	let pathname = `${web_root}${parsedUrl.pathname}`
	// based on the URL path, extract the file extension. e.g. .js, .doc, ...
	let ext = path.parse(pathname).ext
	// maps file extension to MIME typere
	const map = {
		".ico": "image/x-icon",
		".html": "text/html",
		".js": "text/javascript",
		".json": "application/json",
		".css": "text/css",
		".png": "image/png",
		".jpg": "image/jpeg",
		".wav": "audio/wav",
		".mp3": "audio/mpeg",
		".svg": "image/svg+xml",
		".pdf": "application/pdf",
		".doc": "application/msword"
	}
	try {
		fs.accessSync(pathname)
		// if is a directory search for index file matching the extension
		if (fs.statSync(pathname).isDirectory()) {
			ext = ".html"
			pathname += pathname[ pathname.length - 1 ] == "/" ? "" : "/"
			pathname += "index" + ext
		}
		// read file from file system
		fs.readFile(pathname, function (err, data) {
			if (err) {
				res.statusCode = 500
				res.end(`error getting the file: ${err}.`)
			} else {
				// if the file is found, set Content-type and send data
				res.setHeader("Content-type", map[ ext ] || "text/plain")
				res.end(data)
			}
		})
	} catch (access_err) {
		if (access_err.code === "ENOENT") {
			// if the file is not found, return 404
			res.statusCode = 404
			res.end(`file ${pathname} not found!`)
			return
		} else throw access_err
	}
}).listen(parseInt(port))

console.log(`server listening on port ${port}`)
