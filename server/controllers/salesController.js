const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const SaleItem = require('../models/SaleItem');
const Product = require('../models/Product');
const Service = require('../models/Service');
const User = require('../models/User');
const Customer = require('../models/Customer');
const Shop = require('../models/Shop');
const printController = require('./printController');

// Generate invoice number with shop-specific prefix
const generateInvoiceNumber = async (shopId) => {
  try {
    let shopPrefix = 'INV';
    
    // If shopId is provided, fetch shop to get first 3 letters of shop name
    if (shopId) {
      const shop = await Shop.findById(shopId);
      if (shop && shop.name) {
        shopPrefix = shop.name.substring(0, 3).toUpperCase();
      }
    }
    
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
    
    // Get the last invoice number for today and this shop
    const lastSale = await Sale.findOne({
      invoiceNumber: new RegExp(`^${shopPrefix}-${dateStr}-`),
      shopId: shopId
    }).sort({ createdAt: -1 });
    
    let nextNumber = 1;
    if (lastSale && lastSale.invoiceNumber) {
      const parts = lastSale.invoiceNumber.split('-');
      if (parts.length >= 3) {
        nextNumber = parseInt(parts[2]) + 1;
      }
    }
    
    return `${shopPrefix}-${dateStr}-${nextNumber.toString().padStart(4, '0')}`;
  } catch (error) {
    console.error('Error generating invoice number:', error);
    return `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }
};

// Create a new sale
const createSale = async (req, res) => {
  console.log('=== SALES CONTROLLER CREATE SALE STARTED ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const {
      customer,
      customerName,
      customerPhone,
      items,
      subtotal,
      servicesSubtotal = 0,
      discount = 0,
      tax = 0,
      total,
      paymentMethod,
      notes
    } = req.body;
    
    console.log('Extracted items:', JSON.stringify(items, null, 2));
    
    if (!items || !Array.isArray(items)) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Items array is required' });
    }
    
    // Check if there are any items (products, manual items, or services)
    const hasProducts = items.some(item => !item.isService);
    const hasServices = items.some(item => item.isService);
    
    
    if (!hasProducts && !hasServices) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'At least one product or service is required' });
    }
    
    // Generate invoice number
    const invoiceNumber = await generateInvoiceNumber(req.user.shopId);
    
    // Create customer if customerName is provided but no customer ID
    let customerId = customer;
    if (!customerId && customerName) {
      try {
        // Check if customer already exists with this phone number
        let existingCustomer = null;
        if (customerPhone) {
          existingCustomer = await Customer.findOne({ 
            phone: customerPhone,
            shopId: req.user.shopId
          });
        }
        
        if (existingCustomer) {
          customerId = existingCustomer._id;
        } else {
          // Create new customer
          const newCustomer = await Customer.create({
            name: customerName,
            phone: customerPhone,
            shopId: req.user.shopId,
            createdAt: new Date()
          });
          customerId = newCustomer._id;
        }
      } catch (customerErr) {
        console.error('Could not create customer:', customerErr);
        // Continue without customer if creation fails
      }
    }
    
    // Calculate only product subtotal in backend (services handled separately)
    let calculatedSubtotal = 0;
    
    // Pre-calculate product subtotal only (before discounts)
    for (const item of items) {
      if (!item.isService) { // Only count non-service items
        const itemSubtotal = item.price * item.quantity; // Before discount
        calculatedSubtotal += itemSubtotal;
      }
    }

    // Create new sale with only product data (no services data)
    const sale = new Sale({
      invoiceNumber,
      customer: customerId,
      items: [],
      services: [], // Only references to services, no service totals
      subtotal: calculatedSubtotal, // Only products subtotal
      discount,
      tax,
      total, // Use the total from frontend (includes services)
      paymentMethod,
      user: req.user.id,
      shopId: req.user.shopId,
      notes,
      createdAt: new Date()
    });
    
    // Process items and create service records
    for (const item of items) {
      if (item.isService) {
        // Create service record in Services collection
        const service = new Service({
          name: item.name,
          description: 'Service from POS sale',
          price: item.price,
          quantity: item.quantity,
          total: (item.price * item.quantity) - (item.discount || 0),
          discount: item.discount || 0,
          paymentMethod: paymentMethod,
          saleId: null, // Will be set after sale is created
          invoiceNumber: invoiceNumber,
          userId: req.user.id,
          shopId: req.user.shopId,
          status: 'completed'
        });
        
        await service.save({ session });
        sale.services.push(service._id);
      } else if (item.isManual) {
        // Handle manual items - no product reference or stock updates needed
        sale.items.push({
          isManual: true,
          name: item.name,
          quantity: item.quantity,
          price: item.price,
          discount: item.discount || 0
        });
      } else {
        // Handle regular product items
        // Check if product exists, belongs to the user's shop, and has enough stock
        const product = await Product.findOne({ 
          _id: item.product || item.productId,
          shopId: req.user.shopId
        }).session(session);
        
        if (!product) {
          await session.abortTransaction();
          session.endSession();
          return res.status(404).json({ message: `Product with ID ${item.product || item.productId} not found in your shop` });
        }
        
        if (product.quantity < item.quantity) {
          await session.abortTransaction();
          session.endSession();
          return res.status(400).json({ 
            message: `Insufficient stock for product: ${product.name}`,
            product: product.name,
            available: product.quantity,
            requested: item.quantity
          });
        }
        
        // Add item to sale with cost price
        sale.items.push({
          product: product._id,
          quantity: item.quantity,
          price: item.price,
          costPrice: product.cost || 0, // Use actual cost from database
          discount: item.discount || 0
        });
        
        // Debug logging for cost price
        console.log(`Product ${product.name}: cost=${product.cost}, saved costPrice=${product.cost || 0}`);
        
        // Update product stock
        product.quantity -= item.quantity;
        await product.save({ session });
      }
    }
    
    // Save the sale
    await sale.save({ session });
    
    // Update service records with the sale ID
    if (sale.services.length > 0) {
      await Service.updateMany(
        { _id: { $in: sale.services } },
        { saleId: sale._id },
        { session }
      );
    }
    
    // Commit transaction
    await session.commitTransaction();
    session.endSession();
    
    // Return created sale with populated fields
    const createdSale = await Sale.findById(sale._id)
      .populate('customer')
      .populate('user', 'name username')
      .populate({
        path: 'shopId',
        select: 'name'
      })
      .populate('items.product')
      .populate('services');
    
    res.status(201).json(createdSale);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error creating sale:', error);
    res.status(500).json({ message: 'Server error creating sale' });
  }
};

// Get all sales with pagination and filtering
const getAllSales = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      startDate,
      endDate,
      paymentMethod,
      minAmount,
      maxAmount,
      sort = 'createdAt',
      order = 'desc'
    } = req.query;
    
    // Prepare filter conditions
    const filter = {};
    
    // Add shop filter based on user role
    if (req.user.role !== 'developer') {
      // Non-developers can only see sales from their shop
      filter.shopId = req.user.shopId;
    } else if (req.query.shopId) {
      // Developers can filter by shop
      filter.shopId = req.query.shopId;
    }
    
    // Date range filter
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) {
        filter.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateTime;
      }
    }
    
    // Payment method filter
    if (paymentMethod) {
      filter.paymentMethod = paymentMethod;
    }
    
    // Amount range filter
    if (minAmount || maxAmount) {
      filter.total = {};
      if (minAmount) {
        filter.total.$gte = Number(minAmount);
      }
      if (maxAmount) {
        filter.total.$lte = Number(maxAmount);
      }
    }
    
    // Set up sort options
    const sortOptions = {};
    sortOptions[sort] = order === 'desc' ? -1 : 1;
    
    // Query sales with pagination
    const sales = await Sale.find(filter)
      .populate('customer')
      .populate('user', 'name username')
      .populate({
        path: 'shopId',
        select: 'name'
      })
      .sort(sortOptions)
      .skip((Number(page) - 1) * Number(limit))
      .limit(Number(limit));
    
    // Transform MongoDB documents with consistent structure
    const transformedSales = sales.map(sale => {
      const saleObj = sale.toObject();
      saleObj.id = saleObj._id; // Add id field for frontend compatibility
      
      // Add cashier info from user if available
      if (saleObj.user && !saleObj.cashier) {
        saleObj.cashier = {
          id: saleObj.user._id,
          username: saleObj.user.username || saleObj.user.name || 'Unknown'
        };
      }
      
      // Make sure sale date is correctly set
      if (!saleObj.date) {
        saleObj.date = saleObj.createdAt;
      }
      
      return saleObj;
    });
    
    // Get total count for pagination
    const totalSales = await Sale.countDocuments(filter);
    
    res.status(200).json({
      sales: transformedSales,
      totalPages: Math.ceil(totalSales / Number(limit)),
      currentPage: Number(page),
      totalSales
    });
  } catch (error) {
    console.error('Error fetching sales:', error);
    res.status(500).json({ message: 'Server error fetching sales' });
  }
};

// Get a single sale by ID with all details
const getSaleById = async (req, res) => {
  try {
    const saleId = req.params.id;
    
    if (!saleId || !mongoose.Types.ObjectId.isValid(saleId)) {
      return res.status(400).json({ message: 'Invalid sale ID format' });
    }
    
    const filter = { _id: saleId };
    
    // Add shop filter for non-developers
    if (req.user.role !== 'developer') {
      filter.shopId = req.user.shopId;
    }
    
    const sale = await Sale.findOne(filter)
      .populate({
        path: 'items.product',
        select: 'name price sku barcode _id'
      })
      .populate('services')
      .populate('customer')
      .populate('user', 'name username');
    
    if (!sale) {
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    // Transform MongoDB document with consistent structure
    const saleObj = sale.toObject();
    saleObj.id = saleObj._id; // Add id field for frontend compatibility
    
    // Add cashier info from user if available
    if (saleObj.user && !saleObj.cashier) {
      saleObj.cashier = {
        id: saleObj.user._id,
        username: saleObj.user.username || saleObj.user.name || 'Unknown'
      };
    }
    
    // Make sure sale date is correctly set
    if (!saleObj.date) {
      saleObj.date = saleObj.createdAt;
    }
    
    // Fix to correctly handle manual and product items, plus services
    const allSaleItems = [];
    
    // Add product and manual items
    if (saleObj.items && Array.isArray(saleObj.items)) {
      saleObj.items.forEach(item => {
        // For manual items
        if (item.isManual) {
          allSaleItems.push({
            id: item._id.toString(),
            isManual: true,
            name: item.name || 'Manual Item',
            quantity: item.quantity,
            price: item.price,
            discount: item.discount || 0,
            subtotal: item.price * item.quantity
          });
        } 
        // For product items
        else {
          // Calculate subtotal if not already present
          const subtotal = item.subtotal || (item.price * item.quantity);
          
          // Check if product exists and has necessary fields
          if (item.product) {
            allSaleItems.push({
              id: item._id.toString(),
              productId: item.product._id.toString(),
              quantity: item.quantity,
              unitPrice: item.price,
              price: item.price,
              discount: item.discount || 0,
              subtotal: subtotal,
              Product: {
                id: item.product._id.toString(),
                name: item.product.name || 'Unnamed Product',
                barcode: item.product.barcode || item.product.sku || ''
              },
              product: {
                _id: item.product._id.toString(),
                name: item.product.name || 'Unnamed Product',
                barcode: item.product.barcode || item.product.sku || ''
              }
            });
          } else {
            // If product reference is missing or broken
            allSaleItems.push({
              id: item._id.toString(),
              productId: item.product, // Keep the ID reference if available
              quantity: item.quantity,
              price: item.price,
              discount: item.discount || 0,
              subtotal: subtotal,
              Product: {
                id: 'unknown',
                name: 'Product Not Found',
                barcode: ''
              },
              product: {
                _id: 'unknown',
                name: 'Product Not Found',
                barcode: ''
              }
            });
          }
        }
      });
    }
    
    // Add services
    if (saleObj.services && Array.isArray(saleObj.services)) {
      saleObj.services.forEach(service => {
        if (service && typeof service === 'object') {
          allSaleItems.push({
            id: service._id.toString(),
            isService: true,
            name: service.name || 'Service',
            quantity: service.quantity || 1,
            price: service.price || 0,
            discount: service.discount || 0,
            subtotal: service.total || ((service.price || 0) * (service.quantity || 1))
          });
        }
      });
    }
    
    // Set the combined items array
    saleObj.SaleItems = allSaleItems;
    
    res.status(200).json(saleObj);
  } catch (error) {
    console.error('Error fetching sale:', error);
    res.status(500).json({ message: 'Server error fetching sale details' });
  }
};

// Return single item from sale
const returnSingleItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { saleId, itemId, returnQuantity, reason } = req.body;
    
    if (!saleId || !itemId || !returnQuantity || returnQuantity <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Sale ID, item ID, and return quantity are required' });
    }
    
    const filter = { _id: saleId };
    
    // Add shop filter for non-developers
    if (req.user.role !== 'developer') {
      // Handle populated shopId from auth middleware
      filter.shopId = req.user.shopId._id ? req.user.shopId._id : req.user.shopId;
    }
    
    const sale = await Sale.findOne(filter).populate('items.product').session(session);
    
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    // Find the item to return
    const itemIndex = sale.items.findIndex(item => item._id.toString() === itemId);
    
    if (itemIndex === -1) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Item not found in sale' });
    }
    
    const item = sale.items[itemIndex];
    
    // Check if return quantity is valid
    const availableToReturn = item.quantity - (item.returnedQuantity || 0);
    if (returnQuantity > availableToReturn) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ 
        message: `Cannot return ${returnQuantity} items. Only ${availableToReturn} available for return.` 
      });
    }
    
    // Update returned quantity
    sale.items[itemIndex].returnedQuantity = (item.returnedQuantity || 0) + returnQuantity;
    
    // Restore inventory for product items only (not services or manual items)
    if (!item.isManual && !item.isService && item.product) {
      const product = await Product.findById(item.product._id || item.product).session(session);
      if (product) {
        product.quantity += returnQuantity;
        await product.save({ session });
      }
    }
    
    // Calculate return amount
    const returnAmount = (item.price * returnQuantity) - ((item.discount || 0) * returnQuantity / item.quantity);
    sale.returnedAmount = (sale.returnedAmount || 0) + returnAmount;
    
    // Add return history
    if (!sale.returnHistory) {
      sale.returnHistory = [];
    }
    
    sale.returnHistory.push({
      itemId: itemId,
      itemName: item.isManual ? item.name : (item.product?.name || 'Unknown Product'),
      returnQuantity: returnQuantity,
      returnAmount: returnAmount,
      reason: reason,
      returnedBy: req.user.id,
      returnedAt: new Date()
    });
    
    // Check if all items are fully returned
    const allItemsReturned = sale.items.every(item => 
      (item.returnedQuantity || 0) >= item.quantity
    );
    
    console.log('Return status check:', {
      totalItems: sale.items.length,
      itemsChecked: sale.items.map(item => ({
        name: item.product?.name || item.name,
        quantity: item.quantity,
        returnedQuantity: item.returnedQuantity || 0,
        fullyReturned: (item.returnedQuantity || 0) >= item.quantity
      })),
      allItemsReturned: allItemsReturned
    });
    
    if (allItemsReturned) {
      sale.status = 'returned';
    } else {
      sale.status = 'partially_returned';
    }
    
    await sale.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    // Return updated sale
    const updatedSale = await Sale.findById(saleId)
      .populate('customer')
      .populate('user', 'name username')
      .populate('items.product');
    
    res.status(200).json({
      message: 'Item returned successfully',
      sale: updatedSale,
      returnAmount: returnAmount
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error returning item:', error);
    res.status(500).json({ message: 'Server error returning item' });
  }
};

// Update sale status (simplified return handling)
const updateSaleStatus = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { id } = req.params;
    const { status, reason } = req.body;
    
    if (!status) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: 'Status is required' });
    }
    
    const filter = { _id: id };
    
    // Add shop filter for non-developers
    if (req.user.role !== 'developer') {
      filter.shopId = req.user.shopId;
    }
    
    const sale = await Sale.findOne(filter).populate('items.product').session(session);
    
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    const oldStatus = sale.status || 'completed';
    
    // Handle full return
    if (status === 'returned' && oldStatus !== 'returned') {
      // Restore inventory for product items only (not services or manual items)
      for (const item of sale.items) {
        if (!item.isManual && !item.isService && item.product) {
          const product = await Product.findById(item.product._id || item.product).session(session);
          if (product) {
            product.quantity += item.quantity;
            await product.save({ session });
          }
        }
      }
      sale.returnedAmount = sale.total;
    }
    
    // Update sale status
    sale.status = status;
    
    // Add status history
    if (!sale.statusHistory) {
      sale.statusHistory = [];
    }
    
    sale.statusHistory.push({
      status,
      reason,
      updatedBy: req.user.id,
      updatedAt: new Date()
    });
    
    await sale.save({ session });
    
    await session.commitTransaction();
    session.endSession();
    
    // Return updated sale with populated data
    const updatedSale = await Sale.findById(id)
      .populate('customer')
      .populate('user', 'name username')
      .populate('items.product');
    
    res.status(200).json(updatedSale);
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error updating sale status:', error);
    res.status(500).json({ message: 'Server error updating sale status' });
  }
};

// Get sales report
const getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
    // Only include completed sales for revenue calculation
    query.status = 'completed';
    
    const sales = await Sale.find(query)
      .populate('customer', 'name')
      .populate('user', 'name')
      .sort({ createdAt: -1 });
      
    const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0);
    const totalItems = sales.reduce((sum, sale) => {
      return sum + sale.items.reduce((itemSum, item) => itemSum + item.quantity, 0);
    }, 0);
    
    res.json({
      sales,
      summary: {
        totalSales,
        totalItems,
        count: sales.length
      }
    });
  } catch (error) {
    console.error('Error generating sales report:', error);
    res.status(500).json({ message: 'Server error generating sales report' });
  }
};

// Generate receipt
const generateReceipt = async (req, res) => {
  // Forward to the printController
  return printController.generateReceipt(req, res);
};

// Generate sales profit report
const getSalesProfitReport = async (req, res) => {
  // Forward to the reportController to handle profit reports
  return reportController.getProfitDistribution(req, res);
};

module.exports = {
  createSale,
  getAllSales,
  getSaleById,
  updateSaleStatus,
  returnSingleItem,
  getSalesReport,
  generateReceipt,
  getSalesProfitReport
};