import fs from 'node:fs'

const logFile = fs.createWriteStream(`./logs/${Date.now()}.txt`, { flags: 'w' }) // 'a' to append, 'w' to truncate the file every time the process starts.
console.log = function (data: any) {
  logFile.write(`${JSON.stringify(data)}\n`)
  process.stdout.write(`${JSON.stringify(data)}\n`)
}
const postFile = fs.createWriteStream(`./logs/${Date.now()}_post_requests.txt`, { flags: 'w' }) // 'a' to append, 'w' to truncate the file every time the process starts.
console.info = function (data: any) {
  postFile.write(`${JSON.stringify(data)}\n`)
}
