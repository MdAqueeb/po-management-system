

const API_BASE_URL = 'http://localhost:8000';

let globalProducts = [];
let globalVendorsMap = {};
let vendorsLoaded = false;


async function fetchPurchaseOrders() {
    const tbody = document.getElementById('po-table-body');
    if (!tbody) return;

    try {
        if (!vendorsLoaded) {
            try {
                const vRes = await fetch(`${API_BASE_URL}/vendors`);
                if (vRes.ok) {
                    const vendors = await vRes.json();
                    vendors.forEach(v => { globalVendorsMap[v.id] = v.name });
                    vendorsLoaded = true;
                }
            } catch (err) {
                console.error("Failed to load vendors map", err);
            }
        }

        const response = await fetch(`${API_BASE_URL}/purchase-orders`);
        if (!response.ok) {
            throw new Error('Failed to fetch purchase orders');
        }

        const data = await response.json();

        tbody.innerHTML = '';

        if (data.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No purchase orders found.</td></tr>';
            return;
        }

        data.forEach(po => {
            const tr = document.createElement('tr');

            const formattedTotal = po.total_amount != null ? `₹${parseFloat(po.total_amount).toFixed(2)}` : 'N/A';

            const vendorName = po.vendor ? po.vendor.name : (globalVendorsMap[po.vendor_id] || `ID: ${po.vendor_id}`);

            let badgeClass = 'bg-warning text-dark';
            const status = po.status ? po.status.toUpperCase() : 'PENDING';
            if (status === 'APPROVED') badgeClass = 'bg-success';
            else if (status === 'REJECTED') badgeClass = 'bg-danger';
            else if (status === 'COMPLETED') badgeClass = 'bg-primary';

            tr.innerHTML = `
                <td class="ps-4 fw-semibold text-dark">${po.reference_no}</td>
                <td>${vendorName}</td>
                <td class="fw-bold">${formattedTotal}</td>
                <td><span class="badge ${badgeClass} rounded-pill px-3 py-2">${status}</span></td>
                <td class="text-end pe-4">
                    <div class="dropdown d-inline-block">
                        <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown" aria-expanded="false">
                            Update
                        </button>
                        <ul class="dropdown-menu">
                            <li><a class="dropdown-item" href="#" onclick="updatePurchaseOrderStatus(${po.id}, 'APPROVED'); return false;">Approve</a></li>
                            <li><a class="dropdown-item" href="#" onclick="updatePurchaseOrderStatus(${po.id}, 'REJECTED'); return false;">Reject</a></li>
                            <li><a class="dropdown-item" href="#" onclick="updatePurchaseOrderStatus(${po.id}, 'COMPLETED'); return false;">Complete</a></li>
                            <li><a class="dropdown-item" href="#" onclick="updatePurchaseOrderStatus(${po.id}, 'PENDING'); return false;">Pending</a></li>
                        </ul>
                    </div>
                    <button class="btn btn-sm btn-outline-danger ms-1" onclick="deletePurchaseOrder(${po.id})" title="Delete">
                        &times;
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    } catch (error) {
        console.error('Error fetching POs:', error);
        tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger">Error loading data: ${error.message}. Ensure backend is running.</td></tr>`;
    }
}

async function initCreatePO() {
    const form = document.getElementById('create-po-form');
    const addBtn = document.getElementById('add-product-btn');

    if (!form) return; 

    try {
        await Promise.all([
            fetchVendors(),
            fetchProducts()
        ]);
    } catch (err) {
        console.error("Init Error", err);
    }

    addBtn.addEventListener('click', addProductRow);
    form.addEventListener('submit', handleFormSubmit);

    addProductRow();
}

async function fetchVendors() {
    try {
        const response = await fetch(`${API_BASE_URL}/vendors`);
        if (!response.ok) throw new Error('Failed to fetch vendors');

        const vendors = await response.json();
        const vendorSelect = document.getElementById('vendor_id');

        vendors.forEach(vendor => {
            const option = document.createElement('option');
            option.value = vendor.id;
            option.textContent = `${vendor.name} (ID: ${vendor.id})`;
            vendorSelect.appendChild(option);
        });
    } catch (error) {
        console.error('Error fetching vendors:', error);
        showAlert('Failed to load vendors. Please ensure backend is running.', 'danger');
        throw error;
    }
}


async function fetchProducts() {
    try {
        const response = await fetch(`${API_BASE_URL}/products`);
        if (!response.ok) throw new Error('Failed to fetch products');

        globalProducts = await response.json();
    } catch (error) {
        console.error('Error fetching products:', error);
        showAlert('Failed to load products. Please ensure backend is running.', 'danger');
        throw error;
    }
}


function addProductRow() {
    const container = document.getElementById('product-list-container');
    const template = document.getElementById('product-row-template');

    if (!template) return;

    const rowEntry = template.content.cloneNode(true);
    const rowDiv = rowEntry.querySelector('.product-row');
    const productSelect = rowEntry.querySelector('.product-select');
    globalProducts.forEach(product => {
        const option = document.createElement('option');
        option.value = product.id;
        option.dataset.price = product.unit_price;
        option.textContent = `${product.name} - ₹${product.unit_price}`;
        productSelect.appendChild(option);
    });

    const priceInput = rowEntry.querySelector('.price-input');

    productSelect.addEventListener('change', function (e) {
        const selectedOption = e.target.options[e.target.selectedIndex];
        const price = parseFloat(selectedOption.dataset.price) || 0;
        if (price > 0) {
            priceInput.value = price.toFixed(2);
        } else {
            priceInput.value = '0.00';
        }
        calculateTotals();
    });

    const qtyInput = rowEntry.querySelector('.quantity-input');
    if (qtyInput) qtyInput.addEventListener('input', calculateTotals);

    const removeBtn = rowEntry.querySelector('.remove-product-btn');
    removeBtn.addEventListener('click', function () {
        if (document.querySelectorAll('.product-row').length > 1) {
            rowDiv.remove();
            calculateTotals();
        } else {
            alert('A purchase order must have at least one product.');
        }
    });

    container.appendChild(rowEntry);
    calculateTotals();
}
async function handleFormSubmit(e) {
    e.preventDefault();

    const submitBtn = document.getElementById('submit-po-btn');
    const originalBtnText = submitBtn.innerHTML;

    const reference_no = document.getElementById('reference_no').value.trim();
    const vendor_id = parseInt(document.getElementById('vendor_id').value, 10);

    const productRows = document.querySelectorAll('.product-row');
    const items = [];

    let hasError = false;

    productRows.forEach(row => {
        const productId = parseInt(row.querySelector('.product-select').value, 10);
        const quantity = parseInt(row.querySelector('.quantity-input').value, 10) || 0;
        const price = parseFloat(row.querySelector('.price-input').value) || 0;

        if (isNaN(productId) || isNaN(quantity) || isNaN(price)) {
            hasError = true;
        } else {
            items.push({
                product_id: productId,
                quantity: quantity,
                price: price
            });
        }
    });

    if (hasError || items.length === 0) {
        showAlert('Please ensure all product rows are filled completely, and at least one product is added.', 'warning');
        return;
    }

    const payload = {
        reference_no: reference_no,
        vendor_id: vendor_id,
        items: items
    };

    try {
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
        submitBtn.disabled = true;

        const response = await fetch(`${API_BASE_URL}/purchase-orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.detail || 'Failed to create Purchase Order');
        }

        showAlert('Purchase Order created successfully!', 'success');
        

        document.getElementById('create-po-form').reset();
        document.getElementById('product-list-container').innerHTML = '';
        addProductRow();

        setTimeout(() => {
            window.location.href = 'index.html';
        }, 1500);

    } catch (error) {
        console.error('Submission error:', error);
        showAlert(`Error: ${error.message}`, 'danger');
    } finally {
        submitBtn.innerHTML = originalBtnText;
        submitBtn.disabled = false;
    }
}

function showAlert(message, type = 'info') {
    const container = document.getElementById('alert-container');
    if (!container) return;

    container.innerHTML = `
        <div class="alert alert-${type} alert-dismissible fade show shadow-sm" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        </div>
    `;

    if (type === 'success') {
        setTimeout(() => {
            const alertNode = document.querySelector('.alert');
            if (alertNode) {
                const bsAlert = new bootstrap.Alert(alertNode);
                bsAlert.close();
            }
        }, 5000);
    }
}

async function deletePurchaseOrder(id) {
    if (!confirm('Are you sure you want to delete this purchase order?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}`, {
            method: 'DELETE'
        });

        if (!response.ok) throw new Error('Failed to delete purchase order');

        showAlert('Purchase Order deleted successfully', 'success');
        fetchPurchaseOrders();
    } catch (error) {
        console.error('Delete error:', error);
        showAlert(`Error deleting: ${error.message}`, 'danger');
    }
}

async function updatePurchaseOrderStatus(id, newStatus) {
    try {
        const response = await fetch(`${API_BASE_URL}/purchase-orders/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
        });

        if (!response.ok) throw new Error('Failed to update status');

        showAlert('Status updated successfully', 'success');
        fetchPurchaseOrders();
    } catch (error) {
        console.error('Update status error:', error);
        showAlert(`Error updating: ${error.message}`, 'danger');
    }
}


function calculateTotals() {
    let subtotal = 0;
    const productRows = document.querySelectorAll('.product-row');
    productRows.forEach(row => {
        const qty = parseInt(row.querySelector('.quantity-input').value, 10) || 0;
        const price = parseFloat(row.querySelector('.price-input').value) || 0;
        subtotal += (qty * price);
    });

    const tax = subtotal * 0.05;
    const total = subtotal + tax;

    const elSubtotal = document.getElementById('summary-subtotal');
    const elTax = document.getElementById('summary-tax');
    const elTotal = document.getElementById('summary-total');

    if (elSubtotal) elSubtotal.textContent = `₹${subtotal.toFixed(2)}`;
    if (elTax) elTax.textContent = `₹${tax.toFixed(2)}`;
    if (elTotal) elTotal.textContent = `₹${total.toFixed(2)}`;
}
