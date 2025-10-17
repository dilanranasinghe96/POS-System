const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
const generateBarcode = require('../utils/barcodeGenerator');

const ProductSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  sku: {
    type: String,
    sparse: true // Allow null/undefined but enforce uniqueness when present
  },
  barcode: {
    type: String,
    sparse: true // Allow null/undefined but enforce uniqueness when present
  },
  price: {
    type: Number,
    required: true
  },
  cost: {
    type: Number,
    default: 0
  },
  quantity: {
    type: Number,
    default: 0
  },
  reorderLevel: {
    type: Number,
    default: 5 // Default reorder level
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null // Explicitly set default to null
  },
  supplier: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Supplier',
    default: null // Explicitly set default to null
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  image: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Generate a barcode before saving if one doesn't exist
ProductSchema.pre('save', async function(next) {
  try {
    // Generate unique barcode if not provided
    if (!this.barcode) {
      this.barcode = await generateBarcode(this);
    }
    
    // Update the updatedAt timestamp
    this.updatedAt = new Date();
    
    // Generate SKU if not provided (based on product name and ID)
    if (!this.sku) {
      const namePrefix = this.name
        .substring(0, 3)
        .toUpperCase()
        .replace(/\s+/g, '')
        .replace(/[^A-Z0-9]/g, ''); // Remove non-alphanumeric characters
      
      const uniquePart = uuidv4().substring(0, 4);
      this.sku = `${namePrefix || 'PRD'}-${uniquePart}`;
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

// Add index to improve lookup performance
ProductSchema.index({ shopId: 1, barcode: 1 }, { unique: true }); // Make barcode unique per shop
ProductSchema.index({ shopId: 1, sku: 1 }, { unique: true }); // Make SKU unique per shop
ProductSchema.index({ shopId: 1, category: 1 });
ProductSchema.index({ shopId: 1, supplier: 1 });

// Virtual property for mapping backend field names to frontend expectations
ProductSchema.virtual('stockQuantity').get(function() {
  return this.quantity;
});

ProductSchema.virtual('costPrice').get(function() {
  return this.cost;
});

// Add utility method for QR code data
ProductSchema.methods.getQRData = function() {
  return {
    id: this._id.toString(),
    name: this.name,
    price: this.price,
    barcode: this.barcode || '',
    sku: this.sku || ''
  };
};

// Configure the schema to include virtuals when converted to JSON
ProductSchema.set('toJSON', { virtuals: true });
ProductSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Product', ProductSchema);