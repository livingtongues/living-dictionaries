// /// <reference types="jest" />
// import * as fs from 'fs-extra';
// import { convertOldTDKeyNames } from '../../src/import/td-converters';

// // Write console statements to txt file
// const util = require('util');
// const logFile = fs.createWriteStream(`./tests/logs/td-converter-test-${Date.now()}.txt`, { flags: 'w' }); // 'a' to append, 'w' to truncate the file every time the process starts.
// const logStdout = process.stdout;
// console.log = function () {
//     logFile.write(util.format.apply(null, arguments) + '\n');
//     logStdout.write(util.format.apply(null, arguments) + '\n');
// }

// test('convertOldTDKeyNames returns properly formatted JSON for processing', async () => {
//     // const tdJsonData = await fs.readJson('./tests/import/files/gta_export.json');
//     const tdJsonData = await fs.readJson('./tests/import/files/td-v1/wahgi_export.json');
//     // console.log(tdJsonData);
//     const convertedJsonData = convertOldTDKeyNames(tdJsonData);
//     // console.log(convertedJsonData);
//     expect(convertedJsonData[0].lexeme).toBeTruthy();
// })