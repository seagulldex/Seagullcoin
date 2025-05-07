// Assuming these are injected via build tools or environment variables
const xummApiKey = process.env.XUMM_API_KEY || 'YOUR_XUMM_API_KEY'; // Replace with your XUMM API key
const nftStorageApiKey = process.env.NFT_STORAGE_API_KEY || 'YOUR_NFT_STORAGE_API_KEY'; // Replace with your NFT.Storage API key

// XUMM SDK initialization
const xummSDK = new XummSdk(xummApiKey);

// Dynamically adding properties to NFT metadata
document.getElementById('add-property').addEventListener('click', function() {
  const propertiesSection = document.getElementById('properties-section');
  const propertyIndex = propertiesSection.getElementsByClassName('property').length + 1;
  
  // Create new property fields
  const newProperty = document.createElement('div');
  newProperty.classList.add('property');
  
  newProperty.innerHTML = `
    <label for="property_name_${propertyIndex}">Property Name ${propertyIndex}:</label>
    <input type="text" id="property_name_${propertyIndex}" name="property_name_${propertyIndex}" placeholder="Property Name">
    <label for="property_value_${propertyIndex}">Property Value ${propertyIndex}:</label>
    <input type="text" id="property_value_${propertyIndex}" name="property_value_${propertyIndex}" placeholder="Property Value">
    <button type="button" class="remove-property" onclick="removeProperty(this)">Remove</button><br><br>
  `;
  
  propertiesSection.appendChild(newProperty);
});

function removeProperty(button) {
  button.parentElement.remove();
}

document.getElementById('mint-button').addEventListener('click', async () => {
  const nftName = document.getElementById('nft-name').value;
  const nftDescription = document.getElementById('nft-description').value;
  const nftFile = document.getElementById('nft-file').files[0];

  if (!nftName || !nftDescription || !nftFile) {
    alert('Please fill in all fields and upload a file.');
    return;
  }

  // Ensure user is logged in
  const walletAddress = localStorage.getItem('xumm_wallet_address');
  if (!walletAddress) {
    document.getElementById('login-alert').style.display = 'block';
    return;
  }

  // Prepare metadata and upload to NFT.Storage
  const nftMetadata = {
    name: nftName,
    description: nftDescription,
    properties: getNFTProperties(),
    file: nftFile
  };

  try {
    const metadataResponse = await uploadMetadata(nftMetadata);
    const metadataUrl = metadataResponse.url;

    // Create XUMM payload to mint the NFT
    const payload = await xummSDK.payload.create({
      TransactionType: 'NFTokenCreateOffer',
      Account: walletAddress,
      NFTokenID: generateTokenID(),  // This function generates or fetches a unique NFT ID
      URI: metadataUrl,              // Metadata URI from NFT.Storage
      Flags: 0,
    });

    // Redirect to XUMM for signing
    const payloadURL = `https://xumm.app/sign/${payload.payloadUUID}`;
    window.location.href = payloadURL;
  } catch (error) {
    console.error('Error during NFT minting:', error);
    alert('An error occurred during the minting process. Please try again.');
  }
});

// Helper function to upload metadata to NFT.Storage
async function uploadMetadata(metadata) {
  const formData = new FormData();
  formData.append('file', metadata.file);
  formData.append('name', metadata.name);
  formData.append('description', metadata.description);

  const response = await fetch('https://api.nft.storage/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${nftStorageApiKey}` // Use the environment variable for NFT.Storage API key
    },
    body: formData
  });

  if (!response.ok) {
    throw new Error('Failed to upload metadata');
  }

  const data = await response.json();
  return data;
}

// Helper function to generate or get Token ID for the NFT
function generateTokenID() {
  // This function should either generate a new NFT ID or fetch it from your logic
  return "SOME_UNIQUE_TOKEN_ID";
}

// Helper function to get NFT properties (if any)
function getNFTProperties() {
  const properties = [];
  document.querySelectorAll('.property').forEach((group) => {
    const name = group.querySelector('input[type="text"]:nth-child(1)').value;
    const value = group.querySelector('input[type="text"]:nth-child(2)').value;
    if (name && value) {
      properties.push({ name, value });
    }
  });
  return properties;
}
