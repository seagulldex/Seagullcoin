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
