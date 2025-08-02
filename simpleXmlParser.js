// simpleXmlParser.js
export function parseSimpleXml(xmlString) {
  // This just extracts values between tags <tag>value</tag>
  // Only for very simple XML — extend as needed
  const regex = /<(\w+)>([^<]+)<\/\1>/g;
  const result = {};
  let match;
  while ((match = regex.exec(xmlString)) !== null) {
    result[match[1]] = match[2];
  }
  return result;
}
