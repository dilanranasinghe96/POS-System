import 'bootstrap/dist/css/bootstrap.min.css';
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Tooltip as ChartTooltip,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Title,
} from 'chart.js';
import { useEffect, useState } from 'react';
import {
    Button,
    Card,
    Col,
    Container,
    Form,
    Nav,
    Row,
    Spinner,
    Table,
} from 'react-bootstrap';
import {
    BarChart,
    BoxSeam,
    Download,
    FileEarmarkText
} from 'react-bootstrap-icons';
import { Bar, Line } from 'react-chartjs-2';
import DatePicker from 'react-datepicker';
import "react-datepicker/dist/react-datepicker.css";
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { categoriesApi, reportsApi } from '../services/api';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  ChartTooltip,
  Legend
);

const Reports = () => {
  const { user, getCurrentShop } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [activeTab, setActiveTab] = useState('sales');
  const [loading, setLoading] = useState(false);
  
  // Dates for filtering
  const [startDate, setStartDate] = useState<Date>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Default to last 30 days
    return date;
  });
  const [endDate, setEndDate] = useState<Date>(new Date());
  
  // Sales summary data
  const [salesSummary, setSalesSummary] = useState<{ summary: any[], totals: any }>({ summary: [], totals: {} });
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  
  // Profit distribution data
  const [profitDistribution, setProfitDistribution] = useState<{ summary: any[], totals: any }>({ summary: [], totals: {} });
  const [profitGroupBy, setProfitGroupBy] = useState<'day' | 'week' | 'month'>('day');
  
  // Product sales data
  interface ProductSale {
    name: string;
    category: string;
    quantitySold: number;
    totalRevenue: number;
    profit: number;
    profitMargin: string;
  }
  
  const [productSales, setProductSales] = useState<ProductSale[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [topProductsLimit, setTopProductsLimit] = useState<number>(10);
  
  // Inventory data
  interface InventoryItem {
    name: string;
    category: string;
    quantity: number;
    reorderLevel: number;
    value: number;
    barcode?: string;
  }
  
  const [inventoryData, setInventoryData] = useState<{ inventory: InventoryItem[], summary: any }>({ inventory: [], summary: {} });
  const [showLowStock, setShowLowStock] = useState(false);
  
  // Fetch categories on component mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const currentShop = getCurrentShop();
        if (!currentShop) {
          showError('No shop selected');
          return;
        }
        
        const response = await categoriesApi.getAll({ shopId: currentShop._id });
        setCategories(response.data);
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    };
    
    fetchCategories();
  }, [getCurrentShop]);
  
  // Format date for API
  const formatDateForApi = (date: Date | null): string => {
    if (!date) return '';
    return date.toISOString().split('T')[0];
  };

  // Format date for display
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };
  
  // Fetch sales summary data
  const fetchSalesSummary = async () => {
    try {
      setLoading(true);
      
      const currentShop = getCurrentShop();
      if (!currentShop) {
        if (user?.role !== 'developer') {
          showError('No shop selected. Please contact your administrator.');
        }
        setLoading(false);
        return;
      }
      
      const response = await reportsApi.getSalesSummary({
        startDate: formatDateForApi(startDate),
        endDate: formatDateForApi(endDate),
        groupBy,
        shopId: currentShop._id
      });
      
      // Log the data for debugging
      
      setSalesSummary(response.data);
      
    } catch (err) {
      console.error('Error fetching sales summary:', err);
      showError('Failed to load sales summary data');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch profit distribution data
  const fetchProfitDistribution = async () => {
    try {
      setLoading(true);
      
      const currentShop = getCurrentShop();
      if (!currentShop) {
        if (user?.role !== 'developer') {
          showError('No shop selected. Please contact your administrator.');
        }
        setLoading(false);
        return;
      }
      
      const response = await reportsApi.getProfitDistribution({
        startDate: formatDateForApi(startDate),
        endDate: formatDateForApi(endDate),
        groupBy: profitGroupBy,
        shopId: currentShop._id
      });
      
      
      setProfitDistribution(response.data);
      
    } catch (err) {
      console.error('Error fetching profit distribution:', err);
      showError('Failed to load profit distribution data');
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch product sales data
  const fetchProductSales = async () => {
    try {
      setLoading(true);
      
      const currentShop = getCurrentShop();
      if (!currentShop) {
        if (user?.role !== 'developer') {
          showError('No shop selected. Please contact your administrator.');
        }
        setLoading(false);
        return;
      }
      
      const response = await reportsApi.getProductSalesReport({
        startDate: formatDateForApi(startDate),
        endDate: formatDateForApi(endDate),
        categoryId: categoryFilter,
        limit: topProductsLimit,
        shopId: currentShop._id
      });
      
      // Ensure response.data is an array before setting state
      if (Array.isArray(response.data)) {
        setProductSales(response.data);
      } else {
        console.error('Expected array for product sales data but got:', response.data);
        setProductSales([]);
        showError('Invalid data format received for product sales');
      }
      
    } catch (err) {
      console.error('Error fetching product sales:', err);
      showError('Failed to load product sales data');
      setProductSales([]); // Reset to empty array on error
    } finally {
      setLoading(false);
    }
  };
  
  // Fetch inventory data
  const fetchInventoryData = async () => {
    try {
      setLoading(true);
      
      const currentShop = getCurrentShop();
      if (!currentShop) {
        if (user?.role !== 'developer') {
          showError('No shop selected. Please contact your administrator.');
        }
        setLoading(false);
        return;
      }

    
      
      const response = await reportsApi.getInventoryStatusReport({
        lowStock: showLowStock,
        categoryId: categoryFilter, // Include category filter in the request
        shopId: currentShop._id
      });
      
      
      // Improved handling of response data format
      if (!response.data) {
        showError('No data received from server');
        setInventoryData({ inventory: [], summary: {} });
      } 
      // Handle both possible response formats (array or object with inventory property)
      else if (Array.isArray(response.data)) {
        // If the response is a direct array, adapt it to expected format
        setInventoryData({ 
          inventory: response.data,
          summary: {
            totalProducts: response.data.length,
            totalItems: response.data.reduce((sum, item) => sum + item.quantity, 0),
            totalValue: response.data.reduce((sum, item) => sum + (item.value || 0), 0),
            lowStockItems: response.data.filter(item => item.quantity <= item.reorderLevel).length
          }
        });
      }
      else if (response.data.inventory || Array.isArray(response.data.inventory)) {
        // Standard expected format
        setInventoryData(response.data);
      }
      else {
        showError('Invalid inventory data format received from server');
        setInventoryData({ inventory: [], summary: {} });
      }
      
    } catch (err: any) {
      console.error('Error fetching inventory data:', err);
      showError(`Failed to load inventory data: ${err.message || 'Unknown error'}`);
      setInventoryData({ inventory: [], summary: {} });
    } finally {
      setLoading(false);
    }
  };

  // Load data when tab changes or filters change
  useEffect(() => {
    if (activeTab === 'sales') {
      fetchSalesSummary();
    } else if (activeTab === 'products') {
      fetchProductSales();
    } else if (activeTab === 'inventory') {
      fetchInventoryData();
    } else if (activeTab === 'profit') {
      fetchProfitDistribution();
    }
  }, [activeTab, startDate, endDate, groupBy, profitGroupBy, showLowStock]);
  
  // Format date for display
  // Prepare data for sales chart
  const salesChartData = {
    labels: salesSummary.summary.map((item: any) => {
      if (groupBy === 'day') {
        return formatDate(item.date);
      } else if (groupBy === 'week') {
        return `Week of ${formatDate(item.date)}`;
      } else {
        return new Date(item.date).toLocaleString('default', { month: 'long', year: 'numeric' });
      }
    }),
    datasets: [
      {
        label: 'Sales',
        data: salesSummary.summary.map((item) => parseFloat(item.totalRevenue || item.productRevenue || item.total || 0)),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
      },
    ],
  };

  // Prepare data for product sales chart
  const productSalesChartData = {
    labels: Array.isArray(productSales) ? productSales.map(item => item.name) : [],
    datasets: [
      {
        label: 'Quantity Sold',
        data: Array.isArray(productSales) ? productSales.map(item => item.quantitySold) : [],
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderColor: 'rgba(54, 162, 235, 1)',
        borderWidth: 1,
      },
    ],
  };
  
  // Prepare data for inventory category distribution chart
  const getInventoryCategoryData = () => {
    const categoryMap = new Map();
    
    inventoryData.inventory.forEach((item) => {
      const category = item.category || 'Uncategorized';
      if (categoryMap.has(category)) {
        categoryMap.set(category, categoryMap.get(category) + 1);
      } else {
        categoryMap.set(category, 1);
      }
    });
    
    return {
      labels: Array.from(categoryMap.keys()),
      datasets: [
        {
          data: Array.from(categoryMap.values()),
          backgroundColor: [
            'rgba(255, 99, 132, 0.6)',
            'rgba(54, 162, 235, 0.6)',
            'rgba(255, 206, 86, 0.6)',
            'rgba(75, 192, 192, 0.6)',
            'rgba(153, 102, 255, 0.6)',
            'rgba(255, 159, 64, 0.6)',
            'rgba(199, 199, 199, 0.6)',
          ],
          borderWidth: 1,
        },
      ],
    };
  };
  
  // Prepare data for profit distribution chart
  const profitChartData = {
    labels: profitDistribution.summary.map((item: any) => {
      if (profitGroupBy === 'day') {
        return formatDate(item.date);
      } else if (profitGroupBy === 'week') {
        return `Week of ${formatDate(item.date)}`;
      } else {
        return new Date(item.date).toLocaleString('default', { month: 'long', year: 'numeric' });
      }
    }),
    datasets: [
      {
        label: 'Profit',
        data: profitDistribution.summary.map((item) => parseFloat(item.profit)),
        borderColor: 'rgba(40, 167, 69, 1)',
        backgroundColor: 'rgba(40, 167, 69, 0.2)',
        tension: 0.4,
      },
      {
        label: 'Revenue',
        data: profitDistribution.summary.map((item) => parseFloat(item.total)),
        borderColor: 'rgba(75, 192, 192, 1)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
        tension: 0.4,
      },
    ],
  };
  
  return (
    <Container fluid className="py-4">
      <Row className="mb-4 align-items-center">
        <Col>
          <h2 className="mb-3 fw-bold">
            <FileEarmarkText className="me-2 mb-1" /> 
            Reports Dashboard
          </h2>
        </Col>
        <Col xs="auto">
        </Col>
      </Row>
      
      <Card className="mb-4 border-0 shadow-sm">
        <Card.Header className="bg-white py-3">
          <Nav 
            variant="pills" 
            activeKey={activeTab} 
            onSelect={(key) => key && setActiveTab(key)}
            className="flex-nowrap overflow-auto pb-2"
          >
            <Nav.Item>
              <Nav.Link eventKey="sales" className="d-flex align-items-center px-3 me-2">
                <FileEarmarkText className="me-2" /> Sales Summary
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="products" className="d-flex align-items-center px-3 me-2">
                <BarChart className="me-2" /> Product Sales
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="profit" className="d-flex align-items-center px-3 me-2">
                <BarChart className="me-2" /> Profit Distribution
              </Nav.Link>
            </Nav.Item>
            <Nav.Item>
              <Nav.Link eventKey="inventory" className="d-flex align-items-center px-3">
                <BoxSeam className="me-2" /> Inventory Status
              </Nav.Link>
            </Nav.Item>
          </Nav>
        </Card.Header>
        
        <Card.Body className="p-4">
          {/* Date Range Selector */}
          <Row className="g-4 mb-4 bg-light p-3 rounded">
            <Col md={6} lg={3}>
              <Form.Group>
                <Form.Label className="fw-semibold">Start Date</Form.Label>
                <DatePicker
                  selected={startDate}
                  onChange={date => date && setStartDate(date)}
                  className="form-control shadow-sm"
                  dateFormat="MM/dd/yyyy"
                />
              </Form.Group>
            </Col>
            
            <Col md={6} lg={3}>
              <Form.Group>
                <Form.Label className="fw-semibold">End Date</Form.Label>
                <DatePicker
                  selected={endDate}
                  onChange={date => date && setEndDate(date)}
                  className="form-control shadow-sm"
                  dateFormat="MM/dd/yyyy"
                />
              </Form.Group>
            </Col>
            
            {(activeTab === 'sales' || activeTab === 'profit') && (
              <Col md={6} lg={3}>
                <Form.Group>
                  <Form.Label className="fw-semibold">Group By</Form.Label>
                  <Form.Select
                    value={activeTab === 'profit' ? profitGroupBy : groupBy}
                    onChange={(e) => {
                      const value = e.target.value as 'day' | 'week' | 'month';
                      if (activeTab === 'profit') {
                        setProfitGroupBy(value);
                      } else {
                        setGroupBy(value);
                      }
                    }}
                    className="shadow-sm"
                  >
                    <option value="day">Day</option>
                    <option value="week">Week</option>
                    <option value="month">Month</option>
                  </Form.Select>
                </Form.Group>
              </Col>
            )}
            
            {activeTab === 'products' && (
              <>
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Category</Form.Label>
                    <Form.Select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="shadow-sm"
                    >
                      <option value="">All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Top Products Limit</Form.Label>
                    <Form.Control
                      type="number"
                      value={topProductsLimit}
                      onChange={(e) => setTopProductsLimit(Math.max(1, parseInt(e.target.value) || 10))}
                      min={1}
                      max={100}
                      className="shadow-sm"
                    />
                  </Form.Group>
                </Col>
              </>
            )}
            
            {activeTab === 'inventory' && (
              <>
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label className="fw-semibold">Category</Form.Label>
                    <Form.Select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="shadow-sm"
                    >
                      <option value="">All Categories</option>
                      {categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </Form.Select>
                  </Form.Group>
                </Col>
                
                <Col md={6} lg={3}>
                  <Form.Group>
                    <Form.Label className="d-block opacity-0">Filter</Form.Label>
                    <Button
                      variant={showLowStock ? "warning" : "outline-primary"}
                      onClick={() => setShowLowStock(!showLowStock)}
                      className="w-100 shadow-sm"
                    >
                      {showLowStock ? "Show All Stock" : "Show Low Stock Only"}
                    </Button>
                  </Form.Group>
                </Col>
              </>
            )}
            
            <Col md={6} lg={3} className="d-flex align-items-end">
              <Button 
                variant="success" 
                className="w-100 shadow-sm"
                onClick={() => {
                  if (activeTab === 'sales') fetchSalesSummary();
                  else if (activeTab === 'products') fetchProductSales();
                  else if (activeTab === 'inventory') fetchInventoryData();
                  else if (activeTab === 'profit') fetchProfitDistribution();
                }}
              >
                Apply Filters
              </Button>
            </Col>
          </Row>
          
          {loading ? (
            <div className="text-center py-5">
              <Spinner animation="border" role="status" variant="primary" style={{ width: '3rem', height: '3rem' }}>
                <span className="visually-hidden">Loading...</span>
              </Spinner>
              <p className="mt-3 text-muted">Loading report data...</p>
            </div>
          ) : (
            <>
              {/* Sales Summary Tab */}
              {activeTab === 'sales' && (
                <Row className="g-4">
                  <Col lg={8}>
                    <Card className="h-100 border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <BarChart className="me-2 mb-1" /> Sales Trend
                        </h5>
                        <hr className="mb-4" />
                        
                        {salesSummary.summary.length > 0 ? (
                          <div style={{ height: 400 }}>
                            <Line
                              data={salesChartData}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: 'top',
                                  },
                                  title: {
                                    display: false,
                                  },
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    title: {
                                      display: true,
                                      text: 'Sales Amount (Rs.)'
                                    }
                                  },
                                },
                              }}
                            />
                          </div>
                        ) : (
                          <div className="text-center d-flex justify-content-center align-items-center h-100 bg-light rounded py-5">
                            <div>
                              <FileEarmarkText size={40} className="text-muted mb-3" />
                              <p className="text-muted">
                                No sales data available for the selected period
                              </p>
                            </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col lg={4}>
                    <Card className="mb-4 border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <FileEarmarkText className="me-2 mb-1" /> Summary
                        </h5>
                        <hr className="mb-4" />
                        
                        <Table hover size="sm" responsive className="table-borderless">
                          <tbody>
                            <tr>
                              <td className="fw-semibold">Date Range</td>
                              <td className="text-end">
                                {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Total Sales</td>
                              <td className="text-end">
                                {salesSummary.totals?.totalSales || 0}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Total Services</td>
                              <td className="text-end">
                                {salesSummary.totals?.totalServices || 0}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Product Revenue</td>
                              <td className="text-end">
                                Rs. {parseFloat(salesSummary.totals?.productRevenue || 0).toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Service Revenue</td>
                              <td className="text-end">
                                Rs. {parseFloat(salesSummary.totals?.serviceRevenue || 0).toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Subtotal</td>
                              <td className="text-end">
                                Rs. {parseFloat(salesSummary.totals?.subtotal || 0).toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Discount</td>
                              <td className="text-end">
                                Rs. {parseFloat(salesSummary.totals?.discount || 0).toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Tax</td>
                              <td className="text-end">
                                Rs. {parseFloat(salesSummary.totals?.tax || 0).toFixed(2)}
                              </td>
                            </tr>
                            <tr className="bg-light rounded">
                              <td className="fw-bold px-2 py-2">Total Revenue</td>
                              <td className="text-end fw-bold px-2 py-2 text-success">
                                Rs. {parseFloat(salesSummary.totals?.totalRevenue || salesSummary.totals?.total || 0).toFixed(2)}
                              </td>
                            </tr>
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                    
                    <Card className="border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <BarChart className="me-2 mb-1" /> Sales by Day
                        </h5>
                        <hr className="mb-4" />
                        
                        <div style={{ maxHeight: 300, overflowY: 'auto' }} className="custom-scrollbar">
                          <Table hover size="sm" responsive className="table-striped">
                            <thead className="sticky-top bg-white text-primary">
                              <tr>
                                <th>Date</th>
                                <th className="text-end">Transactions</th>
                                <th className="text-end">Product Revenue</th>
                                <th className="text-end">Service Revenue</th>
                                <th className="text-end">Total Revenue</th>
                              </tr>
                            </thead>
                            <tbody>
                              {salesSummary.summary.length > 0 ? (
                                salesSummary.summary.map((item, index) => (
                                  <tr key={index}>
                                    <td>
                                      {groupBy === 'day'
                                        ? formatDate(item.date)
                                        : groupBy === 'week'
                                        ? `Week of ${formatDate(item.date)}`
                                        : new Date(item.date).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                    </td>
                                    <td className="text-end">{(item.salesCount || 0) + (item.servicesCount || 0)}</td>
                                    <td className="text-end fw-semibold">Rs. {parseFloat(item.productRevenue || item.total || 0).toFixed(2)}</td>
                                    <td className="text-end fw-semibold">Rs. {parseFloat(item.serviceRevenue || 0).toFixed(2)}</td>
                                    <td className="text-end fw-semibold">Rs. {parseFloat(item.totalRevenue || item.total || 0).toFixed(2)}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="text-center py-3">
                                    <p className="text-muted mb-0">No data available</p>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}
              
              {/* Product Sales Tab */}
              {activeTab === 'products' && (
                <Row className="g-4">
                  <Col lg={7}>
                    <Card className="h-100 border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <BarChart className="me-2 mb-1" /> Top {topProductsLimit} Products by Sales
                        </h5>
                        <hr className="mb-4" />
                        
                        {Array.isArray(productSales) && productSales.length > 0 ? (
                          <div style={{ height: 400 }}>
                            <Bar
                              data={productSalesChartData}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    display: false,
                                  },
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    title: {
                                      display: true,
                                      text: 'Quantity Sold'
                                    }
                                  },
                                  x: {
                                    ticks: {
                                      maxRotation: 45,
                                      minRotation: 45
                                    }
                                  }
                                },
                              }}
                            />
                          </div>
                        ) : (
                          <div className="text-center d-flex justify-content-center align-items-center h-100 bg-light rounded py-5">
                            <div>
                              <BarChart size={40} className="text-muted mb-3" />
                              <p className="text-muted">
                                No product sales data available for the selected period
                              </p>
                            </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col lg={5}>
                    <Card className="border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <FileEarmarkText className="me-2 mb-1" /> Product Sales Details
                        </h5>
                        <hr className="mb-4" />
                        
                        <div style={{ maxHeight: 400, overflowY: 'auto' }} className="custom-scrollbar">
                          <Table hover size="sm" responsive className="table-striped">
                            <thead className="sticky-top bg-white text-primary">
                              <tr>
                                <th>Product</th>
                                <th className="text-end">Quantity</th>
                                <th className="text-end">Revenue</th>
                                <th className="text-end">Profit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {Array.isArray(productSales) && productSales.length > 0 ? (
                                productSales.map((product, index) => (
                                  <tr key={index}>
                                    <td className="fw-semibold">{product.name}</td>
                                    <td className="text-end">{product.quantitySold}</td>
                                    <td className="text-end">Rs. {product.totalRevenue}</td>
                                    <td className="text-end fw-semibold text-success">
                                      Rs. {product.profit} ({product.profitMargin})
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="text-center py-3">
                                    <p className="text-muted mb-0">No data available</p>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}
              
              {/* Profit Distribution Tab */}
              {activeTab === 'profit' && (
                <Row className="g-4">
                  <Col lg={8}>
                    <Card className="h-100 border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <Download className="me-2 mb-1" /> Profit Distribution
                        </h5>
                        <hr className="mb-4" />
                        
                        {profitDistribution.summary.length > 0 ? (
                          <div style={{ height: 400 }}>
                            <Line
                              data={profitChartData}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: {
                                  legend: {
                                    position: 'top',
                                  },
                                  title: {
                                    display: false,
                                  },
                                },
                                scales: {
                                  y: {
                                    beginAtZero: true,
                                    title: {
                                      display: true,
                                      text: 'Amount (Rs.)'
                                    }
                                  },
                                },
                              }}
                            />
                          </div>
                        ) : (
                          <div className="text-center d-flex justify-content-center align-items-center h-100 bg-light rounded py-5">
                            <div>
                              <Download size={40} className="text-muted mb-3" />
                              <p className="text-muted">
                                No profit data available for the selected period
                              </p>
                            </div>
                          </div>
                        )}
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col lg={4}>
                    <Card className="mb-4 border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <FileEarmarkText className="me-2 mb-1" /> Profit Summary
                        </h5>
                        <hr className="mb-4" />
                        
                        <Table hover size="sm" responsive className="table-borderless">
                          <tbody>
                            <tr>
                              <td className="fw-semibold">Date Range</td>
                              <td className="text-end">
                                {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Total Revenue</td>
                              <td className="text-end">
                                Rs. {parseFloat(profitDistribution.totals?.total || 0).toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Cost of Goods</td>
                              <td className="text-end">
                                Rs. {parseFloat(profitDistribution.totals?.cost || 0).toFixed(2)}
                              </td>
                            </tr>
                            <tr className="bg-light rounded">
                              <td className="fw-bold px-2 py-2">Total Profit</td>
                              <td className="text-end fw-bold px-2 py-2 text-success">
                                Rs. {parseFloat(profitDistribution.totals?.profit || 0).toFixed(2)}
                              </td>
                            </tr>
                            <tr>
                              <td className="fw-semibold">Profit Margin</td>
                              <td className="text-end fw-semibold">
                                {profitDistribution.totals?.profitMargin || '0%'}
                              </td>
                            </tr>
                          </tbody>
                        </Table>
                      </Card.Body>
                    </Card>
                    
                    <Card className="border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <Download className="me-2 mb-1" /> Profit by {profitGroupBy}
                        </h5>
                        <hr className="mb-4" />
                        
                        <div style={{ maxHeight: 300, overflowY: 'auto' }} className="custom-scrollbar">
                          <Table hover size="sm" responsive className="table-striped">
                            <thead className="sticky-top bg-white text-primary">
                              <tr>
                                <th>Period</th>
                                <th className="text-end">Revenue</th>
                                <th className="text-end">Profit</th>
                                <th className="text-end">Margin</th>
                              </tr>
                            </thead>
                            <tbody>
                              {profitDistribution.summary.length > 0 ? (
                                profitDistribution.summary.map((item, index) => (
                                  <tr key={index}>
                                    <td>
                                      {profitGroupBy === 'day'
                                        ? formatDate(item.date)
                                        : profitGroupBy === 'week'
                                        ? `Week of ${formatDate(item.date)}`
                                        : new Date(item.date).toLocaleString('default', { month: 'long', year: 'numeric' })}
                                    </td>
                                    <td className="text-end">Rs. {parseFloat(item.total).toFixed(2)}</td>
                                    <td className="text-end text-success fw-semibold">Rs. {parseFloat(item.profit).toFixed(2)}</td>
                                    <td className="text-end">{item.profitMargin}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={4} className="text-center py-3">
                                    <p className="text-muted mb-0">No data available</p>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}
              
              {/* Inventory Status Tab */}
              {activeTab === 'inventory' && (
                <Row className="g-4">
                  <Col lg={5}>
                    <Card className="mb-4 border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <Download className="me-2 mb-1" /> Inventory Summary
                        </h5>
                        <hr className="mb-4" />
                        
                        <Row className="g-3 mb-4">
                          <Col sm={6}>
                            <Card className="h-100 bg-light border-0 shadow-sm">
                              <Card.Body className="text-center py-3">
                                <h3 className="text-primary mb-1 fw-bold">
                                  {inventoryData.summary?.totalProducts || 0}
                                </h3>
                                <p className="text-muted small mb-0">Total Products</p>
                              </Card.Body>
                            </Card>
                          </Col>
                          
                          <Col sm={6}>
                            <Card className="h-100 bg-light border-0 shadow-sm">
                              <Card.Body className="text-center py-3">
                                <h3 className="text-primary mb-1 fw-bold">
                                  {inventoryData.summary?.totalItems || 0}
                                </h3>
                                <p className="text-muted small mb-0">Total Items in Stock</p>
                              </Card.Body>
                            </Card>
                          </Col>
                          
                          <Col sm={6}>
                            <Card className="h-100 bg-light border-0 shadow-sm">
                              <Card.Body className="text-center py-3">
                                <h3 className="text-primary mb-1 fw-bold">
                                  Rs. {parseFloat(inventoryData.summary?.totalValue || 0).toFixed(2)}
                                </h3>
                                <p className="text-muted small mb-0">Total Inventory Value</p>
                              </Card.Body>
                            </Card>
                          </Col>
                          
                          <Col sm={6}>
                            <Card className="h-100 bg-light border-0 shadow-sm">
                              <Card.Body className="text-center py-3">
                                <h3 className="text-danger mb-1 fw-bold">
                                  {inventoryData.summary?.lowStockItems || 0}
                                </h3>
                                <p className="text-muted small mb-0">Low Stock Items</p>
                              </Card.Body>
                            </Card>
                          </Col>
                        </Row>
                        
                       
                      </Card.Body>
                    </Card>
                  </Col>
                  
                  <Col lg={7}>
                    <Card className="border-0 shadow-sm">
                      <Card.Body className="p-4">
                        <h5 className="card-title fw-bold text-primary mb-3">
                          <FileEarmarkText className="me-2 mb-1" /> Inventory Details
                        </h5>
                        <hr className="mb-4" />
                        
                        <div style={{ maxHeight: 600, overflowY: 'auto' }} className="custom-scrollbar">
                          <Table hover size="sm" responsive className="table-striped">
                            <thead className="sticky-top bg-white text-primary">
                              <tr>
                                <th>Product</th>
                                <th>Barcode</th>
                                <th className="text-end">Stock</th>
                                <th className="text-end">Reorder Level</th>
                                <th className="text-end">Value</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {inventoryData.inventory.length > 0 ? (
                                inventoryData.inventory.map((item, index) => (
                                  <tr key={index}>
                                    <td className="fw-semibold">{item.name}</td>
                                    <td>{item.barcode || 'N/A'}</td>
                                      <td className="text-end">{item.quantity}</td>
                                    <td className="text-end">{item.reorderLevel}</td>
                                    <td className="text-end">Rs. {item.value}</td>
                                    <td>
                                      <span className={`badge ${item.quantity < item.reorderLevel ? 'bg-danger' : 'bg-success'}`}>
                                        {item.quantity < item.reorderLevel ? 'Low Stock' : 'In Stock'}
                                      </span>
                                    </td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={7} className="text-center py-3">
                                    <p className="text-muted mb-0">No data available</p>
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </Table>
                        </div>
                      </Card.Body>
                    </Card>
                  </Col>
                </Row>
              )}
            </>
          )}
        </Card.Body>
      </Card>
      
      {/* Add CSS for custom scrollbar */}
      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 4px;
        }
        
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
        }
        
        .table-striped > tbody > tr:nth-of-type(odd) {
          background-color: rgba(0, 0, 0, 0.02);
        }
      `}</style>
    </Container>
  );
};

export default Reports;