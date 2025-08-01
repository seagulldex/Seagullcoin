import fs from 'fs';
import convert from 'xml-js';

const rawXml = fs.readFileSync('./message.xml', 'utf8');
const json = convert.xml2json(rawXml, { compact: true, spaces: 2 });

console.log(json);
