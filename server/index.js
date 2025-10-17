const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const { connectDB } = require('./config/database');
const mongoose = require('mongoose');

// Load environment variables from proper path
dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Suppress strictQuery deprecation warning
mongoose.set('strictQuery', false);

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Import additional middleware and controllers
const { authenticate, authorize } = require('./middleware/auth');
const productController = require('./controllers/productController');
const multer = require('multer');
const fs = require('fs');

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads/products');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    const extension = path.extname(file.originalname);
    cb(null, `product-${uniqueSuffix}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'));
    }
  }
});

// Import routes
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const categoryRoutes = require('./routes/categories');
const salesRoutes = require('./routes/sales');
const reportRoutes = require('./routes/reports');
const supplierRoutes = require('./routes/suppliers');
const printRoutes = require('./routes/print');
const userRoutes = require('./routes/users');
const orderRoutes = require('./routes/orders');
const shopRoutes = require('./routes/shops');
const statsRoutes = require('./routes/stats'); // Add this line to import stats routes
const servicesRoutes = require('./routes/services');
const repairJobRoutes = require('./routes/repairJobs');


// Additional product routes that were in app.js
const productRouter = express.Router();
productRouter.get('/refresh', authenticate, productController.refreshProducts);
productRouter.get('/latest', authenticate, productController.getLatestProducts);
productRouter.get('/barcode/:barcode', authenticate, productController.getProductByBarcode);
productRouter.post('/', authenticate, authorize('admin', 'manager'), upload.single('image'), productController.createProduct);
productRouter.get('/', authenticate, productController.getAllProducts);
productRouter.post('/print-labels', authenticate, productController.generateLabels);
productRouter.get('/:id', authenticate, productController.getProductById);
productRouter.put('/:id', authenticate, authorize('admin', 'manager'), upload.single('image'), productController.updateProduct);
productRouter.delete('/:id', authenticate, authorize('admin'), productController.deleteProduct);
productRouter.patch('/:id/stock', authenticate, authorize('admin', 'manager'), productController.updateStock);

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRouter); // Use the enhanced product router
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/print', printRoutes);
app.use('/api/users', userRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/stats', statsRoutes); // Add this line to use stats routes
app.use('/api/services', servicesRoutes);
app.use('/api/repair-jobs', repairJobRoutes);

// Root route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Bike Parts POS System API' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error:', err);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    message: err.message || 'An unexpected error occurred',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
});

// Start server ONLY if running directly (not when imported by Vercel)
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
});

// Export the Express app as the default module export for Vercel
module.exports = app;