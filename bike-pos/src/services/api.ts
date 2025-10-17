import axios from 'axios';

// Create axios instance with default config
const api = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json'
  },
  timeout: 10000 // Add timeout of 10 seconds for all requests
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle token expiration
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Product interface
interface Product {
  id?: string | number;
  _id?: string;
  name: string;
  description?: string;
  price: number;
  cost?: number;
  costPrice?: number;
  barcode?: string;
  sku?: string;
  categoryId?: string;
  supplierId?: string;
  category?: { _id: string; name: string };
  supplier?: { _id: string; name: string };
  quantity?: number;
  stockQuantity?: number;
  reorderLevel?: number;
  minStock?: number;
  image?: string | File;
}

// Supplier interface
interface Supplier {
  id?: string | number;
  _id?: string;
  name: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  address?: string;
  notes?: string;
}

// Sale interface
interface Sale {
  id?: number;
  customerId?: number;
  items: Array<{
    productId?: number;
    product?: number;
    quantity: number; 
    price: number;
    costPrice?: number; // Add costPrice for products
    discount?: number;
    isManual?: boolean; // Add flag for manual items
    isService?: boolean; // Add flag for service items
    name?: string; // Add name for manual items and services
  }>;
  subtotal: number;
  tax?: number;
  discount?: number;
  total: number;
  paymentMethod: string;
  notes?: string;
  customerName?: string;
  customerPhone?: string;
  user?: number;
}

// Auth API
export const authApi = {
  login: (credentials: { username: string; password: string }) => 
    api.post('/auth/login', credentials),
  
  register: (userData: { username: string; password: string; name: string; role: string }) =>
    api.post('/auth/register', userData),
  
  getProfile: () => 
    api.get('/auth/me'),
};

// Products API
export const productsApi = {
  getAll: (params = {}) => api.get('/products', { params }),
  getById: (id: string | number) => {
    return api.get(`/products/${id}`);
  },
  getByBarcode: (barcode: string) => 
    api.get(`/products/barcode/${barcode}`)
      .catch(error => {
        // Enhanced error handling specifically for barcode scanning
        if (error.code === 'ECONNABORTED') {
          throw new Error('Connection timeout. Server might be unavailable.');
        }
        if (error.code === 'ERR_NETWORK' || error.message.includes('Network Error')) {
          throw new Error('Network error. Please check server connection.');
        }
        if (error.response) {
          // The server responded with an error status
          if (error.response.status === 404) {
            throw new Error(`Product with barcode ${barcode} not found`);
          }
          throw new Error(`Server error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`);
        }
        throw error;
      }),
  create: (data: FormData) => {
    // Use multipart/form-data for file uploads
    return api.post('/products', data, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  update: (id: string | number, data: FormData) => {
    // Use multipart/form-data for file uploads
    return api.put(`/products/${id}`, data, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },
  delete: (id: string | number) => api.delete(`/products/${id}`),
  updateStock: (id: string | number, quantity: number) => api.patch(`/products/${id}/stock`, { quantity }),
  getLatest: (limit = 10) => api.get('/products/latest', { params: { limit } }),
  refresh: () => api.get('/products/refresh'),
  
  // Fix the checkExistingProducts method with better error handling
  checkExistingProducts: (productNames: string[]) => {
    console.log('Checking existing products with names:', productNames);
    return api.post('/products/check-existing', { productNames })
      .catch(error => {
        console.error('Error in checkExistingProducts:', error);
        if (error.response) {
          throw new Error(`Server error (${error.response.status}): ${error.response.data?.message || 'Unknown error checking products'}`);
        } else if (error.request) {
          throw new Error('No response received from server when checking existing products');
        } else {
          throw new Error(`Error checking products: ${error.message}`);
        }
      });
  },
};

// Categories API
export const categoriesApi = {
  getAll: (params?: { shopId?: string }) => api.get('/categories', { params }),
  getById: (id: string | number) => api.get(`/categories/${id}`),
  create: (data: any) => api.post('/categories', data),
  update: (id: string | number, data: any) => api.put(`/categories/${id}`, data),
  delete: (id: string | number) => api.delete(`/categories/${id}`)
};

// Suppliers API
export const suppliersApi = {
  getAll: () => api.get('/suppliers'),
  getById: (id: string | number) => api.get(`/suppliers/${id}`),
  create: (data: any) => api.post('/suppliers', data),
  update: (id: string | number, data: any) => api.put(`/suppliers/${id}`, data),
  delete: (id: string | number) => api.delete(`/suppliers/${id}`)
};

// Sales API
export const salesApi = {
  getAll: (params?: { 
    page?: number;
    limit?: number;
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    status?: string;
  }) => api.get('/sales', { params }),
  
  getById: (id: string | number) => {
    return api.get(`/sales/${id}`)
      .catch(error => {
        console.error('Error fetching sale details:', error);
        if (error.response && error.response.status === 404) {
          throw new Error('Sale not found');
        } else if (error.response && error.response.status === 400) {
          throw new Error('Invalid sale ID format provided');
        }
        throw new Error(`Failed to load sale: ${error.response?.data?.message || error.message}`);
      });
  },
  
  create: (saleData: Sale) => {
    // Improved handling of manual, service, and product items
    const formattedData = {
      ...saleData,
      items: saleData.items.map(item => {
        // Keep isService flag and name for service items
        if (item.isService) {
          return {
            isService: true,
            name: item.name || 'Service',
            quantity: item.quantity,
            price: item.price,
            discount: item.discount || 0
          };
        }
        // Keep isManual flag and name for manual items
        else if (item.isManual) {
          return {
            isManual: true,
            name: item.name || 'Manual Item',
            quantity: item.quantity,
            price: item.price,
            discount: item.discount || 0
          };
        } else {
          // For regular products, ensure we have the proper ID format
          return {
            product: item.productId || item.product,
            quantity: item.quantity,
            price: item.price,
            costPrice: item.costPrice || 0,
            discount: item.discount || 0
          };
        }
      })
    };
    
    return api.post('/sales', formattedData)
      .catch(error => {
        console.error('Error creating sale:', error);
        throw new Error(`Failed to create sale: ${error.response?.data?.message || error.message}`);
      });
  },
  
  updateStatus: (id: number | string, statusData: { status: string; reason?: string }) => {
    // Enhanced validation and error handling
    if (!id) {
      return Promise.reject(new Error('Sale ID is required'));
    }
    
    return api.patch(`/sales/${id}/status`, statusData)
      .then(response => {
        console.log('Update status response:', response.data);
        return response;
      })
      .catch(error => {
        console.error('Update status error:', error);
        if (error.response) {
          if (error.response.status === 404) {
            throw new Error('Sale not found');
          } else if (error.response.status === 400) {
            throw new Error('Invalid status update data');
          }
          throw new Error(`Server error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`);
        }
        throw new Error(`Failed to update sale status: ${error.message}`);
      });
  },
  
  returnSingleItem: (returnData: {
    saleId: string;
    itemId: string;
    returnQuantity: number;
    reason?: string;
  }) => {
    if (!returnData.saleId || !returnData.itemId || !returnData.returnQuantity) {
      return Promise.reject(new Error('Sale ID, item ID, and return quantity are required'));
    }
    
    return api.post('/sales/return-item', returnData)
      .catch(error => {
        console.error('Error returning item:', error);
        if (error.response) {
          if (error.response.status === 404) {
            throw new Error('Sale or item not found');
          } else if (error.response.status === 400) {
            throw new Error(error.response.data?.message || 'Invalid return data');
          }
          throw new Error(`Server error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`);
        }
        throw new Error(`Failed to return item: ${error.message}`);
      });
  },
};

// Reports API
export const reportsApi = {
  getSalesSummary: (params: { 
    startDate?: string; 
    endDate?: string; 
    groupBy?: 'day' | 'week' | 'month';
    shopId?: string;
  }) => api.get('/reports/sales/summary', { params }),
  
  getProductSalesReport: (params: { 
    startDate?: string;
    endDate?: string;
    categoryId?: string | number;
    limit?: number;
    shopId?: string;
  }) => api.get('/reports/sales/products', { params }),
  
  // Enhanced getProfitDistribution method with better error handling
  getProfitDistribution: (params: { 
    startDate?: string; 
    endDate?: string; 
    groupBy?: 'day' | 'week' | 'month';
    shopId?: string;
  }) => {
    console.log('Calling profit distribution API with params:', params);
    return api.get('/reports/sales/profit', { params })
      .catch(error => {
        console.error('Profit distribution API error:', error);
        if (error.response) {
          throw new Error(`Server error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`);
        } else if (error.request) {
          throw new Error('No response received from server when fetching profit data');
        } else {
          throw new Error(`Error fetching profit data: ${error.message}`);
        }
      });
  },
  
  // Ensure there's only one implementation for inventory status report
  getInventoryStatusReport: (params: { 
    lowStock?: boolean;   
    categoryId?: string;
    shopId: string;
  }) => {
    console.log('Calling inventory status API with params:', params);
    return api.get('/reports/inventory/status', { params });
  },
  
  // Fix the generateSalesReport function - correctly implement it
  generateSalesReport: (params: { 
    startDate?: string; 
    endDate?: string;
    shopId?: string;
  }) => {
    console.log('Calling generateSalesReport API with params:', params);
    return api.get('/reports/sales-report', { 
      params,
      responseType: 'blob' // Set response type to blob for direct file download
    })
    .then(response => {
      // Create a blob from the response data
      const blob = new Blob([response.data], { type: 'application/pdf' });
      
      // Create a link element to trigger download
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sales_report_${new Date().getTime()}.pdf`;
      
      // Append to body, click and remove
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      return { success: true, message: 'Report generated successfully' };
    })
    .catch(error => {
      console.error('Error generating sales report:', error);
      if (error.response) {
        throw new Error(`Server error (${error.response.status}): ${error.response.data?.message || 'Unknown error'}`);
      } else if (error.request) {
        throw new Error('No response received from server. Check server connection.');
      } else {
        throw new Error(`Request error: ${error.message}`);
      }
    });
  },
  
  getDailySales: (params: {
    startDate?: string;
    endDate?: string;
    shopId?: string;
  }) => api.get('/reports/sales/daily', { params }),
};

// Print API
export const printApi = {
  generateBarcodes: (productIds: number[], quantity: number) => {
    return api.post('/products/print-labels', { 
      productIds, 
      quantity 
    }, { 
      responseType: 'blob'  // Set response type to blob for direct file download
    });
  },
  printReceipt: (orderId: string | number) => 
    api.post(`/print/receipt/${orderId}`),
  
  // Add new methods for thermal printing
  printReceiptToThermal: (orderId: string | number) => 
    api.post(`/print/thermal/${orderId}`),
  
  getReceiptPdf: (orderId: string | number) => 
    api.get(`/print/receipt/${orderId}`, {
      responseType: 'blob'
    })
};

// Repairs API - moved up for better recognition
export const repairsApi = {
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string; 
  }) => api.get('/repairs', { params }),
  
  getById: (id: string) => api.get(`/repairs/${id}`),
  
  create: (repairData: { 
    title: string; 
    description?: string; 
    price: number; 
  }) => api.post('/repairs', repairData),
  
  update: (id: string, repairData: { 
    title?: string; 
    description?: string; 
    price?: number; 
    isActive?: boolean; 
  }) => api.put(`/repairs/${id}`, repairData),
  
  delete: (id: string) => api.delete(`/repairs/${id}`),
};

// Services API
export const servicesApi = {
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    startDate?: string;
    endDate?: string;
    paymentMethod?: string;
    status?: string;
    search?: string;
    shopId?: string;
  }) => api.get('/services', { params }),
  
  getById: (id: string) => api.get(`/services/${id}`),
  
  create: (serviceData: { 
    name: string; 
    description?: string; 
    price: number; 
    quantity?: number;
    discount?: number;
    customerName?: string;
    customerPhone?: string;
    paymentMethod?: string;
    notes?: string;
  }) => api.post('/services', serviceData),
  
  updateStatus: (id: string, statusData: {
    status: 'completed' | 'pending' | 'cancelled' | 'refunded';
    reason?: string;
  }) => api.patch(`/services/${id}/status`, statusData),
  
  getStats: (params?: {
    startDate?: string;
    endDate?: string;
    shopId?: string;
  }) => api.get('/services/stats', { params }),
};

// Repair Jobs API
export const repairJobsApi = {
  getAll: (params?: { 
    page?: number; 
    limit?: number; 
    search?: string;
    status?: string;
    priority?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/repair-jobs', { params }),
  
  getById: (id: string) => api.get(`/repair-jobs/${id}`),
  
  create: (jobData: {
    customer: {
      name: string;
      phone: string;
      email?: string;
    };
    bike?: {
      brand?: string;
      model?: string;
      year?: string;
      color?: string;
      serialNumber?: string;
    };
    description: string;
    priority?: 'low' | 'medium' | 'high' | 'urgent';
    estimatedCost?: number;
    estimatedCompletionDate?: string;
    deposit?: number;
    assignedTo?: string;
  }) => api.post('/repair-jobs', jobData),
  
  update: (id: string, updates: any) => api.put(`/repair-jobs/${id}`, updates),
  
  addPart: (id: string, partData: {
    productId?: string;
    name: string;
    quantity: number;
    unitPrice: number;
  }) => api.post(`/repair-jobs/${id}/parts`, partData),
  
  addLabor: (id: string, laborData: {
    description: string;
    hours: number;
    hourlyRate: number;
  }) => api.post(`/repair-jobs/${id}/labor`, laborData),
  
  addService: (id: string, serviceData: {
    repairId?: string;
    name: string;
    price: number;
  }) => api.post(`/repair-jobs/${id}/services`, serviceData),
  
  addNote: (id: string, noteData: {
    text: string;
  }) => api.post(`/repair-jobs/${id}/notes`, noteData),
  
  convertToSale: (id: string, saleData?: {
    paymentMethod?: string;
  }) => api.post(`/repair-jobs/${id}/convert-to-sale`, saleData),
  
  delete: (id: string) => api.delete(`/repair-jobs/${id}`),
  
  getStats: (params?: {
    startDate?: string;
    endDate?: string;
  }) => api.get('/repair-jobs/stats', { params }),
};

// Users API
export const usersApi = {
  getAll: (params?: {
    shopId?: string;
  }) => api.get('/users', { params }),
  
  getById: (id: string) => api.get(`/users/${id}`),
  
  create: (userData: {
    name: string;
    username: string;
    email: string;
    password: string;
    role: 'admin' | 'manager' | 'cashier';
    shopId?: string;
    isActive?: boolean;
  }) => api.post('/users', userData),
  
  update: (id: string, userData: {
    name?: string;
    username?: string;
    email?: string;
    password?: string;
    role?: 'admin' | 'manager' | 'cashier';
    shopId?: string;
    isActive?: boolean;
  }) => api.put(`/users/${id}`, userData),
  
  toggleStatus: (id: string) => api.patch(`/users/${id}/toggle-status`),
  
  delete: (id: string) => api.delete(`/users/${id}`)
};

// Stats API
export const statsApi = {
  getDeveloperStats: () => api.get('/stats/developer'),
  getShopStats: (params?: {
    shopId?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/stats/shop', { params }),
};

// Helper function to check server connectivity
export const checkServerConnectivity = () => {
  return api.get('/health-check')
    .then(() => true)
    .catch(() => false);
};

export default api;