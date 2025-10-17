const Service = require('../models/Service');
const { generateInvoiceNumber } = require('../utils/invoiceGenerator');

// Get all services with pagination and filtering
const getAllServices = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      startDate, 
      endDate, 
      paymentMethod, 
      status = 'completed',
      search 
    } = req.query;

    // Determine shop ID based on user role
    let shopId;
    if (req.user.role === 'developer') {
      shopId = req.query.shopId || req.user.shopId?._id;
    } else {
      shopId = req.user.shopId?._id;
    }

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Build query
    let query = { shopId, status };

    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        query.createdAt.$lte = end;
      }
    }

    // Payment method filter
    if (paymentMethod) {
      query.paymentMethod = paymentMethod;
    }

    // Search filter
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { invoiceNumber: { $regex: search, $options: 'i' } }
      ];
    }

    const services = await Service.find(query)
      .populate('userId', 'name username')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await Service.countDocuments(query);

    res.json({
      services,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit),
        limit: parseInt(limit)
      }
    });
  } catch (error) {
    console.error('Error fetching services:', error);
    res.status(500).json({ message: 'Server error fetching services', error: error.message });
  }
};

// Get service by ID
const getServiceById = async (req, res) => {
  try {
    const service = await Service.findById(req.params.id)
      .populate('userId', 'name username')
      .populate('shopId', 'name');

    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if user has access to this service
    if (req.user.role !== 'developer' && service.shopId._id.toString() !== req.user.shopId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ service });
  } catch (error) {
    console.error('Error fetching service:', error);
    res.status(500).json({ message: 'Server error fetching service', error: error.message });
  }
};

// Create new service
const createService = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      quantity = 1,
      discount = 0,
      customerName,
      customerPhone,
      paymentMethod = 'cash',
      saleId,
      notes
    } = req.body;

    // Validate required fields
    if (!name || !price) {
      return res.status(400).json({ message: 'Service name and price are required' });
    }

    // Calculate total
    const subtotal = price * quantity;
    const total = subtotal - discount;

    if (total < 0) {
      return res.status(400).json({ message: 'Total cannot be negative' });
    }

    // Get shop ID
    let shopId;
    if (req.user.role === 'developer') {
      shopId = req.body.shopId || req.user.shopId?._id;
    } else {
      shopId = req.user.shopId?._id;
    }

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Generate invoice number if not part of a sale
    let invoiceNumber;
    if (saleId) {
      // If part of a sale, use the sale's invoice number with suffix
      const Sale = require('../models/Sale');
      const sale = await Sale.findById(saleId);
      invoiceNumber = sale ? `${sale.invoiceNumber}-SRV` : generateInvoiceNumber();
    } else {
      invoiceNumber = generateInvoiceNumber();
    }

    // Create service
    const service = new Service({
      name: name.trim(),
      description: description?.trim() || 'Manual service entry',
      price,
      quantity,
      total,
      discount,
      customerName: customerName?.trim(),
      customerPhone: customerPhone?.trim(),
      paymentMethod,
      saleId,
      invoiceNumber,
      userId: req.user._id,
      shopId,
      notes: notes?.trim()
    });

    await service.save();

    // Populate the response
    await service.populate('userId', 'name username');

    res.status(201).json({
      service,
      message: 'Service created successfully'
    });
  } catch (error) {
    console.error('Error creating service:', error);
    res.status(500).json({ message: 'Server error creating service', error: error.message });
  }
};

// Update service status
const updateServiceStatus = async (req, res) => {
  try {
    const { status, reason } = req.body;
    const serviceId = req.params.id;

    if (!['completed', 'pending', 'cancelled', 'refunded'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const service = await Service.findById(serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Check if user has access to this service
    if (req.user.role !== 'developer' && service.shopId.toString() !== req.user.shopId._id.toString()) {
      return res.status(403).json({ message: 'Access denied' });
    }

    service.status = status;
    if (reason) {
      service.notes = service.notes ? `${service.notes}\nStatus change: ${reason}` : `Status change: ${reason}`;
    }

    await service.save();

    res.json({
      service,
      message: `Service ${status} successfully`
    });
  } catch (error) {
    console.error('Error updating service status:', error);
    res.status(500).json({ message: 'Server error updating service', error: error.message });
  }
};

// Get service statistics
const getServiceStats = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Determine shop ID based on user role
    let shopId;
    if (req.user.role === 'developer') {
      shopId = req.query.shopId || req.user.shopId?._id;
    } else {
      shopId = req.user.shopId?._id;
    }

    if (!shopId) {
      return res.status(400).json({ message: 'Shop ID is required' });
    }

    // Default to last 30 days if no dates provided
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    end.setHours(23, 59, 59, 999);

    const matchCondition = {
      shopId: shopId,
      status: 'completed',
      createdAt: { $gte: start, $lte: end }
    };

    // Get basic stats
    const stats = await Service.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: "$total" },
          totalServices: { $sum: 1 },
          totalQuantity: { $sum: "$quantity" },
          averageService: { $avg: "$total" },
          totalDiscount: { $sum: "$discount" }
        }
      },
      {
        $project: {
          _id: 0,
          totalRevenue: { $round: ["$totalRevenue", 2] },
          totalServices: 1,
          totalQuantity: 1,
          averageService: { $round: ["$averageService", 2] },
          totalDiscount: { $round: ["$totalDiscount", 2] }
        }
      }
    ]);

    // Get payment method breakdown
    const paymentMethodStats = await Service.aggregate([
      { $match: matchCondition },
      {
        $group: {
          _id: "$paymentMethod",
          total: { $sum: "$total" },
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          method: "$_id",
          total: { $round: ["$total", 2] },
          count: 1
        }
      }
    ]);

    res.json({
      stats: stats[0] || {
        totalRevenue: 0,
        totalServices: 0,
        totalQuantity: 0,
        averageService: 0,
        totalDiscount: 0
      },
      paymentMethods: paymentMethodStats,
      period: { startDate: start, endDate: end }
    });
  } catch (error) {
    console.error('Error getting service stats:', error);
    res.status(500).json({ message: 'Server error getting service stats', error: error.message });
  }
};

module.exports = {
  getAllServices,
  getServiceById,
  createService,
  updateServiceStatus,
  getServiceStats
};
