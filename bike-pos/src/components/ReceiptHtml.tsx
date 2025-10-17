import React from 'react';

export interface ReceiptItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface ReceiptHtmlProps {
  shopName: string;
  shopAddress?: string;
  shopPhone?: string;
  receiptData: {
    date: string;
    invoiceNumber: string;
    customer: string;
    cashier: string;
    items: ReceiptItem[];
    subtotal: number;
    servicesSubtotal: number;
    discount: number;
    tax: number;
    total: number;
    paymentMethod: string;
  };
}

const ReceiptHtml: React.FC<ReceiptHtmlProps> = ({ shopName, shopAddress, shopPhone, receiptData }) => {
  const safeItems = receiptData.items.map(item => ({
    name: item.name || 'Unnamed Item',
    quantity: item.quantity || 1,
    price: typeof item.price === 'number' ? item.price : 0,
    total: typeof item.total === 'number' ? item.total : 0
  }));

  return (
    <div style={{ width: '72mm', margin: '4mm', fontFamily: 'Arial, sans-serif', fontSize: 12 }}>
      <div className="receipt">
        <div className="text-center" style={{ textAlign: 'center' }}>
          <h2 style={{ margin: '0px 0 4px 0', fontSize: 18 }}>{shopName}</h2>
          {shopAddress && <p style={{ margin: '0px 0 4px 0', fontSize: 12 }}>{shopAddress}</p>}
          <h3 style={{ margin: '0px 0 4px 0', fontSize: 16 }}>RECEIPT</h3>
          <p style={{ margin: '3px 0', fontSize: 11 }}>{receiptData.date}</p>
          <p style={{ margin: '3px 0', fontSize: 11 }}>Invoice: {receiptData.invoiceNumber}</p>
        </div>
        <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
        <div>
          <p style={{ margin: '2px 0', fontSize: 11 }}>Customer: {receiptData.customer}</p>
          <p style={{ margin: '2px 0', fontSize: 11 }}>Cashier: {receiptData.cashier}</p>
        </div>
        <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
        <table style={{ width: '100%', borderCollapse: 'collapse', margin: '5px 0' }}>
          <thead>
            <tr>
              <th style={{ width: '40%', fontWeight: 'bold', textAlign: 'left', fontSize: 11 }}>Item</th>
              <th style={{ width: '15%', textAlign: 'center', fontWeight: 'bold', fontSize: 11 }}>Qty</th>
              <th style={{ width: '20%', textAlign: 'right', fontWeight: 'bold', fontSize: 11 }}>Price</th>
              <th style={{ width: '25%', textAlign: 'right', fontWeight: 'bold', fontSize: 11 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {safeItems.map((item, idx) => (
              <tr className="item-row" key={idx}>
                <td className="item-name" style={{ wordWrap: 'break-word', wordBreak: 'break-word', whiteSpace: 'normal', maxWidth: '35mm', paddingRight: 4 }}>{item.name}</td>
                <td style={{ textAlign: 'center', fontSize: 12, padding: '2px 0', verticalAlign: 'top' }}>{item.quantity}</td>
                <td style={{ textAlign: 'right', fontSize: 12, padding: '2px 0', verticalAlign: 'top' }}>{item.price.toFixed(2)}</td>
                <td style={{ textAlign: 'right', fontSize: 12, padding: '2px 0', verticalAlign: 'top' }}>{item.total.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
        <div>
          {receiptData.subtotal > 0 && (
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: 12 }}>
              <span>Items Subtotal:</span>
              <span>Rs. {receiptData.subtotal.toFixed(2)}</span>
            </div>
          )}
          {receiptData.servicesSubtotal > 0 && (
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: 12 }}>
              <span>Services Subtotal:</span>
              <span>Rs. {receiptData.servicesSubtotal.toFixed(2)}</span>
            </div>
          )}
          {receiptData.discount > 0 && (
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: 12 }}>
              <span>Discount:</span>
              <span>-Rs. {receiptData.discount.toFixed(2)}</span>
            </div>
          )}
          {receiptData.tax > 0 && (
            <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: 12 }}>
              <span>Tax:</span>
              <span>Rs. {receiptData.tax.toFixed(2)}</span>
            </div>
          )}
          <div className="summary-row total-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontWeight: 'bold', fontSize: 14, marginTop: 5 }}>
            <span>Total:</span>
            <span>Rs. {receiptData.total.toFixed(2)}</span>
          </div>
          <div className="summary-row" style={{ display: 'flex', justifyContent: 'space-between', margin: '2px 0', fontSize: 12 }}>
            <span>Payment Method:</span>
            <span>{receiptData.paymentMethod.replace('_', ' ').toUpperCase()}</span>
          </div>
        </div>
        <hr style={{ border: 'none', borderTop: '1px dashed #000', margin: '5px 0' }} />
        <div className="text-center" style={{ textAlign: 'center' }}>
          <p style={{ margin: '2px 0' }}>Thank you for your purchase!</p>
          <p style={{ margin: '2px 0' }}>Please visit again</p>
          {shopPhone && <p style={{ margin: '4px 0', fontSize: 11 }}>Contact us: {shopPhone}</p>}
        </div>
        <div className="paper-cut-space" style={{ height: '20mm' }}></div>
      </div>
    </div>
  );
};

export default ReceiptHtml;
