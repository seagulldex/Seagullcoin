
export function parseIsoXml(rawXml) {
  try {
    // Wrap raw XML with a root element to allow multiple root nodes
    const wrappedXml = `<root>${rawXml}</root>`;

    const doc = new DOMParser().parseFromString(wrappedXml, 'application/xml');

    // Now you can safely access MsgId and InstdAmt anywhere inside the wrapper
    const messageId = doc.getElementsByTagName('MsgId')[0]?.textContent;
    const amount = doc.getElementsByTagName('InstdAmt')[0]?.textContent;

    return {
      messageId,
      amount,
    };
  } catch (err) {
    throw new Error('Basic XML parse failed: ' + err.message);
  }
}

