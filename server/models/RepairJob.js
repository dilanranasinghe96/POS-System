const mongoose = require('mongoose');

const repairJobSchema = new mongoose.Schema({
  jobNumber: {
    type: String,
    unique: true
    // Not required - will be auto-generated in pre-save hook
  },
  customer: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    email: {
      type: String
    }
  },
  item: {
    brand: {
      type: String,
      default: ''
    },
    model: {
      type: String,
      default: ''
    },
    year: {
      type: String,
      default: ''
    },
    color: {
      type: String,
      default: ''
    },
    serialNumber: {
      type: String,
      default: ''
    },
    type: {
      type: String,
      default: '' // e.g., 'bike', 'motorcycle', 'electronics', etc.
    }
  },
  jobType: {
    type: String,
    enum: ['quick_service', 'repair_job'],
    default: 'repair_job'
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'in_progress', 'completed', 'billed', 'cancelled'],
    default: 'pending'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  estimatedCost: {
    type: Number,
    default: 0
  },
  estimatedCompletionDate: {
    type: Date
  },
  actualCompletionDate: {
    type: Date
  },
  parts: [{
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product'
    },
    name: String,
    quantity: {
      type: Number,
      required: true
    },
    unitPrice: {
      type: Number,
      required: true
    },
    totalPrice: {
      type: Number,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  labor: [{
    description: {
      type: String,
      required: true
    },
    hours: {
      type: Number,
      required: true
    },
    hourlyRate: {
      type: Number,
      required: true
    },
    totalCost: {
      type: Number,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  services: [{
    repair: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Repair'
    },
    name: String,
    price: {
      type: Number,
      required: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  notes: [{
    text: {
      type: String,
      required: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  totalCost: {
    type: Number,
    default: 0
  },
  deposit: {
    type: Number,
    default: 0
  },
  remainingBalance: {
    type: Number,
    default: 0
  },
  saleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  shop: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Shop',
    required: true
  }
}, {
  timestamps: true
});

// Generate job number before saving (unified with Sale invoice numbers)
repairJobSchema.pre('save', async function(next) {
  if (this.isNew && !this.jobNumber) {
    try {
      const Shop = mongoose.model('Shop');
      const Sale = mongoose.model('Sale');
      const shop = await Shop.findById(this.shop);
      
      // Generate prefix from shop name (first 3 letters, uppercase) + shop ID
      // Same format as Sale invoices for unified numbering
      let shopNamePrefix = 'INV'; // Default shop prefix
      if (shop && shop.name) {
        // Remove spaces and special characters, take first 3 letters
        const cleanName = shop.name.replace(/[^a-zA-Z]/g, '').toUpperCase();
        shopNamePrefix = cleanName.substring(0, 3) || 'INV';
      }
      
      // Add last 2 characters of shop ID to ensure uniqueness across shops
      const shopIdSuffix = this.shop.toString().slice(-2).toUpperCase();
      const prefix = `${shopNamePrefix}${shopIdSuffix}`; // Same as Sale: e.g., BIS9A
      
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      
      // Get the last invoice number from BOTH Sales and RepairJobs for unified sequence
      const [lastSale, lastJob] = await Promise.all([
        Sale.findOne({
          invoiceNumber: new RegExp(`^${prefix}-${dateStr}-`),
          shopId: this.shop
        }).sort({ createdAt: -1 }),
        this.constructor.findOne({
          jobNumber: new RegExp(`^${prefix}-${dateStr}-`),
          shop: this.shop
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
      
      this.jobNumber = `${prefix}-${dateStr}-${nextNumber.toString().padStart(4, '0')}`;
    } catch (error) {
      return next(error);
    }
  }
  
  // Calculate total cost
  const partsTotal = this.parts.reduce((sum, part) => sum + part.totalPrice, 0);
  const laborTotal = this.labor.reduce((sum, labor) => sum + labor.totalCost, 0);
  const servicesTotal = this.services.reduce((sum, service) => sum + service.price, 0);
  
  this.totalCost = partsTotal + laborTotal + servicesTotal;
  this.remainingBalance = this.totalCost - this.deposit;
  
  next();
});

// Indexes for better performance
repairJobSchema.index({ jobNumber: 1 });
repairJobSchema.index({ status: 1 });
repairJobSchema.index({ 'customer.phone': 1 });
repairJobSchema.index({ createdAt: -1 });
repairJobSchema.index({ shop: 1 });

module.exports = mongoose.model('RepairJob', repairJobSchema);
