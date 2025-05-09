// Function to convert hex to UTF-8
function hexToUtf8(hex) {
  return Buffer.from(hex, 'hex').toString('utf8').replace(/\0/g, '');
}

// Example Hex String (as provided in your previous responses)
const hexString = '697066733A2F2F62616679626569687079636E6C64656662376175356E6A3232336E3374696476346E34736871736F777778686A65717A746C66687775756B7864652F313931372E6A736F6E';

// Convert Hex to UTF-8
const decodedUri = hexToUtf8(hexString);

// Log the result
console.log('Decoded URI:', decodedUri);
