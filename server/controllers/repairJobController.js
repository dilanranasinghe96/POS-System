const { RepairJob, Product, Repair, Sale } = require('../models');

// Get all repair jobs
const getAllRepairJobs = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search, 
      status, 
      priority,
      startDate,
      endDate 
    } = req.query;
    

  // Use same shop logic as createRepairJob
  let shop = req.user.shop || req.user.shopId || (req.user.shopId && req.user.shopId._id);
  if (typeof shop === 'object' && shop._id) shop = shop._id;
  let query = { shop };
    
    // Search functionality
    if (search) {
      query = {
        ...query,
        $or: [
          { jobNumber: { $regex: search, $options: 'i' } },
          { 'customer.name': { $regex: search, $options: 'i' } },
          { 'customer.phone': { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      };
    }
    
    // Filter by status
    if (status && status !== 'all') {
      query.status = status;
    }
    
    // Filter by priority
    if (priority && priority !== 'all') {
      query.priority = priority;
    }
    
    // Date range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const repairJobs = await RepairJob.find(query)
      .populate('createdBy', 'name username')
      .populate('assignedTo', 'name username')
      .populate('parts.product', 'name sku')
      .populate('services.repair', 'title')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .exec();

    const total = await RepairJob.countDocuments(query);

    res.json({
      repairJobs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching repair jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repair jobs',
      error: error.message
    });
  }
};

// Get repair job by ID
const getRepairJobById = async (req, res) => {
  try {
    const repairJob = await RepairJob.findById(req.params.id)
      .populate('createdBy', 'name username')
      .populate('assignedTo', 'name username')
      .populate('parts.product', 'name sku price')
      .populate('services.repair', 'title price')
      .populate('notes.addedBy', 'name username')
      .populate('saleId');
    
    if (!repairJob) {
      return res.status(404).json({
        success: false,
        message: 'Repair job not found'
      });
    }

    res.json(repairJob);
  } catch (error) {
    console.error('Error fetching repair job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repair job',
      error: error.message
    });
  }
};

// Create new repair job
const createRepairJob = async (req, res) => {
  try {
    const {
      customer,
      bike,
      description,
      priority,
      estimatedCost,
      estimatedCompletionDate,
      deposit,
      assignedTo
    } = req.body;


    // Determine shop value from user
    let shop = req.user.shop || req.user.shopId || (req.user.shopId && req.user.shopId._id);
    if (typeof shop === 'object' && shop._id) shop = shop._id;

    if (!shop) {
      return res.status(400).json({
        success: false,
        message: 'User shop not found. Please select a shop before creating a repair job.'
      });
    }


    // Generate job number manually
    const jobCount = await RepairJob.countDocuments({ shop });
    const jobNumber = `RJ${String(jobCount + 1).padStart(6, '0')}`;

    const repairJob = new RepairJob({
      jobNumber,
      customer,
      bike,
      description,
      priority: priority || 'medium',
      estimatedCost: estimatedCost || 0,
      estimatedCompletionDate: estimatedCompletionDate ? new Date(estimatedCompletionDate) : null,
      deposit: deposit || 0,
      assignedTo: assignedTo || null,
      createdBy: req.user.id,
      shop
    });

    await repairJob.save();
    
    // Populate the created job for response
    await repairJob.populate('createdBy', 'name username');
    await repairJob.populate('assignedTo', 'name username');

    res.status(201).json({
      success: true,
      message: 'Repair job created successfully',
      repairJob
    });
  } catch (error) {
    console.error('Error creating repair job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create repair job',
      error: error.message
    });
  }
};

// Update repair job
const updateRepairJob = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Handle status change to completed
    if (updates.status === 'completed' && updates.status !== req.body.currentStatus) {
      updates.actualCompletionDate = new Date();
    }

    const repairJob = await RepairJob.findByIdAndUpdate(
      id,
      updates,
      { new: true, runValidators: true }
    )
      .populate('createdBy', 'name username')
      .populate('assignedTo', 'name username')
      .populate('parts.product', 'name sku')
      .populate('services.repair', 'title');

    if (!repairJob) {
      return res.status(404).json({
        success: false,
        message: 'Repair job not found'
      });
    }

    res.json({
      success: true,
      message: 'Repair job updated successfully',
      repairJob
    });
  } catch (error) {
    console.error('Error updating repair job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update repair job',
      error: error.message
    });
  }
};

// Add part to repair job
const addPart = async (req, res) => {
  try {
    const { id } = req.params;
    const { productId, name, quantity, unitPrice } = req.body;

    const repairJob = await RepairJob.findById(id);
    if (!repairJob) {
      return res.status(404).json({
        success: false,
        message: 'Repair job not found'
      });
    }

    const part = {
      product: productId || null,
      name: name,
      quantity: parseInt(quantity),
      unitPrice: parseFloat(unitPrice),
      totalPrice: parseInt(quantity) * parseFloat(unitPrice)
    };

    // Decrement product stock if productId is provided
    if (productId) {
      const Product = require('../models/Product');
      const product = await Product.findById(productId);
      if (!product) {
        return res.status(400).json({ success: false, message: 'Product not found' });
      }
      if (product.quantity < part.quantity) {
        return res.status(400).json({ success: false, message: 'Not enough stock for this product' });
      }
      product.quantity -= part.quantity;
      await product.save();
    }

    repairJob.parts.push(part);
    await repairJob.save();

    res.json({
      success: true,
      message: 'Part added successfully',
      repairJob
    });
  } catch (error) {
    console.error('Error adding part:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add part',
      error: error.message
    });
  }
};

// Add labor to repair job
const addLabor = async (req, res) => {
  try {
    const { id } = req.params;
    const { description, hours, hourlyRate } = req.body;

    const repairJob = await RepairJob.findById(id);
    if (!repairJob) {
      return res.status(404).json({
        success: false,
        message: 'Repair job not found'
      });
    }

    const labor = {
      description,
      hours: parseFloat(hours),
      hourlyRate: parseFloat(hourlyRate),
      totalCost: parseFloat(hours) * parseFloat(hourlyRate)
    };

    repairJob.labor.push(labor);
    await repairJob.save();

    res.json({
      success: true,
      message: 'Labor added successfully',
      repairJob
    });
  } catch (error) {
    console.error('Error adding labor:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add labor',
      error: error.message
    });
  }
};

// Add service to repair job
const addService = async (req, res) => {
  try {
    const { id } = req.params;
    const { repairId, name, price } = req.body;

    const repairJob = await RepairJob.findById(id);
    if (!repairJob) {
      return res.status(404).json({
        success: false,
        message: 'Repair job not found'
      });
    }

    const service = {
      repair: repairId || null,
      name: name,
      price: parseFloat(price)
    };

    repairJob.services.push(service);
    await repairJob.save();

    res.json({
      success: true,
      message: 'Service added successfully',
      repairJob
    });
  } catch (error) {
    console.error('Error adding service:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add service',
      error: error.message
    });
  }
};

// Add note to repair job
const addNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { text } = req.body;

    const repairJob = await RepairJob.findById(id);
    if (!repairJob) {
      return res.status(404).json({
        success: false,
        message: 'Repair job not found'
      });
    }

    const note = {
      text,
      addedBy: req.user.id
    };

    repairJob.notes.push(note);
    await repairJob.save();

    // Populate the note for response
    await repairJob.populate('notes.addedBy', 'name username');

    res.json({
      success: true,
      message: 'Note added successfully',
      repairJob
    });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add note',
      error: error.message
    });
  }
};

// Convert repair job to sale
const convertToSale = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod = 'cash' } = req.body;

    const repairJob = await RepairJob.findById(id);
    if (!repairJob) {
      return res.status(404).json({
        success: false,
        message: 'Repair job not found'
      });
    }

    if (repairJob.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Repair job must be completed before converting to sale'
      });
    }

    if (repairJob.saleId) {
      return res.status(400).json({
        success: false,
        message: 'Repair job has already been billed'
      });
    }


    // Create sale items from repair job
    const items = [];
    // For DB, services field must be array of ObjectIds (Service references), but we have only manual services/labor here
    // So, leave services as empty array for DB, but send service/labor details in response for receipt
    const receiptServices = [];

    // Add parts as items
    repairJob.parts.forEach(part => {
      if (part.product) {
        items.push({
          product: part.product,
          name: part.name,
          quantity: part.quantity,
          price: part.unitPrice,
          discount: 0,
          subtotal: part.totalPrice,
          isManual: false
        });
      } else {
        items.push({
          name: part.name,
          quantity: part.quantity,
          price: part.unitPrice,
          discount: 0,
          subtotal: part.totalPrice,
          isManual: true
        });
      }
    });

    // Add services for receipt only
    repairJob.services.forEach(service => {
      receiptServices.push({
        name: service.name,
        price: service.price,
        quantity: 1,
        isService: true
      });
    });

    // Add labor for receipt only
    repairJob.labor.forEach(labor => {
      receiptServices.push({
        name: `Labor: ${labor.description}`,
        price: labor.totalCost,
        quantity: 1,
        isService: true
      });
    });

    // Determine shopId value from user
    let shopId = req.user.shop || req.user.shopId || (req.user.shopId && req.user.shopId._id);
    if (typeof shopId === 'object' && shopId._id) shopId = shopId._id;

    // Create the sale
    const sale = new Sale({
      items,
      services: [], // must be array of ObjectIds
      subtotal: repairJob.parts.reduce((sum, part) => sum + part.totalPrice, 0),
      servicesSubtotal: repairJob.services.reduce((sum, service) => sum + service.price, 0) + 
                       repairJob.labor.reduce((sum, labor) => sum + labor.totalCost, 0),
      discount: 0,
      tax: 0,
      total: repairJob.totalCost,
      paymentMethod,
      customerName: repairJob.customer.name,
      customerPhone: repairJob.customer.phone,
      notes: `Repair Job: ${repairJob.jobNumber}`,
      user: req.user.id,
      shopId
    });

    await sale.save();

    // Update repair job
    repairJob.status = 'billed';
    repairJob.saleId = sale._id;
    await repairJob.save();

    res.json({
      success: true,
      message: 'Repair job converted to sale successfully',
      sale,
      repairJob,
      receiptServices // for frontend receipt rendering
    });
  } catch (error) {
    console.error('Error converting repair job to sale:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to convert repair job to sale',
      error: error.message
    });
  }
};

// Delete repair job
const deleteRepairJob = async (req, res) => {
  try {
      if (!req.user || !req.user.shop) {
        return res.status(400).json({
          success: false,
          message: 'User or shop not found. Please login and select a shop.'
        });
      }
      const { id } = req.params;

    const repairJob = await RepairJob.findById(id);
    if (!repairJob) {
      return res.status(404).json({
        success: false,
        message: 'Repair job not found'
      });
    }

    if (repairJob.status === 'billed') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete a billed repair job'
      });
    }

    await RepairJob.findByIdAndDelete(id);

    res.json({
      success: true,
      message: 'Repair job deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting repair job:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete repair job',
      error: error.message
    });
  }
};

// Get repair job statistics
const getRepairJobStats = async (req, res) => {
  try {
      if (!req.user || !req.user.shop) {
        return res.status(400).json({
          success: false,
          message: 'User or shop not found. Please login and select a shop.'
        });
      }
      const { startDate, endDate } = req.query;
    
    let dateFilter = { shop: req.user.shop };
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const stats = await RepairJob.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalCost' }
        }
      }
    ]);

    const totalJobs = await RepairJob.countDocuments(dateFilter);
    const avgJobValue = totalJobs > 0 ? 
      (await RepairJob.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, avg: { $avg: '$totalCost' } } }
      ]))[0]?.avg || 0 : 0;

    res.json({
      stats,
      totalJobs,
      avgJobValue: Math.round(avgJobValue * 100) / 100
    });
  } catch (error) {
    console.error('Error fetching repair job stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch repair job statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllRepairJobs,
  getRepairJobById,
  createRepairJob,
  updateRepairJob,
  addPart,
  addLabor,
  addService,
  addNote,
  convertToSale,
  deleteRepairJob,
  getRepairJobStats
};
