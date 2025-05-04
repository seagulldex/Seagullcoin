// errorHandler.js

// Handle errors in a generic way
export function handleError(err) {
    console.error('An error occurred:', err);
}

// Log the error (e.g., send it to an external logging service or file)
export function logError(err) {
    console.error('Logging error:', err);  // You can change this logic to log to a file or external service
}
