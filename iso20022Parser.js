import { XMLParser } from 'fast-xml-parser';

export function parseIsoXml(rawXml) {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  });

  try {
    const parsedJson = parser.parse(rawXml);
    return parsedJson;
  } catch (err) {
    throw new Error('ISO XML Parsing Failed: ' + err.message);
  }
}
