import React, { useEffect, useState } from 'react';
import {
  Badge,
  Button,
  Card,
  Col,
  Container,
  Form,
  InputGroup,
  Modal,
  Pagination,
  Row,
  Spinner,
  Table
} from 'react-bootstrap';
import { categoriesApi, printApi, productsApi, suppliersApi } from '../services/api';
// Fix icon imports
import {
  FaFileDownload,
  FaFileExcel,
  FaFileUpload,
  FaFilter,
  FaPencilAlt,
  FaPlus,
  FaPrint,
  FaSearch,
  FaTrash
} from 'react-icons/fa';
// Import xlsx library for Excel file processing
import * as XLSX from 'xlsx';
import { useNotification } from '../contexts/NotificationContext';

const Products: React.FC = () => {
  const { showSuccess, showError } = useNotification();
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [printLoading, setPrintLoading] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const [importData, setImportData] = useState<any[]>([]);
  const [importPreview, setImportPreview] = useState(false);
  const [productUpdateMap, setProductUpdateMap] = useState<Record<string, { id: number, existing: boolean, currentStock: number }>>({});
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [categoryFormData, setCategoryFormData] = useState({
    id: '',
    name: '',
    description: ''
  });
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalProducts, setTotalProducts] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [showLowStock, setShowLowStock] = useState(false);
  const [productFormOpen, setProductFormOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bulkDeleteDialogOpen, setBulkDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [printQuantity, setPrintQuantity] = useState(1);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    barcode: '',
    price: '',
    costPrice: '',
    stockQuantity: '',
    reorderLevel: '',
    categoryId: '',
    supplierId: '',
    categoryName: '',
    supplierName: '',
    image: null as File | null,
    imageUrl: '',
  });
  const [printPreviewUrl, setPrintPreviewUrl] = useState<string | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, [page, rowsPerPage, searchQuery, categoryFilter, supplierFilter, showLowStock]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [categoriesResponse, suppliersResponse] = await Promise.all([
          categoriesApi.getAll(),
          suppliersApi.getAll(),
        ]);

        setCategories(categoriesResponse.data || []);
        setSuppliers(suppliersResponse.data || []);
      } catch (err) {
        console.error('Error fetching categories and suppliers:', err);
        showError('Failed to load categories and suppliers');
        setCategories([]);
        setSuppliers([]);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (selectedProduct) {
      setFormData({
        name: selectedProduct.name || '',
        description: selectedProduct.description || '',
        barcode: selectedProduct.barcode || '',
        price: selectedProduct.price?.toString() || '',
        costPrice: selectedProduct.costPrice?.toString() || '',
        stockQuantity: selectedProduct.stockQuantity?.toString() || '',
        reorderLevel: selectedProduct.reorderLevel?.toString() || '',
        categoryId: selectedProduct.categoryId?.toString() || selectedProduct.category?.id?.toString() || '',
        supplierId: selectedProduct.supplierId?.toString() || selectedProduct.supplier?.id?.toString() || '',
        categoryName: selectedProduct.category?.name || '',
        supplierName: selectedProduct.supplier?.name || '',
        image: null,
        imageUrl: selectedProduct.image ? `http://localhost:5000${selectedProduct.image}` : '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        barcode: '',
        price: '',
        costPrice: '',
        stockQuantity: '0',
        reorderLevel: '0',
        categoryId: '',
        supplierId: '',
        categoryName: '',
        supplierName: '',
        image: null,
        imageUrl: '',
      });
    }
  }, [selectedProduct]);

  const fetchProducts = async () => {
    try {
      setLoading(true);

      const response = await productsApi.getAll({
        page: page + 1,
        limit: rowsPerPage,
        search: searchQuery,
        category: categoryFilter || undefined,
        supplier: supplierFilter || undefined,
        lowStock: showLowStock,
      });

      setProducts(response.data?.products || []);
      setTotalProducts(response.data?.pagination?.total || 0);

    } catch (err) {
      console.error('Error fetching products:', err);
      showError('Failed to load products');
      setProducts([]);
      setTotalProducts(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoriesApi.getAll();
      setCategories(response.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
      showError('Failed to load categories');
    }
  };

  const handleChangePage = (pageNumber: number) => {
    setPage(pageNumber);
  };

  const handleChangeRowsPerPage = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  };

  const handleOpenProductForm = (product: any = null) => {
    setSelectedProduct(product);
    setProductFormOpen(true);
  };

  const handleCloseProductForm = () => {
    setProductFormOpen(false);
    setSelectedProduct(null);
  };

  const handleOpenCategoryModal = () => {
    setCategoryModalOpen(true);
  };

  const handleCloseCategoryModal = () => {
    setCategoryModalOpen(false);
    setCategoryFormData({ id: '', name: '', description: '' });
  };

  const handleEditCategory = (category: any) => {
    setCategoryFormData({
      id: category._id,
      name: category.name,
      description: category.description || ''
    });
  };

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      await categoriesApi.delete(categoryId);
      showSuccess('Category deleted successfully');
      fetchCategories();
    } catch (err) {
      console.error('Error deleting category:', err);
      showError('Failed to delete category');
    }
  };

  const handleSubmitCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (categoryFormData.id) {
        await categoriesApi.update(categoryFormData.id, categoryFormData);
        showSuccess('Category updated successfully');
      } else {
        await categoriesApi.create(categoryFormData);
        showSuccess('Category created successfully');
      }
      handleCloseCategoryModal();
      fetchCategories();
    } catch (err) {
      console.error('Error saving category:', err);
      showError('Failed to save category');
    }
  };

  const handleOpenDeleteDialog = (product: any) => {
    setSelectedProduct(product);
    setDeleteDialogOpen(true);
  };

  const handleOpenBulkDeleteDialog = () => {
    if (selectedProductIds.length === 0) {
      showError('Please select at least one product');
      return;
    }
    setBulkDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    setDeleteDialogOpen(false);
    setSelectedProduct(null);
  };

  const handleCloseBulkDeleteDialog = () => {
    setBulkDeleteDialogOpen(false);
  };

  const handleDeleteProduct = async () => {
    if (!selectedProduct) return;

    try {
      await productsApi.delete(selectedProduct.id);

      showSuccess('Product deleted successfully');
      handleCloseDeleteDialog();
      fetchProducts();
    } catch (err) {
      console.error('Error deleting product:', err);
      showError('Failed to delete product');
    }
  };

  const handleBulkDeleteProducts = async () => {
    if (selectedProductIds.length === 0) return;

    try {
      const deletePromises = selectedProductIds.map(id => productsApi.delete(id));
      await Promise.all(deletePromises);

      showSuccess(`${selectedProductIds.length} products deleted successfully`);
      setSelectedProductIds([]);
      handleCloseBulkDeleteDialog();
      fetchProducts();
    } catch (err) {
      console.error('Error deleting products:', err);
      showError('Failed to delete selected products');
    }
  };

  const toggleProductSelection = (productId: number) => {
    setSelectedProductIds(prev => {
      if (prev.includes(productId)) {
        return prev.filter(id => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const toggleSelectAll = () => {
    if (selectedProductIds.length === products.length) {
      setSelectedProductIds([]);
    } else {
      const allIds = products.map(product => product.id);
      setSelectedProductIds(allIds);
    }
  };

  const isAllSelected = products.length > 0 && selectedProductIds.length === products.length;
  const isIndeterminate = selectedProductIds.length > 0 && selectedProductIds.length < products.length;

  const handleOpenPrintDialog = () => {
    if (selectedProductIds.length === 0) {
      showError('Please select at least one product');
      return;
    }

    setPrintDialogOpen(true);
  };

  const handleGeneratePreview = async () => {
    try {
      setPrintLoading(true);

      if (selectedProductIds.length === 0) {
        showError('No products selected for printing labels');
        return;
      }


      const response = await printApi.generateBarcodes(selectedProductIds, printQuantity);

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);

      setPrintPreviewUrl(url);
      setShowPrintPreview(true);

    } catch (err: any) {
      console.error('Error generating preview:', err);

      if (err.response) {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            let errorMsg = 'Unknown error';
            try {
              const errorObj = JSON.parse(text);
              errorMsg = errorObj.message || 'Error generating preview';
            } catch (e) {
              errorMsg = text || 'Error generating preview';
            }
            showError(`Failed to generate preview: ${errorMsg}`);
          } catch (textErr) {
            showError(`Failed to generate preview: Server returned an error`);
          }
        } else {
          const errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
          showError(`Failed to generate preview: ${errorMessage}`);
        }
      } else if (err.request) {
        showError('Failed to generate preview: No response from server. Please check your network connection.');
      } else {
        showError(`Failed to generate preview: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setPrintLoading(false);
    }
  };

  const handlePrintLabels = async () => {
    try {
      setPrintLoading(true);

      if (selectedProductIds.length === 0) {
        showError('No products selected for printing labels');
        return;
      }


      const response = await printApi.generateBarcodes(selectedProductIds, printQuantity);

      if (response.headers['content-type'] === 'application/pdf' || 
         (response.data instanceof Blob && response.data.type === 'application/pdf')) {

        const blob = new Blob([response.data], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);

        const printWindow = window.open(url, '_blank');
        if (printWindow) {
          printWindow.onload = () => {
            setTimeout(() => {
              printWindow.print();
            }, 500);
          };

          showSuccess(`${selectedProductIds.length} product labels sent to printer`);
        } else {
          alert('Please allow pop-ups to print the labels');

          const link = document.createElement('a');
          link.href = url;
          link.download = `product-labels-${Date.now()}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);

          showSuccess(`${selectedProductIds.length} product labels downloaded`);
        }

        setPrintDialogOpen(false);
        setSelectedProductIds([]);
        setPrintQuantity(1);
      } else {
        throw new Error('Received invalid response format from server');
      }

    } catch (err: any) {
      console.error('Error generating labels:', err);

      if (err.response) {
        if (err.response.data instanceof Blob) {
          try {
            const text = await err.response.data.text();
            let errorMsg = 'Unknown error';
            try {
              const errorObj = JSON.parse(text);
              errorMsg = errorObj.message || 'Error generating labels';
            } catch (e) {
              errorMsg = text || 'Error generating labels';
            }
            showError(`Failed to generate labels: ${errorMsg}`);
          } catch (textErr) {
            showError(`Failed to generate labels: Server returned an error`);
          }
        } else {
          const errorMessage = err.response.data?.message || `Server error: ${err.response.status}`;
          showError(`Failed to generate labels: ${errorMessage}`);
        }
      } else if (err.request) {
        showError('Failed to generate labels: No response from server. Please check your network connection.');
      } else {
        showError(`Failed to generate labels: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setPrintLoading(false);
      if (printPreviewUrl) {
        window.URL.revokeObjectURL(printPreviewUrl);
        setPrintPreviewUrl(null);
      }
    }
  };

  const handlePrintFromPreview = () => {
    if (!printPreviewUrl) return;

    const printWindow = window.open(printPreviewUrl, '_blank');
    if (printWindow) {
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 500);
      };
    } else {
      alert('Please allow pop-ups to print the labels');
    }
  };

  const handleDownloadPdf = () => {
    if (!printPreviewUrl) return;

    const link = document.createElement('a');
    link.href = printPreviewUrl;
    link.download = `product-labels-${Date.now()}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleClosePreview = () => {
    if (printPreviewUrl) {
      window.URL.revokeObjectURL(printPreviewUrl);
    }
    setPrintPreviewUrl(null);
    setShowPrintPreview(false);
    setSelectedProductIds([]);
    setPrintQuantity(1);
  };

  const handleClosePrintDialog = () => {
    setPrintDialogOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFilterSelectChange = (e: React.ChangeEvent<HTMLSelectElement>, filterType: 'category' | 'supplier') => {
    const value = e.target.value;
    if (filterType === 'category') {
      setCategoryFilter(value);
    } else {
      setSupplierFilter(value);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFormData(prev => ({
        ...prev,
        image: file,
        imageUrl: URL.createObjectURL(file),
      }));
    }
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const formDataToSend = new FormData();

      formDataToSend.append('name', formData.name);
      formDataToSend.append('description', formData.description);

      if (formData.barcode) {
        formDataToSend.append('barcode', formData.barcode);
      }

      formDataToSend.append('price', formData.price);

      if (formData.costPrice) {
        formDataToSend.append('costPrice', formData.costPrice);
      }

      formDataToSend.append('stockQuantity', formData.stockQuantity);

      if (formData.reorderLevel) {
        formDataToSend.append('reorderLevel', formData.reorderLevel);
      }

      if (formData.categoryName) {
        formDataToSend.append('categoryName', formData.categoryName);
      } else if (formData.categoryId) {
        formDataToSend.append('categoryId', formData.categoryId);
      }

      if (formData.supplierName) {
        formDataToSend.append('supplierName', formData.supplierName);
      } else if (formData.supplierId) {
        formDataToSend.append('supplierId', formData.supplierId);
      }

      if (formData.image) {
        formDataToSend.append('image', formData.image);
      }

      if (selectedProduct) {
        await productsApi.update(selectedProduct.id, formDataToSend);
        showSuccess('Product updated successfully');
      } else {
        await productsApi.create(formDataToSend);
        showSuccess('Product created successfully');
      }

      handleCloseProductForm();
      fetchProducts();
    } catch (err) {
      console.error('Error submitting product:', err);
      showError('Failed to save product');
    }
  };

  const paginationItems = () => {
    const totalPages = Math.ceil(totalProducts / rowsPerPage);
    let items = [];

    for (let number = 0; number < totalPages; number++) {
      items.push(
        <Pagination.Item key={number} active={number === page} onClick={() => handleChangePage(number)}>
          {number + 1}
        </Pagination.Item>
      );
    }

    return items;
  };

  const downloadTemplate = () => {
    const template = [
      {
        name: 'Sample Product',
        description: 'Product description',
        barcode: '',
        price: 1000,
        costPrice: 800,
        stockQuantity: 10,
        reorderLevel: 5,
        categoryName: categories.length > 0 ? categories[0].name : 'Category Name',
        supplierName: suppliers.length > 0 ? suppliers[0].name : 'Supplier Name',
      }
    ];

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(template);

    const notes = [
      ['Notes:'],
      ['1. CategoryName: Use one of the following categories:'],
      ...categories.map(cat => [`   - ${cat.name}`]),
      ['2. For new products, stockQuantity is the initial stock'],
      ['3. For existing products (matching names), stockQuantity will be ADDED to current stock'],
    ];

    const notesWs = XLSX.utils.aoa_to_sheet(notes);

    XLSX.utils.book_append_sheet(wb, ws, 'Products Template');
    XLSX.utils.book_append_sheet(wb, notesWs, 'Instructions');

    XLSX.writeFile(wb, 'product_import_template.xlsx');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      setImportFile(files[0]);
      setImportPreview(false);
      setImportData([]);
    }
  };

  const parseExcelFile = async () => {
    if (!importFile) return;

    setImportLoading(true);

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'array' });

        const worksheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[worksheetName];

        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        if (jsonData.length === 0) {
          showError('The Excel file is empty or has no valid data');
          setImportLoading(false);
          return;
        }

        const requiredFields = ['name', 'price', 'stockQuantity'];
        const firstRow = jsonData[0] as any;

        const missingFields = requiredFields.filter(field => !(field in firstRow));
        if (missingFields.length > 0) {
          showError(`Missing required fields: ${missingFields.join(', ')}`);
          setImportLoading(false);
          return;
        }

        const importProductNames = jsonData.map((product: any) => product.name);

        if (importProductNames.length === 0) {
          showError('No valid products found in the import file');
          setImportLoading(false);
          return;
        }

        try {
          let existingProducts: any[] = [];

          try {
            const response = await productsApi.checkExistingProducts(importProductNames);
            existingProducts = response.data || [];
          } catch (apiError) {
            console.error('API error when checking existing products:', apiError);

            const refreshResponse = await productsApi.getAll({limit: 1000});
            const allProducts = refreshResponse.data?.products || [];

            const productNameMap = new Map();
            allProducts.forEach((product: any) => {
              productNameMap.set(product.name.toLowerCase(), {
                id: product.id,
                name: product.name,
                stockQuantity: product.stockQuantity || 0
              });
            });

            existingProducts = importProductNames
              .map(name => {
                const match = productNameMap.get(name.toLowerCase());
                return match ? { 
                  id: match.id, 
                  name, 
                  stockQuantity: match.stockQuantity 
                } : null;
              })
              .filter(Boolean);

          }

          const updateMap: Record<string, { id: number, existing: boolean, currentStock: number }> = {};
          existingProducts.forEach((product: any) => {
            if (product && product.name) {
              updateMap[product.name.toLowerCase()] = {
                id: product.id,
                existing: true,
                currentStock: product.stockQuantity || 0
              };
            }
          });

          setProductUpdateMap(updateMap);

          const enrichedData = jsonData.map((product: any) => {
            const normalizedName = product.name.toLowerCase();
            const existingProduct = updateMap[normalizedName];
            const isUpdate = existingProduct !== undefined;

            let finalStockQuantity = parseInt(product.stockQuantity) || 0;
            let stockChange = 0;

            if (isUpdate) {
              const currentStock = existingProduct.currentStock;
              const importQuantity = parseInt(product.stockQuantity) || 0;
              finalStockQuantity = currentStock + importQuantity;
              stockChange = importQuantity;
            }

            return {
              ...product,
              _action: isUpdate ? 'UPDATE' : 'CREATE',
              _id: isUpdate ? existingProduct.id : null,
              _currentStock: isUpdate ? existingProduct.currentStock : 0,
              _importQuantity: parseInt(product.stockQuantity) || 0,
              _finalStock: finalStockQuantity,
              _stockChange: stockChange,
              stockQuantity: finalStockQuantity
            };
          });

          setImportData(enrichedData);
          setImportPreview(true);
        } catch (error) {
          console.error('Error in product import process:', error);
          showError('Failed to process import data. Please try again or contact support.');
        } 
      } catch (error) {
        console.error('Error parsing Excel file:', error);
        showError('Failed to parse Excel file. Please make sure it\'s a valid Excel file.');
      } finally {
        setImportLoading(false);
      }
    };

    reader.readAsArrayBuffer(importFile);
  };

  const submitImportData = async () => {
    if (importData.length === 0) return;

    setImportLoading(true);

    try {
      let successCount = 0;
      let updateCount = 0;
      let failedCount = 0;

      for (const product of importData) {
        try {
          const formDataToSend = new FormData();

          Object.keys(product).forEach(key => {
            if (!key.startsWith('_') && product[key] !== undefined && product[key] !== null && product[key] !== '') {
              formDataToSend.append(key, product[key].toString());
            }
          });

          if (product._action === 'UPDATE' && product._id) {
            await productsApi.update(product._id, formDataToSend);
            updateCount++;
          } else {
            await productsApi.create(formDataToSend);
            successCount++;
          }
        } catch (err) {
          console.error(`Error processing product ${product.name}:`, err);
          failedCount++;
        }
      }

      showSuccess(`Import completed: ${successCount} products added, ${updateCount} updated, ${failedCount} failed`);

      setImportModalOpen(false);
      fetchProducts();
    } catch (err) {
      console.error('Import process error:', err);
      showError('Failed to complete the import process');
    } finally {
      setImportLoading(false);
      setImportFile(null);
      setImportData([]);
      setImportPreview(false);
      setProductUpdateMap({});
    }
  };

  const handleCloseImportModal = () => {
    setImportModalOpen(false);
    setImportFile(null);
    setImportData([]);
    setImportPreview(false);
    setProductUpdateMap({});
  };

  return (
    <Container fluid className="py-4">
      <Row className="mb-4 align-items-center">
        <Col md="auto" className="mb-2 mb-md-0">
          <h4 className="mb-0">Products</h4>
        </Col>
        <Col md className="d-flex flex-column flex-md-row flex-wrap gap-2 justify-content-md-end">
          <Button variant="primary" onClick={() => handleOpenProductForm()}>
            <>{FaPlus({ className: "me-1" })}</> Add Product
          </Button>
          <Button variant="info" onClick={handleOpenCategoryModal}>
            <>{FaPlus({ className: "me-1" })}</> Manage Categories
          </Button>
          <Button variant="success" onClick={() => setImportModalOpen(true)}>
            <>{FaFileExcel({ className: "me-1" })}</> Import Products
          </Button>
          {selectedProductIds.length > 0 && (
            <>
              <Button variant="outline-primary" onClick={handleOpenPrintDialog}>
                <>{FaPrint({ className: "me-1" })}</> Print Labels ({selectedProductIds.length})
              </Button>
              <Button variant="outline-danger" onClick={handleOpenBulkDeleteDialog}>
                <>{FaTrash({ className: "me-1" })}</> Delete Selected ({selectedProductIds.length})
              </Button>
            </>
          )}
        </Col>
      </Row>
      
      <Card className="mb-4">
        <Card.Header className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h6 className="mb-0">Filters</h6>
          <Button variant="link" className="p-0">
            <>{FaFilter({})}</>
          </Button>
        </Card.Header>
        <Card.Body>
          <Row className="g-3 flex-column flex-md-row">
            <Col xs={12} md={6} lg={4}>
              <InputGroup>
                <InputGroup.Text>
                  <>{FaSearch({})}</>
                </InputGroup.Text>
                <Form.Control
                  placeholder="Search Products"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </InputGroup>
            </Col>
            <Col xs={12} sm={6} md={2}>
              <Button
                variant={showLowStock ? "warning" : "outline-warning"}
                className="w-100"
                onClick={() => setShowLowStock(!showLowStock)}
              >
                {showLowStock ? "All Stock" : "Low Stock"}
              </Button>
            </Col>
          </Row>
        </Card.Body>
      </Card>
      
      <Card>
        <Card.Body className="p-0">
          <div className="table-responsive" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            <Table hover className="mb-0 align-middle">
              <thead className="sticky-top bg-white" style={{ zIndex: 10 }}>
                <tr>
                  <th style={{ width: '50px' }}>
                    <Form.Check
                      type="checkbox"
                      checked={isAllSelected}
                      ref={(input: HTMLInputElement | null) => {
                        if (input) input.indeterminate = isIndeterminate;
                      }}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th>Name</th>
                  <th className="d-none d-md-table-cell">Description</th>
                  <th>Category</th>
                  <th>Sale price</th>
                  <th className="d-none d-sm-table-cell">Cost price</th>
                  <th>Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      <Spinner animation="border" />
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-4">
                      No products found
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const isLowStock = (product.stockQuantity || 0) <= (product.reorderLevel || 0);
                    const isSelected = selectedProductIds.includes(product.id);
                    return (
                      <tr key={product.id} className={isSelected ? "table-primary" : ""}>
                        <td>
                          <Form.Check
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleProductSelection(product.id)}
                          />
                        </td>
                        <td>{product.name}</td>
                        <td className="d-none d-md-table-cell">{product.description || 'No description'}</td>
                        <td>{product.category?.name || ''}</td>
                        <td>Rs. {(product.price || 0).toFixed(2)}</td>
                        <td className="d-none d-sm-table-cell">Rs. {(product.costPrice || 0).toFixed(2)}</td>
                        <td>
                          <Badge bg={isLowStock ? "danger" : "success"}>
                            {product.stockQuantity || 0} units
                          </Badge>
                        </td>
                        <td>
                          <div className="d-flex flex-row flex-wrap gap-1">
                            <Button
                              variant="link"
                              className="p-1 me-1"
                              onClick={() => handleOpenProductForm(product)}
                            >
                              <>{FaPencilAlt({})}</>
                            </Button>
                            <Button
                              variant="link"
                              className="p-1 text-danger"
                              onClick={() => handleOpenDeleteDialog(product)}
                            >
                              <>{FaTrash({})}</>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </Table>
          </div>
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-center p-3 gap-2">
            <div className="d-flex align-items-center mb-2 mb-md-0">
              <span className="me-2">Rows per page:</span>
              <Form.Select
                style={{ width: '80px' }}
                value={rowsPerPage.toString()}
                onChange={handleChangeRowsPerPage}
              >
                <option value="5">5</option>
                <option value="10">10</option>
                <option value="25">25</option>
              </Form.Select>
            </div>
            <div className="d-flex align-items-center flex-wrap gap-2">
              <span className="me-3">
                {page * rowsPerPage + 1}-{Math.min((page + 1) * rowsPerPage, totalProducts)} of {totalProducts}
              </span>
              <Pagination className="d-inline-flex mb-0 flex-wrap">
                <Pagination.Prev
                  onClick={() => setPage(Math.max(0, page - 1))}
                  disabled={page === 0}
                />
                {paginationItems()}
                <Pagination.Next
                  onClick={() => setPage(Math.min(Math.ceil(totalProducts / rowsPerPage) - 1, page + 1))}
                  disabled={page >= Math.ceil(totalProducts / rowsPerPage) - 1}
                />
              </Pagination>
            </div>
          </div>
        </Card.Body>
      </Card>
      
      <Modal 
        show={printDialogOpen} 
        onHide={handleClosePrintDialog}
      >
        <Modal.Header closeButton>
          <Modal.Title>Print Product Labels</Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <p>
            You are about to print labels for {selectedProductIds.length} selected products.
          </p>
          
          <Form.Group className="mt-3">
            <Form.Label>Quantity per product</Form.Label>
            <Form.Control
              type="number"
              value={printQuantity}
              onChange={(e) => setPrintQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              min={1}
            />
          </Form.Group>
          
          <div className="mt-4">
            <p className="text-muted">
              <small>
                When you click "Print Labels", your browser's print dialog will appear automatically.
                Make sure your label printer is selected in the print settings.
              </small>
            </p>
          </div>
        </Modal.Body>
        
        <Modal.Footer>
          <Button 
            variant="secondary" 
            onClick={handleClosePrintDialog}
            disabled={printLoading}
          >
            Cancel
          </Button>
          <Button 
            variant="primary" 
            onClick={handlePrintLabels}
            disabled={printLoading}
          >
            {printLoading ? (
              <>
                <Spinner as="span" animation="border" size="sm" className="me-1" /> 
                Processing...
              </>
            ) : (
              <>
                <>{FaPrint({ className: "me-1" })}</> Print Labels
              </>
            )}
          </Button>
        </Modal.Footer>
      </Modal>
      
      <Modal show={bulkDeleteDialogOpen} onHide={handleCloseBulkDeleteDialog}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Selected Products</Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <p>
            Are you sure you want to delete <strong>{selectedProductIds.length}</strong> selected products?
          </p>
          <p className="text-danger">This action cannot be undone.</p>
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseBulkDeleteDialog}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleBulkDeleteProducts}>
            Delete {selectedProductIds.length} Products
          </Button>
        </Modal.Footer>
      </Modal>

      <Modal show={deleteDialogOpen} onHide={handleCloseDeleteDialog}>
        <Modal.Header closeButton>
          <Modal.Title>Delete Product</Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          <p>
            Are you sure you want to delete the product: <strong>{selectedProduct?.name}</strong>?
          </p>
          <p className="text-danger">This action cannot be undone.</p>
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseDeleteDialog}>
            Cancel
          </Button>
          <Button variant="danger" onClick={handleDeleteProduct}>
            Delete
          </Button>
        </Modal.Footer>
      </Modal>
      
      <Modal
        show={productFormOpen}
        onHide={handleCloseProductForm}
        size="lg"
      >
        <form onSubmit={handleSubmitForm}>
          <Modal.Header closeButton>
            <Modal.Title>
              {selectedProduct ? 'Edit Product' : 'Add New Product'}
            </Modal.Title>
          </Modal.Header>
          <Modal.Body>
            <Row className="g-3 flex-column flex-md-row">
              <Col xs={12} md={6}>
                <Form.Group className="mb-3">
                  <Form.Label>Product Name</Form.Label>
                  <Form.Control
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Description</Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={3}
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                  />
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Barcode</Form.Label>
                  <Form.Control
                    name="barcode"
                    value={formData.barcode}
                    onChange={handleInputChange}
                  />
                  <Form.Text className="text-muted">
                    Leave empty to auto-generate a unique barcode
                  </Form.Text>
                </Form.Group>
                <Form.Group className="mb-3">
                  <Form.Label>Category</Form.Label>
                  <Form.Select
                    name="categoryId"
                    value={formData.categoryId}
                    onChange={handleSelectChange}
                  >
                    <option value="">Select Category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.name}
                      </option>
                    ))}
                  </Form.Select>
                </Form.Group>
              </Col>
              <Col xs={12} md={6}>
                <Row>
                  <Col xs={12} sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Price</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>Rs.</InputGroup.Text>
                        <Form.Control
                          type="number"
                          name="price"
                          value={formData.price}
                          onChange={handleInputChange}
                          required
                          min="0"
                          step="0.01"
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Cost Price</Form.Label>
                      <InputGroup>
                        <InputGroup.Text>Rs.</InputGroup.Text>
                        <Form.Control
                          type="number"
                          name="costPrice"
                          value={formData.costPrice}
                          onChange={handleInputChange}
                          min="0"
                          step="0.01"
                        />
                      </InputGroup>
                    </Form.Group>
                  </Col>
                </Row>
                <Row>
                  <Col xs={12} sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Stock Quantity</Form.Label>
                      <Form.Control
                        type="number"
                        name="stockQuantity"
                        value={formData.stockQuantity}
                        onChange={handleInputChange}
                        required
                        min="0"
                      />
                    </Form.Group>
                  </Col>
                  <Col xs={12} sm={6}>
                    <Form.Group className="mb-3">
                      <Form.Label>Reorder Level</Form.Label>
                      <Form.Control
                        type="number"
                        name="reorderLevel"
                        value={formData.reorderLevel}
                        onChange={handleInputChange}
                        min="0"
                      />
                    </Form.Group>
                  </Col>
                </Row>
              </Col>
            </Row>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="secondary" onClick={handleCloseProductForm}>
              Cancel
            </Button>
            <Button type="submit" variant="primary">
              {selectedProduct ? 'Update' : 'Create'} Product
            </Button>
          </Modal.Footer>
        </form>
      </Modal>
      
      <Modal 
        show={importModalOpen} 
        onHide={handleCloseImportModal}
        size="lg"
      >
        <Modal.Header closeButton>
          <Modal.Title>Import Products from Excel</Modal.Title>
        </Modal.Header>
        
        <Modal.Body>
          {!importPreview ? (
            <>
              <p>Upload an Excel file containing product data. The file should have the following columns:</p>
              <ul>
                <li><strong>name</strong> - Product name (required)</li>
                <li><strong>description</strong> - Product description</li>
                <li><strong>barcode</strong> - Product barcode (leave empty for auto-generation)</li>
                <li><strong>price</strong> - Selling price (required)</li>
                <li><strong>costPrice</strong> - Cost price</li>
                <li><strong>stockQuantity</strong> - For new products: initial stock. For existing products: quantity to ADD (required)</li>
                <li><strong>reorderLevel</strong> - Stock reorder level</li>
                <li><strong>categoryName</strong> - Category name</li>
                <li><strong>supplierName</strong> - Supplier name</li>
              </ul>
              
              <div className="alert alert-info">
                <strong>Note:</strong> For existing products (products with the same name), the stock quantity will be <strong>added</strong> to the current stock, not replaced.
              </div>

              <div className="d-flex justify-content-between mb-3">
                <Button 
                  variant="outline-primary" 
                  onClick={downloadTemplate}
                >
                  <>{FaFileDownload({ className: "me-1" })}</> Download Template
                </Button>
              </div>

              <Form.Group className="mb-3">
                <Form.Label>Excel File</Form.Label>
                <Form.Control
                  type="file"
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                />
                <Form.Text className="text-muted">
                  Only Excel files (.xlsx, .xls) are accepted
                </Form.Text>
              </Form.Group>
            </>
          ) : (
            <>
              <div className="d-flex justify-content-between mb-3">
                <h5>Preview ({importData.length} products)</h5>
                <Button 
                  variant="link" 
                  onClick={() => {
                    setImportPreview(false);
                    setImportData([]);
                    setProductUpdateMap({});
                  }}
                >
                  Back to Upload
                </Button>
              </div>
              
              <div className="mb-3 p-3 bg-light rounded">
                <div className="mb-2">Import summary:</div>
                <Badge bg="success" className="me-2">
                  {importData.filter(p => p._action !== 'UPDATE').length} new products
                </Badge>
                <Badge bg="warning" text="dark" className="me-2">
                  {importData.filter(p => p._action === 'UPDATE').length} products to update
                </Badge>
                <div className="mt-2 text-muted small">
                  For existing products, the imported stock quantity will be <strong>added</strong> to the current stock.
                </div>
              </div>
              
              <div className="table-responsive" style={{ maxHeight: '400px', overflowY: 'auto' }}>
                <Table hover size="sm">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Price</th>
                      <th>Stock Info</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importData.map((product, index) => (
                      <tr key={index} className={product._action === 'UPDATE' ? 'table-warning' : ''}>
                        <td>{index + 1}</td>
                        <td>{product.name}</td>
                        <td>Rs. {product.price}</td>
                        <td>
                          {product._action === 'UPDATE' ? (
                            <div>
                              <small className="text-muted">Current: {product._currentStock}</small><br/>
                              <small className="text-success">+{product._importQuantity}</small><br/>
                              <strong>Total: {product._finalStock}</strong>
                            </div>
                          ) : (
                            <span>{product.stockQuantity}</span>
                          )}
                        </td>
                        <td>
                          {product._action === 'UPDATE' ? (
                            <Badge bg="warning" text="dark">Update</Badge>
                          ) : (
                            <Badge bg="success">New</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </>
          )}
        </Modal.Body>
        
        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseImportModal} disabled={importLoading}>
            Cancel
          </Button>
          
          {!importPreview ? (
            <Button 
              variant="primary" 
              onClick={parseExcelFile}
              disabled={!importFile || importLoading}
            >
              {importLoading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-1" /> 
                  Parsing...
                </>
              ) : (
                <>
                  <>{FaFileUpload({ className: "me-1" })}</> Preview Import
                </>
              )}
            </Button>
          ) : (
            <Button 
              variant="success" 
              onClick={submitImportData}
              disabled={importLoading || importData.length === 0}
            >
              {importLoading ? (
                <>
                  <Spinner as="span" animation="border" size="sm" className="me-1" /> 
                  Importing...
                </>
              ) : (
                <>
                  Import {importData.length} Products
                </>
              )}
            </Button>
          )}
        </Modal.Footer>
      </Modal>
      
      <Modal show={categoryModalOpen} onHide={handleCloseCategoryModal}>
        <Modal.Header closeButton>
          <Modal.Title>{categoryFormData.id ? 'Edit Category' : 'Add Category'}</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form onSubmit={handleSubmitCategory}>
            <Form.Group className="mb-3">
              <Form.Label>Category Name</Form.Label>
              <Form.Control
                type="text"
                value={categoryFormData.name}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, name: e.target.value }))}
                required
              />
            </Form.Group>

            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={categoryFormData.description}
                onChange={(e) => setCategoryFormData(prev => ({ ...prev, description: e.target.value }))}
              />
            </Form.Group>

            <Table responsive>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category._id}>
                    <td>{category.name}</td>
                    <td>{category.description}</td>
                    <td>
                      <Button
                        variant="link"
                        className="p-0 me-2"
                        onClick={() => handleEditCategory(category)}
                      >
                        <>{FaPencilAlt({})}</>
                      </Button>
                      <Button
                        variant="link"
                        className="p-0 text-danger"
                        onClick={() => handleDeleteCategory(category._id)}
                      >
                        <>{FaTrash({})}</>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </Form>
        </Modal.Body>

        <Modal.Footer>
          <Button variant="secondary" onClick={handleCloseCategoryModal}>
            Close
          </Button>
          <Button variant="primary" onClick={handleSubmitCategory}>
            {categoryFormData.id ? 'Update' : 'Add'} Category
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default Products;