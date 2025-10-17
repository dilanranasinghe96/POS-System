const Product = require('../models/Product');
const Category = require('../models/Category');
const Supplier = require('../models/Supplier');
const path = require('path');
const fs = require('fs');

// Get all products
const getAllProducts = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page) || 1;
    // const limit = parseInt(req.query.limit) || 20;
    const limit = 1000;

    const skip = (page - 1) * limit;
    
    // Add sorting and filtering options
    const sort = req.query.sort || '-updatedAt'; // Default sort by latest updated
    const filter = {
      shopId: req.user.shopId // Add shop filter
    };
    
    if (req.query.category) {
      filter.category = req.query.category;
    }
    
    if (req.query.supplier) {
      filter.supplier = req.query.supplier;
    }
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { description: { $regex: req.query.search, $options: 'i' } },
        { barcode: { $regex: req.query.search, $options: 'i' } },
        { sku: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Low stock filter - compare quantity to reorderLevel
    if (req.query.lowStock === 'true') {
      filter.$expr = { $lte: ["$quantity", "$reorderLevel"] };
    }
    
    const products = await Product.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate('category')
      .populate('supplier');
    
    // Transform for frontend field naming
    const transformedProducts = products.map(product => {
      const productObj = product.toObject();
      return {
        ...productObj,
        id: productObj._id,
        stockQuantity: productObj.quantity,
        costPrice: productObj.cost || productObj.costPrice || 0,
        categoryId: productObj.category ? productObj.category._id : null,
        supplierId: productObj.supplier ? productObj.supplier._id : null
      };
    });
    
    const total = await Product.countDocuments(filter);
    
    res.status(200).json({
      products: transformedProducts,
      pagination: {
        total,
        page,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching products:', error);
    res.status(500).json({ message: 'Server error while fetching products', error: error.message });
  }
};

// Get product by ID
const getProductById = async (req, res) => {
  try {
    const product = await Product.findOne({
      _id: req.params.id,
      shopId: req.user.shopId // Add shop filter
    })
      .populate('category')
      .populate('supplier');
      
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.status(200).json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    res.status(500).json({ message: 'Server error fetching product' });
  }
};

// Get product by barcode
const getProductByBarcode = async (req, res) => {
  try {
    const { barcode } = req.params;
    
    if (!barcode) {
      return res.status(400).json({ 
        success: false,
        message: 'Barcode parameter is required' 
      });
    }
    
    const product = await Product.findOne({ 
      barcode,
      shopId: req.user.shopId // Add shop filter
    })
      .populate('category')
      .populate('supplier');
    
    if (!product) {
      return res.status(404).json({ 
        success: false,
        message: 'Product not found with this barcode' 
      });
    }
    
    // Transform for frontend field naming consistency
    const productData = product.toObject();
    
    // Log for debugging
    console.log('Product fetched by barcode:', {
      name: productData.name,
      cost: productData.cost,
      costPrice: productData.costPrice
    });
    
    return res.status(200).json({
      ...productData,
      id: productData._id,
      stockQuantity: productData.quantity,
      costPrice: productData.cost || productData.costPrice || 0,
      categoryId: productData.category ? productData.category._id : null,
      supplierId: productData.supplier ? productData.supplier._id : null
    });
  } catch (error) {
    console.error('Error fetching product by barcode:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error while fetching product',
      error: error.message
    });
  }
};

// Create product
const createProduct = async (req, res) => {
  try {
    const productData = {
      ...req.body,
      shopId: req.user.shopId // Add shop ID to new products
    };
    
    // If an image was uploaded, add the path
    if (req.file) {
      productData.image = `/uploads/products/${req.file.filename}`;
    }
    
    // Map frontend field names to backend field names if needed
    if (productData.stockQuantity !== undefined) {
      productData.quantity = parseInt(productData.stockQuantity);
      delete productData.stockQuantity;
    }
    
    if (productData.costPrice !== undefined) {
      productData.cost = parseFloat(productData.costPrice);
      delete productData.costPrice;
    }
    
    if (productData.price !== undefined) {
      productData.price = parseFloat(productData.price);
    }
    
    if (productData.reorderLevel !== undefined) {
      productData.reorderLevel = parseInt(productData.reorderLevel);
    }
    
    // Handle category
    if (productData.categoryName) {
      // First try to find existing category
      let category = await Category.findOne({ 
        name: { $regex: new RegExp(`^${productData.categoryName}$`, 'i') },
        shopId: req.user.shopId
      });
      
      // If category doesn't exist, create it
      if (!category) {
        try {
          category = await Category.create({
            name: productData.categoryName,
            shopId: req.user.shopId
          });
        } catch (err) {
          console.warn('Failed to create category:', err);
        }
      }
      
      if (category) {
        productData.category = category._id;
      }
    } else {
      productData.category = null;
    }
    
    delete productData.categoryId;
    delete productData.categoryName;
    
    // Handle supplier - only use existing suppliers, don't create new ones
    if (productData.supplierId) {
      // Use supplier ID directly
      const supplier = await Supplier.findById(productData.supplierId);
      if (supplier) {
        productData.supplier = supplier._id;
      } else {
        productData.supplier = null;
      }
    } else if (productData.supplierName) {
      // Find supplier by name but don't create a new one
      const supplier = await Supplier.findOne({ name: productData.supplierName });
      if (supplier) {
        productData.supplier = supplier._id;
      } else {
        productData.supplier = null;
      }
    } else {
      productData.supplier = null;
    }
    
    delete productData.supplierId;
    delete productData.supplierName;
    
    // Create product - barcode will be auto-generated if not provided
    const product = await Product.create(productData);
    
    // Populate references for the response
    const populatedProduct = await Product.findById(product._id)
      .populate('category')
      .populate('supplier');
    
    res.status(201).json(populatedProduct);
  } catch (error) {
    console.error('Error creating product:', error);
    res.status(500).json({ message: 'Server error creating product', error: error.message });
  }
};

// Update product
const updateProduct = async (req, res) => {
  try {
    const productData = { ...req.body };
    
    // If an image was uploaded, add the path
    if (req.file) {
      productData.image = `/uploads/products/${req.file.filename}`;
    }
    
    // Map frontend field names to backend field names
    if (productData.stockQuantity !== undefined) {
      productData.quantity = parseInt(productData.stockQuantity);
      delete productData.stockQuantity;
    }
    
    if (productData.costPrice !== undefined) {
      productData.cost = parseFloat(productData.costPrice);
      delete productData.costPrice;
    }
    
    if (productData.price !== undefined) {
      productData.price = parseFloat(productData.price);
    }
    
    if (productData.reorderLevel !== undefined) {
      productData.reorderLevel = parseInt(productData.reorderLevel);
    }
    
    // Handle category
    if (productData.categoryId) {
      const category = await Category.findOne({
        _id: productData.categoryId,
        shopId: req.user.shopId
      });
      if (category) {
        productData.category = category._id;
      }
    }
    delete productData.categoryId;
    
    // Handle supplier
    if (productData.supplierId) {
      const supplier = await Supplier.findOne({
        _id: productData.supplierId,
        shopId: req.user.shopId
      });
      if (supplier) {
        productData.supplier = supplier._id;
      }
    }
    delete productData.supplierId;
    
    const product = await Product.findOneAndUpdate(
      { 
        _id: req.params.id,
        shopId: req.user.shopId // Add shop filter
      },
      productData,
      { new: true }
    ).populate('category').populate('supplier');
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error('Error updating product:', error);
    res.status(500).json({ message: 'Server error updating product' });
  }
};

// Delete product
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findOneAndDelete({ 
      _id: req.params.id,
      shopId: req.user.shopId // Add shop filter
    });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    // Delete product image if exists
    if (product.image) {
      const imagePath = path.join(__dirname, '..', 'public', product.image);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
      }
    }
    
    res.status(200).json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    res.status(500).json({ message: 'Server error deleting product' });
  }
};

// Update stock
const updateStock = async (req, res) => {
  try {
    const { quantity } = req.body;
    
    if (quantity === undefined) {
      return res.status(400).json({ message: 'Quantity is required' });
    }
    
    const product = await Product.findOneAndUpdate(
      { 
        _id: req.params.id,
        shopId: req.user.shopId // Add shop filter
      },
      { $inc: { quantity: parseInt(quantity) } },
      { new: true }
    );
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.status(200).json(product);
  } catch (error) {
    console.error('Error updating stock:', error);
    res.status(500).json({ message: 'Server error updating stock' });
  }
};

// Get latest products
const getLatestProducts = async (req, res) => {
  try {
    const products = await Product.find({ shopId: req.user.shopId }) // Add shop filter
      .sort('-createdAt')
      .limit(5)
      .populate('category')
      .populate('supplier');
    
    res.status(200).json(products);
  } catch (error) {
    console.error('Error fetching latest products:', error);
    res.status(500).json({ message: 'Server error fetching latest products' });
  }
};

// Refresh products
const refreshProducts = async (req, res) => {
  try {
    const products = await Product.find({ shopId: req.user.shopId }) // Add shop filter
      .populate('category')
      .populate('supplier');
    
    res.status(200).json(products);
  } catch (error) {
    console.error('Error refreshing products:', error);
    res.status(500).json({ message: 'Server error refreshing products' });
  }
};

// Generate labels
const generateLabels = async (req, res) => {
  try {
    const { productIds, quantity = 1 } = req.body;
    
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return res.status(400).json({ message: 'Product IDs are required' });
    }
    
    const products = await Product.find({
      _id: { $in: productIds },
      shopId: req.user.shopId // Add shop filter
    }).select('name price barcode');
    
    // Instead of returning JSON, call the print controller's function directly
    const printController = require('./printController');
    return printController.generateProductLabels(req, res);
  } catch (error) {
    console.error('Error generating labels:', error);
    res.status(500).json({ message: 'Server error generating labels' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  getProductByBarcode, // Make sure getProductByBarcode is exported properly
  createProduct,
  updateProduct,
  deleteProduct,
  updateStock,
  getLatestProducts,
  refreshProducts,
  generateLabels
};