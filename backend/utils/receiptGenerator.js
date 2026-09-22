// Receipt number generator & Receipt formatter utility

const getLocalDateString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const generateReceiptNo = () => {
  const dateStr = getLocalDateString();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `RCP-${dateStr}-${randomNum}`;
};

const generateOrderNo = () => {
  const dateStr = getLocalDateString();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${dateStr}-${randomNum}`;
};

const generateBatchNo = (productCode = 'BAT') => {
  const dateStr = getLocalDateString();
  const randomNum = Math.floor(100 + Math.random() * 900);
  return `B-${dateStr}-${randomNum}`;
};

const formatReceipt = (sale, items, cashier) => {
  return {
    receipt_no: sale.receipt_no,
    date: sale.created_at,
    cashier_name: `${cashier.first_name} ${cashier.last_name}`,
    items: items.map(item => ({
      product_name: item.product_name,
      meat_cut: item.meat_cut,
      weight_kg: Number(item.weight_kg),
      price_per_kg: Number(item.price_per_kg),
      subtotal: Number(item.subtotal)
    })),
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    total_amount: Number(sale.total_amount),
    payment_method: sale.payment_method,
    amount_tendered: Number(sale.amount_tendered),
    change_amount: Number(sale.change_amount)
  };
};

module.exports = {
  generateReceiptNo,
  generateOrderNo,
  generateBatchNo,
  formatReceipt
};
