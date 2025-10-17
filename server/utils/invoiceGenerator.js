// Utility function to generate invoice numbers
const generateInvoiceNumber = () => {
  const timestamp = Date.now().toString();
  const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `INV-${timestamp}-${random}`;
};

module.exports = {
  generateInvoiceNumber
};
