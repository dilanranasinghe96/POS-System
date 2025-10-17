const mongoose = require('mongoose');

const SaleItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: function() {
      return !this.repair && !this.isManual;
    }
  },
  repair: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Repair',
    required: function() {
      return !this.product && !this.isManual;
    }
  },
  isManual: {
    type: Boolean,
    default: false
  },
  name: {
    type: String,
    required: function() {
      return this.isManual;
    }
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  subtotal: {
    type: Number,
    required: true
  }
});

// Calculate subtotal before saving
SaleItemSchema.pre('save', function(next) {
  this.subtotal = (this.price * this.quantity) - this.discount;
  next();
});

module.exports = mongoose.model('SaleItem', SaleItemSchema);