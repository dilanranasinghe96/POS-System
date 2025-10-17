// Export all mongoose models for easier imports
const Category = require('./Category');
const Customer = require('./Customer');
const Product = require('./Product');
const Sale = require('./Sale');
const SaleItem = require('./SaleItem');
const Supplier = require('./Supplier');
const User = require('./User');
const Repair = require('./Repair');
const RepairJob = require('./RepairJob');

// No relationships needed for MongoDB as they're handled by refs in schema

module.exports = {
  Category,
  Customer,
  Product,
  Sale,
  SaleItem,
  Supplier,
  User,
  Repair,
  RepairJob
};