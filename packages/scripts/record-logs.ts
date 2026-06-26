import fs from 'node:fs'

if (!process.env.CI) {
  const logFile = fs.createWriteStream(`./logs/${Date.now()}.txt`, { flags: 'w' }) // 'a' to append, 'w' to truncate the file every time the process starts.
  console.log = function (data: any) {
    logFile.write(`${JSON.stringify(data)}\n`)
    process.stdout.write(`${JSON.stringify(data)}\n`)
  }

  console.info = function (data: any) {
    logFile.write(`${JSON.stringify(data)}\n`)
  }
}
