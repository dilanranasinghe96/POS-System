const mongoose = require('mongoose');
const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Repair = require('../models/Repair');
const Service = require('../models/Service');

// Generate invoice number
const generateInvoiceNumber = async (shopId) => {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  
  // Get the last invoice number for today for this shop
  const lastSale = await Sale.findOne({
    invoiceNumber: new RegExp(`^INV-${dateStr}-`),
    shopId: shopId
  }).sort({ createdAt: -1 });
  
  let nextNumber = 1;
  if (lastSale && lastSale.invoiceNumber) {
    const parts = lastSale.invoiceNumber.split('-');
    if (parts.length >= 3) {
      nextNumber = parseInt(parts[2]) + 1;
    }
  }
  
  return `INV-${dateStr}-${nextNumber.toString().padStart(4, '0')}`;
};

// Create a new sale
exports.createSale = async (req, res) => {
  console.log('=== CREATE SALE STARTED ===');
  console.log('Request body:', JSON.stringify(req.body, null, 2));
  
  const session = await mongoose.startSession();
  session.startTransaction();
  
  try {
    const { items, services = [], customerName, customerPhone, ...saleData } = req.body;
    
    console.log('Extracted items:', JSON.stringify(items, null, 2));
    console.log('Items length:', items ? items.length : 'undefined');
    
    // Generate invoice number if not provided
    if (!saleData.invoiceNumber) {
      saleData.invoiceNumber = await generateInvoiceNumber(req.user.shopId);
    }
    
    // Create customer if customerName is provided but no customer ID
    let customerId = saleData.customer;
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
    
    // Debug: Log the incoming request data
    console.log('Incoming sale request items:', JSON.stringify(items, null, 2));
    
    // Filter items to separate products, manual items, and services
    const productItems = items.filter(item => !item.isService && !item.isManual && (item.product || item.productId));
    const manualItems = items.filter(item => !item.isService && item.isManual);
    const serviceItems = items.filter(item => item.isService);
    
    console.log('Filtered product items:', JSON.stringify(productItems, null, 2));
    
    // Process product items and fetch actual cost prices from database
    const processedProductItems = [];
    for (const item of productItems) {
      const productId = item.product || item.productId;
      
      // Fetch the actual product to get the real cost price
      const productDoc = await Product.findOne({
        _id: productId,
        shopId: req.user.shopId
      });
      
      if (!productDoc) {
        throw new Error(`Product not found: ${productId}`);
      }
      
      // Debug: Log all cost price related data
      console.log(`Processing item for product ${productDoc.name}:`);
      console.log(`  - Frontend item.costPrice: ${item.costPrice}`);
      console.log(`  - Database productDoc.cost: ${productDoc.cost}`);
      console.log(`  - Item object:`, JSON.stringify(item, null, 2));
      
      // Use frontend cost price if available and valid, otherwise use database cost
      const finalCostPrice = (item.costPrice && item.costPrice > 0) ? item.costPrice : (productDoc.cost || 0);
      
      processedProductItems.push({
        ...item,
        costPrice: finalCostPrice,
        product: productId
      });
      
      // Debug logging for cost price
      console.log(`Product ${productDoc.name}: frontend_costPrice=${item.costPrice}, db_cost=${productDoc.cost}, final_costPrice=${finalCostPrice}`);
    }
    
    // Process manual items (no costPrice needed for manual items)
    const processedManualItems = manualItems.map(item => ({
      ...item,
      isManual: true,
      costPrice: 0 // Manual items have no cost price
    }));
    
    // Combine all processed items
    const processedItems = [...processedProductItems, ...processedManualItems];

    // Create the sale with processed items
    const newSale = new Sale({
      ...saleData,
      customer: customerId,
      items: processedItems,
      user: req.user.id,
      shopId: req.user.shopId
    });
    
    // Debug logging for sale items with cost prices
    console.log('Sale items with cost prices:', processedItems.map(item => ({
      name: item.name || 'Product',
      quantity: item.quantity,
      price: item.price,
      costPrice: item.costPrice,
      isManual: item.isManual
    })));
    
    await newSale.save({ session });
    
    // Update inventory for product items
    for (const item of productItems) {
      const productId = item.product || item.productId;
      await Product.updateOne(
        { 
          _id: productId,
          shopId: req.user.shopId
        },
        { $inc: { quantity: -item.quantity } },
        { session }
      );
    }
    
    // Create separate service records for service items
    const createdServices = [];
    for (const serviceItem of serviceItems) {
      const service = new Service({
        name: serviceItem.name,
        description: serviceItem.description || 'Manual service entry',
        price: serviceItem.price,
        costPrice: serviceItem.costPrice || 0, // Handle both costPrice and cost_price formats
        quantity: serviceItem.quantity || 1,
        total: serviceItem.total || (serviceItem.price * (serviceItem.quantity || 1)),
        discount: serviceItem.discount || 0,
        customerName: customerName,
        customerPhone: customerPhone,
        paymentMethod: saleData.paymentMethod || 'cash',
        saleId: newSale._id,
        invoiceNumber: `${saleData.invoiceNumber}-SRV`,
        userId: req.user.id,
        shopId: req.user.shopId,
        status: 'completed'
      });
      
      await service.save({ session });
      createdServices.push(service);
    }
    
    // Also create service records from the services array if provided
    for (const serviceData of services) {
      const service = new Service({
        name: serviceData.name,
        description: serviceData.description || 'Manual service entry',
        price: serviceData.price,
        costPrice: serviceData.costPrice || serviceData.cost_price || 0,
        quantity: serviceData.quantity || 1,
        total: serviceData.total || (serviceData.price * (serviceData.quantity || 1)),
        discount: serviceData.discount || 0,
        customerName: customerName,
        customerPhone: customerPhone,
        paymentMethod: saleData.paymentMethod || 'cash',
        saleId: newSale._id,
        invoiceNumber: `${saleData.invoiceNumber}-SRV`,
        userId: req.user.id,
        shopId: req.user.shopId,
        status: 'completed'
      });
      
      await service.save({ session });
      createdServices.push(service);
      
      // If this service is linked to a repair job, update the repair job status to 'billed'
      if (serviceData.repairJobId) {
        const RepairJob = require('../models/RepairJob');
        await RepairJob.findByIdAndUpdate(
          serviceData.repairJobId,
          { 
            status: 'billed',
            saleId: newSale._id
          },
          { session }
        );
      }
    }
    
    await session.commitTransaction();
    session.endSession();
    
    // Return the sale with populated items and created services
    const completeSale = await Sale.findOne({
      _id: newSale._id,
      shopId: req.user.shopId
    })
      .populate('customer', 'name email phone')
      .populate('user', 'name username')
      .populate('items.product')
      .populate('items.repair');
      
    res.status(201).json({
      ...completeSale.toObject(),
      services: createdServices
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    console.error('=== ERROR CREATING SALE ===');
    console.error('Error message:', err.message);
    console.error('Error stack:', err.stack);
    console.error('Request body that caused error:', JSON.stringify(req.body, null, 2));
    res.status(500).json({ message: 'Server error creating sale', error: err.message });
  }
};

// Get all sales with pagination and filtering
exports.getSales = async (req, res) => {
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
    const filter = {
      shopId: req.user.shopId // Add shop filter
    };
    
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
        path: 'items.product',
        select: 'name sku barcode'
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
      
      // Ensure items array exists and has returnedQuantity - transform explicitly
      if (saleObj.items && Array.isArray(saleObj.items)) {
        // Debug: Log item data to verify returnedQuantity
        if (saleObj.returnedAmount > 0) {
          console.log(`Sale ${saleObj.invoiceNumber} items:`, saleObj.items.map(i => ({
            id: i._id,
            qty: i.quantity,
            returned: i.returnedQuantity
          })));
        }
        
        // Add SaleItems for frontend compatibility with full product details
        saleObj.SaleItems = saleObj.items.map(item => {
          // Base item fields
          const baseItem = {
            id: item._id ? item._id.toString() : undefined,
            _id: item._id ? item._id.toString() : undefined,
            quantity: item.quantity || 0,
            price: item.price || 0,
            discount: item.discount || 0,
            returnedQuantity: item.returnedQuantity || 0  // Explicitly get from database
          };
          
          if (item.isManual) {
            return {
              ...baseItem,
              isManual: true,
              name: item.name || 'Manual Item'
            };
          } else {
            return {
              ...baseItem,
              productId: item.product?._id ? item.product._id.toString() : undefined,
              Product: item.product ? {
                id: item.product._id ? item.product._id.toString() : undefined,
                name: item.product.name || 'Unknown',
                barcode: item.product.barcode || item.product.sku || ''
              } : { name: 'Unknown' },
              product: item.product ? {
                _id: item.product._id ? item.product._id.toString() : undefined,
                name: item.product.name || 'Unknown',
                barcode: item.product.barcode || item.product.sku || ''
              } : { name: 'Unknown' }
            };
          }
        });
      } else {
        saleObj.SaleItems = [];
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
  } catch (err) {
    console.error('Error fetching sales:', err.message);
    res.status(500).json({ message: 'Server error fetching sales' });
  }
};

// Get sale by id
exports.getSaleById = async (req, res) => {
  try {
    const saleId = req.params.id;
    
    // Check if ID exists
    if (!saleId) {
      return res.status(400).json({ message: 'Sale ID is required' });
    }
    
    // Check if ID is valid
    if (!mongoose.Types.ObjectId.isValid(saleId)) {
      return res.status(400).json({ message: 'Invalid sale ID format' });
    }
    
    const sale = await Sale.findById(saleId)
      .populate({
        path: 'items.product',
        select: 'name price sku barcode'
      })
      .populate('customer', 'name email phone')
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
    
    // Ensure each item has the calculated subtotal
    if (saleObj.items && Array.isArray(saleObj.items)) {
      saleObj.items = saleObj.items.map(item => {
        // Add unique identifier for each item
        item.id = item._id;
        // Calculate subtotal if not already present
        if (!item.subtotal) {
          item.subtotal = item.price * item.quantity;
        }
        // Ensure returnedQuantity exists
        if (item.returnedQuantity === undefined) {
          item.returnedQuantity = 0;
        }
        // Make sure product information is consistent
        if (item.product) {
          item.product.id = item._id;
        }
        return item;
      });
      
      // Add legacy SaleItems field for frontend compatibility
      saleObj.SaleItems = saleObj.items.map(item => {
        // Handle both manual and product items
        if (item.isManual) {
          return {
            id: item._id.toString(),
            _id: item._id.toString(),
            isManual: true,
            name: item.name || 'Manual Item',
            quantity: item.quantity,
            price: item.price,
            discount: item.discount || 0,
            subtotal: item.price * item.quantity,
            returnedQuantity: item.returnedQuantity || 0
          };
        } else {
          return {
            id: item._id.toString(),
            _id: item._id.toString(),
            productId: item.product?._id.toString(),
            quantity: item.quantity,
            unitPrice: item.price,
            price: item.price,
            discount: item.discount || 0,
            subtotal: item.price * item.quantity,
            returnedQuantity: item.returnedQuantity || 0,
            Product: {
              id: item.product?._id.toString(),
              name: item.product?.name || 'Unknown',
              barcode: item.product?.barcode || item.product?.sku || ''
            },
            product: {
              _id: item.product?._id.toString(),
              name: item.product?.name || 'Unknown',
              barcode: item.product?.barcode || item.product?.sku || ''
            }
          };
        }
      });
    }
    
    res.status(200).json(saleObj);
  } catch (err) {
    console.error('Error fetching sale:', err.message);
    res.status(500).json({ message: 'Server error fetching sale details' });
  }
};

// Update sale status (for returns or cancellations)
exports.updateSaleStatus = async (req, res) => {
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
    
    const sale = await Sale.findById(id).session(session);
    
    if (!sale) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: 'Sale not found' });
    }
    
    const oldStatus = sale.status || 'completed';
    
    // Update sale with new status
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
    
    // If returning items, adjust product inventory
    if ((oldStatus !== 'returned' && status === 'returned')) {
      for (const item of sale.items) {
        const product = await Product.findById(item.product).session(session);
        if (product) {
          // Add the returned quantity back to inventory
          product.quantity += item.quantity;
          await product.save({ session });
        }
      }
    }
    
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
exports.getSalesReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const query = {};
    if (startDate && endDate) {
      query.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    
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
  } catch (err) {
    console.error('Error generating sales report:', err.message);
    res.status(500).json({ message: 'Server error generating sales report' });
  }
};
