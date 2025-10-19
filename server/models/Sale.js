const mongoose = require('mongoose');

const SaleSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer'
  },
  items: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: function() { return !this.isManual; }
    },
    quantity: {
      type: Number,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    costPrice: {
      type: Number,
      default: 0
    },
    discount: {
      type: Number,
      default: 0
    },
    isManual: {
      type: Boolean,
      default: false
    },
    name: {
      type: String,
      required: function() { return this.isManual; }
    },
    returnedQuantity: {
      type: Number,
      default: 0
    }
  }],
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service'
  }],
  subtotal: {
    type: Number,
    required: true
  },
  tax: {
    type: Number,
    default: 0
  },
  discount: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  paymentMethod: {
    type: String,
    required: true,
    enum: ['cash', 'credit', 'debit', 'other']
  },
  paymentDetails: {
    // Additional payment details like card last 4 digits, transaction ID, etc.
    type: Object
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'returned', 'cancelled', 'partially_returned'],
    default: 'completed'
  },
  statusHistory: [{
    status: String,
    reason: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String
  },
  shopId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  },
  returnedAmount: {
    type: Number,
    default: 0
  },
  returnHistory: [{
    itemId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    itemName: {
      type: String,
      required: true
    },
    returnQuantity: {
      type: Number,
      required: true
    },
    returnAmount: {
      type: Number,
      required: true
    },
    reason: {
      type: String,
      trim: true
    },
    returnedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    returnedAt: {
      type: Date,
      default: Date.now
    }
  }]
});

// Add utility method for receipt data
SaleSchema.methods.getReceiptData = function() {
  // Map product and manual items
  const itemsWithDetails = this.items.map(item => {
    if (item.isManual) {
      return {
        name: item.name || 'Manual Item',
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        subtotal: (item.price * item.quantity) - (item.discount || 0),
        isManual: true
      };
    } else {
      // For regular product items
      return {
        productId: item.product?._id || item.product,
        name: item.product?.name || 'Unknown Product',
        quantity: item.quantity,
        price: item.price,
        discount: item.discount || 0,
        subtotal: (item.price * item.quantity) - (item.discount || 0)
      };
    }
  });
  
  // Add services to items list if populated
  if (this.services && Array.isArray(this.services)) {
    this.services.forEach(service => {
      if (service && typeof service === 'object') {
        itemsWithDetails.push({
          name: service.name || 'Service',
          quantity: service.quantity || 1,
          price: service.price || 0,
          discount: service.discount || 0,
          subtotal: service.total || ((service.price || 0) * (service.quantity || 1)) - (service.discount || 0),
          isService: true
        });
      }
    });
  }
  
  return {
    id: this._id.toString(),
    invoiceNumber: this.invoiceNumber,
    date: this.createdAt,
    customer: this.customer,
    items: itemsWithDetails,
    subtotal: this.subtotal,
    servicesSubtotal: this.servicesSubtotal || 0,
    tax: this.tax,
    discount: this.discount,
    total: this.total,
    paymentMethod: this.paymentMethod,
    user: this.user,
    shopId: this.shopId,
    notes: this.notes
  };
};

// Add method to calculate return status
SaleSchema.methods.calculateReturnStatus = function() {
  const totalReturnable = this.items.reduce((sum, item) => {
    return sum + (item.quantity * item.price) - (item.discount || 0);
  }, 0);
  
  const totalReturned = this.returnedAmount || 0;
  
  if (totalReturned === 0) {
    return 'completed';
  } else if (totalReturned >= totalReturnable) {
    return 'returned';
  } else {
    return 'partially_returned';
  }
};

// Pre-save middleware - Generate invoice number and calculate totals
SaleSchema.pre('save', async function(next) {
  try {
    // Generate invoice number if not provided (unified with RepairJob numbering)
    if (!this.invoiceNumber && this.isNew) {
      const Shop = mongoose.model('Shop');
      const RepairJob = mongoose.model('RepairJob');
      const shop = await Shop.findById(this.shopId);
      
      // Generate prefix from shop name (first 3 letters, uppercase) + last 2 chars of shop ID
      let shopNamePrefix = 'INV'; // Default prefix
      if (shop && shop.name) {
        // Remove spaces and special characters, take first 3 letters
        const cleanName = shop.name.replace(/[^a-zA-Z]/g, '').toUpperCase();
        shopNamePrefix = cleanName.substring(0, 3) || 'INV';
      }
      
      // Add last 2 characters of shop ID to ensure uniqueness across shops
      const shopIdSuffix = this.shopId.toString().slice(-2).toUpperCase();
      const prefix = `${shopNamePrefix}${shopIdSuffix}`; // e.g., BIS9A
      
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get the last invoice number from BOTH Sales and RepairJobs for unified sequence
      const [lastSale, lastJob] = await Promise.all([
        this.constructor.findOne({
          invoiceNumber: new RegExp(`^${prefix}-${dateStr}-`),
          shopId: this.shopId
        }).sort({ createdAt: -1 }),
        RepairJob.findOne({
          jobNumber: new RegExp(`^${prefix}-${dateStr}-`),
          shop: this.shopId
        }).sort({ createdAt: -1 })
      ]);
      
      // Get the highest number from both collections
      let nextNumber = 1;
      
      if (lastSale && lastSale.invoiceNumber) {
        const parts = lastSale.invoiceNumber.split('-');
        if (parts.length >= 3) {
          const saleNumber = parseInt(parts[2]);
          if (saleNumber >= nextNumber) {
            nextNumber = saleNumber + 1;
          }
        }
      }
      
      if (lastJob && lastJob.jobNumber) {
        const parts = lastJob.jobNumber.split('-');
        if (parts.length >= 3) {
          const jobNumber = parseInt(parts[2]);
          if (jobNumber >= nextNumber) {
            nextNumber = jobNumber + 1;
          }
        }
      }
      
      this.invoiceNumber = `${prefix}-${dateStr}-${nextNumber.toString().padStart(4, '0')}`;
    }
    
    // Calculate totals only if not already set by controller
    if (this.isNew || this.isModified('items') || this.isModified('services')) {
      // Only recalculate subtotal if not already set by controller
      if (this.subtotal === undefined || this.subtotal === null) {
        this.subtotal = this.items && this.items.length > 0
          ? this.items.reduce((sum, item) => sum + (item.price * item.quantity), 0)
          : 0;
      }
      
      // Services are handled separately - no servicesSubtotal in Sale model
      
      // Calculate item discounts (safe for empty items array)
      const itemDiscounts = this.items && this.items.length > 0 
        ? this.items.reduce((sum, item) => sum + (item.discount || 0), 0)
        : 0;
      
      // Set total discount (item discounts + additional discount)
      if (!this.discount) this.discount = 0;
      
      // Set tax if not specified
      if (!this.tax) this.tax = 0;
      
      // Only recalculate total if not already set by controller
      // Note: Total from frontend includes services, so we use that
      if (this.total === undefined || this.total === null) {
        this.total = this.subtotal - this.discount - itemDiscounts + this.tax;
      }
    }
    
    next();
  } catch (error) {
    next(error);
  }
});

module.exports = mongoose.model('Sale', SaleSchema);