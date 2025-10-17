const mongoose = require('mongoose');

const repairJobSchema = new mongoose.Schema({
  jobNumber: {
    type: String,
    required: true,
    unique: true
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
    brand: String,
    model: String,
    year: String,
    color: String,
    serialNumber: String,
    type: String // e.g., 'bike', 'motorcycle', 'electronics', etc.
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

// Generate job number before saving
repairJobSchema.pre('save', async function(next) {
  if (this.isNew && !this.jobNumber) {
    try {
      const today = new Date();
      const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
      const prefix = this.jobType === 'quick_service' ? 'QS' : 'RJ';
      
      // Get the last job number for today, this shop, and this job type
      const lastJob = await this.constructor.findOne({
        jobNumber: new RegExp(`^${prefix}-${dateStr}-`),
        shop: this.shop,
        jobType: this.jobType
      }).sort({ createdAt: -1 });
      
      let nextNumber = 1;
      if (lastJob && lastJob.jobNumber) {
        const parts = lastJob.jobNumber.split('-');
        if (parts.length >= 3) {
          nextNumber = parseInt(parts[2]) + 1;
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
