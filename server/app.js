const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const shopRoutes = require('./routes/shops');
const statsRoutes = require('./routes/stats');
const repairRoutes = require('./routes/repairs');
const repairJobRoutes = require('./routes/repairJobs');
const categoryRoutes = require('./routes/categories');
const salesRoutes = require('./routes/sales');
const supplierRoutes = require('./routes/suppliers');
const reportRoutes = require('./routes/reports');
const productController = require('../controllers/productController');
const { authenticate, authorize } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const logger = require('./middleware/loggerMiddleware');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('Connected to MongoDB'))
.catch(err => console.error('MongoDB connection error:', err));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/shops', shopRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/repairs', repairRoutes);
app.use('/api/repair-jobs', repairJobRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/reports', reportRoutes);

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/products');
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

// Add logger middleware before your routes
app.use(logger);

// Routes - IMPORTANT: Order matters for route matching!
// Put more specific routes before generic ones
const router = express.Router();
router.get('/refresh', authenticate, productController.refreshProducts);
router.get('/latest', authenticate, productController.getLatestProducts);
router.get('/barcode/:barcode', authenticate, productController.getProductByBarcode);
router.post('/', authenticate, authorize('admin', 'manager'), upload.single('image'), productController.createProduct);
router.get('/', authenticate, productController.getAllProducts);

// Add a specific route for printing labels
router.post('/print-labels', authenticate, productController.generateLabels);

// ID-specific routes after other specific paths but before wildcard routes
router.get('/:id', authenticate, productController.getProductById);
router.put('/:id', authenticate, authorize('admin', 'manager'), upload.single('image'), productController.updateProduct);
router.delete('/:id', authenticate, authorize('admin'), productController.deleteProduct);
router.patch('/:id/stock', authenticate, authorize('admin', 'manager'), productController.updateStock);

app.use('/api/products', router);

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something broke!' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});