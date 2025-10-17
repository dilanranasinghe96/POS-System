import 'bootstrap/dist/css/bootstrap.min.css';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    Badge,
    Button,
    Card,
    Col,
    Container,
    Form,
    InputGroup,
    ListGroup,
    Modal,
    OverlayTrigger,
    Pagination,
    Row,
    Spinner,
    Tooltip
} from 'react-bootstrap';
import {
    BsDash,
    BsPlus,
    BsSearch,
    BsTrash,
    BsX
} from 'react-icons/bs';
import {
    Column,
    HeaderGroup,
    TableInstance,
    usePagination,
    UsePaginationInstanceProps,
    UsePaginationState,
    useTable
} from 'react-table';
import QRScanner from '../components/QRScanner';
import { useAuth } from '../contexts/AuthContext';
import { useNotification } from '../contexts/NotificationContext';
import { categoriesApi, productsApi, salesApi, repairJobsApi } from '../services/api'; // Add categoriesApi and repairJobsApi
import ReceiptHtml from '../components/ReceiptHtml';
import ReactDOMServer from 'react-dom/server';

interface Product {
  id: number; 
  name: string;
  description: string;
  barcode: string;
  price: number;
  costPrice: number;
  stockQuantity: number;
  image?: string;
  Category?: {
    id: number;
    name: string;
  };
}

interface Repair {
  _id: string;
  title: string;
  description: string;
  price: number;
  isActive: boolean;
}

interface CartItem {
  product?: Product;
  repair?: Repair;
  repairJobId?: string;
  manualItem?: boolean;
  name?: string;
  barcode?: string;
  price?: number;
  costPrice?: number;
  quantity: number;
  subtotal: number;
  discount: number;
}

type PaymentMethod = 'cash' | 'credit_card' | 'debit_card' | 'mobile_payment' | 'other';

type POSMode = 'products' | 'manual' | 'repairs';

interface Sale {
  id?: number;
  customerId?: number;
  items: Array<{
    productId?: number;
    product?: number;
    quantity: number; 
    price: number;
    costPrice?: number;
    discount?: number;
    isManual?: boolean;
    isService?: boolean;
    name?: string;
  }>;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
  user?: number;
}

interface ReceiptData {
  id: string | number;
  invoiceNumber: string;
  date: string;
  customer: string;
  cashier: string;
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    total: number;
  }>;
  subtotal: number;
  servicesSubtotal: number; // Keep this for receipt calculation
  discount: number;
  tax: number;
  total: number;
  paymentMethod: PaymentMethod;
}

// Add Category interface
interface Category {
  _id: string;
  name: string;
  description?: string;
}

const POS: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();
  const [products, setProducts] = useState<Product[]>([]);
  const [repairs, setRepairs] = useState<Repair[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredRepairs, setFilteredRepairs] = useState<Repair[]>([]);
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [manualDiscount, setManualDiscount] = useState<number>(0);

  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [processingSale, setProcessingSale] = useState(false);

  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [printingReceipt, setPrintingReceipt] = useState(false);

  const receiptPreviewRef = useRef<HTMLDivElement>(null);

  const [scanningMessage, setScanningMessage] = useState<string | null>(null);
  const [scanningProduct, setScanningProduct] = useState<Product | null>(null);
  const [qrScannerActive, setQrScannerActive] = useState(true);

  const barcodeInputRef = useRef<HTMLInputElement>(null);

  const completeSaleButtonRef = useRef<HTMLButtonElement>(null);

  const [tempQuantities, setTempQuantities] = useState<{ [key: number]: string }>({});

  const [mode, setMode] = useState<POSMode>('products');
  const [manualItemName, setManualItemName] = useState('');
  const [manualItemPrice, setManualItemPrice] = useState('');
  const [manualItemQuantity, setManualItemQuantity] = useState('1');

  // Service entry states
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceQuantity, setServiceQuantity] = useState('1');

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isTypingInInput, setIsTypingInInput] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [pageSize, setPageSize] = useState(10);

  const [selectedCategory, setSelectedCategory] = useState<string>('');

  // Add categories state
  const [categories, setCategories] = useState<Category[]>([]);

  // Add refresh function
  const refreshProducts = async () => {
    try {
      setLoadingProducts(true);
      const response = await productsApi.getAll({
        category: selectedCategory || undefined
      });
      const productsData = response.data?.products || [];
      setProducts(productsData);
      setFilteredProducts(productsData);
    } catch (err) {
      console.error('Error refreshing products:', err);
      showError('Failed to refresh products');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Add refresh function for repairs
  const refreshRepairs = async () => {
    // No longer needed since we use manual entry
  };

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true);
        const response = await productsApi.getAll({
          category: selectedCategory || undefined
        });
        const productsData = response.data?.products || [];
        setProducts(productsData);
        setFilteredProducts(productsData);
      } catch (err) {
        console.error('Error fetching products:', err);
        showError('Failed to load products. Please try again.');
        setProducts([]);
        setFilteredProducts([]);
      } finally {
        setLoadingProducts(false);
      }
    };

    fetchProducts();
  }, [selectedCategory]);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await categoriesApi.getAll();
        setCategories(response.data || []);
      } catch (err) {
        console.error('Error fetching categories:', err);
        showError('Failed to load categories');
      }
    };

    fetchCategories();
  }, []);

  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredProducts(products);
      return;
    }

    const filteredProductsData = products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode.includes(searchQuery)
    );

    setFilteredProducts(filteredProductsData);
  }, [searchQuery, products]);

  useEffect(() => {
    if (barcodeInputRef.current) {
      barcodeInputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if we're typing in an input or processing a sale
      const target = event.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || 
                     target.tagName === 'TEXTAREA' || 
                     target.tagName === 'SELECT';

      // Allow input field shortcuts (Ctrl+Enter, etc.) but block regular keys
      if (isInput && !event.ctrlKey) {
        return;
      }

      // Block shortcuts during certain states
      if (checkoutDialogOpen || showHelpModal || processingSale) {
        return;
      }

      // Don't interfere with rapid scanner input - detect if this might be scanner input
      const now = event.timeStamp;
      const timeSinceLastKey = now - lastKeyTime;
      const isRapidInput = timeSinceLastKey < 50; // Less than 50ms between keys suggests scanner
      
      // If it's rapid input and alphanumeric, let the QR scanner handle it
      if (isRapidInput && /^[a-zA-Z0-9{"}]/.test(event.key)) {
        lastKeyTime = now;
        return; // Don't handle this key, let QR scanner process it
      }

      switch (event.key) {
        case 'F3':
          event.preventDefault();
          if (mode === 'products') {
            focusSearchInput();
          }
          break;

        case 'f':
          if (event.ctrlKey) {
            event.preventDefault();
            if (mode === 'products') {
              focusSearchInput();
            }
          }
          break;

        case 'F9':
          event.preventDefault();
          if (cartItems.length > 0) {
            handleCheckout();
          }
          break;

        case 'Enter':
          if (event.ctrlKey && cartItems.length > 0) {
            event.preventDefault();
            handleCheckout();
          }
          break;

        case 'Delete':
          if (event.ctrlKey && cartItems.length > 0) {
            event.preventDefault();
            clearCart();
          }
          break;

        case 'F2':
          event.preventDefault();
          setMode(prev => {
            if (prev === 'products') return 'manual';
            if (prev === 'manual') return 'repairs';
            return 'products';
          });
          break;

        case 'F1':
          event.preventDefault();
          setShowHelpModal(true);
          break;

        default:
          // Only trigger search auto-focus for single character keys
          // when in products mode and it's NOT rapid scanner input
          if (mode === 'products' && !event.ctrlKey && 
              /^[a-zA-Z0-9]$/.test(event.key) && !isInput && !isRapidInput) {
            // Add a small delay to ensure this isn't part of a scanner sequence
            setTimeout(() => {
              const timeSinceThisKey = Date.now() - now;
              if (timeSinceThisKey < 100) { // If less than 100ms has passed, likely single keypress
                focusSearchInput();
              }
            }, 100);
          }
          break;
      }

      lastKeyTime = now;
    };

    let lastKeyTime = 0;
    window.addEventListener('keydown', handleKeyDown, false); // Use bubbling phase instead of capture

    return () => {
      window.removeEventListener('keydown', handleKeyDown, false);
    };
  }, [
    isTypingInInput, 
    checkoutDialogOpen, 
    showHelpModal, 
    processingSale, 
    cartItems.length, 
    mode
  ]);

  useEffect(() => {
    const activateCamera = () => {
      if (qrScannerActive) {
        const qrScannerElement = document.querySelector('.qr-scanner-container video');
        if (qrScannerElement) {
          const startButton = document.querySelector('.qr-scanner-container button') as HTMLButtonElement;
          if (startButton) {
            try {
              startButton.click();
            } catch (err) {
              console.warn('Could not activate QR scanner:', err);
            }
          }
        }
      }
    };

    const timeoutId = setTimeout(activateCamera, 500);

    return () => {
      clearTimeout(timeoutId);

      if (!qrScannerActive) {
        const videoElements = document.querySelectorAll('.qr-scanner-container video');
        videoElements.forEach((videoElement: any) => {
          if (videoElement && videoElement.srcObject) {
            const tracks = videoElement.srcObject.getTracks();
            tracks.forEach((track: MediaStreamTrack) => {
              track.stop();
            });
            videoElement.srcObject = null;
          }
        });
      }
    };
  }, [qrScannerActive]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        setQrScannerActive(false);
      } else {
        setQrScannerActive(true);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (checkoutDialogOpen && !processingSale) {
      setTimeout(() => {
        if (completeSaleButtonRef.current) {
          completeSaleButtonRef.current.focus();
        }
      }, 100);

      const handleEnterKey = (event: KeyboardEvent) => {
        if (event.key === 'Enter' && !processingSale) {
          event.preventDefault();
          processSale();
        }
      };

      window.addEventListener('keydown', handleEnterKey);

      return () => {
        window.removeEventListener('keydown', handleEnterKey);
      };
    }
  }, [checkoutDialogOpen, processingSale]);

  const focusSearchInput = () => {
    if (mode === 'products' && searchInputRef.current) {
      searchInputRef.current.focus();
      searchInputRef.current.select();
    }
  };

  const handleInputFocus = () => setIsTypingInInput(true);
  const handleInputBlur = () => setIsTypingInInput(false);

  const cartSubtotal = cartItems.reduce((sum, item) => {
    if (item.product || item.manualItem) {
      return sum + item.subtotal;
    }
    return sum;
  }, 0);
  
  const servicesSubtotal = cartItems.reduce((sum, item) => {
    if (item.repair) {
      return sum + item.subtotal;
    }
    return sum;
  }, 0);
  
  const cartDiscount = cartItems.reduce((sum, item) => sum + item.discount, 0);
  const cartTax = 0;
  const cartTotal = cartSubtotal + servicesSubtotal - cartDiscount - manualDiscount + cartTax;

  const handleBarcodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!barcodeInput.trim()) return;

    try {
      setLoading(true);

      const response = await productsApi.getByBarcode(barcodeInput);
      const product = response.data;

      if (!product) {
        showError('Product not found. Please try again.');
        return;
      }

      if (product.stockQuantity <= 0) {
        showError('Product is out of stock.');
        return;
      }

      addToCart(product);
      setBarcodeInput('');

    } catch (err) {
      console.error('Error fetching product by barcode:', err);
      showError('Product not found or an error occurred.');
    } finally {
      setLoading(false);
      if (barcodeInputRef.current) {
        barcodeInputRef.current.focus();
      }
    }
  };

  const handleQRScanSuccess = async (qrData: any) => {
    try {
      setLoading(true);
      setScanningMessage(null);
      setScanningProduct(null);

      console.log("QR scan received:", qrData);

      if (!qrData) {
        setScanningMessage('Invalid QR data: Empty or null data received');
        return;
      }

      let product;
      let identifierType = '';

      if (qrData.barcode) {
        identifierType = 'barcode';
        console.log("Trying to fetch by barcode:", qrData.barcode);
        try {
          const response = await productsApi.getByBarcode(qrData.barcode);
          if (response.data) {
            product = response.data;
            console.log("Product found by barcode:", product);
          }
        } catch (error) {
          console.warn("Barcode lookup failed:", error);
        }
      }

      if (!product && qrData.id) {
        identifierType = 'id';
        console.log("Trying to fetch by ID:", qrData.id);
        try {
          const response = await productsApi.getById(qrData.id);
          if (response.data) {
            product = response.data;
            console.log("Product found by ID:", product);
          }
        } catch (error) {
          console.warn("ID lookup failed:", error);
        }
      }

      if (!product && qrData.name) {
        identifierType = 'name';
        console.log("Trying to search by name:", qrData.name);
        try {
          const response = await productsApi.getAll({ search: qrData.name });
          if (response.data && response.data.products && response.data.products.length > 0) {
            product = response.data.products[0];
            console.log("Product found by name search:", product);
          }
        } catch (error) {
          console.warn("Name search failed:", error);
        }
      }

      if (!product) {
        setScanningMessage(`Product not found. Could not find product with ${identifierType || 'provided data'}.`);
        return;
      }

      if (product.stockQuantity <= 0) {
        setScanningMessage('Product is out of stock.');
        return;
      }

      setScanningProduct(product);
      addToCart(product);
      setScanningMessage(`Added ${product.name} to cart!`);

      // Clear any success message after 3 seconds
      setTimeout(() => {
        setScanningMessage(null);
        setScanningProduct(null);
      }, 3000);

    } catch (err) {
      console.error('Error processing QR code:', err);
      setScanningMessage('Error processing QR code. Please try again or enter the barcode manually.');
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (product: Product) => {
    setCartItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(
        item => item.product && item.product.id === product.id
      );

      if (existingItemIndex >= 0) {
        const currentItem = prevItems[existingItemIndex];

        if (currentItem.product && currentItem.quantity >= currentItem.product.stockQuantity) {
          showError('Cannot add more of this product. Stock limit reached.');
          return prevItems;
        }

        const newQuantity = currentItem.quantity + 1;
        const updatedItems = [...prevItems];
        updatedItems[existingItemIndex] = {
          ...currentItem,
          quantity: newQuantity,
          subtotal: newQuantity * (currentItem.product?.price || currentItem.price || 0)
        };

        return updatedItems;
      } else {
        return [
          ...prevItems,
          {
            product,
            quantity: 1,
            subtotal: product.price,
            discount: 0,
          },
        ];
      }
    });
  };

  const addServiceToCart = async (serviceName: string, servicePrice: number, quantity: number) => {
    try {
      // Create a quick service repair job
      const quickServiceData = {
        customer: {
          name: customerName || 'Walk-in Customer',
          phone: customerPhone || 'N/A'
        },
        description: serviceName,
        jobType: 'quick_service',
        status: 'billed', // Quick services are billed when added to cart
        estimatedCost: servicePrice * quantity,
        totalCost: servicePrice * quantity,
        services: [{
          name: serviceName,
          price: servicePrice * quantity
        }]
      };

      const response = await repairJobsApi.create(quickServiceData);
      const createdJob = response.data;

      // Also add to cart for immediate billing
      const newService: CartItem = {
        repair: {
          _id: createdJob._id,
          title: serviceName,
          description: 'Quick service',
          price: servicePrice,
          isActive: true
        },
        repairJobId: createdJob._id,
        quantity: quantity,
        subtotal: servicePrice * quantity,
        discount: 0,
      };

      setCartItems(prev => [...prev, newService]);
      showSuccess(`Quick service "${serviceName}" added to cart and job created`);
    } catch (error) {
      console.error('Error creating quick service:', error);
      showError('Failed to create quick service job');
    }
  };

  const updateCartItemQuantity = (index: number, newQuantity: number) => {
    setCartItems(prevItems => {
      const updatedItems = [...prevItems];
      const item = updatedItems[index];

      if (newQuantity <= 0) {
        updatedItems.splice(index, 1);
        return updatedItems;
      }

      if (item.product && newQuantity > item.product.stockQuantity) {
        showError('Cannot add more of this product. Stock limit reached.');
        return prevItems;
      }

      item.quantity = newQuantity;
      item.subtotal = newQuantity * (item.product?.price || item.price || 0);

      return updatedItems;
    });
  };

  const handleItemDiscountChange = (index: number, discount: number) => {
    setCartItems(prevItems => {
      const updatedItems = [...prevItems];
      const item = updatedItems[index];

      const maxDiscount = item.subtotal;
      const validDiscount = isNaN(discount) || discount < 0 ? 0 :
        discount > maxDiscount ? maxDiscount : discount;

      item.discount = validDiscount;
      return updatedItems;
    });
  };

  const removeCartItem = (index: number) => {
    setCartItems(prevItems => {
      const updatedItems = [...prevItems];
      updatedItems.splice(index, 1);
      return updatedItems;
    });
  };

  const clearCart = () => {
    setCartItems([]);
  };

  const handleCheckout = async () => {
    if (cartItems.length === 0) {
      showError('Cart is empty. Please add items before checkout.');
      return;
    }

    setCheckoutDialogOpen(true);
  };

  const directPrintReceipt = async (receiptToPrint: ReceiptData) => {
    try {
      setPrintingReceipt(true);

      const currentShop = user?.shopId ? { name: user.shopId.name } : null;
      const shopName = currentShop?.name || "Bike Shop";
      const shopPhone = user?.shopId?.phone || "";
      const shopAddress = user?.shopId?.address || "";

  const printIframe = document.createElement('iframe');
  printIframe.style.position = 'fixed';
  printIframe.style.right = '0';
  printIframe.style.bottom = '0';
  printIframe.style.width = '0';
  printIframe.style.height = '0';
  printIframe.style.border = 'none';
  printIframe.style.background = 'transparent';
  printIframe.style.zIndex = '9999';
  printIframe.setAttribute('id', 'receipt-print-preview');
  document.body.appendChild(printIframe);

      const safeItems = receiptToPrint.items.map(item => ({
        name: item.name || 'Unnamed Item',
        quantity: item.quantity || 1,
        price: typeof item.price === 'number' ? item.price : 0,
        total: typeof item.total === 'number' ? item.total : 0
      }));

      // Render ReceiptHtml to HTML string for printing
      const receiptHtmlString = ReactDOMServer.renderToStaticMarkup(
        <ReceiptHtml shopName={shopName} shopAddress={shopAddress} shopPhone={shopPhone} receiptData={receiptToPrint} />
      );
      const printCss = `<style>
        @media print {
          body { margin: 0; }
        }
        body { background: #fff; margin: 0; padding: 0; }
      </style>`;
      // Only print the receipt content, no extra title or date
      const fullHtml = `<!DOCTYPE html><html><head>${printCss}</head><body>${receiptHtmlString}</body></html>`;

      const iframeDoc = printIframe.contentDocument || printIframe.contentWindow?.document;
      if (iframeDoc) {
        iframeDoc.open();
        iframeDoc.write(fullHtml);
        iframeDoc.close();

        // Immediately trigger print, no preview
        try {
          printIframe.contentWindow?.focus();
          printIframe.contentWindow?.print();
          setTimeout(() => {
            if (document.body.contains(printIframe)) {
              document.body.removeChild(printIframe);
              setPrintingReceipt(false);
            }
          }, 2000);
        } catch (err) {
          console.error('Error during iframe print:', err);
          document.body.removeChild(printIframe);
          setPrintingReceipt(false);
        }
      } else {
        throw new Error('Could not access iframe document');
      }
    } catch (error) {
      console.error('Error printing receipt:', error);
      setPrintingReceipt(false);
    }
  };

  const processSale = async () => {
    try {
      setProcessingSale(true);

      const saleItems = cartItems.map(item => {
        if (item.product) {
          // Debug logging
          console.log('Processing product for sale:', {
            name: item.product.name,
            costPrice: item.product.costPrice,
            price: item.product.price
          });
          
          return {
            productId: item.product.id,
            quantity: item.quantity,
            price: item.product.price,
            costPrice: item.product.costPrice || 0,
            discount: item.discount || 0
          };
        } else if (item.repair) {
          // Handle services properly with isService flag
          return {
            isService: true,
            name: item.repair.title,
            quantity: item.quantity,
            price: item.repair.price,
            costPrice: item.costPrice || 0,
            discount: item.discount || 0,
            repairJobId: item.repairJobId
          };
        } else {
          return {
            isManual: true,
            name: item.name || 'Manual Item',
            quantity: item.quantity,
            price: item.price || 0,
            discount: item.discount || 0
          };
        }
      });

      const sale: Sale = {
        items: saleItems,
        subtotal: cartSubtotal, // Only products subtotal
        discount: manualDiscount,
        tax: cartTax,
        total: cartTotal, // Total includes both products and services
        paymentMethod,
        customerName: customerName.trim() || undefined,
        customerPhone: customerPhone.trim() || undefined,
        user: user?.id
      };

      const response = await salesApi.create(sale);

      if (response.data) {
        const receiptDataForPrint = {
          id: response.data._id || response.data.id,
          invoiceNumber: response.data.invoiceNumber || `INV-${Date.now()}`,
          date: new Date().toLocaleString(),
          customer: customerName || 'Walk-in Customer',
          cashier: user?.name || user?.username || 'Staff',
          items: cartItems.map(item => ({
            name: item.product ? item.product.name : 
                  item.repair ? item.repair.title : 
                  (item.name || 'Manual Item'),
            quantity: item.quantity,
            price: item.product ? item.product.price : 
                   item.repair ? item.repair.price : 
                   (item.price || 0),
            total: (item.quantity * (item.product ? item.product.price : 
                                   item.repair ? item.repair.price : 
                                   (item.price || 0))) - item.discount
          })),
          subtotal: cartSubtotal, // Only products subtotal
          servicesSubtotal: servicesSubtotal, // Services subtotal
          discount: cartDiscount + manualDiscount,
          tax: cartTax,
          total: cartTotal, // Total includes both products and services
          paymentMethod: paymentMethod
        };

        setCheckoutDialogOpen(false);
        setCartItems([]);
        setManualDiscount(0);
        setCustomerName('');
        setCustomerPhone('');
        setPaymentMethod('cash');

        showSuccess('Sale completed successfully!');

        // Update repair job status to 'billed' for quick services
        const quickServiceJobs = cartItems.filter(item => item.repair && item.repair._id);
        for (const serviceItem of quickServiceJobs) {
          try {
            await repairJobsApi.update(serviceItem.repair!._id, { 
              status: 'billed',
              saleId: response.data._id 
            });
          } catch (error) {
            console.error('Error updating repair job status:', error);
          }
        }

        // Refresh products to update stock quantities
        await refreshProducts();

        directPrintReceipt(receiptDataForPrint);
      }
    } catch (err: any) {
      console.error('Error processing sale:', err);
      showError(`Failed to process sale: ${err?.response?.data?.message || err?.message || 'Unknown error'}`);
    } finally {
      setProcessingSale(false);
    }
  };

  const handleServiceSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!serviceName.trim()) {
      showError('Service name is required');
      return;
    }

    const price = parseFloat(servicePrice);
    if (isNaN(price) || price <= 0) {
      showError('Please enter a valid service price');
      return;
    }

    const quantity = parseInt(serviceQuantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      showError('Please enter a valid quantity');
      return;
    }

    addServiceToCart(serviceName.trim(), price, quantity);

    setServiceName('');
    setServicePrice('');
    setServiceQuantity('1');
    showSuccess('Service added to cart');
  };

  const handleManualItemSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!manualItemName.trim()) {
      showError('Item name is required');
      return;
    }

    const price = parseFloat(manualItemPrice);
    if (isNaN(price) || price <= 0) {
      showError('Please enter a valid price');
      return;
    }

    const quantity = parseInt(manualItemQuantity, 10);
    if (isNaN(quantity) || quantity <= 0) {
      showError('Please enter a valid quantity');
      return;
    }

    const newItem: CartItem = {
      manualItem: true,
      name: manualItemName.trim(),
      price: price,
      quantity: quantity,
      subtotal: price * quantity,
      discount: 0
    };

    setCartItems(prev => [...prev, newItem]);

    setManualItemName('');
    setManualItemPrice('');
    setManualItemQuantity('1');
    showSuccess('Manual item added to cart');
  };

  const handleCategoryChange = (categoryId: string) => {
    setSelectedCategory(categoryId);
    setSearchQuery('');
  };

  const columns: Column<Product>[] = useMemo(
    () => [
      {
        Header: 'Product Details',
        accessor: 'name',
        Cell: ({ row }: { row: any }) => (
          <div className="product-cell">
            <div className="product-main">
              <div className="product-title" title={row.original.name}>
                {row.original.name}
              </div>
              {row.original.description && (
                <div className="product-desc" title={row.original.description}>
                  {row.original.description}
                </div>
              )}
              <div className="product-meta">
                {row.original.Category && (
                  <span className="category-tag">
                    {row.original.Category.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        ),
      },
      {
        Header: 'Price',
        accessor: 'price',
        Cell: ({ value }: { value: number }) => (
          <div className="price-cell">
            <span className="price-amount">Rs. {value}</span>
          </div>
        ),
      },
      {
        Header: 'Stock',
        accessor: 'stockQuantity',
        Cell: ({ value }: { value: number }) => (
          <div className="stock-cell">
            <Badge 
              bg={value > 10 ? "success" : value > 0 ? "warning" : "danger"}
              className="stock-badge"
            >
              {value}
            </Badge>
          </div>
        ),
      },
    ],
    []
  );

  const tableInstance = useTable(
    {
      columns,
      data: filteredProducts,
      initialState: { pageIndex: 0, pageSize } as any,
    },
    usePagination
  ) as TableInstance<Product> & UsePaginationInstanceProps<Product> & {
    state: UsePaginationState<Product>;
  };

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    page,
    prepareRow,
    canPreviousPage,
    canNextPage,
    pageOptions,
    pageCount,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize: setTablePageSize,
    state: { pageIndex },
  } = tableInstance;

  useEffect(() => {
    setTablePageSize(pageSize);
  }, [pageSize, setTablePageSize]);

  return (
    <Container fluid className="py-4 px-3 px-md-4 d-flex flex-column" style={{ minHeight: "calc(100vh - 56px)" }}>
      <Row className="mb-3">
        <Col>
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center gap-3">
              <h4 className="fw-bold mb-0">Point of sale</h4>
              <div className="d-none d-lg-block">
                <small className="text-muted">
                  <kbd>F1</kbd> Help • <kbd>Ctrl+F</kbd> Search • <kbd>F9</kbd> Checkout • <kbd>F2</kbd> Toggle Mode • <kbd>Ctrl+Delete</kbd> Clear Cart
                </small>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2">
              <Badge
                bg="success"
                className="d-flex align-items-center gap-1"
                style={{ fontSize: '0.8rem', padding: '0.5rem 0.75rem' }}
              >
                <i className="bi bi-qr-code-scan"></i>
                <span className="d-none d-sm-inline">QR Scanner Active</span>
                <span className="d-sm-none">QR ON</span>
              </Badge>
            </div>
          </div>
        </Col>
      </Row>

      <Row className="flex-grow-1 g-0">
        <Col xs={12} className="d-flex flex-column bg-body-tertiary">
          <div style={{ display: 'none' }}>
            <QRScanner
              onScanSuccess={handleQRScanSuccess}
              onScanError={(error) => {
                console.warn('QR Scanner error:', error);
                setScanningMessage(`Scanner error: ${error}`);
              }}
              autoStart={true}
            />
          </div>
          
          {scanningMessage && (
            <div className="alert alert-info alert-dismissible fade show shadow-sm" role="alert">
              <div className="d-flex align-items-center">
                <i className="bi bi-qr-code-scan me-2"></i>
                <div>{scanningMessage}</div>
              </div>
              <button 
                type="button" 
                className="btn-close"
                onClick={() => setScanningMessage(null)}
              ></button>
            </div>
          )}
          
          <div className="d-flex flex-lg-row flex-column">
            <Row className="w-100 g-1">
              <Col xs={12} lg={8} className="products-section">
                <div className="d-flex flex-column">
                  <Card className="shadow-sm mb-3 border-0">
                    <Card.Body className="pb-2">
                      <Row className="mb-3">
                        <Col md={3} className="mb-3 mb-md-0">
                          <Form.Select
                            value={selectedCategory}
                            onChange={(e) => handleCategoryChange(e.target.value)}
                            className="shadow-sm"
                          >
                            <option value="">All Categories</option>
                            {categories.map((category) => (
                              <option key={category._id} value={category._id}>
                                {category.name}
                              </option>
                            ))}
                          </Form.Select>
                        </Col>
                        <Col md={6} className="mb-3 mb-md-0">
                          <div className="btn-group w-100">
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Switch to Products (F2)</Tooltip>}
                            >
                              <Button 
                                variant={mode === "products" ? "primary" : "outline-primary"}
                                onClick={() => setMode('products')}
                                className="flex-grow-1 rounded-start"
                              >
                                <i className="bi bi-grid me-1"></i> Products
                              </Button>
                            </OverlayTrigger>
                            <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Switch to Manual Entry (F2)</Tooltip>}
                            >
                              <Button 
                                variant={mode === "manual" ? "primary" : "outline-primary"}
                                onClick={() => setMode('manual')}
                                className="flex-grow-1"
                              >
                                <i className="bi bi-pencil-square me-1"></i> Manual Entry
                              </Button>
                            </OverlayTrigger>
                             <OverlayTrigger
                              placement="top"
                              overlay={<Tooltip>Switch to Quick Services (F2)</Tooltip>}
                            >
                              <Button 
                                variant={mode === "repairs" ? "primary" : "outline-primary"}
                                onClick={() => setMode('repairs')}
                                className="flex-grow-1 rounded-end"
                              >
                                <i className="bi bi-tools me-1"></i> Quick Services
                              </Button>
                            </OverlayTrigger>
                          </div>
                        </Col>
                        <Col md={3}>
                          <OverlayTrigger
                            placement="top"
                            overlay={<Tooltip>Search Products (Ctrl+F or F3)</Tooltip>}
                          >
                            <InputGroup className="search-bar shadow-sm rounded">
                              <InputGroup.Text className="bg-white border-end-0">
                                <>{BsSearch({ size: 16 })}</>
                              </InputGroup.Text>
                              <Form.Control
                                ref={searchInputRef}
                                type="text"
                                placeholder="Search Products (Ctrl+F)"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onFocus={handleInputFocus}
                                onBlur={handleInputBlur}
                                className="border-start-0"
                              />
                              {searchQuery && (
                                <Button variant="outline-secondary" onClick={() => setSearchQuery('')} className="border-start-0">
                                  <>{BsX({ size: 16 })}</>
                                </Button>
                              )}
                            </InputGroup>
                          </OverlayTrigger>
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                  
                  <Card className="shadow-sm border-0 products-card">
                    <div className="products-container">
                      {mode === 'products' ? (
                        <div className="products-table-container">
                          {/* Table Controls */}
                          <div className="d-flex justify-content-between align-items-center p-3 border-bottom">
                            <div className="d-flex align-items-center gap-2">
                              <span className="text-muted small">Show</span>
                              <Form.Select
                                size="sm"
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                                style={{ width: 'auto' }}
                              >
                                <option value={5}>5</option>
                                <option value={10}>10</option>
                                <option value={25}>25</option>
                                <option value={50}>50</option>
                              </Form.Select>
                              <span className="text-muted small">entries</span>
                            </div>
                          </div>

                          <div className="table-responsive products-table">
                            <table {...getTableProps()} className="table table-hover mb-0 products-data-table">
                              <thead className="table-light sticky-top">
                                {headerGroups.map((headerGroup: HeaderGroup<Product>, headerIndex: number) => (
                                  <tr {...headerGroup.getHeaderGroupProps()} key={headerIndex}>
                                    {headerGroup.headers.map((column: any, columnIndex: number) => (
                                      <th {...column.getHeaderProps()} scope="col" key={columnIndex} className={`table-header-${columnIndex}`}>
                                        {column.render('Header')}
                                      </th>
                                    ))}
                                  </tr>
                                ))}
                              </thead>
                              <tbody {...getTableBodyProps()}>
                                {page.map((row: any, rowIndex: number) => {
                                  prepareRow(row);
                                  const product = row.original;
                                  return (
                                    <tr 
                                      {...row.getRowProps()}
                                      key={product.id}
                                      className={`clickable-row product-row ${product.stockQuantity <= 0 ? 'out-of-stock' : ''}`}
                                      onClick={() => {
                                        if (product.stockQuantity > 0) {
                                          addToCart(product);
                                        } else {
                                          showError('Product is out of stock.');
                                        }
                                      }}
                                      style={{ cursor: product.stockQuantity > 0 ? 'pointer' : 'not-allowed' }}
                                    >
                                      {row.cells.map((cell: any, cellIndex: number) => (
                                        <td {...cell.getCellProps()} key={cellIndex} className={`table-cell-${cellIndex}`}>
                                          {cell.render('Cell')}
                                        </td>
                                      ))}
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Pagination */}
                          {pageCount > 1 && (
                            <div className="d-flex justify-content-between align-items-center p-3 border-top">
                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => previousPage()}
                                disabled={!canPreviousPage}
                                className="d-flex align-items-center gap-1"
                              >
                                <i className="bi bi-chevron-left" style={{fontSize: '14px'}}></i>
                                Previous
                              </Button>

                              <Pagination className="mb-0" size="sm">
                                {/* First page */}
                                {pageIndex > 2 && (
                                  <>
                                    <Pagination.Item onClick={() => gotoPage(0)}>
                                      1
                                    </Pagination.Item>
                                    {pageIndex > 3 && <Pagination.Ellipsis />}
                                  </>
                                )}

                                {/* Previous page */}
                                {pageIndex > 0 && (
                                  <Pagination.Item onClick={() => gotoPage(pageIndex - 1)}>
                                    {pageIndex}
                                  </Pagination.Item>
                                )}

                                {/* Current page */}
                                <Pagination.Item active>
                                  {pageIndex + 1}
                                </Pagination.Item>

                                {/* Next page */}
                                {pageIndex < pageCount - 1 && (
                                  <Pagination.Item onClick={() => gotoPage(pageIndex + 1)}>
                                    {pageIndex + 2}
                                  </Pagination.Item>
                                )}

                                {/* Last page */}
                                {pageIndex < pageCount - 3 && (
                                  <>
                                    {pageIndex < pageCount - 4 && <Pagination.Ellipsis />}
                                    <Pagination.Item onClick={() => gotoPage(pageCount - 1)}>
                                      {pageCount}
                                    </Pagination.Item>
                                  </>
                                )}
                              </Pagination>

                              <Button
                                variant="outline-secondary"
                                size="sm"
                                onClick={() => nextPage()}
                                disabled={!canNextPage}
                                className="d-flex align-items-center gap-1"
                              >
                                Next
                                <i className="bi bi-chevron-right" style={{fontSize: '14px'}}></i>
                              </Button>
                            </div>
                          )}
                        </div>
                      ) : mode === 'repairs' ? (
                        <div className="services-entry-container">
                          <div className="p-4 border-bottom bg-light">
                            <h6 className="mb-0 text-primary d-flex align-items-center">
                              <i className="bi bi-tools me-2"></i>
                              Quick Services - Immediate Billing
                            </h6>
                            <small className="text-muted">For simple services that can be completed immediately (oil change, tire inflation, etc.)</small>
                            <div className="mt-2">
                              <small className="text-info">
                                <i className="bi bi-info-circle me-1"></i>
                                For complex repairs that need tracking, use <strong>Repair Jobs</strong> instead
                              </small>
                            </div>
                          </div>
                          
                          <div className="p-4">
                            <Form onSubmit={handleServiceSubmit} className="service-entry-form">
                              <Row className="g-3">
                                <Col xs={12}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">Service Name</Form.Label>
                                    <Form.Control
                                      type="text"
                                      placeholder="Enter service name (e.g., Bike Tune-up, Tire Repair)"
                                      value={serviceName}
                                      onChange={(e) => setServiceName(e.target.value)}
                                      onFocus={handleInputFocus}
                                      onBlur={handleInputBlur}
                                      required
                                    />
                                  </Form.Group>
                                </Col>
                                
                                <Col xs={12} sm={6}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">Service Price (Rs.)</Form.Label>
                                    <InputGroup>
                                      <InputGroup.Text>Rs.</InputGroup.Text>
                                      <Form.Control
                                        type="number"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        value={servicePrice}
                                        onChange={(e) => setServicePrice(e.target.value)}
                                        onFocus={handleInputFocus}
                                        onBlur={handleInputBlur}
                                        required
                                      />
                                    </InputGroup>
                                  </Form.Group>
                                </Col>
                                
                                <Col xs={12} sm={6}>
                                  <Form.Group>
                                    <Form.Label className="fw-semibold">Quantity</Form.Label>
                                    <Form.Control
                                      type="number"
                                      min="1"
                                      value={serviceQuantity}
                                      onChange={(e) => setServiceQuantity(e.target.value)}
                                      onFocus={handleInputFocus}
                                      onBlur={handleInputBlur}
                                      required
                                    />
                                  </Form.Group>
                                </Col>
                                
                                <Col xs={12}>
                                  <div className="d-grid">
                                    <Button 
                                      type="submit" 
                                      variant="primary" 
                                      size="lg"
                                      className="d-flex align-items-center justify-content-center gap-2"
                                    >
                                      <i className="bi bi-plus-circle"></i>
                                      Add Service to Cart
                                    </Button>
                                  </div>
                                </Col>
                              </Row>
                            </Form>
                            
                            <div className="mt-4 p-3 bg-info bg-opacity-10 rounded">
                              <h6 className="text-info mb-2">
                                <i className="bi bi-info-circle me-2"></i>
                                Service Entry Tips
                              </h6>
                              <ul className="mb-0 small text-muted">
                                <li>Services are calculated separately from product revenue</li>
                                <li>Enter clear service descriptions for better record keeping</li>
                                <li>Price should include all service charges</li>
                              </ul>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center my-5 py-4 rounded bg-light">
                          <div className="mb-3">
                            <i className="bi bi-pencil-square fs-1 text-primary"></i>
                          </div>
                            
                        <Col md={6} className="mx-auto ">
                          
                            <Form onSubmit={handleManualItemSubmit} className="manual-entry-form">
                              <InputGroup className="mb-2">
                                <InputGroup.Text className="bg-white">
                                  <i className="bi bi-tag"></i>
                                </InputGroup.Text>
                                <Form.Control
                                  type="text"
                                  placeholder="Item name"
                                  value={manualItemName}
                                  onChange={(e) => setManualItemName(e.target.value)}
                                  onFocus={handleInputFocus}
                                  onBlur={handleInputBlur}
                                  required
                                  className="border-start-0"
                                />
                              </InputGroup>
                              <Row>
                                <Col xs={12} sm={7} className="mb-2 mb-sm-0">
                                  <InputGroup>
                                    <InputGroup.Text className="bg-white">Rs.</InputGroup.Text>
                                    <Form.Control
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      placeholder="Price"
                                      value={manualItemPrice}
                                      onChange={(e) => setManualItemPrice(e.target.value)}
                                      onFocus={handleInputFocus}
                                      onBlur={handleInputBlur}
                                      required
                                      className="border-start-0"
                                      style={{ height: '42px' }}
                                    />
                                  </InputGroup>
                                </Col>
                                <Col xs={12} sm={5}>
                                  <InputGroup>
                                    <InputGroup.Text className="bg-white">
                                      <i className="bi bi-123"></i>
                                    </InputGroup.Text>
                                    <Form.Control
                                      type="number"
                                      min="1"
                                      placeholder="Qty"
                                      value={manualItemQuantity}
                                      onChange={(e) => setManualItemQuantity(e.target.value)}
                                      onFocus={handleInputFocus}
                                      onBlur={handleInputBlur}
                                      required
                                      className="border-start-0"
                                    />
                                  </InputGroup>
                                </Col>
                              </Row>
                              <Button type="submit" variant="success" className="w-50 rounded-pill m-3 text-center">
                                <>{BsPlus({ size: 16, className: "me-1" })}</>Add to Cart
                              </Button>
                            </Form>
                         
                        </Col>
                        </div>
                      )}
                    </div>
                  </Card>
                </div>
              </Col>

              <Col xs={12} lg={4} className="cart-section">
                <Card className="shadow-sm border-0 cart-card">
                  <Card.Header className="bg-primary text-white py-3">
                    <h5 className="mb-0 d-flex align-items-center">
                      <i className="bi bi-cart me-2"></i>
                      Shopping Cart
                      {cartItems.length > 0 && (
                        <Badge bg="light" text="dark" className="ms-2 rounded-pill">{cartItems.length}</Badge>
                      )}
                    </h5>
                  </Card.Header>
                  
                  <div className="cart-items-container">
                    <ListGroup variant="flush" className="cart-items">
                      {cartItems.length === 0 ? (
                        <ListGroup.Item className="text-center py-5">
                          <div className="empty-cart-placeholder">
                            <div className="text-muted mb-3">
                              <i className="bi bi-cart fs-1"></i>
                            </div>
                            <p className="mb-1 fw-medium">Your cart is empty</p>
                            <small className="text-muted">Scan or search for products to add</small>
                          </div>
                        </ListGroup.Item>
                      ) : (
                        cartItems.map((item, index) => (
                          <ListGroup.Item key={item.product?.id || item.repair?._id || `manual-${index}`} className="py-3 cart-item">
                            <div className="d-flex align-items-start mb-2">
                              <div className="flex-grow-1">
                                <h6 className="mb-0 d-flex align-items-center">
                                  {item.manualItem && (
                                    <span className="badge bg-info text-dark rounded-pill me-2" style={{fontSize: '0.7rem'}}>
                                      Manual
                                    </span>
                                  )}
                                  {item.repair && (
                                    <span className="badge bg-warning text-dark rounded-pill me-2" style={{fontSize: '0.7rem'}}>
                                      Repair
                                    </span>
                                  )}
                                  {item.product ? item.product.name : 
                                   item.repair ? item.repair.title : 
                                   item.name}
                                </h6>
                                <div className="d-flex justify-content-between mt-1">
                                  <small className="text-muted">
                                    Rs. {item.product ? item.product.price.toFixed(2) : 
                                         item.repair ? item.repair.price.toFixed(2) : 
                                         item.price?.toFixed(2)}
                                  </small>
                                  <span className="fw-bold text-primary">
                                    Rs. {(item.subtotal - item.discount).toFixed(2)}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="d-flex align-items-center quantity-control">
                                <Button
                                  variant="light"
                                  size="sm"
                                  className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                                  style={{ width: '28px', height: '28px' }}
                                  onClick={() => updateCartItemQuantity(index, item.quantity - 1)}
                                >
                                  <>{BsDash({ size: 16 })}</>
                                </Button>
                                <Form.Control
                                  type="text"
                                  min="1"
                                  max={item.product?.stockQuantity || 9999}
                                  className="mx-2 text-center"
                                  value={tempQuantities[index] !== undefined ? tempQuantities[index] : item.quantity.toString()}
                                  onChange={(e) => {
                                    const newTempQuantities = { ...tempQuantities };
                                    newTempQuantities[index] = e.target.value;
                                    setTempQuantities(newTempQuantities);
                                    
                                    if (e.target.value !== '') {
                                      const newValue = parseInt(e.target.value, 10);
                                      if (!isNaN(newValue)) {
                                        updateCartItemQuantity(index, newValue);
                                      }
                                    }
                                  }}
                                  onFocus={handleInputFocus}
                                  onBlur={(e) => {
                                    handleInputBlur();
                                    if (e.target.value === '' || isNaN(parseInt(e.target.value, 10))) {
                                      updateCartItemQuantity(index, 1);
                                    }
                                    
                                    const newTempQuantities = { ...tempQuantities };
                                    delete newTempQuantities[index];
                                    setTempQuantities(newTempQuantities);
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (e.currentTarget.value === '' || isNaN(parseInt(e.currentTarget.value, 10))) {
                                        updateCartItemQuantity(index, 1);
                                      }
                                      e.currentTarget.blur();
                                      
                                      const newTempQuantities = { ...tempQuantities };
                                      delete newTempQuantities[index];
                                      setTempQuantities(newTempQuantities);
                                    }
                                  }}
                                  style={{ width: '50px', textAlign: 'center', padding: '2px', height: '28px' }}
                                />
                                <Button
                                  variant="light"
                                  size="sm"
                                  className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                                  style={{ width: '28px', height: '28px' }}
                                  onClick={() => updateCartItemQuantity(index, item.quantity + 1)}
                                >
                                  <>{BsPlus({ size: 16 })}</>
                                </Button>
                              </div>
                              
                              <div className="d-flex align-items-center gap-2">
                                <InputGroup size="sm" className="cart-discount-input">
                                  <InputGroup.Text className="py-0 px-2 bg-light" style={{fontSize: '0.75rem'}}>Discount</InputGroup.Text>
                                  <Form.Control
                                    type="number"
                                    value={item.discount}
                                    onChange={(e) => handleItemDiscountChange(index, parseFloat(e.target.value))}
                                    onFocus={handleInputFocus}
                                    onBlur={handleInputBlur}
                                    style={{ width: '70px', height: '28px', fontSize: '0.85rem' }}
                                  />
                                </InputGroup>
                                <Button
                                  variant="outline-danger"
                                  size="sm"
                                  className="rounded-circle p-1 d-flex align-items-center justify-content-center"
                                  style={{ width: '28px', height: '28px' }}
                                  onClick={() => removeCartItem(index)}
                                >
                                  <>{BsTrash({ size: 14 })}</>
                                </Button>
                              </div>
                            </div>
                          </ListGroup.Item>
                        ))
                      )}
                    </ListGroup>
                  </div>
                  
                  <Card.Footer className="bg-white py-3">
                    <div className="mb-3">
                      <div className="d-flex justify-content-between mb-2">
                        <span className="text-muted">Products Subtotal:</span>
                        <span>Rs. {cartSubtotal.toFixed(2)}</span>
                      </div>
                      
                      {servicesSubtotal > 0 && (
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted">Services Subtotal:</span>
                          <span>Rs. {servicesSubtotal.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="d-flex justify-content-between mb-2 align-items-center">
                        <span className="text-muted">Additional Discount:</span>
                        <InputGroup size="sm" style={{ maxWidth: "140px" }}>
                          <InputGroup.Text className="bg-light">Rs.</InputGroup.Text>
                          <Form.Control
                            type="number"
                            value={manualDiscount}
                            onChange={(e) => {
                              const value = parseFloat(e.target.value);
                              const maxDiscount = cartSubtotal + servicesSubtotal - cartDiscount;
                              if (isNaN(value) || value < 0) {
                                setManualDiscount(0);
                              } else if (value > maxDiscount) {
                                setManualDiscount(maxDiscount);
                              } else {
                                setManualDiscount(value);
                              }
                            }}
                            onFocus={handleInputFocus}
                            onBlur={handleInputBlur}
                          />
                        </InputGroup>
                      </div>
                      
                      <div className="d-flex justify-content-between mb-2 text-primary">
                        <span>Total Discount:</span>
                        <span>-Rs. {(cartDiscount + manualDiscount).toFixed(2)}</span>
                      </div>
                      
                      {cartTax > 0 && (
                        <div className="d-flex justify-content-between mb-2">
                          <span className="text-muted">Tax:</span>
                          <span>Rs. {cartTax.toFixed(2)}</span>
                        </div>
                      )}
                      
                      <div className="d-flex justify-content-between pt-3 mt-2 border-top">
                        <h5 className="mb-0">Total:</h5>
                        <h5 className="mb-0 text-primary">Rs. {cartTotal.toFixed(2)}</h5>
                      </div>
                    </div>
                    
                    <div className="d-flex flex-wrap justify-content-between gap-2">
                      <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>Clear Cart (Ctrl+Delete)</Tooltip>}
                      >
                        <Button
                          variant="outline-danger"
                          className="flex-1 rounded-pill"
                          onClick={clearCart}
                          disabled={cartItems.length === 0}
                        >
                          <i className="bi bi-trash me-1"></i>
                          <span className="d-inline">Clear</span>
                        </Button>
                      </OverlayTrigger>
                      
                      <OverlayTrigger
                        placement="top"
                        overlay={<Tooltip>Checkout (F9 or Ctrl+Enter)</Tooltip>}
                      >
                        <Button
                          variant="success"
                          className="flex-1 rounded-pill"
                          onClick={handleCheckout}
                          disabled={cartItems.length === 0}
                        >
                          <i className="bi bi-credit-card me-1"></i>
                          <span className="d-inline">Checkout</span>
                        </Button>
                      </OverlayTrigger>
                    </div>
                  </Card.Footer>
                </Card>
              </Col>
            </Row>
          </div>
        </Col>
      </Row>

      <Modal
        show={checkoutDialogOpen}
        onHide={() => setCheckoutDialogOpen(false)}
        backdrop="static"
        keyboard={!processingSale}
        centered
      >
        <Modal.Header closeButton={!processingSale}>
          <Modal.Title>Complete Sale</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Customer Name (Optional)</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={processingSale}
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Customer Phone (Optional)</Form.Label>
            <Form.Control
              type="text"
              placeholder="Enter customer phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={processingSale}
            />
          </Form.Group>
          
          <Form.Group className="mb-3">
            <Form.Label>Payment Method</Form.Label>
            <Form.Select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={processingSale}
            >
              <option value="cash">Cash</option>
              <option value="credit_card">Credit Card</option>
              <option value="debit_card">Debit Card</option>
              <option value="mobile_payment">Mobile Payment</option>
              <option value="other">Other</option>
            </Form.Select>
          </Form.Group>
          
          <div className="mt-4">
            <h6 className="mb-3">Order Summary</h6>
            <div className="d-flex justify-content-between mb-2">
              <span>Products Subtotal:</span>
              <span>Rs. {cartSubtotal.toFixed(2)}</span>
            </div>
            {servicesSubtotal > 0 && (
              <div className="d-flex justify-content-between mb-2">
                <span>Services Subtotal:</span>
                <span>Rs. {servicesSubtotal.toFixed(2)}</span>
              </div>
            )}
            {cartDiscount > 0 && (
              <div className="d-flex justify-content-between mb-2 text-danger">
                <span>Item Discounts:</span>
                <span>-Rs. {cartDiscount.toFixed(2)}</span>
              </div>
            )}
            {manualDiscount > 0 && (
              <div className="d-flex justify-content-between mb-2 text-danger">
                <span>Additional Discount:</span>
                <span>-Rs. {manualDiscount.toFixed(2)}</span>
              </div>
            )}
            {cartTax > 0 && (
              <div className="d-flex justify-content-between mb-2">
                <span>Tax:</span>
                <span>Rs. {cartTax.toFixed(2)}</span>
              </div>
            )}
            <div className="d-flex justify-content-between mt-3 pt-2 border-top">
              <h5 className="mb-0">Total:</h5>
              <h5 className="mb-0">Rs. {cartTotal.toFixed(2)}</h5>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={() => setCheckoutDialogOpen(false)}
            disabled={processingSale}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={processSale}
            disabled={processingSale}
            ref={completeSaleButtonRef}
          >
            {processingSale ? (
              <><Spinner animation="border" size="sm" className="me-2" /> Processing...</>
            ) : (
              'Complete Sale'
            )}
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal
        show={showHelpModal}
        onHide={() => setShowHelpModal(false)}
        size="lg"
        centered
      >
        <Modal.Header closeButton>
          <Modal.Title>
            <i className="bi bi-keyboard me-2"></i>
            Keyboard Shortcuts
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <div className="row">
            <div className="col-md-6">
              <h6 className="text-primary mb-3">
                <i className="bi bi-search me-2"></i>
                Search & Navigation
              </h6>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Focus Search</span>
                  <div>
                    <kbd className="me-1">Ctrl</kbd>+<kbd>F</kbd> or <kbd>F3</kbd>
                  </div>
                </div>
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Auto Search</span>
                  <span><small className="text-muted">Type any letter/number</small></span>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span>Switch Mode (Products/Manual/Services)</span>
                  <kbd>F2</kbd>
                </div>
              </div>

              <h6 className="text-success mb-3">
                <i className="bi bi-cart me-2"></i>
                Cart Actions
              </h6>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>Checkout</span>
                  <div>
                    <kbd>F9</kbd> or <kbd className="me-1">Ctrl</kbd>+<kbd>Enter</kbd>
                  </div>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span>Clear Cart</span>
                  <div>
                    <kbd className="me-1">Ctrl</kbd>+<kbd>Delete</kbd>
                  </div>
                </div>
              </div>
            </div>

            <div className="col-md-6">
              <h6 className="text-info mb-3">
                <i className="bi bi-qr-code-scan me-2"></i>
                Scanner & Tools
              </h6>
              <div className="mb-3">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span>QR Scanner</span>
                  <span className="badge bg-success">Always Active</span>
                </div>
                <div className="d-flex justify-content-between align-items-center">
                  <span>Show Help</span>
                  <kbd>F1</kbd>
                </div>
              </div>

              <h6 className="text-warning mb-3">
                <i className="bi bi-info-circle me-2"></i>
                Tips
              </h6>
              <div className="small text-muted">
                <ul className="list-unstyled">
                  <li className="mb-1">• Shortcuts are disabled when typing in fields</li>
                  <li className="mb-1">• Shortcuts are disabled during checkout</li>
                  <li className="mb-1">• Auto-search only works in Products mode</li>
                  <li>• QR scanner works automatically in background</li>
                </ul>
              </div>
            </div>
          </div>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowHelpModal(false)}>
            Close
          </Button>
        </Modal.Footer>
      </Modal>

      <style>{`
        kbd {
          background-color: #e9ecef;
          border: 1px solid #adb5bd;
          border-radius: 3px;
          box-shadow: 0 1px 0 rgba(0,0,0,0.2), 0 0 0 2px #fff inset;
          color: #495057;
          display: inline-block;
          font-size: 0.75rem;
          font-weight: 700;
          line-height: 1;
          padding: 2px 4px;
          white-space: nowrap;
        }
        
        .kbd-combo {
          white-space: nowrap;
        }
        
        .tooltip {
          z-index: 1070;
        }
        
        /* Table Layout Optimization */
        .products-table {
          flex: 1;
          overflow-y: auto;
          max-height: calc(100vh - 400px);
        }
        
        .products-data-table {
          table-layout: fixed;
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }
        
        /* Column Headers */
        .table-header-0 {
          width: 50%;
          text-align: left;
          padding-left: 16px;
        }
        
        .table-header-1 {
          width: 30%;
          text-align: center;
        }
        
        .table-header-2 {
          width: 20%;
          text-align: center;
        }
        
        /* Table Cells */
        .table-cell-0 {
          width: 50%;
          padding: 16px;
          vertical-align: top;
        }
        
        .table-cell-1 {
          width: 30%;
          padding: 16px;
          text-align: center;
          vertical-align: middle;
        }
        
        .table-cell-2 {
          width: 20%;
          padding: 16px;
          text-align: center;
          vertical-align: middle;
        }
        
        /* Product Cell Layout */
        .product-cell {
          display: flex;
          align-items: flex-start;
          width: 100%;
        }
        
        .product-main {
          flex: 1;
          min-width: 0;
        }
        
        .product-title {
          font-size: 1rem;
          font-weight: 600;
          color: #212529;
          line-height: 1.4;
          margin-bottom: 4px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-wrap: break-word;
        }
        
        .product-desc {
          font-size: 0.85rem;
          color: #6c757d;
          line-height: 1.3;
          margin-bottom: 6px;
          display: -webkit-box;
          -webkit-line-clamp: 1;
          -webkit-box-orient: vertical;
          overflow: hidden;
          word-wrap: break-word;
        }
        
        .product-meta {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        
        .category-tag {
          font-size: 0.7rem;
          padding: 2px 8px;
          background-color: #f8f9fa;
          color: #495057;
          border: 1px solid #dee2e6;
          border-radius: 12px;
          white-space: nowrap;
        }
        
        /* Price Cell */
        .price-cell {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
        }
        
        .price-amount {
          font-size: 1rem;
          font-weight: 700;
          color: #198754;
          background: linear-gradient(135deg, #d4edda 0%, #c3e6cb 100%);
          padding: 4px 8px;
          border-radius: 20px;
          white-space: nowrap;
          min-width: 100px;
          text-align: center;
        }
        
        /* Stock Cell */
        .stock-cell {
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100%;
        }
        
        .stock-badge {
          font-size: 0.85rem;
          font-weight: 600;
          padding: 6px 12px;
          border-radius: 16px;
          min-width: 50px;
          text-align: center;
        }
        
        /* Table Headers Styling */
        .table-light th {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          color: #495057;
          font-weight: 600;
          font-size: 0.9rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 16px 12px;
          border-bottom: 2px solid #dee2e6;
          position: sticky;
          top: 0;
          z-index: 10;
        }
        
        /* Row Hover Effects */
        .product-row {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        
        .product-row:hover {
          background: linear-gradient(135deg, #e3f2fd 0%, #f0f8ff 100%);
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(13, 110, 253, 0.15);
        }
        
        .product-row:hover .product-title {
          color: #0d6efd;
        }
        
        .product-row:hover .price-amount {
          background: linear-gradient(135deg, #0d6efd 0%, #0b5ed7 100%);
          color: white;
          transform: scale(1.05);
        }
        
        .out-of-stock {
          opacity: 0.6;
          cursor: not-allowed;
          background: #f8f9fa;
        }
        
        .out-of-stock:hover {
          background: #f8f9fa;
          transform: none;
          box-shadow: none;
        }
        
        .out-of-stock .product-title,
        .out-of-stock .product-desc,
        .out-of-stock .price-amount {
          color: #6c757d !important;
        }
        
        /* Responsive Design */
        @media (max-width: 1200px) {
          .table-header-0, .table-cell-0 { width: 45%; }
          .table-header-1, .table-cell-1 { width: 35%; }
          .table-header-2, .table-cell-2 { width: 20%; }
          
          .product-title { font-size: 0.95rem; }
          .price-amount { font-size: 1rem; min-width: 90px; }
        }
        
        @media (max-width: 992px) {
          .table-header-0, .table-cell-0 { width: 50%; }
          .table-header-1, .table-cell-1 { width: 30%; }
          .table-header-2, .table-cell-2 { width: 20%; }
          
          .products-data-table td,
          .products-data-table th {
            padding: 12px 8px;
          }
          
          .product-title { 
            font-size: 0.9rem;
            -webkit-line-clamp: 1;
          }
          
          .product-desc { display: none; }
          .price-amount { 
            font-size: 0.95rem;
            padding: 6px 12px;
            min-width: 80px;
          }
        }
        
        @media (max-width: 768px) {
          .table-header-0, .table-cell-0 { width: 60%; }
          .table-header-1, .table-cell-1 { width: 25%; }
          .table-header-2, .table-cell-2 { width: 15%; }
          
          .products-data-table td,
          .products-data-table th {
            padding: 10px 6px;
          }
          
          .product-title { font-size: 0.85rem; }
          .category-tag { display: none; }
          .price-amount { 
            font-size: 0.9rem;
            padding: 4px 8px;
            min-width: 70px;
          }
          .stock-badge {
            font-size: 0.75rem;
            padding: 4px 8px;
            min-width: 40px;
          }
        }
        
        .products-table-container {
          height: 100%;
          display: flex;
          flex-direction: column;
        }
        
        .clickable-row {
          transition: background-color 0.2s ease;
        }
        
        .flex-1 {
          flex: 1;
          min-width: 100px;
        }
        
        @media (max-width: 576px) {
          .flex-1 {
            flex-basis: 100%;
            margin-bottom: 0.5rem;
          }
          .flex-wrap {
            flex-direction: column;
          }
        }
        
        @media (max-width: 991.98px) {
          .products-section {
            margin-bottom: 1rem;
          }
          
          .products-card {
            min-height: 400px;
          }
          
          .products-container {
            min-height: 350px;
          }
          
          .products-table-container {
            height: 350px;
            display: flex;
            flex-direction: column;
          }
          
          .cart-card {
            min-height: 500px;
            display: flex;
            flex-direction: column;
          }
          
          .cart-items-container {
            flex: 1;
            overflow-y: auto;
            max-height: 400px;
          }
        }
        
        @media (min-width: 992px) {
          .products-section,
          .cart-section {
            height: calc(100vh - 200px);
          }
          
          .products-card,
          .cart-card {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          .products-container {
            flex: 1;
            overflow: hidden;
          }
          
          .products-table-container {
            height: 100%;
            display: flex;
            flex-direction: column;
          }
          
          .cart-items-container {
            flex: 1;
            overflow-y: auto;
          }
        }
      `}</style>
    </Container>
  );
};

export default POS;